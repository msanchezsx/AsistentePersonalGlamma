import "server-only";

import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { TASK_SELECT, type Task } from "@/lib/tasks/model";

export type { Option } from "@/lib/tasks/types";
import type { Option } from "@/lib/tasks/types";

/** Tareas abiertas + las cerradas en los últimos 14 días. */
export const listTasks = cache(async (): Promise<{ tasks: Task[]; error: boolean }> => {
  const supabase = await createClient();
  const since = new Date(Date.now() - 14 * 24 * 3600 * 1000).toISOString();
  const { data, error } = await supabase
    .from("tasks")
    .select(TASK_SELECT)
    .or(`status.in.(pending,in_progress,waiting),updated_at.gte."${since}"`)
    .order("due_at", { ascending: true, nullsFirst: false })
    .limit(500);
  return { tasks: (data as unknown as Task[] | null) ?? [], error: Boolean(error) };
});

/** Tareas con fecha límite dentro del rango UTC [from, to). */
export async function listTasksDueInRange(from: string, to: string): Promise<{ tasks: Task[]; error: boolean }> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tasks")
    .select(TASK_SELECT)
    .gte("due_at", from)
    .lt("due_at", to)
    .order("due_at")
    .limit(500);
  return { tasks: (data as unknown as Task[] | null) ?? [], error: Boolean(error) };
}

export async function getTask(id: string): Promise<Task | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("tasks").select(TASK_SELECT).eq("id", id).maybeSingle();
  return (data as unknown as Task | null) ?? null;
}

/** Opciones para relacionar la tarea con un proyecto o cliente existente. */
export async function listRelationOptions(): Promise<{ projects: Option[]; clients: Option[] }> {
  const supabase = await createClient();
  const [p, c] = await Promise.all([
    supabase.from("projects").select("id, name, code").neq("status", "cancelled").order("name").limit(200),
    supabase.from("clients").select("id, name").eq("status", "active").order("name").limit(200),
  ]);
  return {
    projects: ((p.data as { id: string; name: string; code: string | null }[] | null) ?? []).map((x) => ({
      id: x.id,
      label: x.code ? `${x.name} (${x.code})` : x.name,
    })),
    clients: ((c.data as { id: string; name: string }[] | null) ?? []).map((x) => ({ id: x.id, label: x.name })),
  };
}

export async function listContactOptions(): Promise<Option[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("contacts").select("id, full_name, client:clients(name)").order("full_name").limit(300);
  return ((data as unknown as { id: string; full_name: string; client: { name: string } | null }[] | null) ?? []).map((c) => ({
    id: c.id,
    label: c.client ? `${c.full_name} (${c.client.name})` : c.full_name,
  }));
}
