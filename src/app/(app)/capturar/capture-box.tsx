"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/icon";
import { captureFormHref, describeCapture, parseCapture } from "@/lib/capture";

const EXAMPLES = [
  "Junta con Ana mañana a las 10 por 30 minutos",
  "Recuérdame enviar la cotización el viernes urgente",
  "Revisar inventario todos los lunes a las 9",
];

/**
 * Captura por texto. Para voz se usa el micrófono del teclado del equipo
 * (decisión del usuario 2026-11-03: el dictado de Chrome no devuelve texto
 * en su tablet). La frase se interpreta en el dispositivo.
 */
export function CaptureBox({ todayKey }: { todayKey: string }) {
  const router = useRouter();
  const [text, setText] = useState("");
  const parsed = useMemo(() => (text.trim() ? parseCapture(text, todayKey) : null), [text, todayKey]);

  function review(e: React.FormEvent) {
    e.preventDefault();
    if (!parsed || !parsed.title) return;
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
          <p className="flex items-center gap-2 text-sm text-muted">
            <span className="grid size-8 shrink-0 place-items-center rounded-full bg-accent-soft text-accent">
              <Icon name="mic" className="size-4" />
            </span>
            Para dictar, usa el micrófono de tu teclado.
          </p>
          {text ? (
            <button type="button" onClick={() => setText("")} className="ml-auto text-sm text-muted">
              Borrar
            </button>
          ) : null}
        </div>
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
        La frase se interpreta en tu dispositivo y no se guarda nada hasta que confirmes en el formulario.
      </p>
    </form>
  );
}
