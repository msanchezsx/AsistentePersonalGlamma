"use client";

import { useEffect, useRef, useState } from "react";

const RATES = [0.9, 1, 1.15, 1.3];

/** Elige la mejor voz en español disponible en el equipo (es-MX primero). */
function pickVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  const es = voices.filter((v) => v.lang.toLowerCase().startsWith("es"));
  return (
    es.find((v) => v.lang.toLowerCase() === "es-mx") ??
    es.find((v) => v.lang.toLowerCase() === "es-us") ??
    es.find((v) => v.lang.toLowerCase().startsWith("es-4")) ??
    es[0] ??
    null
  );
}

/**
 * Reproductor del podcast con la voz del propio equipo (Web Speech API,
 * síntesis local: sin servicios externos ni costo). Lee párrafo por párrafo.
 */
export function PodcastPlayer({ paragraphs }: { paragraphs: string[] }) {
  const [supported, setSupported] = useState(true);
  const [voice, setVoice] = useState<SpeechSynthesisVoice | null>(null);
  const [state, setState] = useState<"idle" | "playing" | "paused">("idle");
  const [index, setIndex] = useState(0);
  const [rate, setRate] = useState(1);
  const runId = useRef(0);

  useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      setSupported(false);
      return;
    }
    const load = () => setVoice(pickVoice(window.speechSynthesis.getVoices()));
    load();
    window.speechSynthesis.addEventListener("voiceschanged", load);
    return () => {
      window.speechSynthesis.removeEventListener("voiceschanged", load);
      window.speechSynthesis.cancel();
    };
  }, []);

  const speakFrom = (start: number) => {
    const synth = window.speechSynthesis;
    synth.cancel();
    const id = ++runId.current;
    const next = (i: number) => {
      if (id !== runId.current) return;
      if (i >= paragraphs.length) {
        setState("idle");
        setIndex(0);
        return;
      }
      setIndex(i);
      const u = new SpeechSynthesisUtterance(paragraphs[i]);
      u.lang = voice?.lang ?? "es-MX";
      if (voice) u.voice = voice;
      u.rate = rate;
      u.onend = () => next(i + 1);
      u.onerror = (e) => {
        if (e.error !== "interrupted" && e.error !== "canceled") next(i + 1);
      };
      synth.speak(u);
    };
    setState("playing");
    next(start);
  };

  const pause = () => {
    window.speechSynthesis.pause();
    setState("paused");
  };
  const resume = () => {
    window.speechSynthesis.resume();
    setState("playing");
  };
  const stop = () => {
    runId.current++;
    window.speechSynthesis.cancel();
    setState("idle");
    setIndex(0);
  };

  if (!supported)
    return <p className="text-sm text-muted">Este navegador no puede leer en voz alta. Puedes leer el guion abajo.</p>;

  const btn = "rounded-xl px-5 py-3 text-sm font-semibold";
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {state === "idle" ? (
          <button type="button" onClick={() => speakFrom(0)} className={`${btn} bg-accent text-accent-text`}>
            ▶ Reproducir
          </button>
        ) : state === "playing" ? (
          <button type="button" onClick={pause} className={`${btn} bg-accent text-accent-text`}>
            ❚❚ Pausa
          </button>
        ) : (
          <button type="button" onClick={resume} className={`${btn} bg-accent text-accent-text`}>
            ▶ Continuar
          </button>
        )}
        {state !== "idle" ? (
          <>
            <button
              type="button"
              onClick={() => speakFrom(Math.max(0, index - 1))}
              className={`${btn} border border-border`}
              aria-label="Párrafo anterior"
            >
              ⏮
            </button>
            <button
              type="button"
              onClick={() => speakFrom(Math.min(paragraphs.length - 1, index + 1))}
              className={`${btn} border border-border`}
              aria-label="Párrafo siguiente"
            >
              ⏭
            </button>
            <button type="button" onClick={stop} className={`${btn} border border-border`}>
              ■ Detener
            </button>
          </>
        ) : null}
        <label className="ml-auto flex items-center gap-2 text-sm text-muted">
          Velocidad
          <select
            value={rate}
            onChange={(e) => setRate(Number(e.target.value))}
            disabled={state !== "idle"}
            className="rounded-lg border border-border bg-bg px-2 py-1.5"
          >
            {RATES.map((r) => (
              <option key={r} value={r}>
                {r}×
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-surface-2">
        <div
          className="h-full bg-accent transition-all"
          style={{ width: `${state === "idle" ? 0 : ((index + 1) / paragraphs.length) * 100}%` }}
        />
      </div>
      {!voice ? (
        <p className="text-xs text-muted">
          No encontré una voz en español; se usará la voz predeterminada. En Android puedes instalarla en Ajustes →
          Administración general → Texto a voz.
        </p>
      ) : (
        <p className="text-xs text-muted">Voz: {voice.name}</p>
      )}
      <ol className="space-y-3">
        {paragraphs.map((p, i) => (
          <li
            key={i}
            className={`rounded-xl px-4 py-3 text-sm leading-relaxed ${state !== "idle" && i === index ? "bg-accent-soft" : "bg-surface-2"}`}
          >
            {p}
          </li>
        ))}
      </ol>
    </div>
  );
}
