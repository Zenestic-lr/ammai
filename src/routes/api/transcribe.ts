import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/transcribe")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const key = process.env["LOVABLE_API_KEY"];
        if (!key) return new Response(JSON.stringify({ error: "Missing key" }), { status: 500 });

        const form = await request.formData();
        const audio = form.get("audio");
        if (!(audio instanceof File) || audio.size < 2048) {
          return new Response(
            JSON.stringify({ error: "பேச்சு பதிவாகவில்லை. மறுபடியும் பேசுங்க." }),
            { status: 400, headers: { "Content-Type": "application/json" } },
          );
        }

        const upstream = new FormData();
        upstream.append("model", "google/gemini-3.5-transcribe");
        upstream.append("file", audio, "recording.wav");
        upstream.append("language", "ta");

        const res = await fetch("https://ai.gateway.lovable.dev/v1/audio/transcriptions", {
          method: "POST",
          headers: { Authorization: `Bearer ${key}` },
          body: upstream,
        });

        if (!res.ok) {
          const detail = await res.text().catch(() => "");
          return new Response(
            JSON.stringify({ error: "கேட்க முடியலை. மறுபடியும் பேசுங்க.", detail: detail.slice(0, 300) }),
            { status: res.status, headers: { "Content-Type": "application/json" } },
          );
        }

        const data = (await res.json()) as { text?: string };
        return new Response(JSON.stringify({ text: data.text ?? "" }), {
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});
