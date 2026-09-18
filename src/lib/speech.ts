// Client-side helpers: microphone recording to WAV + streamed Tamil speech playback.

export type Recorder = {
  stop: () => Promise<Blob>;
};

function encodeWav(chunks: Float32Array[], inputRate: number, targetRate = 16000): Blob {
  let total = 0;
  for (const c of chunks) total += c.length;
  const merged = new Float32Array(total);
  let offset = 0;
  for (const c of chunks) {
    merged.set(c, offset);
    offset += c.length;
  }

  const ratio = inputRate / targetRate;
  const outLength = Math.floor(merged.length / ratio);
  const samples = new Int16Array(outLength);
  for (let i = 0; i < outLength; i++) {
    const v = merged[Math.floor(i * ratio)] ?? 0;
    const clamped = Math.max(-1, Math.min(1, v));
    samples[i] = clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff;
  }

  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);
  const writeStr = (pos: number, str: string) => {
    for (let i = 0; i < str.length; i++) view.setUint8(pos + i, str.charCodeAt(i));
  };
  writeStr(0, "RIFF");
  view.setUint32(4, 36 + samples.length * 2, true);
  writeStr(8, "WAVE");
  writeStr(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, targetRate, true);
  view.setUint32(28, targetRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeStr(36, "data");
  view.setUint32(40, samples.length * 2, true);
  new Int16Array(buffer, 44).set(samples);
  return new Blob([buffer], { type: "audio/wav" });
}

export async function startRecording(): Promise<Recorder> {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation: true, noiseSuppression: true },
  });
  const ctx = new AudioContext();
  const source = ctx.createMediaStreamSource(stream);
  const node = ctx.createScriptProcessor(4096, 1, 1);
  const chunks: Float32Array[] = [];
  node.onaudioprocess = (e) => chunks.push(new Float32Array(e.inputBuffer.getChannelData(0)));
  source.connect(node);
  node.connect(ctx.destination);

  return {
    stop: async () => {
      stream.getTracks().forEach((t) => t.stop());
      node.disconnect();
      source.disconnect();
      const rate = ctx.sampleRate;
      await ctx.close();
      return encodeWav(chunks, rate);
    },
  };
}

export async function transcribeTamil(blob: Blob): Promise<string> {
  const form = new FormData();
  form.append("audio", blob, "recording.wav");
  const res = await fetch("/api/transcribe", { method: "POST", body: form });
  const data = (await res.json()) as { text?: string; error?: string };
  if (!res.ok) throw new Error(data.error || "கேட்க முடியலை");
  return (data.text || "").trim();
}

let activeCtx: AudioContext | null = null;

export function stopSpeaking() {
  if (activeCtx) {
    activeCtx.close().catch(() => {});
    activeCtx = null;
  }
}

export async function speakTamil(text: string, onEnd?: () => void): Promise<void> {
  stopSpeaking();
  const ctx = new AudioContext({ sampleRate: 24000 });
  activeCtx = ctx;
  if (ctx.state === "suspended") await ctx.resume().catch(() => {});

  let playhead = 0;
  let pending = new Uint8Array(0);
  let lastEnd = 0;

  const playChunk = (incoming: Uint8Array) => {
    const bytes = new Uint8Array(pending.length + incoming.length);
    bytes.set(pending);
    bytes.set(incoming, pending.length);
    const usable = bytes.length - (bytes.length % 2);
    pending = bytes.slice(usable);
    if (usable === 0) return;
    const samples = new Int16Array(bytes.buffer, 0, usable / 2);
    const floats = Float32Array.from(samples, (s) => s / 32768);
    const buffer = ctx.createBuffer(1, floats.length, 24000);
    buffer.copyToChannel(floats, 0);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.connect(ctx.destination);
    playhead = playhead === 0 ? ctx.currentTime + 0.08 : Math.max(playhead, ctx.currentTime);
    src.start(playhead);
    playhead += buffer.duration;
    lastEnd = playhead;
  };

  const res = await fetch("/api/speak", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });
  if (!res.ok || !res.body) {
    stopSpeaking();
    throw new Error("குரல் கிடைக்கவில்லை");
  }

  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
  let buf = "";
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += value;
    const parts = buf.split("\n\n");
    buf = parts.pop() ?? "";
    for (const part of parts) {
      for (const line of part.split("\n")) {
        if (!line.startsWith("data:")) continue;
        const payloadText = line.slice(5).trim();
        if (!payloadText || payloadText === "[DONE]") continue;
        let payload: { type?: string; audio?: string };
        try {
          payload = JSON.parse(payloadText);
        } catch {
          continue;
        }
        if (payload.type !== "speech.audio.delta" || !payload.audio) continue;
        const bin = atob(payload.audio);
        const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        playChunk(bytes);
      }
    }
  }

  if (onEnd) {
    const wait = Math.max(0, (lastEnd - ctx.currentTime) * 1000);
    setTimeout(() => {
      if (activeCtx === ctx) onEnd();
    }, wait + 150);
  }
}
