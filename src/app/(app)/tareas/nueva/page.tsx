import type { Metadata } from "next";
import { Card, PageHeader } from "@/components/ui";
import { listRelationOptions } from "@/lib/tasks/queries";
import { getViewer } from "@/lib/session";
import { createTask } from "../actions";
import { TaskForm } from "../task-form";

export const metadata: Metadata = { title: "Nueva tarea" };
export const dynamic = "force-dynamic";

export default async function NewTaskPage() {
  const viewer = await getViewer();
  const { projects, clients } = viewer.preview ? { projects: [], clients: [] } : await listRelationOptions();
  return (
    <>
      <PageHeader title="Nueva tarea" />
      <Card>
        <TaskForm
          action={createTask}
          submitLabel="Guardar tarea"
          projects={projects}
          clients={clients}
          defaults={{
            title: "",
            description: "",
            priority: 3,
            is_urgent: false,
            is_important: false,
            due_date: "",
            due_time: "",
            project_id: "",
            client_id: "",
            reminder: "",
            repeat: "",
            repeat_until: "",
          }}
        />
      </Card>
    </>
  );
}
