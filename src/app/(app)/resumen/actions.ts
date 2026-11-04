"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getViewer } from "@/lib/session";
import { addDaysKey, localDateKey, localTimeKey, zonedToUtc } from "@/lib/zoned-time";

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return supabase;
}

/** "Listo" en un aviso de recordatorio: deja de mostrarse. */
export async function dismissReminder(formData: FormData): Promise<void> {
  const id = z.string().uuid().safeParse(formData.get("id"));
  if (!id.success) return;
  const supabase = await requireUser();
  await supabase.from("reminders").update({ status: "dismissed" }).eq("id", id.data).eq("status", "scheduled");
  revalidatePath("/", "layout");
}

/**
 * Cierre del día: pasa a mañana las tareas abiertas que vencían hoy, a la
 * misma hora local. Sus recordatorios pendientes se recorren igual.
 * Solo se ejecuta cuando el usuario toca el botón (con confirmación).
 */
export async function moveTodayToTomorrow(): Promise<void> {
  const supabase = await requireUser();
  const viewer = await getViewer();
  const tz = viewer.timezone;
  const today = localDateKey(new Date(), tz);
  const tomorrow = addDaysKey(today, 1);
  const from = zonedToUtc(today, "00:00", tz).toISOString();
  const to = zonedToUtc(tomorrow, "00:00", tz).toISOString();

  const { data } = await supabase
    .from("tasks")
    .select("id, due_at, updated_at")
    .in("status", ["pending", "in_progress", "waiting"])
    .gte("due_at", from)
    .lt("due_at", to)
    .limit(200);
  const tasks = (data as { id: string; due_at: string; updated_at: string }[] | null) ?? [];

  let moved = 0;
  for (const t of tasks) {
    const time = localTimeKey(new Date(t.due_at), tz);
    const next = zonedToUtc(tomorrow, time, tz);
    const shift = next.getTime() - new Date(t.due_at).getTime();
    const { error, count } = await supabase
      .from("tasks")
      .update({ due_at: next.toISOString() }, { count: "exact" })
      .eq("id", t.id)
      .eq("updated_at", t.updated_at);
    if (error || !count) continue;
    moved++;
    const { data: rem } = await supabase
      .from("reminders")
      .select("id, remind_at")
      .eq("task_id", t.id)
      .eq("status", "scheduled");
    for (const r of (rem as { id: string; remind_at: string }[] | null) ?? []) {
      await supabase
        .from("reminders")
        .update({ remind_at: new Date(new Date(r.remind_at).getTime() + shift).toISOString() })
        .eq("id", r.id);
    }
  }
  revalidatePath("/", "layout");
  redirect(`/resumen?tipo=cierre&movidas=${moved}`);
}
