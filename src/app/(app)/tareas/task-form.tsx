"use client";

import Link from "next/link";
import { useActionState } from "react";
import type { Option } from "@/lib/tasks/types";
import { PRIORITY_LABELS } from "@/lib/tasks/labels";
import { REMINDER_OPTIONS } from "@/lib/reminders";
import type { RepeatOption } from "@/lib/recurrence";
import { RepeatFields } from "@/components/repeat-fields";
import type { TaskFormState } from "./actions";

export type TaskFormDefaults = {
  id?: string;
  /** updated_at al abrir el formulario: detecta cambios hechos en otro dispositivo. */
  version?: string;
  title: string;
  description: string;
  priority: number;
  is_urgent: boolean;
  is_important: boolean;
  due_date: string;
  due_time: string;
  project_id: string;
  client_id: string;
  reminder: string;
  repeat: RepeatOption;
  repeat_until: string;
};

const inputCls =
  "w-full rounded-xl border border-border bg-bg px-3.5 py-3 text-base outline-none focus:border-accent focus:ring-2 focus:ring-accent/30";

export function TaskForm({
  action,
  defaults,
  projects,
  clients,
  submitLabel,
}: {
  action: (prev: TaskFormState, formData: FormData) => Promise<TaskFormState>;
  defaults: TaskFormDefaults;
  projects: Option[];
  clients: Option[];
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState<TaskFormState, FormData>(action, null);
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
          maxLength={300}
          defaultValue={defaults.title}
          autoFocus={!defaults.id}
          placeholder="Ej. Revisar el pedido 103050 de Abarrotes"
          className={inputCls}
        />
      </Field>

      <Field label="Descripción (opcional)" error={err.description} htmlFor="description">
        <textarea
          id="description"
          name="description"
          rows={3}
          maxLength={4000}
          defaultValue={defaults.description}
          className={inputCls}
        />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Fecha límite" error={err.due_date} htmlFor="due_date">
          <input id="due_date" name="due_date" type="date" defaultValue={defaults.due_date} className={inputCls} />
        </Field>
        <Field label="Hora (opcional)" error={err.due_time} htmlFor="due_time">
          <input id="due_time" name="due_time" type="time" defaultValue={defaults.due_time} className={inputCls} />
        </Field>
      </div>

      <RepeatFields
        defaultRepeat={defaults.repeat}
        defaultUntil={defaults.repeat_until}
        errors={err}
        hint="Al terminar (o cancelar) una tarea que se repite, se crea la siguiente automáticamente."
      />

      <Field label="Recordatorio" error={err.reminder} htmlFor="reminder">
        <select id="reminder" name="reminder" defaultValue={defaults.reminder} className={inputCls}>
          {REMINDER_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <p className="mt-1 text-xs text-muted">
          Se calcula sobre la hora límite (o a las 9:00 si la tarea no tiene hora). Requiere fecha límite.
        </p>
      </Field>

      <Field label="Prioridad" error={err.priority} htmlFor="priority">
        <select id="priority" name="priority" defaultValue={String(defaults.priority)} className={inputCls}>
          {[1, 2, 3, 4, 5].map((p) => (
            <option key={p} value={p}>
              {PRIORITY_LABELS[p]}
            </option>
          ))}
        </select>
      </Field>

      <fieldset className="grid grid-cols-2 gap-3">
        <legend className="sr-only">Clasificación</legend>
        <Toggle name="is_urgent" label="Urgente" hint="Requiere atención pronto" defaultChecked={defaults.is_urgent} />
        <Toggle
          name="is_important"
          label="Importante"
          hint="Impacta tus objetivos"
          defaultChecked={defaults.is_important}
        />
      </fieldset>

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

      {state?.message ? (
        <p role="alert" className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">
          {state.message}
        </p>
      ) : null}

      <div className="flex gap-3">
        <Link
          href="/tareas"
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

function Toggle({
  name,
  label,
  hint,
  defaultChecked,
}: {
  name: string;
  label: string;
  hint: string;
  defaultChecked: boolean;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-border bg-surface p-3 has-[:checked]:border-accent has-[:checked]:bg-accent-soft">
      <input type="checkbox" name={name} defaultChecked={defaultChecked} className="mt-0.5 size-5 accent-accent" />
      <span>
        <span className="block text-sm font-medium">{label}</span>
        <span className="block text-xs text-muted">{hint}</span>
      </span>
    </label>
  );
}
