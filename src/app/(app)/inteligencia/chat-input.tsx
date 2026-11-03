"use client";

import { useActionState, useEffect, useRef } from "react";
import { sendMessage, type ChatState } from "./actions";

const SUGGESTIONS = [
  "¿Qué tengo hoy?",
  "¿Qué tareas tengo vencidas?",
  "¿Tengo tiempo libre mañana en la tarde?",
  "Agenda una junta con Ana el viernes a las 10",
];

export function ChatInput({ conversationId, showSuggestions }: { conversationId: string | null; showSuggestions: boolean }) {
  const [state, action, pending] = useActionState<ChatState, FormData>(sendMessage, null);
  const formRef = useRef<HTMLFormElement>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (state?.ok) formRef.current?.reset();
  }, [state]);

  return (
    <div className="space-y-2">
      {showSuggestions ? (
        <div className="flex flex-wrap gap-2">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => {
                if (textRef.current) {
                  textRef.current.value = s;
                  textRef.current.focus();
                }
              }}
              className="rounded-full border border-border bg-surface px-3 py-1.5 text-sm text-muted hover:text-accent"
            >
              {s}
            </button>
          ))}
        </div>
      ) : null}
      <form ref={formRef} action={action} className="flex items-end gap-2">
        <input type="hidden" name="conversationId" value={conversationId ?? ""} />
        <label htmlFor="chat-text" className="sr-only">
          Mensaje
        </label>
        <textarea
          ref={textRef}
          id="chat-text"
          name="text"
          rows={2}
          maxLength={4000}
          required
          placeholder="Pregunta o pide algo…"
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !pending) {
              e.preventDefault();
              formRef.current?.requestSubmit();
            }
          }}
          className="min-w-0 flex-1 resize-none rounded-xl border border-border bg-bg px-3.5 py-3 text-base outline-none focus:border-accent focus:ring-2 focus:ring-accent/30"
        />
        <button
          type="submit"
          disabled={pending}
          className="rounded-xl bg-accent px-4 py-3 text-sm font-semibold text-accent-text disabled:opacity-60"
        >
          {pending ? "Pensando…" : "Enviar"}
        </button>
      </form>
      {pending ? <p className="text-xs text-muted">El asistente está revisando tu información…</p> : null}
      {state && !state.ok && state.message ? (
        <p role="alert" className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">
          {state.message}
        </p>
      ) : null}
    </div>
  );
}
