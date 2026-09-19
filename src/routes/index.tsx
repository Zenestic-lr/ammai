import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import {
  Bell,
  Check,
  Loader2,
  Mic,
  Play,
  Plus,
  Send,
  Square,
  Trash2,
  Youtube,
} from "lucide-react";
import {
  loadHistory,
  loadReminders,
  newId,
  saveHistory,
  saveReminders,
  youtubeSearchUrl,
  type Answer,
  type HistoryItem,
  type Reminder,
} from "@/lib/store";
import { speakTamil, startRecording, stopSpeaking, transcribeTamil, type Recorder } from "@/lib/speech";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "அம்மா குரல் உதவி | Amma Voice" },
      {
        name: "description",
        content:
          "தமிழில் கேளுங்க, தமிழ் குரலில் பதில் கிடைக்கும். வீடியோ மற்றும் நினைவூட்டல்களும் உண்டு.",
      },
      { property: "og:title", content: "அம்மா குரல் உதவி | Amma Voice" },
      {
        property: "og:description",
        content: "தமிழில் கேளுங்க, தமிழ் குரலில் பதில். நினைவூட்டல்களும் சேர்த்து.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

type Tab = "ask" | "remind";

function Index() {
  const [tab, setTab] = useState<Tab>("ask");
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<Answer | null>(null);
  const [asking, setAsking] = useState(false);
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const recorderRef = useRef<Recorder | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setHistory(loadHistory());
    setReminders(loadReminders());
    // If she started typing before the page finished loading, keep that text.
    const typed = inputRef.current?.value;
    if (typed) setQuestion(typed);
  }, []);

  const updateReminders = (items: Reminder[]) => {
    setReminders(items);
    saveReminders(items);
  };

  async function ask(text: string) {
    const q = text.trim();
    if (!q || asking) return;
    setAsking(true);
    setError("");
    setAnswer(null);
    setStatus("யோசிக்கிறேன்...");
    try {
      const res = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q }),
      });
      const data = (await res.json()) as Answer & { error?: string };
      if (!res.ok) throw new Error(data.error || "பதில் கிடைக்கவில்லை");
      setAnswer(data);
      const item: HistoryItem = { ...data, id: newId(), question: q, at: Date.now() };
      const next = [item, ...history].slice(0, 50);
      setHistory(next);
      saveHistory(next);
      setStatus("");
      void speak(data.spoken);
    } catch (e) {
      setError(e instanceof Error ? e.message : "ஏதோ தவறு. மறுபடியும் முயற்சி செய்யுங்க.");
      setStatus("");
    } finally {
      setAsking(false);
    }
  }

  async function speak(text: string) {
    if (!text) return;
    setSpeaking(true);
    try {
      await speakTamil(text, () => setSpeaking(false));
    } catch {
      setSpeaking(false);
      setError("குரல் வரவில்லை. திரையில் படிக்கவும்.");
    }
  }

  async function toggleMic() {
    stopSpeaking();
    setSpeaking(false);
    if (listening) {
      const rec = recorderRef.current;
      recorderRef.current = null;
      setListening(false);
      if (!rec) return;
      setStatus("கேட்டதை புரிஞ்சிக்கிறேன்...");
      try {
        const blob = await rec.stop();
        const text = await transcribeTamil(blob);
        if (!text) {
          setStatus("");
          setError("ஒன்றும் கேட்கவில்லை. மறுபடியும் பேசுங்க.");
          return;
        }
        setQuestion(text);
        await ask(text);
      } catch (e) {
        setStatus("");
        setError(e instanceof Error ? e.message : "கேட்க முடியலை.");
      }
      return;
    }
    setError("");
    try {
      recorderRef.current = await startRecording();
      setListening(true);
      setStatus("பேசுங்க... முடிஞ்சதும் மறுபடியும் அழுத்துங்க");
    } catch {
      setError("மைக் அனுமதி தேவை. அனுமதி கொடுங்க.");
    }
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col bg-background px-5 pb-28 pt-8">
      <header className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">வணக்கம் அம்மா 🙏</p>
          <h1 className="mt-1 text-2xl font-bold leading-tight">
            என்ன உதவி
            <br />
            வேணும்?
          </h1>
        </div>
        <span className="rounded-full bg-primary px-4 py-1.5 text-sm font-semibold text-primary-foreground">
          தமிழ் உதவி
        </span>
      </header>

      {tab === "ask" ? (
        <section className="mt-7 flex flex-1 flex-col">
          <div className="flex flex-col items-center">
            <div className="relative flex h-44 w-44 items-center justify-center">
              {(listening || speaking) && (
                <span className="pulse-ring absolute inset-0 rounded-full bg-primary" />
              )}
              <button
                type="button"
                onClick={toggleMic}
                disabled={asking}
                aria-label={listening ? "பேசி முடிந்தது" : "பேச தொடங்க"}
                className="glow-ring relative flex h-32 w-32 items-center justify-center rounded-full bg-primary text-primary-foreground transition-transform active:scale-95 disabled:opacity-60"
              >
                {asking ? (
                  <Loader2 className="h-12 w-12 animate-spin" />
                ) : listening ? (
                  <Square className="h-11 w-11" />
                ) : (
                  <Mic className="h-14 w-14" />
                )}
              </button>
            </div>
            <p className="mt-4 text-center text-lg font-semibold">
              {listening ? "கேட்டுக்கிட்டு இருக்கேன்" : "இங்க அழுத்தி தமிழில் கேளுங்க"}
            </p>
            {status && <p className="mt-1 text-center text-sm text-muted-foreground">{status}</p>}
          </div>

          <form
            className="mt-6 flex items-center gap-2 rounded-2xl bg-card p-2"
            onSubmit={(e) => {
              e.preventDefault();
              const typed = inputRef.current?.value ?? question;
              setQuestion(typed);
              void ask(typed);
            }}
          >
            <input
              ref={inputRef}
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="அல்லது இங்கே எழுதுங்க..."
              className="w-full bg-transparent px-3 py-3 text-base text-foreground outline-none placeholder:text-muted-foreground"
            />
            <button
              type="submit"
              disabled={asking}
              aria-label="கேள்வி அனுப்ப"
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground disabled:opacity-40"
            >
              <Send className="h-5 w-5" />
            </button>
          </form>

          {error && (
            <p className="mt-4 rounded-xl bg-destructive/15 px-4 py-3 text-base text-destructive-foreground">
              {error}
            </p>
          )}

          {answer && (
            <article className="mt-6 rounded-3xl bg-card p-5">
              <h2 className="text-xl font-bold">{answer.title}</h2>
              <ol className="mt-4 space-y-3">
                {answer.steps.map((step, i) => (
                  <li key={i} className="flex gap-3 text-lg leading-relaxed">
                    <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
                      {i + 1}
                    </span>
                    <span>{step}</span>
                  </li>
                ))}
              </ol>

              <div className="mt-5 flex flex-col gap-3">
                <button
                  type="button"
                  onClick={() => (speaking ? (stopSpeaking(), setSpeaking(false)) : void speak(answer.spoken))}
                  className="flex items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-4 text-lg font-bold text-primary-foreground active:scale-[0.98]"
                >
                  {speaking ? <Square className="h-5 w-5" /> : <Play className="h-5 w-5" />}
                  {speaking ? "நிறுத்து" : "மறுபடியும் கேட்க"}
                </button>
                <a
                  href={youtubeSearchUrl(answer.videoQuery)}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-center gap-2 rounded-2xl bg-blush px-4 py-4 text-lg font-bold text-blush-foreground"
                >
                  <Youtube className="h-5 w-5" />
                  வீடியோ பார்க்க
                </a>
              </div>
            </article>
          )}

          {history.length > 0 && (
            <section className="mt-8">
              <h3 className="text-base font-semibold text-muted-foreground">முன்பு கேட்டவை</h3>
              <ul className="mt-3 space-y-2">
                {history.slice(0, 6).map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setAnswer(item);
                        setQuestion(item.question);
                        setError("");
                      }}
                      className="w-full rounded-2xl bg-card px-4 py-3 text-left text-base"
                    >
                      {item.question}
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </section>
      ) : (
        <RemindersView reminders={reminders} onChange={updateReminders} onSpeak={speak} />
      )}

      <nav className="fixed inset-x-0 bottom-0 mx-auto flex w-full max-w-md gap-2 bg-background/95 px-5 pb-5 pt-3 backdrop-blur">
        <TabButton active={tab === "ask"} onClick={() => setTab("ask")} icon={<Mic className="h-5 w-5" />}>
          கேள்வி
        </TabButton>
        <TabButton
          active={tab === "remind"}
          onClick={() => setTab("remind")}
          icon={<Bell className="h-5 w-5" />}
        >
          நினைவூட்டல்
        </TabButton>
      </nav>
    </main>
  );
}

function TabButton({
  active,
  onClick,
  icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-1 items-center justify-center gap-2 rounded-2xl px-4 py-4 text-base font-semibold transition-colors ${
        active ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground"
      }`}
    >
      {icon}
      {children}
    </button>
  );
}

function RemindersView({
  reminders,
  onChange,
  onSpeak,
}: {
  reminders: Reminder[];
  onChange: (items: Reminder[]) => void;
  onSpeak: (text: string) => Promise<void>;
}) {
  const [text, setText] = useState("");
  const [time, setTime] = useState("");
  const [listening, setListening] = useState(false);
  const [busy, setBusy] = useState(false);
  const recorderRef = useRef<Recorder | null>(null);

  async function micToText() {
    if (listening) {
      const rec = recorderRef.current;
      recorderRef.current = null;
      setListening(false);
      if (!rec) return;
      setBusy(true);
      try {
        const blob = await rec.stop();
        const said = await transcribeTamil(blob);
        if (said) setText(said);
      } catch {
        /* ignore */
      }
      setBusy(false);
      return;
    }
    try {
      recorderRef.current = await startRecording();
      setListening(true);
    } catch {
      /* mic denied */
    }
  }

  function add() {
    if (!text.trim()) return;
    onChange([
      { id: newId(), text: text.trim(), time: time.trim(), done: false, at: Date.now() },
      ...reminders,
    ]);
    setText("");
    setTime("");
  }

  return (
    <section className="mt-7 flex flex-1 flex-col">
      <h2 className="text-xl font-bold">நினைவூட்டல்</h2>
      <p className="mt-1 text-base text-muted-foreground">மறக்கக் கூடாதவற்றை இங்கே சேர்த்து வைங்க.</p>

      <div className="mt-5 rounded-3xl bg-card p-4">
        <div className="flex items-center gap-2">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="என்ன நினைவூட்டணும்?"
            className="w-full bg-transparent px-2 py-3 text-base outline-none placeholder:text-muted-foreground"
          />
          <button
            type="button"
            onClick={micToText}
            aria-label="பேசி சொல்ல"
            className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${
              listening ? "bg-destructive text-destructive-foreground" : "bg-lilac text-lilac-foreground"
            }`}
          >
            {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : listening ? <Square className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
          </button>
        </div>
        <div className="mt-3 flex items-center gap-2">
          <input
            value={time}
            onChange={(e) => setTime(e.target.value)}
            placeholder="நேரம் (உ.ம். காலை 8 மணி)"
            className="w-full rounded-xl bg-secondary px-3 py-3 text-base outline-none placeholder:text-muted-foreground"
          />
          <button
            type="button"
            onClick={add}
            aria-label="சேர்க்க"
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground"
          >
            <Plus className="h-6 w-6" />
          </button>
        </div>
      </div>

      <ul className="mt-5 space-y-3">
        {reminders.length === 0 && (
          <li className="rounded-2xl bg-card px-4 py-6 text-center text-base text-muted-foreground">
            இப்போதைக்கு எதுவும் இல்லை.
          </li>
        )}
        {reminders.map((r) => (
          <li key={r.id} className="flex items-center gap-3 rounded-2xl bg-card px-4 py-4">
            <button
              type="button"
              aria-label="முடிந்தது"
              onClick={() =>
                onChange(reminders.map((x) => (x.id === r.id ? { ...x, done: !x.done } : x)))
              }
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
                r.done ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"
              }`}
            >
              <Check className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={() => void onSpeak(`${r.text}. ${r.time}`)}
              className="flex-1 text-left"
            >
              <p className={`text-lg ${r.done ? "text-muted-foreground line-through" : ""}`}>{r.text}</p>
              {r.time && <p className="text-sm text-muted-foreground">{r.time}</p>}
            </button>
            <button
              type="button"
              aria-label="நீக்க"
              onClick={() => onChange(reminders.filter((x) => x.id !== r.id))}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-secondary text-muted-foreground"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
