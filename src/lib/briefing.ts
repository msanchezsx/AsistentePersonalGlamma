/**
 * Resumen de la mañana, cierre del día y alertas (Fase 4) y guion del
 * podcast (Fase 5). Lógica pura: se arma solo con datos guardados, sin IA,
 * y no afirma nada que no esté en ellos.
 */
import { DEFAULT_TIMEZONE } from "@/lib/constants";
import { isActiveMeeting, participantNames, type Meeting } from "@/lib/meetings/model";
import { freeSlots, formatClock, formatMinutes } from "@/lib/planner";
import { compareTasks, isOpen, isOverdue, type Task } from "@/lib/tasks/model";
import { addDaysKey, localDateKey, localTimeKey, zonedToUtc } from "@/lib/zoned-time";

export type BriefingKind = "morning" | "closing";

export type Briefing = {
  kind: BriefingKind;
  dateKey: string;
  meetings: Meeting[];
  meetingMinutes: number;
  /** Tareas abiertas que vencen ese día (sin contar las ya vencidas). */
  dueToday: Task[];
  overdue: Task[];
  /** Las 3 más importantes para atender. */
  priorities: Task[];
  completed: Task[];
  free: { start: string; end: string; minutes: number }[];
  tomorrowMeetings: Meeting[];
  tomorrowTasks: Task[];
  alerts: string[];
  headline: string;
};

type Opts = { workStart?: string; workEnd?: string; timeZone?: string };

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

function onDay(iso: string | null, dateKey: string, tz: string) {
  return iso !== null && localDateKey(new Date(iso), tz) === dateKey;
}

export function buildBriefing(
  kind: BriefingKind,
  now: Date,
  tasks: Task[],
  meetings: Meeting[],
  opts: Opts = {},
): Briefing {
  const tz = opts.timeZone ?? DEFAULT_TIMEZONE;
  const dateKey = localDateKey(now, tz);
  const tomorrowKey = addDaysKey(dateKey, 1);
  const active = meetings
    .filter((m) => isActiveMeeting(m))
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  const todays = active.filter((m) => onDay(m.starts_at, dateKey, tz));
  const meetingMinutes = Math.round(
    todays.reduce((s, m) => s + (new Date(m.ends_at).getTime() - new Date(m.starts_at).getTime()) / 60000, 0),
  );

  const open = tasks.filter(isOpen);
  const overdue = open.filter((t) => isOverdue(t, now) && !onDay(t.due_at, dateKey, tz)).sort(compareTasks);
  const dueToday = open.filter((t) => onDay(t.due_at, dateKey, tz)).sort(compareTasks);
  const keyNoDate = open.filter((t) => !t.due_at && (t.is_important || t.is_urgent)).sort(compareTasks);
  const priorities = [...overdue, ...dueToday, ...keyNoDate].sort(compareTasks).slice(0, 3);
  const completed = tasks.filter((t) => t.status === "done" && onDay(t.completed_at, dateKey, tz));
  const free = freeSlots(dateKey, todays, { workStart: opts.workStart, workEnd: opts.workEnd, minMinutes: 30, timeZone: tz });

  const alerts: string[] = [];
  if (overdue.length) alerts.push(`Tienes ${plural(overdue.length, "tarea vencida", "tareas vencidas")} de días anteriores.`);
  if (meetingMinutes >= 300) alerts.push(`Día cargado: ${formatMinutes(meetingMinutes)} en reuniones.`);
  const overlaps = todays.filter((m, i) => i > 0 && new Date(m.starts_at) < new Date(todays[i - 1].ends_at));
  if (overlaps.length) alerts.push(`${plural(overlaps.length, "reunión se empalma", "reuniones se empalman")} con otra.`);
  if (kind === "morning" && dueToday.length && !free.some((f) => f.minutes >= 60))
    alerts.push("No tienes un bloque libre de 1 hora para avanzar tus pendientes de hoy.");

  const tomorrowMeetings = active.filter((m) => onDay(m.starts_at, tomorrowKey, tz));
  const tomorrowTasks = open.filter((t) => onDay(t.due_at, tomorrowKey, tz)).sort(compareTasks);

  let headline: string;
  if (kind === "morning") {
    const parts = [plural(todays.length, "reunión", "reuniones"), `${plural(dueToday.length, "tarea", "tareas")} para hoy`];
    if (overdue.length) parts.push(plural(overdue.length, "vencida", "vencidas"));
    headline = `Hoy: ${parts.join(", ")}.`;
  } else {
    headline =
      dueToday.length === 0
        ? completed.length
          ? `Cerraste el día con ${plural(completed.length, "tarea terminada", "tareas terminadas")} y nada pendiente.`
          : "No quedó nada pendiente del día."
        : `Terminaste ${plural(completed.length, "tarea", "tareas")}; ${dueToday.length === 1 ? "queda 1 pendiente" : `quedan ${dueToday.length} pendientes`} de hoy.`;
  }

  return {
    kind,
    dateKey,
    meetings: todays,
    meetingMinutes,
    dueToday,
    overdue,
    priorities,
    completed,
    free,
    tomorrowMeetings,
    tomorrowTasks,
    alerts,
    headline,
  };
}

/** ¿Toca resumen de la mañana o cierre del día? Después de la hora de cierre, cierre. */
export function briefingKindAt(now: Date, dayCloseTime = "16:45", timeZone: string = DEFAULT_TIMEZONE): BriefingKind {
  return localTimeKey(now, timeZone) >= dayCloseTime.slice(0, 5) ? "closing" : "morning";
}

// ---------------------------------------------------------------- alertas

export type AlertItem = {
  key: string;
  kind: "reminder" | "meeting" | "overdue";
  title: string;
  body: string;
  url: string;
  at: string;
  reminderId?: string;
};

export type ReminderRow = {
  id: string;
  title: string | null;
  remind_at: string;
  task_id: string | null;
  meeting_id: string | null;
};

export function reminderUrl(r: Pick<ReminderRow, "task_id" | "meeting_id">): string {
  if (r.task_id) return `/tareas/${r.task_id}`;
  if (r.meeting_id) return `/agenda/${r.meeting_id}`;
  return "/agenda";
}

/**
 * Avisos activos: recordatorios cuya hora ya llegó, reuniones que empiezan en
 * los próximos 15 minutos y tareas vencidas. Una llave por origen evita
 * duplicados.
 */
export function buildAlerts(
  now: Date,
  tasks: Task[],
  meetings: Meeting[],
  reminders: ReminderRow[],
  timeZone: string = DEFAULT_TIMEZONE,
): AlertItem[] {
  const t = now.getTime();
  const out: AlertItem[] = [];
  for (const r of reminders) {
    if (new Date(r.remind_at).getTime() > t) continue;
    out.push({
      key: `reminder:${r.id}`,
      kind: "reminder",
      title: r.title || "Recordatorio",
      body: `Programado para las ${formatClock(localTimeKey(new Date(r.remind_at), timeZone))}`,
      url: reminderUrl(r),
      at: r.remind_at,
      reminderId: r.id,
    });
  }
  for (const m of meetings) {
    if (!isActiveMeeting(m)) continue;
    const start = new Date(m.starts_at).getTime();
    if (start < t - 5 * 60000 || start > t + 15 * 60000) continue;
    const mins = Math.round((start - t) / 60000);
    out.push({
      key: `meeting:${m.id}:${m.starts_at}`,
      kind: "meeting",
      title: m.title,
      body: mins > 0 ? `Empieza en ${mins} min` : "Está empezando",
      url: `/agenda/${m.id}`,
      at: m.starts_at,
    });
  }
  const overdue = tasks.filter((x) => isOverdue(x, now)).sort(compareTasks);
  for (const x of overdue.slice(0, 5)) {
    out.push({
      key: `overdue:${x.id}`,
      kind: "overdue",
      title: x.title,
      body: `Venció el ${shortDate(localDateKey(new Date(x.due_at!), timeZone))}`,
      url: `/tareas/${x.id}`,
      at: x.due_at!,
    });
  }
  const rank = { meeting: 0, reminder: 1, overdue: 2 } as const;
  return out.sort((a, b) => rank[a.kind] - rank[b.kind] || a.at.localeCompare(b.at));
}

// ---------------------------------------------------------------- podcast

function meetingLine(m: Meeting, tz: string) {
  const who = participantNames(m);
  const time = formatClock(localTimeKey(new Date(m.starts_at), tz));
  return `A las ${time}, ${m.title}${who.length ? `, con ${listJoin(who)}` : ""}${m.location ? `, en ${m.location}` : ""}.`;
}

function shortDate(dateKey: string) {
  const [y, m, d] = dateKey.split("-").map(Number);
  return new Intl.DateTimeFormat("es-MX", { day: "numeric", month: "short", timeZone: "UTC" }).format(
    new Date(Date.UTC(y, m - 1, d, 12)),
  );
}

function listJoin(items: string[]) {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} y ${items[items.length - 1]}`;
}

function spokenDate(dateKey: string) {
  const [y, m, d] = dateKey.split("-").map(Number);
  return new Intl.DateTimeFormat("es-MX", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }).format(
    new Date(Date.UTC(y, m - 1, d, 12)),
  );
}

/** Hora hablada sin abreviaturas: "10:00 a.m." → "10:00 de la mañana". */
function speakable(text: string) {
  return text.replace(/a\.\s?m\./g, "de la mañana").replace(/p\.\s?m\./g, "de la tarde");
}

/**
 * Guion del podcast en párrafos (cada uno se lee por separado, lo que
 * también evita el corte de textos largos en Chrome para Android).
 */
export function briefingScript(b: Briefing, name: string | null, timeZone: string = DEFAULT_TIMEZONE): string[] {
  const p: string[] = [];
  const hi = b.kind === "morning" ? "Buenos días" : "Buenas tardes";
  p.push(
    `${hi}${name ? `, ${name}` : ""}. Este es tu ${b.kind === "morning" ? "resumen del" : "cierre del"} ${spokenDate(b.dateKey)}. ${b.headline}`,
  );

  if (b.kind === "morning") {
    if (b.meetings.length) {
      p.push(
        `Tienes ${plural(b.meetings.length, "reunión", "reuniones")}, ${formatMinutes(b.meetingMinutes)} en total. ${b.meetings
          .map((m) => meetingLine(m, timeZone))
          .join(" ")}`,
      );
    } else p.push("No tienes reuniones agendadas hoy.");
    if (b.priorities.length) {
      p.push(
        `Tus prioridades: ${b.priorities
          .map((t, i) => `${["Primero", "Segundo", "Tercero"][i]}, ${t.title}${isUrgentImportant(t) ? ", urgente e importante" : ""}.`)
          .join(" ")}`,
      );
    }
    if (b.dueToday.length > b.priorities.length)
      p.push(`En total vencen hoy ${plural(b.dueToday.length, "tarea", "tareas")}.`);
    if (b.free.length) {
      const best = [...b.free].sort((x, y) => y.minutes - x.minutes)[0];
      p.push(
        `Tu bloque libre más largo es de ${formatClock(best.start)} a ${formatClock(best.end)}, ${formatMinutes(best.minutes)}. Es buen momento para avanzar lo importante.`,
      );
    }
  } else {
    p.push(
      b.completed.length
        ? `Terminaste: ${listJoin(b.completed.slice(0, 6).map((t) => t.title))}${b.completed.length > 6 ? ", entre otras" : ""}.`
        : "No se registraron tareas terminadas en el día.",
    );
    if (b.dueToday.length)
      p.push(`Quedaron pendientes de hoy: ${listJoin(b.dueToday.slice(0, 6).map((t) => t.title))}. Decide si las pasas a mañana.`);
    if (b.tomorrowMeetings.length)
      p.push(
        `Mañana tienes ${plural(b.tomorrowMeetings.length, "reunión", "reuniones")}. La primera: ${meetingLine(b.tomorrowMeetings[0], timeZone)}`,
      );
    if (b.tomorrowTasks.length) p.push(`Y vencen ${plural(b.tomorrowTasks.length, "tarea", "tareas")} mañana.`);
  }

  if (b.alerts.length) p.push(`Atención: ${b.alerts.join(" ")}`);
  p.push(b.kind === "morning" ? "Eso es todo. Que tengas un excelente día." : "Eso es todo por hoy. Buen descanso.");
  return p.map(speakable);
}

function isUrgentImportant(t: Task) {
  return t.is_urgent && t.is_important;
}

// ---------------------------------------------------------------- avisos críticos

export type CriticalItem = {
  key: string;
  kind: "task" | "meeting";
  id: string;
  title: string;
  detail: string;
  /** Cuándo debe aparecer el aviso a pantalla completa. */
  showAt: string;
  url: string;
  reminderId: string | null;
};

/** Tarea crítica: prioridad 1 ("Crítica") o urgente + importante. */
export function isCriticalTask(t: Pick<Task, "priority" | "is_urgent" | "is_important">): boolean {
  return t.priority === 1 || (t.is_urgent && t.is_important);
}

/**
 * Avisos a pantalla completa de las próximas 24 h (y los que ya llegaron):
 * - Tarea crítica abierta: al llegar su recordatorio o su hora límite (las de
 *   todo el día, a las 9:00).
 * - Reunión crítica programada: al llegar su recordatorio o 10 min antes.
 * La llave incluye el momento, así que si la fecha cambia vuelve a avisar.
 */
export function buildCriticalItems(
  now: Date,
  tasks: Task[],
  meetings: Meeting[],
  reminders: ReminderRow[],
  criticalMeetingIds: Set<string>,
  timeZone: string = DEFAULT_TIMEZONE,
): CriticalItem[] {
  const horizon = now.getTime() + 24 * 3600_000;
  const out: CriticalItem[] = [];
  const firstReminder = (field: "task_id" | "meeting_id", id: string) =>
    reminders.filter((r) => r[field] === id).sort((a, b) => a.remind_at.localeCompare(b.remind_at))[0] ?? null;

  for (const t of tasks) {
    if (!isOpen(t) || !t.due_at || !isCriticalTask(t)) continue;
    const dueMoment = t.due_all_day
      ? zonedToUtc(localDateKey(new Date(t.due_at), timeZone), "09:00", timeZone)
      : new Date(t.due_at);
    const r = firstReminder("task_id", t.id);
    const show = r && new Date(r.remind_at) < dueMoment ? new Date(r.remind_at) : dueMoment;
    if (show.getTime() > horizon) continue;
    const time = t.due_all_day ? "hoy" : `a las ${formatClock(localTimeKey(new Date(t.due_at), timeZone))}`;
    out.push({
      key: `task:${t.id}:${show.toISOString()}`,
      kind: "task",
      id: t.id,
      title: t.title,
      detail: isOverdue(t, now) ? `Tarea crítica vencida (${shortDate(localDateKey(new Date(t.due_at), timeZone))})` : `Tarea crítica: vence ${time}`,
      showAt: show.toISOString(),
      url: `/tareas/${t.id}`,
      reminderId: r?.id ?? null,
    });
  }

  for (const m of meetings) {
    if (m.status !== "scheduled" || !criticalMeetingIds.has(m.id)) continue;
    if (new Date(m.ends_at) <= now) continue;
    const start = new Date(m.starts_at);
    const r = firstReminder("meeting_id", m.id);
    const tenBefore = new Date(start.getTime() - 10 * 60000);
    const show = r && new Date(r.remind_at) < tenBefore ? new Date(r.remind_at) : tenBefore;
    if (show.getTime() > horizon) continue;
    const who = participantNames(m);
    out.push({
      key: `meeting:${m.id}:${show.toISOString()}`,
      kind: "meeting",
      id: m.id,
      title: m.title,
      detail: `Reunión crítica a las ${formatClock(localTimeKey(start, timeZone))}${who.length ? ` con ${listJoin(who)}` : ""}${m.location ? ` · ${m.location}` : ""}`,
      showAt: show.toISOString(),
      url: `/agenda/${m.id}`,
      reminderId: r?.id ?? null,
    });
  }
  return out.sort((a, b) => a.showAt.localeCompare(b.showAt));
}
