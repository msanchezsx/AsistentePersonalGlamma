"use client";

import { useActionState } from "react";
import { updatePreferredName, type NameActionState } from "./actions";

export function NameForm({ defaultName }: { defaultName: string }) {
  const [state, action, pending] = useActionState<NameActionState, FormData>(updatePreferredName, null);
  return (
    <form action={action} className="space-y-2">
      <label htmlFor="preferred_name" className="block text-sm text-muted">
        ¿Cómo te saludo?
      </label>
      <div className="flex gap-2">
        <input
          id="preferred_name"
          name="preferred_name"
          maxLength={60}
          defaultValue={defaultName}
          placeholder="Ej. Dina"
          className="min-w-0 flex-1 rounded-xl border border-border bg-bg px-3.5 py-2.5 text-base outline-none focus:border-accent focus:ring-2 focus:ring-accent/30"
        />
        <button
          type="submit"
          disabled={pending}
          className="rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-accent-text disabled:opacity-60"
        >
          {pending ? "Guardando…" : "Guardar"}
        </button>
      </div>
      {state ? (
        <p role={state.ok ? "status" : "alert"} className={`text-xs ${state.ok ? "text-ok" : "text-danger"}`}>
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
