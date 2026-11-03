import Link from "next/link";
import { Icon } from "@/components/icon";
import { LiveClock } from "@/components/live-clock";
import { Card, EmptyState, PhaseBadge } from "@/components/ui";
import { greetingFor } from "@/lib/datetime";
import { getViewer } from "@/lib/session";
import { groupTasks, type Task } from "@/lib/tasks/model";
import { listTasks } from "@/lib/tasks/queries";
import { TaskItem } from "./tareas/task-item";
import { MeetingItem } from "./agenda/meeting-item";
import { isActiveMeeting, type Meeting } from "@/lib/meetings/model";
import { listMeetings } from "@/lib/meetings/queries";

export const dynamic = "force-dynamic";

const SECTIONS = [
  {
    title: "Resumen ejecutivo",
    phase: 4,
    text: "El resumen de inicio de jornada se generará automáticamente a partir de tu agenda, tareas y correos.",
  },
  { title: "Alertas", phase: 4, text: "Actividades vencidas y compromisos próximos a vencer." },
  { title: "Seguimientos", phase: 1, text: "Seguimientos y compromisos abiertos con clientes y colaboradores." },
];

export default async function HomePage() {
  const viewer = await getViewer();
  const now = new Date();
  const name = viewer.displayName ? `, ${viewer.displayName}` : "";

  return (
    <div className="space-y-5">
      <header className="space-y-1">
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
        <QuickAction icon="mic" label="Voz" phase={1} />
        <QuickAction icon="plus" label="Nueva tarea" phase={1} href="/tareas/nueva" />
        <QuickAction icon="spark" label="Asistente" phase={2} href="/inteligencia" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <UpcomingMeetings preview={viewer.preview} timeZone={viewer.timezone} now={now} />
        <PriorityTasks preview={viewer.preview} timeZone={viewer.timezone} now={now} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {SECTIONS.map((s, i) => (
          <Card key={s.title} className={i === 0 ? "lg:col-span-2" : ""}>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">{s.title}</h2>
              <PhaseBadge phase={s.phase} />
            </div>
            <EmptyState>{s.text}</EmptyState>
          </Card>
        ))}
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
        <Link href="/agenda" className="text-sm font-medium text-accent">
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
