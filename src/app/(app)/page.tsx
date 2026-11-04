import Link from "next/link";
import { Icon } from "@/components/icon";
import { LiveClock } from "@/components/live-clock";
import { GlamaLogo } from "@/components/glama-logo";
import { Card, EmptyState } from "@/components/ui";
import { greetingFor } from "@/lib/datetime";
import { getViewer } from "@/lib/session";
import { groupTasks, type Task } from "@/lib/tasks/model";
import { listTasks } from "@/lib/tasks/queries";
import { TaskItem } from "./tareas/task-item";
import { MeetingItem } from "./agenda/meeting-item";
import { isActiveMeeting, type Meeting } from "@/lib/meetings/model";
import { listMeetings } from "@/lib/meetings/queries";
import { loadAlerts, loadBriefing } from "@/lib/briefing-server";
import { dismissReminder } from "./resumen/actions";
import { createClient } from "@/lib/supabase/server";
import { FOLLOW_UP_SELECT, groupFollowUps, type FollowUp } from "@/lib/projects";
import { FollowUpItem } from "./proyectos/parts";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const viewer = await getViewer();
  const now = new Date();
  const name = viewer.displayName ? `, ${viewer.displayName}` : "";

  return (
    <div className="space-y-5">
      <header className="space-y-1">
        {/* En celular no hay menú lateral: el logo va en el encabezado de Inicio. */}
        <GlamaLogo className="mb-3 w-20 md:hidden" priority />
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          {greetingFor(now, viewer.timezone)}
          {name}
        </h1>
        <LiveClock timeZone={viewer.timezone} initial={now.toISOString()} />
        {viewer.preview ? (
          <p className="pt-2 text-xs font-medium text-warn">Vista previa local sin base de datos.</p>
        ) : null}
      </header>

      {/* Accesos rápidos */}
      <div className="grid grid-cols-3 gap-3">
        <QuickAction icon="mic" label="Capturar" phase={1} href="/capturar" />
        <QuickAction icon="plus" label="Nueva tarea" phase={1} href="/tareas/nueva" />
        <QuickAction icon="spark" label="Asistente" phase={2} href="/inteligencia" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <UpcomingMeetings preview={viewer.preview} timeZone={viewer.timezone} now={now} />
        <PriorityTasks preview={viewer.preview} timeZone={viewer.timezone} now={now} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ExecutiveSummary />
        <Alerts />
        <FollowUpsCard timeZone={viewer.timezone} preview={viewer.preview} now={now} />
      </div>
    </div>
  );
}

function QuickAction({
  icon,
  label,
  phase,
  href,
}: {
  icon: "mic" | "plus" | "spark";
  label: string;
  phase: number;
  href?: string;
}) {
  const content = (
    <>
      <span className="grid size-11 place-items-center rounded-full bg-accent-soft text-accent">
        <Icon name={icon} className="size-5" />
      </span>
      <span className="text-sm font-medium">{label}</span>
      {href ? null : <span className="text-[11px] text-muted">Fase {phase}</span>}
    </>
  );
  const cls = "flex flex-col items-center gap-1.5 rounded-2xl border border-border bg-surface px-2 py-4 text-center";
  return href ? (
    <Link href={href} className={`${cls} hover:bg-surface-2`}>
      {content}
    </Link>
  ) : (
    <button
      type="button"
      disabled
      aria-disabled="true"
      title={`Disponible en la Fase ${phase}`}
      className={`${cls} opacity-70`}
    >
      {content}
    </button>
  );
}

/** Tareas vencidas, de hoy y las importantes sin fecha (máximo 5). */
async function PriorityTasks({ preview, timeZone, now }: { preview: boolean; timeZone: string; now: Date }) {
  const { tasks, error } = preview ? { tasks: [] as Task[], error: false } : await listTasks();
  const g = groupTasks(tasks, now, timeZone);
  const items = [...g.overdue, ...g.today, ...g.noDate.filter((t) => t.is_important || t.is_urgent)].slice(0, 5);
  const total = g.overdue.length + g.today.length;

  return (
    <Card>
      <div className="mb-1 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Tareas prioritarias</h2>
        <Link href="/tareas" className="text-sm font-medium text-accent">
          Ver todas
        </Link>
      </div>
      {error ? (
        <EmptyState>No se pudieron cargar las tareas.</EmptyState>
      ) : items.length === 0 ? (
        <EmptyState>No tienes tareas vencidas ni para hoy.</EmptyState>
      ) : (
        <>
          {total > 0 ? (
            <p className="text-xs text-muted">
              {g.overdue.length > 0 ? `${g.overdue.length} vencida${g.overdue.length === 1 ? "" : "s"} · ` : ""}
              {g.today.length} para hoy
            </p>
          ) : null}
          <ul className="divide-y divide-border">
            {items.map((t) => (
              <TaskItem key={t.id} task={t} now={now} timeZone={timeZone} />
            ))}
          </ul>
        </>
      )}
    </Card>
  );
}

/** Reuniones activas que aún no terminan, de hoy y mañana (máximo 4). */
async function UpcomingMeetings({ preview, timeZone, now }: { preview: boolean; timeZone: string; now: Date }) {
  const { meetings, error } = preview
    ? { meetings: [] as Meeting[], error: false }
    : await listMeetings({ pastDays: 0, futureDays: 2 });
  const items = meetings
    .filter((m) => isActiveMeeting(m) && new Date(m.ends_at) > now)
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at))
    .slice(0, 4);

  return (
    <Card>
      <div className="mb-1 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Próximas reuniones</h2>
        <Link href="/agenda?vista=dia" className="text-sm font-medium text-accent">
          Ver agenda
        </Link>
      </div>
      {error ? (
        <EmptyState>No se pudo cargar la agenda.</EmptyState>
      ) : items.length === 0 ? (
        <EmptyState>No tienes reuniones pendientes hoy ni mañana.</EmptyState>
      ) : (
        <ul className="divide-y divide-border">
          {items.map((m) => (
            <MeetingItem key={m.id} meeting={m} now={now} timeZone={timeZone} />
          ))}
        </ul>
      )}
    </Card>
  );
}

/** Resumen de la mañana o cierre del día (según la hora de cierre configurada). */
async function ExecutiveSummary() {
  const { briefing: b, error } = await loadBriefing();
  return (
    <Card>
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
          {b?.kind === "closing" ? "Cierre del día" : "Resumen ejecutivo"}
        </h2>
        <Link href="/resumen" className="text-sm font-medium text-accent">
          Ver resumen
        </Link>
      </div>
      {error || !b ? (
        <EmptyState>No se pudo armar el resumen.</EmptyState>
      ) : (
        <>
          <p className="font-medium">{b.headline}</p>
          {b.kind === "morning" && b.priorities.length ? (
            <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm">
              {b.priorities.map((t) => (
                <li key={t.id}>
                  <Link href={`/tareas/${t.id}`} className="hover:text-accent">
                    {t.title}
                  </Link>
                </li>
              ))}
            </ol>
          ) : null}
          <Link href="/podcast" className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-accent">
            <Icon name="headphones" className="size-4" />
            Escuchar resumen
          </Link>
        </>
      )}
    </Card>
  );
}

/** Recordatorios que ya llegaron, reuniones por empezar y tareas vencidas. */
async function Alerts() {
  const { alerts, error } = await loadAlerts();
  return (
    <Card>
      <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted">Alertas</h2>
      {error ? (
        <EmptyState>No se pudieron cargar las alertas.</EmptyState>
      ) : alerts.length === 0 ? (
        <EmptyState>Sin alertas por ahora.</EmptyState>
      ) : (
        <ul className="divide-y divide-border">
          {alerts.slice(0, 6).map((a) => (
            <li key={a.key} className="flex items-center gap-3 py-2.5">
              <span
                className={`size-2 shrink-0 rounded-full ${a.kind === "overdue" ? "bg-danger" : a.kind === "meeting" ? "bg-accent" : "bg-warn"}`}
              />
              <Link href={a.url} className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{a.title}</p>
                <p className="text-xs text-muted">{a.body}</p>
              </Link>
              {a.reminderId ? (
                <form action={dismissReminder}>
                  <input type="hidden" name="id" value={a.reminderId} />
                  <button type="submit" className="rounded-lg border border-border px-2.5 py-1 text-xs">
                    Listo
                  </button>
                </form>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

/** Compromisos abiertos: lo que debo y lo que me deben (máximo 5). */
async function FollowUpsCard({ preview, timeZone, now }: { preview: boolean; timeZone: string; now: Date }) {
  let items: FollowUp[] = [];
  if (!preview) {
    const supabase = await createClient();
    const { data } = await supabase.from("follow_ups").select(FOLLOW_UP_SELECT).eq("status", "open").limit(100);
    items = (data as unknown as FollowUp[] | null) ?? [];
  }
  const g = groupFollowUps(items, now);
  const list = [...g.mine, ...g.theirs]
    .sort((a, b) => (a.due_at ?? "9999").localeCompare(b.due_at ?? "9999"))
    .slice(0, 5);
  return (
    <Card className="lg:col-span-2">
      <div className="mb-1 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Seguimientos</h2>
        <Link href="/proyectos" className="text-sm font-medium text-accent">
          Ver todos
        </Link>
      </div>
      {list.length === 0 ? (
        <EmptyState>Sin compromisos abiertos.</EmptyState>
      ) : (
        <>
          <p className="text-xs text-muted">
            Yo debo {g.mine.length} · Me deben {g.theirs.length}
            {g.overdue ? ` · ${g.overdue} vencido${g.overdue === 1 ? "" : "s"}` : ""}
          </p>
          <ul className="divide-y divide-border">
            {list.map((f) => (
              <FollowUpItem key={f.id} f={f} now={now} timeZone={timeZone} />
            ))}
          </ul>
        </>
      )}
    </Card>
  );
}
