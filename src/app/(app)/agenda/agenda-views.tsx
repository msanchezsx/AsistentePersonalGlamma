import Link from "next/link";
import { Card, EmptyState } from "@/components/ui";
import { formatTime } from "@/lib/datetime";
import { participantNames } from "@/lib/meetings/model";
import {
  formatClock,
  formatMinutes,
  freeSlots,
  shortDayLabel,
  weekRangeLabel,
  type AgendaView,
  type DayPlan,
} from "@/lib/planner";
import type { Meeting } from "@/lib/meetings/model";
import type { Task } from "@/lib/tasks/model";
import { addDaysKey } from "@/lib/zoned-time";
import { TaskItem } from "../tareas/task-item";
import { MeetingItem } from "./meeting-item";

const VIEWS: { view: AgendaView; label: string }[] = [
  { view: "dia", label: "Día" },
  { view: "semana", label: "Semana" },
  { view: "lista", label: "Próximas" },
];

export function agendaHref(view: AgendaView, dateKey?: string) {
  if (view === "lista") return "/agenda";
  return `/agenda?vista=${view}${dateKey ? `&fecha=${dateKey}` : ""}`;
}

export function ViewTabs({ current, dateKey }: { current: AgendaView; dateKey: string }) {
  return (
    <nav aria-label="Vista de la agenda" className="mb-4 inline-flex rounded-xl border border-border bg-surface p-1">
      {VIEWS.map((v) => (
        <Link
          key={v.view}
          href={agendaHref(v.view, v.view === "lista" ? undefined : dateKey)}
          aria-current={current === v.view ? "page" : undefined}
          className={`rounded-lg px-4 py-2 text-sm font-medium ${
            current === v.view ? "bg-accent text-accent-text" : "text-muted hover:text-text"
          }`}
        >
          {v.label}
        </Link>
      ))}
    </nav>
  );
}

function DateNav({
  view,
  prevKey,
  nextKey,
  todayKey,
  label,
  isCurrent,
}: {
  view: AgendaView;
  prevKey: string;
  nextKey: string;
  todayKey: string;
  label: string;
  isCurrent: boolean;
}) {
  const btn = "grid size-10 place-items-center rounded-xl border border-border bg-surface text-lg";
  return (
    <div className="mb-4 flex items-center gap-2">
      <Link href={agendaHref(view, prevKey)} className={btn} aria-label="Anterior">
        ‹
      </Link>
      <Link href={agendaHref(view, nextKey)} className={btn} aria-label="Siguiente">
        ›
      </Link>
      <p className="min-w-0 flex-1 truncate px-1 font-semibold">{label}</p>
      {!isCurrent ? (
        <Link
          href={agendaHref(view, todayKey)}
          className="rounded-xl border border-border bg-surface px-3 py-2 text-sm font-medium"
        >
          {view === "dia" ? "Hoy" : "Esta semana"}
        </Link>
      ) : null}
    </div>
  );
}

function longDayLabel(dateKey: string, todayKey: string): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  const text = new Intl.DateTimeFormat("es-MX", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(y, m - 1, d, 12)));
  const cap = text.charAt(0).toUpperCase() + text.slice(1);
  if (dateKey === todayKey) return `Hoy · ${cap}`;
  if (dateKey === addDaysKey(todayKey, 1)) return `Mañana · ${cap}`;
  if (dateKey === addDaysKey(todayKey, -1)) return `Ayer · ${cap}`;
  return cap;
}

// ------------------------------------------------------------------ Día

export function DayView({
  plan,
  meetings,
  overdue,
  todayKey,
  now,
  timeZone,
  isWorkday,
}: {
  plan: DayPlan;
  meetings: Meeting[];
  overdue: Task[];
  todayKey: string;
  now: Date;
  timeZone: string;
  isWorkday: boolean;
}) {
  const isToday = plan.dateKey === todayKey;
  const slots = isWorkday ? freeSlots(plan.dateKey, meetings, { timeZone }) : [];
  // Entre qué entradas va la marca "Ahora" (solo hoy).
  const nowKey = isToday
    ? new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone }).format(now)
    : null;
  const nowIndex = nowKey ? plan.entries.findIndex((e) => e.time > nowKey) : -1;
  const empty = plan.entries.length === 0 && plan.allDayTasks.length === 0;

  return (
    <>
      <DateNav
        view="dia"
        prevKey={addDaysKey(plan.dateKey, -1)}
        nextKey={addDaysKey(plan.dateKey, 1)}
        todayKey={todayKey}
        label={longDayLabel(plan.dateKey, todayKey)}
        isCurrent={isToday}
      />

      <div className="space-y-4">
        <p className="text-sm text-muted">
          {plan.meetingMinutes ? `${formatMinutes(plan.meetingMinutes)} en reuniones` : "Sin reuniones"}
          {" · "}
          {plan.entries.filter((e) => e.kind === "task").length + plan.allDayTasks.length} tarea(s) con vencimiento
        </p>

        {isToday && overdue.length ? (
          <Card title={`Vencidas (${overdue.length})`}>
            <ul className="divide-y divide-border">
              {overdue.slice(0, 5).map((t) => (
                <TaskItem key={t.id} task={t} now={now} timeZone={timeZone} />
              ))}
            </ul>
            {overdue.length > 5 ? (
              <Link href="/tareas" className="mt-2 block text-sm font-medium text-accent">
                Ver todas en Tareas
              </Link>
            ) : null}
          </Card>
        ) : null}

        {plan.allDayTasks.length ? (
          <Card title="Para este día">
            <ul className="divide-y divide-border">
              {plan.allDayTasks.map((t) => (
                <TaskItem key={t.id} task={t} now={now} timeZone={timeZone} />
              ))}
            </ul>
          </Card>
        ) : null}

        <Card title="Horario">
          {plan.entries.length === 0 ? (
            <EmptyState>{empty ? "Nada agendado este día." : "Nada con hora este día."}</EmptyState>
          ) : (
            <ul className="divide-y divide-border">
              {plan.entries.map((e, i) => (
                <EntryRow
                  key={e.kind === "meeting" ? e.meeting.id : e.task.id}
                  entry={e}
                  showNow={i === nowIndex}
                  now={now}
                  timeZone={timeZone}
                />
              ))}
              {nowKey && nowIndex === -1 && plan.entries.length ? <NowMarker /> : null}
            </ul>
          )}
        </Card>

        {isWorkday ? (
          <Card title="Tiempo libre en tu jornada (9:00 a 17:00)">
            {slots.length ? (
              <ul className="flex flex-wrap gap-2">
                {slots.map((s) => (
                  <li key={s.start} className="rounded-lg bg-ok-soft px-3 py-1.5 text-sm text-ok">
                    {formatClock(s.start)} – {formatClock(s.end)} <span className="opacity-80">({formatMinutes(s.minutes)})</span>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState>Tu jornada está llena de reuniones.</EmptyState>
            )}
          </Card>
        ) : null}
      </div>
    </>
  );
}

function NowMarker() {
  return (
    <li aria-label="Ahora" className="flex items-center gap-2 py-1 text-xs font-semibold text-danger">
      <span className="size-2 rounded-full bg-danger" />
      Ahora
      <span className="h-px flex-1 bg-danger/50" />
    </li>
  );
}

function EntryRow({
  entry,
  showNow,
  now,
  timeZone,
}: {
  entry: DayPlan["entries"][number];
  showNow: boolean;
  now: Date;
  timeZone: string;
}) {
  return (
    <>
      {showNow ? <NowMarker /> : null}
      {entry.kind === "meeting" ? (
        <MeetingItem meeting={entry.meeting} now={now} timeZone={timeZone} />
      ) : (
        <TaskItem task={entry.task} now={now} timeZone={timeZone} />
      )}
    </>
  );
}

// --------------------------------------------------------------- Semana

export function WeekView({
  mondayKey,
  days,
  todayKey,
  timeZone,
  workDays,
}: {
  mondayKey: string;
  days: DayPlan[];
  todayKey: string;
  timeZone: string;
  /** 1 = lunes … 7 = domingo */
  workDays: number[];
}) {
  const totalMeetings = days.reduce((n, d) => n + d.entries.filter((e) => e.kind === "meeting").length, 0);
  const totalMinutes = days.reduce((n, d) => n + d.meetingMinutes, 0);
  const totalTasks = days.reduce(
    (n, d) => n + d.allDayTasks.length + d.entries.filter((e) => e.kind === "task").length,
    0,
  );
  const currentMonday = (() => {
    const [y, m, d] = todayKey.split("-").map(Number);
    const wd = (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7;
    return addDaysKey(todayKey, -wd);
  })();

  return (
    <>
      <DateNav
        view="semana"
        prevKey={addDaysKey(mondayKey, -7)}
        nextKey={addDaysKey(mondayKey, 7)}
        todayKey={todayKey}
        label={weekRangeLabel(mondayKey)}
        isCurrent={mondayKey === currentMonday}
      />
      <p className="mb-4 text-sm text-muted">
        {totalMeetings} reunión(es){totalMinutes ? ` · ${formatMinutes(totalMinutes)}` : ""} · {totalTasks} tarea(s)
        con vencimiento
      </p>

      <div className="grid gap-3 lg:grid-cols-7 lg:gap-2">
        {days.map((d, i) => {
          const { weekday, day } = shortDayLabel(d.dateKey);
          const isToday = d.dateKey === todayKey;
          const offDay = !workDays.includes(i + 1);
          const items = [
            ...d.allDayTasks.map((t) => ({ kind: "task" as const, time: "", task: t })),
            ...d.entries,
          ];
          return (
            <section
              key={d.dateKey}
              className={`rounded-2xl border p-3 ${
                isToday ? "border-accent bg-accent-soft/40" : "border-border bg-surface"
              } ${offDay ? "opacity-75" : ""}`}
            >
              <Link
                href={agendaHref("dia", d.dateKey)}
                className="mb-2 flex items-baseline justify-between gap-2"
                aria-label={`Ver el día ${weekday} ${day}`}
              >
                <span className={`text-sm font-semibold ${isToday ? "text-accent" : ""}`}>
                  {weekday} {day}
                </span>
                {d.meetingMinutes ? (
                  <span className="text-xs text-muted">{formatMinutes(d.meetingMinutes)}</span>
                ) : null}
              </Link>
              {items.length === 0 ? (
                <p className="text-xs text-muted">{offDay ? "Descanso" : "Libre"}</p>
              ) : (
                <ul className="space-y-1.5">
                  {items.map((e) =>
                    e.kind === "meeting" ? (
                      <WeekMeeting key={e.meeting.id} meeting={e.meeting} timeZone={timeZone} />
                    ) : (
                      <WeekTask key={e.task.id} task={e.task} time={e.time} />
                    ),
                  )}
                </ul>
              )}
            </section>
          );
        })}
      </div>
    </>
  );
}

function WeekMeeting({ meeting, timeZone }: { meeting: Meeting; timeZone: string }) {
  const people = participantNames(meeting);
  const inactive = meeting.status === "missed";
  return (
    <li>
      <Link
        href={`/agenda/${meeting.id}`}
        className="block rounded-lg border-l-2 border-accent bg-accent-soft px-2 py-1.5 text-xs"
      >
        <span className="font-semibold">{formatTime(new Date(meeting.starts_at), timeZone)}</span>{" "}
        <span className={inactive ? "line-through" : ""}>{meeting.title}</span>
        {meeting.recurrence_rule_id ? <span className="text-muted"> ↻</span> : null}
        {people.length ? <span className="block truncate text-muted">Con {people.join(", ")}</span> : null}
      </Link>
    </li>
  );
}

function WeekTask({ task, time }: { task: Task; time: string }) {
  const done = task.status === "done";
  return (
    <li>
      <Link
        href={`/tareas/${task.id}`}
        className="flex items-start gap-1.5 rounded-lg px-2 py-1.5 text-xs hover:bg-bg"
      >
        <span
          className={`mt-0.5 size-3 shrink-0 rounded-full border-2 ${done ? "border-ok bg-ok" : "border-muted"}`}
          aria-hidden="true"
        />
        <span className={done ? "text-muted line-through" : ""}>
          {time ? <span className="font-semibold">{formatClock(time)} </span> : null}
          {task.title}
        </span>
      </Link>
    </li>
  );
}
