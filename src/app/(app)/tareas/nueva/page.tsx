import type { Metadata } from "next";
import { Card, CaptureNotice, PageHeader } from "@/components/ui";
import { listRelationOptions } from "@/lib/tasks/queries";
import { getViewer } from "@/lib/session";
import { createTask } from "../actions";
import { TaskForm } from "../task-form";
import { readPrefill } from "@/lib/prefill";

export const metadata: Metadata = { title: "Nueva tarea" };
export const dynamic = "force-dynamic";

export default async function NewTaskPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const pre = readPrefill(await searchParams);
  const viewer = await getViewer();
  const { projects, clients } = viewer.preview ? { projects: [], clients: [] } : await listRelationOptions();
  return (
    <>
      <PageHeader title="Nueva tarea" />
      {pre.fromCapture ? <CaptureNotice /> : null}
      <Card>
        <TaskForm
          action={createTask}
          submitLabel="Guardar tarea"
          projects={projects}
          clients={clients}
          defaults={{
            title: pre.title,
            description: pre.description,
            priority: 3,
            is_urgent: pre.urgent,
            is_important: pre.important,
            due_date: pre.date,
            due_time: pre.time,
            project_id: "",
            client_id: "",
            reminder: "",
            repeat: pre.repeat,
            repeat_until: "",
          }}
        />
      </Card>
    </>
  );
}
