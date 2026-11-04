import "server-only";

import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { getViewer } from "@/lib/session";
import { listTasks } from "@/lib/tasks/queries";
import { listMeetings, listMeetingsInRange } from "@/lib/meetings/queries";
import { utcRangeForDays } from "@/lib/planner";
import { zonedToUtc } from "@/lib/zoned-time";
import {
  buildAlerts,
  buildBriefing,
  briefingKindAt,
  type AlertItem,
  type Briefing,
  type BriefingKind,
  type ReminderRow,
} from "@/lib/briefing";

export type DayPrefs = { workStart: string; workEnd: string; summaryTime: string; closeTime: string };

const DEFAULT_PREFS: DayPrefs = { workStart: "09:00", workEnd: "17:00", summaryTime: "08:45", closeTime: "16:45" };

export const getDayPrefs = cache(async (): Promise<DayPrefs> => {
  const viewer = await getViewer();
  if (viewer.preview || !viewer.id) return DEFAULT_PREFS;
  const supabase = await createClient();
  const { data } = await supabase
    .from("user_preferences")
    .select("work_start, work_end, daily_summary_time, day_close_time")
    .maybeSingle();
  if (!data) return DEFAULT_PREFS;
  return {
    workStart: String(data.work_start).slice(0, 5),
    workEnd: String(data.work_end).slice(0, 5),
    summaryTime: String(data.daily_summary_time).slice(0, 5),
    closeTime: String(data.day_close_time).slice(0, 5),
  };
});

/**
 * Resumen del día. Sin fecha: hoy, y el tipo según la hora de cierre.
 * Con fecha pasada: el cierre de ese día (para el historial del podcast).
 */
export async function loadBriefing(opts: { kind?: BriefingKind; dateKey?: string } = {}): Promise<{
  briefing: Briefing | null;
  error: boolean;
}> {
  const viewer = await getViewer();
  const prefs = await getDayPrefs();
  const tz = viewer.timezone;
  const now = opts.dateKey ? new Date(zonedToUtc(opts.dateKey, "23:59", tz)) : new Date();
  const kind = opts.kind ?? (opts.dateKey ? "closing" : briefingKindAt(now, prefs.closeTime, tz));
  if (viewer.preview) {
    return { briefing: buildBriefing(kind, now, [], [], { timeZone: tz, ...prefs }), error: false };
  }
  const [t, m] = await Promise.all([
    listTasks(),
    opts.dateKey
      ? (() => {
          const r = utcRangeForDays(opts.dateKey!, 2, tz);
          return listMeetingsInRange(r.from, r.to);
        })()
      : listMeetings({ pastDays: 1, futureDays: 2 }),
  ]);
  if (t.error || m.error) return { briefing: null, error: true };
  return { briefing: buildBriefing(kind, now, t.tasks, m.meetings, { timeZone: tz, ...prefs }), error: false };
}

/** Recordatorios programados hasta dentro de 24 h (los vencidos incluidos). */
export async function listUpcomingReminders(): Promise<ReminderRow[]> {
  const viewer = await getViewer();
  if (viewer.preview || !viewer.id) return [];
  const supabase = await createClient();
  const until = new Date(Date.now() + 24 * 3600_000).toISOString();
  const { data } = await supabase
    .from("reminders")
    .select("id, title, remind_at, task_id, meeting_id")
    .eq("status", "scheduled")
    .lte("remind_at", until)
    .order("remind_at")
    .limit(50);
  return (data as ReminderRow[] | null) ?? [];
}

export async function loadAlerts(): Promise<{ alerts: AlertItem[]; error: boolean }> {
  const viewer = await getViewer();
  if (viewer.preview) return { alerts: [], error: false };
  const [t, m, r] = await Promise.all([listTasks(), listMeetings({ pastDays: 0, futureDays: 1 }), listUpcomingReminders()]);
  if (t.error || m.error) return { alerts: [], error: true };
  return { alerts: buildAlerts(new Date(), t.tasks, m.meetings, r, viewer.timezone), error: false };
}
