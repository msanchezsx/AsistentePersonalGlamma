/**
 * Indicadores de productividad (Fase 6). Lógica pura sobre tareas y
 * reuniones guardadas; las recomendaciones salen de reglas explícitas.
 */
import { DEFAULT_TIMEZONE } from "@/lib/constants";
import type { Meeting } from "@/lib/meetings/model";
import { weekStartKey } from "@/lib/planner";
import { isOpen, isOverdue, type Task } from "@/lib/tasks/model";
import { addDaysKey, localDateKey } from "@/lib/zoned-time";

export type WeekPoint = { weekKey: string; completed: number; created: number; meetingHours: number };

export type Metrics = {
  weeks: WeekPoint[];
  open: number;
  overdue: number;
  dueThisWeek: number;
  noDate: number;
  /** % de tareas con fecha terminadas a tiempo en las últimas 4 semanas (null = sin datos). */
  onTimeRate: number | null;
  onTimeSample: number;
  quadrants: { doNow: number; schedule: number; delegate: number; drop: number };
  meetingShare: number | null;
  recommendations: string[];
};

export function buildMetrics(
  now: Date,
  tasks: Task[],
  meetings: Meeting[],
  opts: { weeks?: number; timeZone?: string; workHoursPerWeek?: number } = {},
): Metrics {
  const tz = opts.timeZone ?? DEFAULT_TIMEZONE;
  const n = opts.weeks ?? 4;
  const thisWeek = weekStartKey(localDateKey(now, tz));
  const weekKeys = Array.from({ length: n }, (_, i) => addDaysKey(thisWeek, -7 * (n - 1 - i)));
  const weekOf = (iso: string) => weekStartKey(localDateKey(new Date(iso), tz));

  const weeks: WeekPoint[] = weekKeys.map((weekKey) => ({ weekKey, completed: 0, created: 0, meetingHours: 0 }));
  const byKey = new Map(weeks.map((w) => [w.weekKey, w]));

  let onTime = 0;
  let sample = 0;
  for (const t of tasks) {
    if (t.status === "cancelled") continue;
    const created = byKey.get(weekOf(t.created_at));
    if (created) created.created += 1;
    if (t.status === "done" && t.completed_at) {
      const w = byKey.get(weekOf(t.completed_at));
      if (w) {
        w.completed += 1;
        if (t.due_at) {
          sample += 1;
          if (new Date(t.completed_at) <= new Date(t.due_at)) onTime += 1;
        }
      }
    }
  }
  for (const m of meetings) {
    if ((m.status !== "scheduled" && m.status !== "held") || new Date(m.starts_at) > now) continue;
    const w = byKey.get(weekOf(m.starts_at));
    if (w) w.meetingHours += (new Date(m.ends_at).getTime() - new Date(m.starts_at).getTime()) / 3600_000;
  }
  for (const w of weeks) w.meetingHours = Math.round(w.meetingHours * 10) / 10;

  const open = tasks.filter(isOpen);
  const nextMonday = addDaysKey(thisWeek, 7);
  const overdue = open.filter((t) => isOverdue(t, now)).length;
  const dueThisWeek = open.filter((t) => {
    if (!t.due_at || isOverdue(t, now)) return false;
    const k = localDateKey(new Date(t.due_at), tz);
    return k >= thisWeek && k < nextMonday;
  }).length;
  const quadrants = { doNow: 0, schedule: 0, delegate: 0, drop: 0 };
  for (const t of open) {
    if (t.is_urgent && t.is_important) quadrants.doNow++;
    else if (t.is_important) quadrants.schedule++;
    else if (t.is_urgent) quadrants.delegate++;
    else quadrants.drop++;
  }

  // Semanas completas (sin la actual) para el peso de las reuniones.
  const past = weeks.slice(0, -1);
  const workHours = opts.workHoursPerWeek ?? 40;
  const meetingShare =
    past.length && past.some((w) => w.meetingHours > 0)
      ? Math.round((past.reduce((s, w) => s + w.meetingHours, 0) / (past.length * workHours)) * 100)
      : null;
  const onTimeRate = sample ? Math.round((onTime / sample) * 100) : null;

  const recommendations: string[] = [];
  if (overdue >= 3)
    recommendations.push(
      `Tienes ${overdue} tareas vencidas: reserva 30 minutos para cerrarlas, reprogramarlas o cancelarlas.`,
    );
  if (onTimeRate !== null && sample >= 5 && onTimeRate < 70)
    recommendations.push(
      `Solo ${onTimeRate}% de tus tareas se terminó a tiempo. Pon fechas más realistas o divide las tareas grandes.`,
    );
  if (meetingShare !== null && meetingShare >= 50)
    recommendations.push(
      `Las reuniones ocupan cerca del ${meetingShare}% de tu jornada. Revisa cuáles puedes acortar, delegar o resolver por correo.`,
    );
  if (quadrants.delegate >= 3)
    recommendations.push(`${quadrants.delegate} tareas son urgentes pero no importantes: candidatas a delegar.`);
  const importantNoDate = open.filter((t) => t.is_important && !t.due_at).length;
  if (importantNoDate >= 2)
    recommendations.push(`${importantNoDate} tareas importantes no tienen fecha. Asígnales una para que no se queden atrás.`);
  const recent = weeks.slice(-2);
  const createdRecent = recent.reduce((s, w) => s + w.created, 0);
  const doneRecent = recent.reduce((s, w) => s + w.completed, 0);
  if (createdRecent >= 5 && createdRecent > doneRecent * 1.5)
    recommendations.push(
      `En dos semanas entraron ${createdRecent} tareas y cerraste ${doneRecent}: tu lista está creciendo.`,
    );

  return {
    weeks,
    open: open.length,
    overdue,
    dueThisWeek,
    noDate: open.filter((t) => !t.due_at).length,
    onTimeRate,
    onTimeSample: sample,
    quadrants,
    meetingShare,
    recommendations,
  };
}

/** Desde cuándo pedir datos para `weeks` semanas (lunes de la primera, local). */
export function metricsStartKey(now: Date, weeks = 4, timeZone: string = DEFAULT_TIMEZONE): string {
  return addDaysKey(weekStartKey(localDateKey(now, timeZone)), -7 * (weeks - 1));
}
