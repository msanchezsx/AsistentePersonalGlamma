"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getViewer } from "@/lib/session";
import { parseTaskForm, toDueFields, type TaskFormValues } from "@/lib/tasks/model";
import { parseReminderMinutes } from "@/lib/reminders";
import { syncReminder } from "@/lib/reminders-server";
import { zonedToUtc } from "@/lib/zoned-time";

export type TaskFormState = {
  ok: boolean;
  message?: string;
  fieldErrors?: Record<string, string>;
} | null;

const idSchema = z.string().uuid();

/** Momento de referencia del recordatorio: la hora límite, o las 9:00 si es de todo el día. */
function reminderTarget(v: TaskFormValues, due: { due_at: string | null; due_all_day: boolean }, tz: string) {
  if (!due.due_at || !v.due_date) return null;
  return due.due_all_day ? zonedToUtc(v.due_date, "09:00", tz).toISOString() : due.due_at;
}

function revalidateTaskViews() {
  revalidatePath("/tareas");
  revalidatePath("/");
}

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return { supabase, user };
}

function fieldErrorsFrom(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    out[key] ??= issue.message;
  }
  return out;
}

export async function createTask(_prev: TaskFormState, formData: FormData): Promise<TaskFormState> {
  const parsed = parseTaskForm(formData);
  if (!parsed.success) return { ok: false, fieldErrors: fieldErrorsFrom(parsed.error) };

  const { supabase, user } = await requireUser();
  const viewer = await getViewer();
  const v = parsed.data;
  const due = toDueFields(v, viewer.timezone);
  const { data, error } = await supabase
    .from("tasks")
    .insert({
      user_id: user.id,
      title: v.title,
      description: v.description,
      priority: v.priority,
      is_urgent: v.is_urgent,
      is_important: v.is_important,
      project_id: v.project_id,
      client_id: v.client_id,
      source: "manual",
      ...due,
    })
    .select("id")
    .single();
  if (error || !data) return { ok: false, message: "No se pudo guardar la tarea. Intenta de nuevo." };

  const reminder = parseReminderMinutes(formData.get("reminder"));
  const r = await syncReminder(
    supabase,
    user.id,
    { kind: "task", id: data.id },
    reminderTarget(v, due, viewer.timezone),
    reminder,
    v.title,
  );

  revalidateTaskViews();
  redirect(r.ok ? "/tareas?creada=1" : `/tareas/${data.id}?aviso=recordatorio`);
}

export async function updateTask(_prev: TaskFormState, formData: FormData): Promise<TaskFormState> {
  const id = idSchema.safeParse(formData.get("id"));
  if (!id.success) return { ok: false, message: "Tarea inválida." };
  const parsed = parseTaskForm(formData);
  if (!parsed.success) return { ok: false, fieldErrors: fieldErrorsFrom(parsed.error) };

  const { supabase, user } = await requireUser();
  const viewer = await getViewer();
  const v = parsed.data;
  const due = toDueFields(v, viewer.timezone);
  const { error, count } = await supabase
    .from("tasks")
    .update(
      {
        title: v.title,
        description: v.description,
        priority: v.priority,
        is_urgent: v.is_urgent,
        is_important: v.is_important,
        project_id: v.project_id,
        client_id: v.client_id,
        ...due,
      },
      { count: "exact" },
    )
    .eq("id", id.data);
  if (error || count === 0) return { ok: false, message: "No se pudo actualizar la tarea." };

  const r = await syncReminder(
    supabase,
    user.id,
    { kind: "task", id: id.data },
    reminderTarget(v, due, viewer.timezone),
    parseReminderMinutes(formData.get("reminder")),
    v.title,
  );
  if (!r.ok) return { ok: false, message: "Se guardó la tarea, pero no el recordatorio. Intenta de nuevo." };

  revalidateTaskViews();
  redirect("/tareas?actualizada=1");
}

const statusActionSchema = z.object({
  id: z.string().uuid(),
  action: z.enum(["complete", "reopen", "start", "wait", "cancel"]),
});

/**
 * Cambia el estado de una tarea. Solo se marca como terminada por una acción
 * explícita del usuario (completion_confirmed = true).
 */
export async function changeTaskStatus(formData: FormData): Promise<void> {
  const parsed = statusActionSchema.safeParse({ id: formData.get("id"), action: formData.get("action") });
  if (!parsed.success) return;
  const { supabase } = await requireUser();
  const now = new Date().toISOString();

  const patch =
    parsed.data.action === "complete"
      ? { status: "done", completed_at: now, completion_confirmed: true }
      : parsed.data.action === "cancel"
        ? { status: "cancelled", completed_at: null, completion_confirmed: false }
        : {
            status:
              parsed.data.action === "start" ? "in_progress" : parsed.data.action === "wait" ? "waiting" : "pending",
            completed_at: null,
            completion_confirmed: false,
          };

  await supabase.from("tasks").update(patch).eq("id", parsed.data.id);
  // Una tarea cerrada no debe seguir avisando.
  if (parsed.data.action === "complete" || parsed.data.action === "cancel") {
    await supabase
      .from("reminders")
      .update({ status: "cancelled" })
      .eq("task_id", parsed.data.id)
      .eq("status", "scheduled");
  }
  revalidateTaskViews();
}

export async function deleteTask(formData: FormData): Promise<void> {
  const id = idSchema.safeParse(formData.get("id"));
  if (!id.success) return;
  const { supabase } = await requireUser();
  await supabase.from("tasks").delete().eq("id", id.data);
  revalidateTaskViews();
  redirect("/tareas?eliminada=1");
}
