"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getViewer } from "@/lib/session";
import { parseTaskForm, toDueFields } from "@/lib/tasks/model";

export type TaskFormState = {
  ok: boolean;
  message?: string;
  fieldErrors?: Record<string, string>;
} | null;

const idSchema = z.string().uuid();

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
  const { error } = await supabase.from("tasks").insert({
    user_id: user.id,
    title: v.title,
    description: v.description,
    priority: v.priority,
    is_urgent: v.is_urgent,
    is_important: v.is_important,
    project_id: v.project_id,
    client_id: v.client_id,
    source: "manual",
    ...toDueFields(v, viewer.timezone),
  });
  if (error) return { ok: false, message: "No se pudo guardar la tarea. Intenta de nuevo." };

  revalidateTaskViews();
  redirect("/tareas?creada=1");
}

export async function updateTask(_prev: TaskFormState, formData: FormData): Promise<TaskFormState> {
  const id = idSchema.safeParse(formData.get("id"));
  if (!id.success) return { ok: false, message: "Tarea inválida." };
  const parsed = parseTaskForm(formData);
  if (!parsed.success) return { ok: false, fieldErrors: fieldErrorsFrom(parsed.error) };

  const { supabase } = await requireUser();
  const viewer = await getViewer();
  const v = parsed.data;
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
        ...toDueFields(v, viewer.timezone),
      },
      { count: "exact" },
    )
    .eq("id", id.data);
  if (error || count === 0) return { ok: false, message: "No se pudo actualizar la tarea." };

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
