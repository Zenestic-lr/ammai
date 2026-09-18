import { createFileRoute } from "@tanstack/react-router";

type SpeakBody = { text?: unknown };

export const Route = createFileRoute("/api/speak")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { text } = (await request.json()) as SpeakBody;
        if (typeof text !== "string" || !text.trim()) {
          return new Response("No text", { status: 400 });
        }
        const key = process.env["LOVABLE_API_KEY"];
        if (!key) return new Response("Missing key", { status: 500 });

        const res = await fetch("https://ai.gateway.lovable.dev/v1/audio/speech", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${key}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-3.1-flash-tts-preview",
            stream_format: "sse",
            contents: [
              {
                role: "user",
                parts: [
                  {
                    text: `மிக மெதுவாக, அன்பான பாட்டி பேசுவது போல, தெளிவான தமிழில் படித்துக் காட்டு: ${text.slice(0, 2500)}`,
                  },
                ],
              },
            ],
            generationConfig: {
              responseModalities: ["AUDIO"],
              speechConfig: {
                voiceConfig: { prebuiltVoiceConfig: { voiceName: "Kore" } },
              },
            },
          }),
        });

        if (!res.ok || !res.body) {
          const detail = await res.text().catch(() => "");
          return new Response(detail || "TTS failed", { status: res.status || 500 });
        }

        return new Response(res.body, {
          headers: { "Content-Type": "text/event-stream" },
        });
      },
    },
  },
});
