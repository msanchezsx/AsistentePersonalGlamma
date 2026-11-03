import "server-only";

import type { createClient } from "@/lib/supabase/server";
import { occurrencesAfter } from "@/lib/recurrence";
import { reminderAt } from "@/lib/reminders";
import { addDaysKey, localDateKey, localTimeKey, zonedToUtc } from "@/lib/zoned-time";

type Supa = Awaited<ReturnType<typeof createClient>>;

export type RecurrenceRule = {
  id: string;
  rrule: string;
  timezone: string;
  starts_on: string;
  until_date: string | null;
  applies_to: "task" | "meeting";
  reminder_minutes: number | null;
};

const RULE_SELECT = "id, rrule, timezone, starts_on, until_date, applies_to, reminder_minutes";
/** Las reuniones repetidas se generan hasta 60 días adelante; se rellenan al abrir la agenda. */
const MEETING_HORIZON_DAYS = 60;
const MEETING_REFILL_WHEN_DAYS = 30;

export async function createRule(
  supabase: Supa,
  userId: string,
  r: Omit<RecurrenceRule, "id">,
): Promise<string | null> {
  const { data, error } = await supabase
    .from("recurrence_rules")
    .insert({ user_id: userId, ...r })
    .select("id")
    .single();
  return error || !data ? null : data.id;
}

export async function updateRule(
  supabase: Supa,
  id: string,
  r: Partial<Omit<RecurrenceRule, "id" | "applies_to">>,
): Promise<boolean> {
  const { error } = await supabase.from("recurrence_rules").update(r).eq("id", id);
  return !error;
}

export async function getRule(supabase: Supa, id: string | null): Promise<RecurrenceRule | null> {
  if (!id) return null;
  const { data } = await supabase.from("recurrence_rules").select(RULE_SELECT).eq("id", id).maybeSingle();
  return (data as RecurrenceRule | null) ?? null;
}

/** Termina la serie: no habrá repeticiones después de `lastKey`. */
export async function endRule(supabase: Supa, ruleId: string, lastKey: string) {
  const rule = await getRule(supabase, ruleId);
  if (!rule) return;
  const until = lastKey < rule.starts_on ? rule.starts_on : lastKey;
  await supabase.from("recurrence_rules").update({ until_date: until }).eq("id", ruleId);
}

// ---------------------------------------------------------------- Tareas

type TaskForSpawn = {
  id: string;
  title: string;
  description: string | null;
  priority: number;
  is_urgent: boolean;
  is_important: boolean;
  due_at: string | null;
  due_all_day: boolean;
  project_id: string | null;
  client_id: string | null;
  recurrence_rule_id: string | null;
};

/**
 * Al cerrar una tarea repetida se crea la siguiente repetición (una sola
 * abierta a la vez). Devuelve la fecha creada o null.
 */
export async function spawnNextTask(supabase: Supa, userId: string, task: TaskForSpawn): Promise<string | null> {
  if (!task.recurrence_rule_id || !task.due_at) return null;
  const rule = await getRule(supabase, task.recurrence_rule_id);
  if (!rule) return null;
  const tz = rule.timezone;
  const due = new Date(task.due_at);
  const dueKey = localDateKey(due, tz);
  // Nunca crear repeticiones en el pasado: si la tarea estaba atrasada, saltar a hoy.
  const todayKey = localDateKey(new Date(), tz);
  const afterKey = dueKey > addDaysKey(todayKey, -1) ? dueKey : addDaysKey(todayKey, -1);
  const [nextKey] = occurrencesAfter(rule.rrule, rule.starts_on, afterKey, { untilKey: rule.until_date, limit: 1 });
  if (!nextKey) return null;

  const nextDue = task.due_all_day
    ? zonedToUtc(nextKey, "23:59:59", tz).toISOString()
    : zonedToUtc(nextKey, localTimeKey(due, tz), tz).toISOString();

  const existing = await supabase
    .from("tasks")
    .select("id")
    .eq("recurrence_rule_id", rule.id)
    .eq("due_at", nextDue)
    .maybeSingle();
  if (existing.data) return nextKey;

  const { data, error } = await supabase
    .from("tasks")
    .insert({
      user_id: userId,
      title: task.title,
      description: task.description,
      priority: task.priority,
      is_urgent: task.is_urgent,
      is_important: task.is_important,
      project_id: task.project_id,
      client_id: task.client_id,
      recurrence_rule_id: rule.id,
      due_at: nextDue,
      due_all_day: task.due_all_day,
      source: "recurrence",
    })
    .select("id")
    .single();
  if (error || !data) return null;

  if (rule.reminder_minutes !== null) {
    const base = task.due_all_day ? zonedToUtc(nextKey, "09:00", tz).toISOString() : nextDue;
    const at = reminderAt(base, rule.reminder_minutes);
    if (new Date(at).getTime() > Date.now()) {
      await supabase
        .from("reminders")
        .insert({ user_id: userId, task_id: data.id, title: task.title.slice(0, 300), remind_at: at });
    }
  }
  return nextKey;
}

// ------------------------------------------------------------- Reuniones

export type MeetingTemplate = {
  title: string;
  description: string | null;
  location: string | null;
  project_id: string | null;
  client_id: string | null;
  /** Hora local de inicio "HH:mm" y duración en minutos. */
  start_time: string;
  duration_minutes: number;
  participants: string[];
};

/**
 * Crea las repeticiones de una serie de reuniones posteriores a `afterKey`
 * hasta el horizonte. Ignora las que ya existen (índice único).
 */
export async function materializeMeetings(
  supabase: Supa,
  userId: string,
  rule: RecurrenceRule,
  template: MeetingTemplate,
  afterKey: string,
): Promise<number> {
  const tz = rule.timezone;
  const horizonKey = addDaysKey(localDateKey(new Date(), tz), MEETING_HORIZON_DAYS);
  const keys = occurrencesAfter(rule.rrule, rule.starts_on, afterKey, {
    untilKey: rule.until_date,
    horizonKey,
    limit: 70,
  });
  if (keys.length === 0) return 0;

  const rows = keys.map((k) => {
    const start = zonedToUtc(k, template.start_time, tz);
    return {
      user_id: userId,
      recurrence_rule_id: rule.id,
      title: template.title,
      description: template.description,
      location: template.location,
      project_id: template.project_id,
      client_id: template.client_id,
      starts_at: start.toISOString(),
      ends_at: new Date(start.getTime() + template.duration_minutes * 60000).toISOString(),
      status: "scheduled",
      source: "manual",
      confirmed_at: new Date().toISOString(),
    };
  });

  // Quitar las que ya existen para no chocar con el índice único.
  const { data: existing } = await supabase
    .from("meetings")
    .select("starts_at")
    .eq("recurrence_rule_id", rule.id)
    .in(
      "starts_at",
      rows.map((r) => r.starts_at),
    );
  const have = new Set(((existing as { starts_at: string }[] | null) ?? []).map((e) => new Date(e.starts_at).getTime()));
  const fresh = rows.filter((r) => !have.has(new Date(r.starts_at).getTime()));
  if (fresh.length === 0) return 0;

  const { data: inserted, error } = await supabase.from("meetings").insert(fresh).select("id, starts_at");
  if (error || !inserted) return 0;
  const created = inserted as { id: string; starts_at: string }[];

  if (template.participants.length) {
    await supabase.from("meeting_participants").insert(
      created.flatMap((m) =>
        template.participants.map((display_name) => ({ user_id: userId, meeting_id: m.id, display_name })),
      ),
    );
  }
  if (rule.reminder_minutes !== null) {
    const now = Date.now();
    const reminders = created
      .map((m) => ({ m, at: reminderAt(m.starts_at, rule.reminder_minutes!) }))
      .filter(({ at }) => new Date(at).getTime() > now)
      .map(({ m, at }) => ({ user_id: userId, meeting_id: m.id, title: template.title.slice(0, 300), remind_at: at }));
    if (reminders.length) await supabase.from("reminders").insert(reminders);
  }
  return created.length;
}

/**
 * Rellena las series de reuniones activas cuya última repetición está a menos
 * de 30 días. Se llama al abrir la agenda; es idempotente.
 */
export async function topUpMeetingSeries(supabase: Supa, userId: string): Promise<void> {
  const { data: rules } = await supabase
    .from("recurrence_rules")
    .select(RULE_SELECT)
    .eq("applies_to", "meeting")
    .limit(50);
  const now = new Date();
  for (const rule of (rules as RecurrenceRule[] | null) ?? []) {
    const todayKey = localDateKey(now, rule.timezone);
    if (rule.until_date && rule.until_date < todayKey) continue;

    const { data: last } = await supabase
      .from("meetings")
      .select("title, description, location, project_id, client_id, starts_at, ends_at, participants:meeting_participants(display_name, contact_id)")
      .eq("recurrence_rule_id", rule.id)
      .order("starts_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!last) continue;
    const l = last as {
      title: string;
      description: string | null;
      location: string | null;
      project_id: string | null;
      client_id: string | null;
      starts_at: string;
      ends_at: string;
      participants: { display_name: string | null; contact_id: string | null }[];
    };
    const lastKey = localDateKey(new Date(l.starts_at), rule.timezone);
    if (lastKey > addDaysKey(todayKey, MEETING_REFILL_WHEN_DAYS)) continue;

    await materializeMeetings(
      supabase,
      userId,
      rule,
      {
        title: l.title,
        description: l.description,
        location: l.location,
        project_id: l.project_id,
        client_id: l.client_id,
        start_time: localTimeKey(new Date(l.starts_at), rule.timezone),
        duration_minutes: Math.round((new Date(l.ends_at).getTime() - new Date(l.starts_at).getTime()) / 60000),
        participants: (l.participants ?? []).filter((p) => !p.contact_id && p.display_name).map((p) => p.display_name!),
      },
      lastKey,
    );
  }
}
