import type { Metadata } from "next";
import Link from "next/link";
import { Icon } from "@/components/icon";
import { Card, EmptyState, PageHeader } from "@/components/ui";
import { groupTasks, type Task } from "@/lib/tasks/model";
import { listTasks } from "@/lib/tasks/queries";
import { getViewer } from "@/lib/session";
import { TaskItem } from "./task-item";

export const metadata: Metadata = { title: "Tareas" };
export const dynamic = "force-dynamic";

const NOTICES: Record<string, string> = {
  creada: "Tarea creada.",
  actualizada: "Tarea actualizada.",
  eliminada: "Tarea eliminada.",
};

export default async function TasksPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const params = await searchParams;
  const notice = Object.keys(NOTICES).find((k) => k in params);
  const viewer = await getViewer();
  const now = new Date();
  const { tasks, error } = viewer.preview ? { tasks: [] as Task[], error: false } : await listTasks();
  const g = groupTasks(tasks, now, viewer.timezone);
  const openCount = g.overdue.length + g.today.length + g.tomorrow.length + g.upcoming.length + g.noDate.length;

  const sections: { key: string; title: string; items: Task[]; tone?: string }[] = [
    { key: "overdue", title: "Vencidas", items: g.overdue, tone: "text-danger" },
    { key: "today", title: "Hoy", items: g.today },
    { key: "tomorrow", title: "Mañana", items: g.tomorrow },
    { key: "upcoming", title: "Próximas", items: g.upcoming },
    { key: "noDate", title: "Sin fecha", items: g.noDate },
  ];

  return (
    <>
      <PageHeader
        title="Tareas"
        subtitle={
          openCount === 0
            ? "No tienes tareas abiertas."
            : `${openCount} abierta${openCount === 1 ? "" : "s"}${g.overdue.length ? ` · ${g.overdue.length} vencida${g.overdue.length === 1 ? "" : "s"}` : ""}`
        }
        action={
          <Link
            href="/tareas/nueva"
            className="flex items-center gap-1.5 rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-accent-text"
          >
            <Icon name="plus" className="size-4" />
            Nueva
          </Link>
        }
      />

      {notice ? (
        <p role="status" className="mb-4 rounded-xl bg-ok-soft px-4 py-2.5 text-sm text-ok">
          {NOTICES[notice]}
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="mb-4 rounded-xl bg-danger-soft px-4 py-2.5 text-sm text-danger">
          No se pudieron cargar las tareas. Revisa tu conexión y recarga.
        </p>
      ) : null}

      <div className="space-y-4">
        {openCount === 0 && !error ? (
          <Card>
            <EmptyState>Registra tu primera tarea con el botón &quot;Nueva&quot;.</EmptyState>
          </Card>
        ) : null}

        {sections
          .filter((s) => s.items.length > 0)
          .map((s) => (
            <Card key={s.key}>
              <h2 className={`text-sm font-semibold uppercase tracking-wide ${s.tone ?? "text-muted"}`}>
                {s.title} <span className="font-normal">({s.items.length})</span>
              </h2>
              <ul className="divide-y divide-border">
                {s.items.map((t) => (
                  <TaskItem key={t.id} task={t} now={now} timeZone={viewer.timezone} />
                ))}
              </ul>
            </Card>
          ))}

        {g.closed.length > 0 ? (
          <details className="rounded-2xl border border-border bg-surface p-4 sm:p-5">
            <summary className="cursor-pointer text-sm font-semibold uppercase tracking-wide text-muted">
              Cerradas en los últimos 14 días ({g.closed.length})
            </summary>
            <ul className="mt-2 divide-y divide-border">
              {g.closed.map((t) => (
                <TaskItem key={t.id} task={t} now={now} timeZone={viewer.timezone} />
              ))}
            </ul>
          </details>
        ) : null}
      </div>
    </>
  );
}
