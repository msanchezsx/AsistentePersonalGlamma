"use client";

import { useActionState } from "react";
import { requestMagicLink, type LoginState } from "./actions";

export function LoginForm({ disabled }: { disabled: boolean }) {
  const [state, action, pending] = useActionState<LoginState, FormData>(requestMagicLink, null);

  if (state?.ok) {
    return (
      <p role="status" className="rounded-lg bg-ok-soft px-3 py-3 text-sm text-ok">
        {state.message}
      </p>
    );
  }

  return (
    <form action={action} className="space-y-4">
      <div>
        <label htmlFor="email" className="mb-1.5 block text-sm font-medium">
          Correo electrónico
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          inputMode="email"
          disabled={disabled || pending}
          className="w-full rounded-xl border border-border bg-bg px-3.5 py-3 text-base outline-none focus:border-accent focus:ring-2 focus:ring-accent/30 disabled:opacity-60"
          placeholder="tu.correo@empresa.com"
        />
      </div>
      {state && !state.ok ? (
        <p role="alert" className="text-sm text-danger">
          {state.message}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={disabled || pending}
        className="w-full rounded-xl bg-accent px-4 py-3 text-sm font-semibold text-accent-text disabled:opacity-60"
      >
        {pending ? "Enviando…" : "Enviarme un enlace de acceso"}
      </button>
    </form>
  );
}
