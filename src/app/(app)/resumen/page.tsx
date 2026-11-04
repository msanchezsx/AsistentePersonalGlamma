import type { Metadata } from "next";
import Link from "next/link";
import { Card, EmptyState, PageHeader } from "@/components/ui";
import { ConfirmButton } from "@/components/confirm-button";
import { formatLongDate } from "@/lib/datetime";
import { formatClock, formatMinutes } from "@/lib/planner";
import { getViewer } from "@/lib/session";
import { loadBriefing } from "@/lib/briefing-server";
import { zonedToUtc } from "@/lib/zoned-time";
import { TaskItem } from "../tareas/task-item";
import { MeetingItem } from "../agenda/meeting-item";
import { moveTodayToTomorrow } from "./actions";

export const metadata: Metadata = { title: "Resumen del día" };
export const dynamic = "force-dynamic";

export default async function SummaryPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const params = await searchParams;
  const viewer = await getViewer();
  const kind = params.tipo === "cierre" ? "closing" : params.tipo === "manana" ? "morning" : undefined;
  const { briefing: b, error } = await loadBriefing({ kind });
  const now = new Date();
  const tz = viewer.timezone;

  if (error || !b) {
    return (
      <>
        <PageHeader title="Resumen del día" />
        <EmptyState>No se pudo armar el resumen. Revisa tu conexión e intenta de nuevo.</EmptyState>
      </>
    );
  }
  const morning = b.kind === "morning";

  return (
    <>
      <PageHeader
        title={morning ? "Resumen de la mañana" : "Cierre del día"}
        subtitle={formatLongDate(zonedToUtc(b.dateKey, "12:00", tz), tz)}
        action={
          <Link
            href="/podcast"
            className="rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-accent-text"
          >
            Escuchar
          </Link>
        }
      />

      <nav aria-label="Tipo de resumen" className="mb-4 inline-flex rounded-xl border border-border bg-surface p-1">
        {[
          { k: "manana", label: "Mañana", on: morning },
          { k: "cierre", label: "Cierre", on: !morning },
        ].map((t) => (
          <Link
            key={t.k}
            href={`/resumen?tipo=${t.k}`}
            aria-current={t.on ? "page" : undefined}
            className={`rounded-lg px-4 py-2 text-sm font-medium ${t.on ? "bg-accent text-accent-text" : "text-muted"}`}
          >
            {t.label}
          </Link>
        ))}
      </nav>

      {params.movidas ? (
        <p role="status" className="mb-4 rounded-xl bg-ok-soft px-4 py-2.5 text-sm text-ok">
          {params.movidas === "0" ? "No había tareas para mover." : `Se pasaron ${params.movidas} tareas a mañana.`}
        </p>
      ) : null}

      <div className="space-y-4">
        <Card>
          <p className="text-lg font-medium">{b.headline}</p>
          {b.alerts.length ? (
            <ul className="mt-3 space-y-1.5">
              {b.alerts.map((a) => (
                <li key={a} className="rounded-lg bg-warn-soft px-3 py-2 text-sm text-warn">
                  {a}
                </li>
              ))}
            </ul>
          ) : null}
        </Card>

        {morning ? (
          <>
            <Card title={`Reuniones de hoy${b.meetings.length ? ` · ${formatMinutes(b.meetingMinutes)}` : ""}`}>
              {b.meetings.length ? (
                <ul className="divide-y divide-border">
                  {b.meetings.map((m) => (
                    <MeetingItem key={m.id} meeting={m} now={now} timeZone={tz} />
                  ))}
                </ul>
              ) : (
                <EmptyState>Sin reuniones hoy.</EmptyState>
              )}
            </Card>
            <Card title="Prioridades">
              {b.priorities.length ? (
                <ul className="divide-y divide-border">
                  {b.priorities.map((t) => (
                    <TaskItem key={t.id} task={t} now={now} timeZone={tz} />
                  ))}
                </ul>
              ) : (
                <EmptyState>No hay tareas vencidas, de hoy ni importantes sin fecha.</EmptyState>
              )}
              {b.dueToday.length + b.overdue.length > b.priorities.length ? (
                <Link href="/tareas" className="mt-2 inline-block text-sm font-medium text-accent">
                  Ver las {b.dueToday.length + b.overdue.length} tareas de hoy y vencidas
                </Link>
              ) : null}
            </Card>
            <Card title="Tiempo libre en tu jornada">
              {b.free.length ? (
                <ul className="flex flex-wrap gap-2">
                  {b.free.map((f) => (
                    <li key={f.start} className="rounded-lg bg-ok-soft px-3 py-1.5 text-sm text-ok">
                      {formatClock(f.start)} – {formatClock(f.end)} · {formatMinutes(f.minutes)}
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyState>Sin bloques libres de 30 minutos o más.</EmptyState>
              )}
            </Card>
          </>
        ) : (
          <>
            <Card title={`Terminadas hoy · ${b.completed.length}`}>
              {b.completed.length ? (
                <ul className="divide-y divide-border">
                  {b.completed.map((t) => (
                    <TaskItem key={t.id} task={t} now={now} timeZone={tz} />
                  ))}
                </ul>
              ) : (
                <EmptyState>No se registraron tareas terminadas hoy.</EmptyState>
              )}
            </Card>
            <Card title={`Pendientes de hoy · ${b.dueToday.length}`}>
              {b.dueToday.length ? (
                <>
                  <ul className="divide-y divide-border">
                    {b.dueToday.map((t) => (
                      <TaskItem key={t.id} task={t} now={now} timeZone={tz} />
                    ))}
                  </ul>
                  {!viewer.preview ? (
                    <form action={moveTodayToTomorrow} className="mt-3">
                      <ConfirmButton
                        message={`¿Pasar ${b.dueToday.length === 1 ? "esta tarea" : `estas ${b.dueToday.length} tareas`} a mañana a la misma hora?`}
                      >
                        Pasar pendientes a mañana
                      </ConfirmButton>
                    </form>
                  ) : null}
                </>
              ) : (
                <EmptyState>Nada pendiente para hoy.</EmptyState>
              )}
            </Card>
            <Card title="Mañana">
              {b.tomorrowMeetings.length || b.tomorrowTasks.length ? (
                <ul className="divide-y divide-border">
                  {b.tomorrowMeetings.map((m) => (
                    <MeetingItem key={m.id} meeting={m} now={now} timeZone={tz} />
                  ))}
                  {b.tomorrowTasks.map((t) => (
                    <TaskItem key={t.id} task={t} now={now} timeZone={tz} />
                  ))}
                </ul>
              ) : (
                <EmptyState>Nada agendado para mañana.</EmptyState>
              )}
            </Card>
          </>
        )}
      </div>
    </>
  );
}
