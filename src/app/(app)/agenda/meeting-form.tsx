"use client";

import Link from "next/link";
import { useActionState } from "react";
import { REMINDER_OPTIONS } from "@/lib/reminders";
import { RepeatFields } from "@/components/repeat-fields";
import type { RepeatOption } from "@/lib/recurrence";
import type { Option } from "@/lib/tasks/types";
import type { MeetingFormState } from "./actions";

export type MeetingFormDefaults = {
  id?: string;
  /** updated_at al abrir el formulario: detecta cambios hechos en otro dispositivo. */
  version?: string;
  title: string;
  description: string;
  location: string;
  date: string;
  start_time: string;
  end_time: string;
  participants: string;
  project_id: string;
  client_id: string;
  reminder: string;
  is_critical?: boolean;
  repeat?: RepeatOption;
};

const inputCls =
  "w-full rounded-xl border border-border bg-bg px-3.5 py-3 text-base outline-none focus:border-accent focus:ring-2 focus:ring-accent/30";

export function MeetingForm({
  action,
  defaults,
  projects,
  clients,
  submitLabel,
  showRepeat = false,
}: {
  action: (prev: MeetingFormState, formData: FormData) => Promise<MeetingFormState>;
  defaults: MeetingFormDefaults;
  projects: Option[];
  clients: Option[];
  submitLabel: string;
  /** Solo al crear: la repetición de una serie existente se gestiona desde su detalle. */
  showRepeat?: boolean;
}) {
  const [state, formAction, pending] = useActionState<MeetingFormState, FormData>(action, null);
  const err = state?.fieldErrors ?? {};

  return (
    <form action={formAction} className="space-y-5">
      {defaults.id ? <input type="hidden" name="id" value={defaults.id} /> : null}
      {defaults.version ? <input type="hidden" name="version" value={defaults.version} /> : null}

      <Field label="Título" error={err.title} htmlFor="title">
        <input
          id="title"
          name="title"
          required
          maxLength={200}
          defaultValue={defaults.title}
          autoFocus={!defaults.id}
          placeholder="Ej. Revisión del pedido 103050 con mi jefe"
          className={inputCls}
        />
      </Field>

      <div className="grid grid-cols-3 gap-3">
        <Field label="Fecha" error={err.date} htmlFor="date">
          <input id="date" name="date" type="date" required defaultValue={defaults.date} className={inputCls} />
        </Field>
        <Field label="Inicio" error={err.start_time} htmlFor="start_time">
          <input
            id="start_time"
            name="start_time"
            type="time"
            required
            defaultValue={defaults.start_time}
            className={inputCls}
          />
        </Field>
        <Field label="Fin" error={err.end_time} htmlFor="end_time">
          <input id="end_time" name="end_time" type="time" defaultValue={defaults.end_time} className={inputCls} />
        </Field>
      </div>
      <p className="-mt-3 text-xs text-muted">Si no indicas la hora de fin, la reunión dura 1 hora.</p>

      {showRepeat ? (
        <RepeatFields
          defaultRepeat={defaults.repeat ?? ""}
          defaultUntil=""
          errors={err}
          hint="Se agendan automáticamente las repeticiones de los próximos 60 días y se van agregando más."
        />
      ) : null}

      <Field label="Recordatorio" error={err.reminder} htmlFor="reminder">
        <select id="reminder" name="reminder" defaultValue={defaults.reminder} className={inputCls}>
          {REMINDER_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </Field>

      <label className="flex items-start gap-3 rounded-xl border border-border px-3.5 py-3">
        <input type="checkbox" name="is_critical" defaultChecked={defaults.is_critical} className="mt-1 size-5 accent-[var(--danger)]" />
        <span className="text-sm">
          <span className="font-medium">Reunión crítica</span>
          <span className="block text-muted">Te avisa a pantalla completa y pide que confirmes.</span>
        </span>
      </label>

      <Field label="Participantes (opcional)" error={err.participants} htmlFor="participants">
        <input
          id="participants"
          name="participants"
          defaultValue={defaults.participants}
          placeholder="Separados por coma. Ej. Mi jefe, Ana López"
          className={inputCls}
        />
      </Field>

      <Field label="Lugar o enlace (opcional)" error={err.location} htmlFor="location">
        <input id="location" name="location" maxLength={300} defaultValue={defaults.location} className={inputCls} />
      </Field>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Proyecto (opcional)" error={err.project_id} htmlFor="project_id">
          <select id="project_id" name="project_id" defaultValue={defaults.project_id} className={inputCls}>
            <option value="">Sin proyecto</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Cliente (opcional)" error={err.client_id} htmlFor="client_id">
          <select id="client_id" name="client_id" defaultValue={defaults.client_id} className={inputCls}>
            <option value="">Sin cliente</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <Field label="Notas (opcional)" error={err.description} htmlFor="description">
        <textarea
          id="description"
          name="description"
          rows={3}
          maxLength={4000}
          defaultValue={defaults.description}
          className={inputCls}
        />
      </Field>

      <p className="text-xs text-muted">La reunión se guarda solo en tu agenda. No se envían invitaciones a nadie.</p>

      {state?.message ? (
        <p role="alert" className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">
          {state.message}
        </p>
      ) : null}

      <div className="flex gap-3">
        <Link
          href="/agenda"
          className="flex-1 rounded-xl border border-border bg-surface px-4 py-3 text-center text-sm font-medium"
        >
          Cancelar
        </Link>
        <button
          type="submit"
          disabled={pending}
          className="flex-1 rounded-xl bg-accent px-4 py-3 text-sm font-semibold text-accent-text disabled:opacity-60"
        >
          {pending ? "Guardando…" : submitLabel}
        </button>
      </div>
    </form>
  );
}

function Field({
  label,
  error,
  htmlFor,
  children,
}: {
  label: string;
  error?: string;
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-1.5 block text-sm font-medium">
        {label}
      </label>
      {children}
      {error ? <p className="mt-1 text-xs text-danger">{error}</p> : null}
    </div>
  );
}
