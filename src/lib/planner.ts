/**
 * Vistas diaria y semanal: junta reuniones y tareas por día local y calcula
 * los huecos libres de la jornada. Funciones puras (fáciles de probar).
 */
import { DEFAULT_TIMEZONE } from "@/lib/constants";
import type { Meeting } from "@/lib/meetings/model";
import type { Task } from "@/lib/tasks/model";
import { addDaysKey, localDateKey, localTimeKey, zonedToUtc } from "@/lib/zoned-time";

export type AgendaView = "lista" | "dia" | "semana";

const KEY_RE = /^\d{4}-\d{2}-\d{2}$/;

function isValidKey(k: string | undefined): k is string {
  if (!k || !KEY_RE.test(k)) return false;
  const [y, m, d] = k.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

/** Lee ?vista= y ?fecha= de la URL; valores inválidos → lista / hoy. */
export function parseAgendaParams(
  params: Record<string, string | undefined>,
  todayKey: string,
): { view: AgendaView; dateKey: string } {
  const v = params.vista;
  const view: AgendaView = v === "dia" || v === "semana" ? v : "lista";
  return { view, dateKey: isValidKey(params.fecha) ? params.fecha : todayKey };
}

/** Lunes de la semana de la fecha (semana de lunes a domingo). */
export function weekStartKey(dateKey: string): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  const wd = (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7; // 0 = lunes
  return addDaysKey(dateKey, -wd);
}

/** Rango UTC [desde, hasta) que cubre los días locales indicados. */
export function utcRangeForDays(firstKey: string, days: number, timeZone: string = DEFAULT_TIMEZONE) {
  return {
    from: zonedToUtc(firstKey, "00:00", timeZone).toISOString(),
    to: zonedToUtc(addDaysKey(firstKey, days), "00:00", timeZone).toISOString(),
  };
}

export type PlanEntry =
  | { kind: "meeting"; time: string; meeting: Meeting }
  | { kind: "task"; time: string; task: Task };

export type DayPlan = {
  dateKey: string;
  /** Tareas sin hora (todo el día) que vencen ese día. */
  allDayTasks: Task[];
  /** Reuniones y tareas con hora, en orden. */
  entries: PlanEntry[];
  meetingMinutes: number;
};

/** Reunión que no cuenta en la agenda (cancelada). */
function hidden(m: Meeting): boolean {
  return m.status === "cancelled";
}

export function buildDayPlan(
  dateKey: string,
  meetings: Meeting[],
  tasks: Task[],
  timeZone: string = DEFAULT_TIMEZONE,
): DayPlan {
  const dayMeetings = meetings.filter(
    (m) => !hidden(m) && localDateKey(new Date(m.starts_at), timeZone) === dateKey,
  );
  const dayTasks = tasks.filter(
    (t) => t.status !== "cancelled" && t.due_at && localDateKey(new Date(t.due_at), timeZone) === dateKey,
  );
  const entries: PlanEntry[] = [
    ...dayMeetings.map((m) => ({
      kind: "meeting" as const,
      time: localTimeKey(new Date(m.starts_at), timeZone),
      meeting: m,
    })),
    ...dayTasks
      .filter((t) => !t.due_all_day)
      .map((t) => ({ kind: "task" as const, time: localTimeKey(new Date(t.due_at!), timeZone), task: t })),
  ].sort((a, b) => a.time.localeCompare(b.time) || (a.kind === "meeting" ? -1 : 1));

  const meetingMinutes = dayMeetings
    .filter((m) => m.status !== "missed")
    .reduce((sum, m) => sum + (new Date(m.ends_at).getTime() - new Date(m.starts_at).getTime()) / 60000, 0);

  return {
    dateKey,
    allDayTasks: dayTasks.filter((t) => t.due_all_day),
    entries,
    meetingMinutes: Math.round(meetingMinutes),
  };
}

export function buildWeekPlan(
  mondayKey: string,
  meetings: Meeting[],
  tasks: Task[],
  timeZone: string = DEFAULT_TIMEZONE,
): DayPlan[] {
  return Array.from({ length: 7 }, (_, i) => buildDayPlan(addDaysKey(mondayKey, i), meetings, tasks, timeZone));
}

/**
 * Huecos libres dentro de la jornada (p. ej. 09:00–17:00) que no ocupan las
 * reuniones activas del día. Solo devuelve huecos de al menos `minMinutes`.
 */
export function freeSlots(
  dateKey: string,
  meetings: Meeting[],
  opts: { workStart?: string; workEnd?: string; minMinutes?: number; timeZone?: string } = {},
): { start: string; end: string; minutes: number }[] {
  const { workStart = "09:00", workEnd = "17:00", minMinutes = 30, timeZone = DEFAULT_TIMEZONE } = opts;
  const dayStart = zonedToUtc(dateKey, workStart, timeZone).getTime();
  const dayEnd = zonedToUtc(dateKey, workEnd, timeZone).getTime();
  const busy = meetings
    .filter((m) => m.status === "scheduled" || m.status === "draft" || m.status === "held")
    .map((m) => [new Date(m.starts_at).getTime(), new Date(m.ends_at).getTime()] as const)
    .filter(([s, e]) => e > dayStart && s < dayEnd)
    .sort((a, b) => a[0] - b[0]);

  const out: { start: string; end: string; minutes: number }[] = [];
  let cursor = dayStart;
  const push = (s: number, e: number) => {
    const minutes = Math.round((e - s) / 60000);
    if (minutes >= minMinutes) {
      out.push({
        start: localTimeKey(new Date(s), timeZone),
        end: localTimeKey(new Date(e), timeZone),
        minutes,
      });
    }
  };
  for (const [s, e] of busy) {
    if (s > cursor) push(cursor, Math.min(s, dayEnd));
    cursor = Math.max(cursor, e);
    if (cursor >= dayEnd) break;
  }
  if (cursor < dayEnd) push(cursor, dayEnd);
  return out;
}

/** "1 h 30 min", "45 min", "2 h". */
export function formatMinutes(total: number): string {
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h && m) return `${h} h ${m} min`;
  if (h) return `${h} h`;
  return `${m} min`;
}

/** "Lun 3", "Mar 4"… para encabezados de la semana. */
export function shortDayLabel(dateKey: string): { weekday: string; day: number } {
  const [y, m, d] = dateKey.split("-").map(Number);
  const wd = new Intl.DateTimeFormat("es-MX", { weekday: "short", timeZone: "UTC" })
    .format(new Date(Date.UTC(y, m - 1, d, 12)))
    .replace(".", "");
  return { weekday: wd.charAt(0).toUpperCase() + wd.slice(1), day: d };
}

/** "3 – 9 de noviembre de 2026" / "29 de diciembre de 2026 – 4 de enero de 2027". */
export function weekRangeLabel(mondayKey: string): string {
  const sundayKey = addDaysKey(mondayKey, 6);
  const fmt = (k: string, opts: Intl.DateTimeFormatOptions) => {
    const [y, m, d] = k.split("-").map(Number);
    return new Intl.DateTimeFormat("es-MX", { ...opts, timeZone: "UTC" }).format(new Date(Date.UTC(y, m - 1, d, 12)));
  };
  const full: Intl.DateTimeFormatOptions = { day: "numeric", month: "long", year: "numeric" };
  if (mondayKey.slice(0, 7) === sundayKey.slice(0, 7)) {
    return `${Number(mondayKey.slice(8))} – ${fmt(sundayKey, full)}`;
  }
  if (mondayKey.slice(0, 4) === sundayKey.slice(0, 4)) {
    return `${fmt(mondayKey, { day: "numeric", month: "long" })} – ${fmt(sundayKey, full)}`;
  }
  return `${fmt(mondayKey, full)} – ${fmt(sundayKey, full)}`;
}

/** "13:30" → "01:30 p.m." (mismo formato que formatTime). */
export function formatClock(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  return new Intl.DateTimeFormat("es-MX", { hour: "2-digit", minute: "2-digit", hour12: true, timeZone: "UTC" }).format(
    new Date(Date.UTC(2000, 0, 1, h, m)),
  );
}
