import type { Metadata } from "next";
import Link from "next/link";
import { Card, EmptyState, PageHeader } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { getViewer } from "@/lib/session";
import { getDayPrefs } from "@/lib/briefing-server";
import { buildMetrics, metricsStartKey } from "@/lib/metrics";
import { MEETING_SELECT, type Meeting } from "@/lib/meetings/model";
import { TASK_SELECT, type Task } from "@/lib/tasks/model";
import { shortDayLabel } from "@/lib/planner";
import { zonedToUtc } from "@/lib/zoned-time";
import { WeekBars } from "./week-bars";

export const metadata: Metadata = { title: "Dashboard" };
export const dynamic = "force-dynamic";

const WEEKS = 6;

export default async function DashboardPage() {
  const viewer = await getViewer();
  const prefs = await getDayPrefs();
  const now = new Date();
  const tz = viewer.timezone;
  const since = zonedToUtc(metricsStartKey(now, WEEKS, tz), "00:00", tz).toISOString();

  let tasks: Task[] = [];
  let meetings: Meeting[] = [];
  let error = false;
  if (!viewer.preview) {
    const supabase = await createClient();
    const [t, m] = await Promise.all([
      supabase
        .from("tasks")
        .select(TASK_SELECT)
        .or(`status.in.(pending,in_progress,waiting),created_at.gte."${since}",completed_at.gte."${since}"`)
        .limit(2000),
      supabase
        .from("meetings")
        .select(MEETING_SELECT)
        .gte("starts_at", since)
        .lte("starts_at", now.toISOString())
        .limit(2000),
    ]);
    tasks = (t.data as unknown as Task[] | null) ?? [];
    meetings = (m.data as unknown as Meeting[] | null) ?? [];
    error = Boolean(t.error || m.error);
  }

  const [sh, sm] = prefs.workStart.split(":").map(Number);
  const [eh, em] = prefs.workEnd.split(":").map(Number);
  const workHoursPerWeek = Math.max(1, ((eh * 60 + em - (sh * 60 + sm)) / 60) * 5);
  const m = buildMetrics(now, tasks, meetings, { weeks: WEEKS, timeZone: tz, workHoursPerWeek });
  const q = m.quadrants;

  return (
    <>
      <PageHeader
        title="Dashboard"
        subtitle={`Tus indicadores de las últimas ${WEEKS} semanas.`}
        action={
          <Link href="/dashboard/incidencias" className="rounded-xl border border-border px-3 py-2 text-sm text-muted hover:text-accent">
            Análisis de problemas
          </Link>
        }
      />
      {error ? <EmptyState>No se pudieron cargar todos los datos; los indicadores pueden estar incompletos.</EmptyState> : null}

      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat label="Tareas abiertas" value={String(m.open)} />
          <Stat label="Vencidas" value={String(m.overdue)} tone={m.overdue ? "danger" : undefined} href="/tareas" />
          <Stat label="Vencen esta semana" value={String(m.dueThisWeek)} />
          <Stat
            label="A tiempo (con fecha)"
            value={m.onTimeRate === null ? "—" : `${m.onTimeRate}%`}
            note={m.onTimeRate === null ? "Aún sin tareas terminadas con fecha" : `${m.onTimeSample} tareas`}
          />
        </div>

        <Card title="Recomendaciones">
          {m.recommendations.length ? (
            <ul className="space-y-2">
              {m.recommendations.map((r) => (
                <li key={r} className="rounded-lg bg-accent-soft px-3 py-2 text-sm">
                  {r}
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState>Sin recomendaciones por ahora: no hay señales de atraso ni de sobrecarga.</EmptyState>
          )}
        </Card>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <WeekBars title="Tareas terminadas por semana" points={m.weeks.map((w) => ({ weekKey: w.weekKey, value: w.completed }))} />
          </Card>
          <Card>
            <WeekBars title="Tareas nuevas por semana" points={m.weeks.map((w) => ({ weekKey: w.weekKey, value: w.created }))} />
          </Card>
          <Card>
            <WeekBars
              title="Horas en reuniones por semana"
              points={m.weeks.map((w) => ({ weekKey: w.weekKey, value: w.meetingHours }))}
              format={(v) => `${v} h`}
            />
            {m.meetingShare !== null ? (
              <p className="mt-3 text-sm text-muted">Promedio: {m.meetingShare}% de tu jornada en semanas completas.</p>
            ) : null}
          </Card>
          <Card title="Tareas abiertas por urgencia e importancia">
            <div className="grid grid-cols-2 gap-2 text-sm">
              <Quadrant title="Hacer ya" hint="Urgente e importante" value={q.doNow} strong />
              <Quadrant title="Planear" hint="Importante, no urgente" value={q.schedule} />
              <Quadrant title="Delegar" hint="Urgente, no importante" value={q.delegate} />
              <Quadrant title="Revisar" hint="Ni urgente ni importante" value={q.drop} />
            </div>
            <p className="mt-3 text-xs text-muted">{m.noDate} tareas abiertas sin fecha.</p>
          </Card>
        </div>

        <details className="rounded-2xl border border-border bg-surface p-4 text-sm">
          <summary className="cursor-pointer font-medium">Ver datos en tabla</summary>
          <table className="mt-3 w-full text-left tabular-nums">
            <thead className="text-muted">
              <tr>
                <th className="py-1 font-medium">Semana</th>
                <th className="py-1 font-medium">Terminadas</th>
                <th className="py-1 font-medium">Nuevas</th>
                <th className="py-1 font-medium">Horas reunión</th>
              </tr>
            </thead>
            <tbody>
              {m.weeks.map((w) => {
                const l = shortDayLabel(w.weekKey);
                return (
                  <tr key={w.weekKey} className="border-t border-border">
                    <td className="py-1">Lun {l.day}</td>
                    <td className="py-1">{w.completed}</td>
                    <td className="py-1">{w.created}</td>
                    <td className="py-1">{w.meetingHours}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </details>
      </div>
    </>
  );
}

function Stat({ label, value, note, tone, href }: { label: string; value: string; note?: string; tone?: "danger"; href?: string }) {
  const body = (
    <>
      <p className="text-xs text-muted">{label}</p>
      <p className={`mt-1 text-3xl font-semibold tabular-nums ${tone === "danger" ? "text-danger" : ""}`}>{value}</p>
      {note ? <p className="mt-0.5 text-xs text-muted">{note}</p> : null}
    </>
  );
  const cls = "block rounded-2xl border border-border bg-surface p-4";
  return href ? (
    <Link href={href} className={`${cls} hover:bg-surface-2`}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

function Quadrant({ title, hint, value, strong }: { title: string; hint: string; value: number; strong?: boolean }) {
  return (
    <div className={`rounded-xl p-3 ${strong ? "bg-accent-soft" : "bg-surface-2"}`}>
      <p className="font-medium">{title}</p>
      <p className="text-xs text-muted">{hint}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}
