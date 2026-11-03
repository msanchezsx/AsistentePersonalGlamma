"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getViewer } from "@/lib/session";
import { parseTaskForm, toDueFields, type TaskFormValues } from "@/lib/tasks/model";
import { parseReminderMinutes } from "@/lib/reminders";
import { syncReminder } from "@/lib/reminders-server";
import { CONFLICT_MESSAGE, readVersion } from "@/lib/concurrency";
import { localDateKey, zonedToUtc } from "@/lib/zoned-time";
import { buildRrule, parseRepeatInput, type RepeatInput } from "@/lib/recurrence";
import { createRule, endRule, spawnNextTask, updateRule } from "@/lib/recurrence-server";

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
  revalidatePath("/agenda");
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

/** Valida el formulario completo, incluida la repetición. */
function parseAll(formData: FormData) {
  const parsed = parseTaskForm(formData);
  if (!parsed.success) return { ok: false as const, state: { ok: false, fieldErrors: fieldErrorsFrom(parsed.error) } };
  const repeat = parseRepeatInput(formData, parsed.data.due_date);
  if (!repeat.ok) return { ok: false as const, state: { ok: false, fieldErrors: { [repeat.field]: repeat.message } } };
  return { ok: true as const, v: parsed.data, repeat: repeat.value };
}

function ruleFields(v: TaskFormValues, repeat: RepeatInput, reminder: number | null, tz: string) {
  return {
    rrule: buildRrule(repeat.option, v.due_date!)!,
    timezone: tz,
    starts_on: v.due_date!,
    until_date: repeat.untilKey,
    reminder_minutes: reminder,
  };
}

export async function createTask(_prev: TaskFormState, formData: FormData): Promise<TaskFormState> {
  const p = parseAll(formData);
  if (!p.ok) return p.state;

  const { supabase, user } = await requireUser();
  const viewer = await getViewer();
  const { v, repeat } = p;
  const due = toDueFields(v, viewer.timezone);
  const reminder = parseReminderMinutes(formData.get("reminder"));

  let recurrence_rule_id: string | null = null;
  if (repeat.option) {
    recurrence_rule_id = await createRule(supabase, user.id, {
      applies_to: "task",
      ...ruleFields(v, repeat, reminder, viewer.timezone),
    });
    if (!recurrence_rule_id) return { ok: false, message: "No se pudo guardar la repetición. Intenta de nuevo." };
  }

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
      recurrence_rule_id,
      ...due,
    })
    .select("id")
    .single();
  if (error || !data) return { ok: false, message: "No se pudo guardar la tarea. Intenta de nuevo." };

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
  const p = parseAll(formData);
  if (!p.ok) return p.state;

  const { supabase, user } = await requireUser();
  const viewer = await getViewer();
  const { v, repeat } = p;
  const due = toDueFields(v, viewer.timezone);
  const reminder = parseReminderMinutes(formData.get("reminder"));

  const current = await supabase
    .from("tasks")
    .select("recurrence_rule_id, updated_at")
    .eq("id", id.data)
    .maybeSingle();
  if (current.error || !current.data) return { ok: false, message: "No se pudo actualizar la tarea." };
  const version = readVersion(formData);
  if (version && Date.parse((current.data as { updated_at: string }).updated_at) !== Date.parse(version)) {
    return { ok: false, message: CONFLICT_MESSAGE };
  }
  let recurrence_rule_id = (current.data as { recurrence_rule_id: string | null }).recurrence_rule_id;
  if (repeat.option) {
    const fields = ruleFields(v, repeat, reminder, viewer.timezone);
    if (recurrence_rule_id) {
      if (!(await updateRule(supabase, recurrence_rule_id, fields)))
        return { ok: false, message: "No se pudo guardar la repetición." };
    } else {
      recurrence_rule_id = await createRule(supabase, user.id, { applies_to: "task", ...fields });
      if (!recurrence_rule_id) return { ok: false, message: "No se pudo guardar la repetición." };
    }
  } else {
    recurrence_rule_id = null; // "No se repite": la tarea deja la serie.
  }

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
        recurrence_rule_id,
        ...due,
      },
      { count: "exact" },
    )
    .eq("id", id.data)
    .eq("updated_at", (current.data as { updated_at: string }).updated_at);
  if (error) return { ok: false, message: "No se pudo actualizar la tarea." };
  if (count === 0) return { ok: false, message: CONFLICT_MESSAGE };

  const r = await syncReminder(
    supabase,
    user.id,
    { kind: "task", id: id.data },
    reminderTarget(v, due, viewer.timezone),
    reminder,
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
  const { supabase, user } = await requireUser();
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

    // Si la tarea se repite, crear la siguiente repetición.
    const { data: task } = await supabase
      .from("tasks")
      .select(
        "id, title, description, priority, is_urgent, is_important, due_at, due_all_day, project_id, client_id, recurrence_rule_id",
      )
      .eq("id", parsed.data.id)
      .maybeSingle();
    if (task) await spawnNextTask(supabase, user.id, task as Parameters<typeof spawnNextTask>[2]);
  }
  revalidateTaskViews();
}

/** Deja de repetir: esta tarea sale de la serie y no se crearán más. */
export async function stopTaskRepeat(formData: FormData): Promise<void> {
  const id = idSchema.safeParse(formData.get("id"));
  if (!id.success) return;
  const { supabase } = await requireUser();
  const viewer = await getViewer();
  const { data } = await supabase.from("tasks").select("due_at, recurrence_rule_id").eq("id", id.data).maybeSingle();
  const t = data as { due_at: string | null; recurrence_rule_id: string | null } | null;
  if (!t?.recurrence_rule_id) return;
  const lastKey = t.due_at ? localDateKey(new Date(t.due_at), viewer.timezone) : localDateKey(new Date(), viewer.timezone);
  await endRule(supabase, t.recurrence_rule_id, lastKey);
  await supabase.from("tasks").update({ recurrence_rule_id: null }).eq("id", id.data);
  revalidateTaskViews();
  redirect(`/tareas/${id.data}?aviso=sin-repeticion`);
}

export async function deleteTask(formData: FormData): Promise<void> {
  const id = idSchema.safeParse(formData.get("id"));
  if (!id.success) return;
  const { supabase } = await requireUser();
  await supabase.from("tasks").delete().eq("id", id.data);
  revalidateTaskViews();
  redirect("/tareas?eliminada=1");
}
