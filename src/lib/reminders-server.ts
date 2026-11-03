import "server-only";

import type { createClient } from "@/lib/supabase/server";
import { reminderAt } from "@/lib/reminders";

type Target = { kind: "task" | "meeting"; id: string };

/**
 * Deja un único recordatorio programado para la tarea o reunión.
 * - minutes = null o sin fecha → elimina los recordatorios pendientes.
 * - Si la hora del recordatorio ya pasó, no se programa.
 */
export async function syncReminder(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  target: Target,
  targetIso: string | null,
  minutes: number | null,
  title: string,
): Promise<{ ok: boolean }> {
  const column = target.kind === "task" ? "task_id" : "meeting_id";

  const del = await supabase.from("reminders").delete().eq(column, target.id).eq("status", "scheduled");
  if (del.error) return { ok: false };

  if (minutes === null || !targetIso) return { ok: true };
  const at = reminderAt(targetIso, minutes);
  if (new Date(at).getTime() <= Date.now()) return { ok: true };

  const ins = await supabase.from("reminders").insert({
    user_id: userId,
    [column]: target.id,
    title: title.slice(0, 300),
    remind_at: at,
  });
  return { ok: !ins.error };
}

/** Recordatorio programado actual (o null). */
export async function getScheduledReminder(
  supabase: Awaited<ReturnType<typeof createClient>>,
  target: Target,
): Promise<{ remind_at: string } | null> {
  const column = target.kind === "task" ? "task_id" : "meeting_id";
  const { data } = await supabase
    .from("reminders")
    .select("remind_at")
    .eq(column, target.id)
    .eq("status", "scheduled")
    .order("remind_at")
    .limit(1)
    .maybeSingle();
  return (data as { remind_at: string } | null) ?? null;
}
