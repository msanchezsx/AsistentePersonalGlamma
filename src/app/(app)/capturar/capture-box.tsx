"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/icon";
import { captureFormHref, describeCapture, parseCapture } from "@/lib/capture";

/* Tipos mínimos de la Web Speech API (no vienen en lib.dom). */
type SpeechResultEvent = { resultIndex: number; results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> };
type Recognition = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((e: SpeechResultEvent) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  start: () => void;
  stop: () => void;
};
type RecognitionCtor = new () => Recognition;

function getRecognition(): RecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

const EXAMPLES = [
  "Junta con Ana mañana a las 10 por 30 minutos",
  "Recuérdame enviar la cotización el viernes urgente",
  "Revisar inventario todos los lunes a las 9",
];

const MIC_ERRORS: Record<string, string> = {
  "not-allowed": "No tengo permiso para usar el micrófono. Actívalo en los permisos del navegador para este sitio.",
  "service-not-allowed": "No tengo permiso para usar el micrófono. Actívalo en los permisos del navegador para este sitio.",
  "no-speech": "No escuché nada. Toca el micrófono e intenta de nuevo.",
  network: "El dictado necesita internet. Revisa tu conexión.",
};

export function CaptureBox({ todayKey }: { todayKey: string }) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [listening, setListening] = useState(false);
  const [micError, setMicError] = useState<string | null>(null);
  const [supported, setSupported] = useState(false);
  const recRef = useRef<Recognition | null>(null);
  const baseRef = useRef("");

  useEffect(() => setSupported(Boolean(getRecognition())), []);
  useEffect(() => () => recRef.current?.stop(), []);

  const parsed = useMemo(() => (text.trim() ? parseCapture(text, todayKey) : null), [text, todayKey]);

  function toggleMic() {
    if (listening) {
      recRef.current?.stop();
      return;
    }
    const Ctor = getRecognition();
    if (!Ctor) return;
    const rec = new Ctor();
    rec.lang = "es-MX";
    rec.interimResults = true;
    rec.continuous = false;
    baseRef.current = text.trim() ? `${text.trim()} ` : "";
    rec.onresult = (e) => {
      let transcript = "";
      for (let i = 0; i < e.results.length; i++) transcript += e.results[i][0].transcript;
      setText(baseRef.current + transcript);
    };
    rec.onerror = (e) => setMicError(MIC_ERRORS[e.error] ?? "No se pudo usar el dictado. Puedes escribir la frase.");
    rec.onend = () => setListening(false);
    setMicError(null);
    recRef.current = rec;
    try {
      rec.start();
      setListening(true);
    } catch {
      setMicError("No se pudo iniciar el micrófono.");
    }
  }

  function review(e: React.FormEvent) {
    e.preventDefault();
    if (!parsed || !parsed.title) return;
    recRef.current?.stop();
    router.push(captureFormHref(parsed));
  }

  return (
    <form onSubmit={review} className="space-y-4">
      <div className="rounded-2xl border border-border bg-surface p-4">
        <label htmlFor="capture" className="sr-only">
          Frase
        </label>
        <textarea
          id="capture"
          rows={3}
          maxLength={500}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Ej. Junta con Ana mañana a las 10"
          autoFocus
          className="w-full resize-none bg-transparent text-lg outline-none"
        />
        <div className="mt-2 flex items-center gap-3">
          {supported ? (
            <button
              type="button"
              onClick={toggleMic}
              aria-pressed={listening}
              className={`flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold ${
                listening ? "animate-pulse bg-danger text-white" : "bg-accent-soft text-accent"
              }`}
            >
              <Icon name="mic" className="size-5" />
              {listening ? "Escuchando… toca para terminar" : "Dictar"}
            </button>
          ) : (
            <p className="text-xs text-muted">
              Este navegador no permite dictar aquí; usa el micrófono del teclado.
            </p>
          )}
          {text ? (
            <button type="button" onClick={() => setText("")} className="ml-auto text-sm text-muted">
              Borrar
            </button>
          ) : null}
        </div>
        {micError ? <p className="mt-2 text-sm text-danger">{micError}</p> : null}
      </div>

      {parsed ? (
        <div className="rounded-2xl border border-border bg-surface p-4">
          <p className="text-sm font-semibold uppercase tracking-wide text-muted">Esto entendí</p>
          <p className="mt-2 text-lg font-medium">{parsed.title || "(sin título)"}</p>
          <ul className="mt-1 flex flex-wrap gap-2">
            {describeCapture(parsed).map((l) => (
              <li key={l} className="rounded-lg bg-bg px-2.5 py-1 text-sm">
                {l}
              </li>
            ))}
          </ul>
          <button
            type="submit"
            disabled={!parsed.title}
            className="mt-4 w-full rounded-xl bg-accent px-4 py-3 text-sm font-semibold text-accent-text disabled:opacity-60"
          >
            Revisar y guardar {parsed.kind === "meeting" ? "reunión" : "tarea"}
          </button>
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-border p-4 text-sm text-muted">
          <p className="mb-2 font-medium text-text">Puedes decir, por ejemplo:</p>
          <ul className="space-y-1.5">
            {EXAMPLES.map((ex) => (
              <li key={ex}>
                <button type="button" onClick={() => setText(ex)} className="text-left hover:text-accent">
                  “{ex}”
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="text-xs text-muted">
        El dictado lo convierte en texto el reconocimiento de voz de Chrome (Google). La frase se interpreta en tu
        dispositivo y no se guarda nada hasta que confirmes en el formulario.
      </p>
    </form>
  );
}
