import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { z } from "zod";
import { Card, PageHeader } from "@/components/ui";
import { formatLongDate } from "@/lib/datetime";
import { dueFormDefaults } from "@/lib/tasks/format";
import { STATUS_LABELS } from "@/lib/tasks/model";
import { getTask, listRelationOptions } from "@/lib/tasks/queries";
import { getViewer } from "@/lib/session";
import { changeTaskStatus, deleteTask, updateTask } from "../actions";
import { ConfirmButton } from "./confirm-button";
import { TaskForm } from "../task-form";

export const metadata: Metadata = { title: "Editar tarea" };
export const dynamic = "force-dynamic";

export default async function EditTaskPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) notFound();
  const viewer = await getViewer();
  const [task, options] = await Promise.all([getTask(id), listRelationOptions()]);
  if (!task) notFound();

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
              ...dueFormDefaults(task, viewer.timezone),
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
