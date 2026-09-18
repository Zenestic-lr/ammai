import { createFileRoute } from "@tanstack/react-router";

type AskBody = { question?: unknown };

const SYSTEM = `நீ ஒரு பொறுமையான உதவியாளர். பயனர் ஒரு வயதான தமிழ் பெண்; அவர் தமிழ் அல்லது "thanglish" (ஆங்கில எழுத்தில் தமிழ்) இல் கேட்பார்.

விதிகள்:
1. எப்போதும் எளிய, பேச்சு வழக்கு தமிழில் மட்டுமே பதில் சொல். ஆங்கில வார்த்தைகளை தவிர்; தவிர்க்க முடியாத செயலிப் பெயர்களை (Google Pay, WhatsApp) மட்டும் தமிழ் எழுத்தில் எழுது.
2. பதில் மிகச் சிறியதாக இருக்கட்டும். தேவைப்பட்டால் 3 முதல் 6 படிகள், ஒவ்வொன்றும் ஒரு சிறு வரி.
3. கடினமான சொற்கள் வேண்டாம். "settings" போன்றவற்றை "அமைப்புகள்" என்று சொல்.
4. பாதுகாப்பு தேவைப்பட்டால் ஒரு வரியில் எச்சரிக்கை சொல் (உ.ம். பணம் அனுப்பும் முன் எண்ணை சரிபார்க்க).

JSON மட்டும் திருப்பி அனுப்பு, வேறு எதுவும் வேண்டாம்:
{"title":"மிகச் சிறிய தலைப்பு தமிழில்","steps":["படி 1","படி 2"],"spoken":"படிகளை சேர்த்து பேசுவது போல ஒரே பத்தி தமிழில்","videoQuery":"YouTube-ல் தேட தமிழ் தேடல் சொற்கள்"}`;

export const Route = createFileRoute("/api/ask")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { question } = (await request.json()) as AskBody;
        if (typeof question !== "string" || !question.trim()) {
          return new Response(JSON.stringify({ error: "கேள்வி இல்லை" }), { status: 400 });
        }
        const key = process.env["LOVABLE_API_KEY"];
        if (!key) return new Response(JSON.stringify({ error: "Missing key" }), { status: 500 });

        const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${key}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "openai/gpt-6-astra",
            reasoning_effort: "low",
            messages: [
              { role: "system", content: SYSTEM },
              { role: "user", content: question },
            ],
            response_format: { type: "json_object" },
          }),
        });

        if (!res.ok) {
          const text = await res.text().catch(() => "");
          return new Response(
            JSON.stringify({
              error:
                res.status === 429
                  ? "கொஞ்சம் பொறுத்து மறுபடியும் கேளுங்க."
                  : res.status === 402
                    ? "AI கிரெடிட் தீர்ந்துவிட்டது."
                    : "பதில் கிடைக்கவில்லை. மறுபடியும் முயற்சி செய்யுங்க.",
              detail: text.slice(0, 500),
            }),
            { status: res.status, headers: { "Content-Type": "application/json" } },
          );
        }

        const data = (await res.json()) as {
          choices?: Array<{ message?: { content?: string } }>;
        };
        const raw = data.choices?.[0]?.message?.content ?? "";
        let parsed: {
          title?: string;
          steps?: string[];
          spoken?: string;
          videoQuery?: string;
        } = {};
        try {
          parsed = JSON.parse(raw);
        } catch {
          parsed = { title: "பதில்", steps: [raw], spoken: raw, videoQuery: question };
        }

        const steps = Array.isArray(parsed.steps) ? parsed.steps.filter(Boolean) : [];
        return new Response(
          JSON.stringify({
            title: parsed.title || "பதில்",
            steps,
            spoken: parsed.spoken || steps.join(". "),
            videoQuery: parsed.videoQuery || question,
          }),
          { headers: { "Content-Type": "application/json" } },
        );
      },
    },
  },
});
