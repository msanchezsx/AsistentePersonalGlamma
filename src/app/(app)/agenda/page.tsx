import type { Metadata } from "next";
import Link from "next/link";
import { Icon } from "@/components/icon";
import { Card, EmptyState, PageHeader } from "@/components/ui";
import { groupMeetingsByDay, isActiveMeeting, type Meeting } from "@/lib/meetings/model";
import { listMeetings } from "@/lib/meetings/queries";
import { getViewer } from "@/lib/session";
import { addDaysKey, localDateKey } from "@/lib/zoned-time";
import { MeetingItem } from "./meeting-item";
import { DayView, ViewTabs, WeekView } from "./agenda-views";
import { buildDayPlan, buildWeekPlan, parseAgendaParams, utcRangeForDays, weekStartKey } from "@/lib/planner";
import { listMeetingsInRange } from "@/lib/meetings/queries";
import { listTasks, listTasksDueInRange } from "@/lib/tasks/queries";
import { isOverdue, type Task } from "@/lib/tasks/model";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Agenda" };
export const dynamic = "force-dynamic";

const NOTICES: Record<string, string> = {
  creada: "Reunión agendada.",
  actualizada: "Reunión actualizada.",
  eliminada: "Reunión eliminada.",
};

function dayTitle(dateKey: string, todayKey: string): string {
  if (dateKey === todayKey) return "Hoy";
  if (dateKey === addDaysKey(todayKey, 1)) return "Mañana";
  const [y, m, d] = dateKey.split("-").map(Number);
  const text = new Intl.DateTimeFormat("es-MX", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(y, m - 1, d, 12)));
  return text.charAt(0).toUpperCase() + text.slice(1);
}

const newMeetingButton = (
  <Link
    href="/agenda/nueva"
    className="flex items-center gap-1.5 rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-accent-text"
  >
    <Icon name="plus" className="size-4" />
    Reunión
  </Link>
);

/** Días laborales del usuario (1 = lunes … 7 = domingo). Por defecto lunes a viernes. */
async function loadWorkDays(): Promise<number[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("user_preferences").select("work_days").maybeSingle();
  const days = (data as { work_days: number[] } | null)?.work_days;
  return Array.isArray(days) && days.length ? days : [1, 2, 3, 4, 5];
}

export default async function AgendaPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const params = await searchParams;
  const notice = Object.keys(NOTICES).find((k) => k in params);
  const viewer = await getViewer();
  const now = new Date();
  const todayKey = localDateKey(now, viewer.timezone);
  const { view, dateKey } = parseAgendaParams(params, todayKey);

  if (view !== "lista") {
    const tz = viewer.timezone;
    const firstKey = view === "dia" ? dateKey : weekStartKey(dateKey);
    const days = view === "dia" ? 1 : 7;
    const range = utcRangeForDays(firstKey, days, tz);
    const [m, t, overdue, workDays] = viewer.preview
      ? [{ meetings: [] as Meeting[], error: false }, { tasks: [] as Task[], error: false }, [] as Task[], [1, 2, 3, 4, 5]]
      : await Promise.all([
          listMeetingsInRange(range.from, range.to),
          listTasksDueInRange(range.from, range.to),
          view === "dia" && dateKey === todayKey
            ? listTasks().then((r) =>
                r.tasks.filter((x) => isOverdue(x, now) && localDateKey(new Date(x.due_at!), tz) < todayKey),
              )
            : Promise.resolve([] as Task[]),
          loadWorkDays(),
        ]);
    const loadError = m.error || t.error;
    const wd = (() => {
      const [y, mo, d] = dateKey.split("-").map(Number);
      return ((new Date(Date.UTC(y, mo - 1, d)).getUTCDay() + 6) % 7) + 1;
    })();

    return (
      <>
        <PageHeader title="Agenda" action={newMeetingButton} />
        <ViewTabs current={view} dateKey={dateKey} />
        {loadError ? (
          <p role="alert" className="mb-4 rounded-xl bg-danger-soft px-4 py-2.5 text-sm text-danger">
            No se pudo cargar la agenda. Revisa tu conexión y recarga.
          </p>
        ) : null}
        {view === "dia" ? (
          <DayView
            plan={buildDayPlan(dateKey, m.meetings, t.tasks, tz)}
            meetings={m.meetings}
            overdue={overdue}
            todayKey={todayKey}
            now={now}
            timeZone={tz}
            isWorkday={workDays.includes(wd)}
          />
        ) : (
          <WeekView
            mondayKey={firstKey}
            days={buildWeekPlan(firstKey, m.meetings, t.tasks, tz)}
            todayKey={todayKey}
            timeZone={tz}
            workDays={workDays}
          />
        )}
      </>
    );
  }

  const { meetings, error } = viewer.preview ? { meetings: [] as Meeting[], error: false } : await listMeetings();

  // Desde hoy: las de días anteriores no se muestran aquí.
  const visible = meetings.filter((m) => localDateKey(new Date(m.ends_at), viewer.timezone) >= todayKey);
  const days = groupMeetingsByDay(visible, viewer.timezone);
  const todayActive = visible.filter(
    (m) => isActiveMeeting(m) && localDateKey(new Date(m.starts_at), viewer.timezone) === todayKey,
  ).length;

  return (
    <>
      <PageHeader
        title="Agenda"
        subtitle={todayActive ? `${todayActive} reunión${todayActive === 1 ? "" : "es"} hoy` : "Sin reuniones hoy"}
        action={newMeetingButton}
      />
      <ViewTabs current="lista" dateKey={todayKey} />

      {notice ? (
        <p role="status" className="mb-4 rounded-xl bg-ok-soft px-4 py-2.5 text-sm text-ok">
          {NOTICES[notice]}
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="mb-4 rounded-xl bg-danger-soft px-4 py-2.5 text-sm text-danger">
          No se pudo cargar la agenda. Revisa tu conexión y recarga.
        </p>
      ) : null}

      <div className="space-y-4">
        {days.length === 0 && !error ? (
          <Card>
            <EmptyState>No tienes reuniones próximas. Agenda una con el botón &quot;Reunión&quot;.</EmptyState>
          </Card>
        ) : null}
        {days.map((d) => (
          <Card key={d.dateKey}>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
              {dayTitle(d.dateKey, todayKey)}
            </h2>
            <ul className="divide-y divide-border">
              {d.items.map((m) => (
                <MeetingItem key={m.id} meeting={m} now={now} timeZone={viewer.timezone} />
              ))}
            </ul>
          </Card>
        ))}
      </div>
    </>
  );
}
