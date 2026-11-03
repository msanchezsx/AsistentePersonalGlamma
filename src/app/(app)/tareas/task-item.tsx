import Link from "next/link";
import { formatDue } from "@/lib/tasks/format";
import { isOverdue, PRIORITY_LABELS, STATUS_LABELS, type Task } from "@/lib/tasks/model";
import { changeTaskStatus } from "./actions";

export function TaskItem({ task, now, timeZone }: { task: Task; now: Date; timeZone: string }) {
  const done = task.status === "done";
  const cancelled = task.status === "cancelled";
  const overdue = isOverdue(task, now);

  return (
    <li className="flex items-start gap-3 py-3">
      <form action={changeTaskStatus} className="pt-0.5">
        <input type="hidden" name="id" value={task.id} />
        <input type="hidden" name="action" value={done || cancelled ? "reopen" : "complete"} />
        <button
          type="submit"
          aria-label={done ? `Reabrir "${task.title}"` : `Marcar "${task.title}" como terminada`}
          className={`grid size-6 place-items-center rounded-full border-2 ${
            done ? "border-ok bg-ok text-white" : "border-border hover:border-accent"
          }`}
        >
          {done ? (
            <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth={3}>
              <path d="M5 12l5 5 9-10" />
            </svg>
          ) : null}
        </button>
      </form>

      <Link href={`/tareas/${task.id}`} className="min-w-0 flex-1">
        <p className={`font-medium ${done || cancelled ? "text-muted line-through" : ""}`}>{task.title}</p>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
          {task.due_at ? (
            <span className={overdue ? "font-medium text-danger" : ""}>
              {overdue ? "Venció " : ""}
              {formatDue(task, now, timeZone)}
            </span>
          ) : null}
          {task.recurrence_rule_id ? <span title="Se repite">↻ Se repite</span> : null}
          {task.is_urgent ? <Badge tone="danger">Urgente</Badge> : null}
          {task.is_important ? <Badge tone="accent">Importante</Badge> : null}
          {task.priority <= 2 ? <Badge tone="warn">{PRIORITY_LABELS[task.priority]}</Badge> : null}
          {task.status === "in_progress" || task.status === "waiting" || cancelled ? (
            <Badge tone="muted">{STATUS_LABELS[task.status]}</Badge>
          ) : null}
          {task.project ? <span>· {task.project.code ?? task.project.name}</span> : null}
          {task.client ? <span>· {task.client.name}</span> : null}
        </p>
      </Link>
    </li>
  );
}

const TONES = {
  danger: "bg-danger-soft text-danger",
  accent: "bg-accent-soft text-accent",
  warn: "bg-warn-soft text-warn",
  muted: "bg-surface-2 text-muted",
} as const;

function Badge({ tone, children }: { tone: keyof typeof TONES; children: React.ReactNode }) {
  return <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${TONES[tone]}`}>{children}</span>;
}
