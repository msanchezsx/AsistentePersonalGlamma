import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { z } from "zod";
import { Card, PageHeader } from "@/components/ui";
import { formatLongDate } from "@/lib/datetime";
import { dueFormDefaults } from "@/lib/tasks/format";
import { STATUS_LABELS } from "@/lib/tasks/model";
import { getTask, listRelationOptions } from "@/lib/tasks/queries";
import { getViewer } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { minutesBefore } from "@/lib/reminders";
import { getScheduledReminder } from "@/lib/reminders-server";
import { zonedToUtc } from "@/lib/zoned-time";
import { describeRrule, repeatOptionOf } from "@/lib/recurrence";
import { changeTaskStatus, deleteTask, stopTaskRepeat, updateTask } from "../actions";
import { ConfirmButton } from "@/components/confirm-button";
import { TaskForm } from "../task-form";

export const metadata: Metadata = { title: "Editar tarea" };
export const dynamic = "force-dynamic";

export default async function EditTaskPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string>>;
}) {
  const { id } = await params;
  const { aviso } = await searchParams;
  if (!z.string().uuid().safeParse(id).success) notFound();
  const viewer = await getViewer();
  const supabase = await createClient();
  const [task, options, reminder] = await Promise.all([
    getTask(id),
    listRelationOptions(),
    getScheduledReminder(supabase, { kind: "task", id }),
  ]);
  if (!task) notFound();
  const dueDefaults = dueFormDefaults(task, viewer.timezone);
  const reminderBase =
    task.due_all_day && dueDefaults.due_date
      ? zonedToUtc(dueDefaults.due_date, "09:00", viewer.timezone).toISOString()
      : task.due_at;
  const reminderValue = minutesBefore(reminderBase, reminder?.remind_at ?? null);

  const open = task.status === "pending" || task.status === "in_progress" || task.status === "waiting";
  const statusButtons: { action: string; label: string; primary?: boolean }[] = open
    ? [
        { action: "complete", label: "Marcar como terminada", primary: true },
        ...(task.status !== "in_progress" ? [{ action: "start", label: "En proceso" }] : []),
        ...(task.status !== "waiting" ? [{ action: "wait", label: "En espera" }] : []),
        ...(task.status !== "pending" ? [{ action: "reopen", label: "Pendiente" }] : []),
      ]
    : [{ action: "reopen", label: "Reabrir tarea", primary: true }];

  return (
    <>
      <PageHeader title="Tarea" subtitle={`Estado: ${STATUS_LABELS[task.status]}`} />
      <div className="space-y-4">
        {aviso === "recordatorio" ? (
          <p role="alert" className="rounded-xl bg-warn-soft px-4 py-2.5 text-sm text-warn">
            La tarea se guardó, pero no el recordatorio. Elígelo de nuevo abajo y guarda.
          </p>
        ) : null}
        {aviso === "sin-repeticion" ? (
          <p role="status" className="rounded-xl bg-ok-soft px-4 py-2.5 text-sm text-ok">
            Listo: esta tarea ya no se repetirá.
          </p>
        ) : null}
        {task.recurrence ? (
          <Card>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm">
                <span className="font-medium">Se repite:</span> {describeRrule(task.recurrence.rrule, task.recurrence.until_date)}
                <span className="block text-xs text-muted">
                  Al terminarla o cancelarla se crea la siguiente repetición.
                </span>
              </p>
              <form action={stopTaskRepeat}>
                <input type="hidden" name="id" value={task.id} />
                <ConfirmButton message="¿Dejar de repetir esta tarea? No se crearán más repeticiones.">
                  Dejar de repetir
                </ConfirmButton>
              </form>
            </div>
          </Card>
        ) : null}
        <Card>
          <div className="flex flex-wrap gap-2">
            {statusButtons.map((b) => (
              <form key={b.action} action={changeTaskStatus}>
                <input type="hidden" name="id" value={task.id} />
                <input type="hidden" name="action" value={b.action} />
                <button
                  className={`rounded-xl px-4 py-2.5 text-sm font-medium ${
                    b.primary ? "bg-ok text-white" : "border border-border bg-surface"
                  }`}
                >
                  {b.label}
                </button>
              </form>
            ))}
          </div>
          {task.status === "done" && task.completed_at ? (
            <p className="mt-3 text-xs text-muted">
              Terminada el {formatLongDate(new Date(task.completed_at), viewer.timezone)}
              {task.completion_confirmed ? " (confirmado por ti)" : ""}.
            </p>
          ) : null}
        </Card>

        <Card title="Editar">
          <TaskForm
            action={updateTask}
            submitLabel="Guardar cambios"
            projects={options.projects}
            clients={options.clients}
            defaults={{
              id: task.id,
              title: task.title,
              description: task.description ?? "",
              priority: task.priority,
              is_urgent: task.is_urgent,
              is_important: task.is_important,
              project_id: task.project_id ?? "",
              client_id: task.client_id ?? "",
              reminder: reminderValue,
              repeat: repeatOptionOf(task.recurrence?.rrule),
              repeat_until: task.recurrence?.until_date ?? "",
              ...dueDefaults,
            }}
          />
        </Card>

        <Card>
          <div className="flex flex-wrap gap-2">
            {open ? (
              <form action={changeTaskStatus}>
                <input type="hidden" name="id" value={task.id} />
                <input type="hidden" name="action" value="cancel" />
                <ConfirmButton message="¿Cancelar esta tarea? Seguirá en el historial.">Cancelar tarea</ConfirmButton>
              </form>
            ) : null}
            <form action={deleteTask}>
              <input type="hidden" name="id" value={task.id} />
              <ConfirmButton message="¿Eliminar esta tarea definitivamente?" danger>
                Eliminar
              </ConfirmButton>
            </form>
          </div>
        </Card>
      </div>
    </>
  );
}
