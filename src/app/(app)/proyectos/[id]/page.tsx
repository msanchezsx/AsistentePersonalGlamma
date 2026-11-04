import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, EmptyState, PageHeader } from "@/components/ui";
import { ConfirmButton } from "@/components/confirm-button";
import { createClient } from "@/lib/supabase/server";
import { getViewer } from "@/lib/session";
import { listContactOptions, listRelationOptions } from "@/lib/tasks/queries";
import { TASK_SELECT, type Task } from "@/lib/tasks/model";
import { MEETING_SELECT, type Meeting } from "@/lib/meetings/model";
import { FOLLOW_UP_SELECT, PROJECT_SELECT, PROJECT_STATUS_LABELS, groupFollowUps, type FollowUp, type Project } from "@/lib/projects";
import { TaskItem } from "../../tareas/task-item";
import { MeetingItem } from "../../agenda/meeting-item";
import { deleteProject, updateProject } from "../actions";
import { ClientSelect, FollowUpForm, FollowUpItem, Notice, inputCls } from "../parts";

export const metadata: Metadata = { title: "Proyecto" };
export const dynamic = "force-dynamic";

export default async function ProjectPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string>>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const viewer = await getViewer();
  if (viewer.preview || !/^[0-9a-f-]{36}$/.test(id)) notFound();
  const supabase = await createClient();
  const [{ data: proj }, t, m, f, rel, contacts] = await Promise.all([
    supabase.from("projects").select(PROJECT_SELECT).eq("id", id).maybeSingle(),
    supabase.from("tasks").select(TASK_SELECT).eq("project_id", id).order("due_at", { nullsFirst: false }).limit(200),
    supabase.from("meetings").select(MEETING_SELECT).eq("project_id", id).order("starts_at", { ascending: false }).limit(50),
    supabase.from("follow_ups").select(FOLLOW_UP_SELECT).eq("project_id", id).limit(200),
    listRelationOptions(),
    listContactOptions(),
  ]);
  const project = proj as unknown as Project | null;
  if (!project) notFound();
  const now = new Date();
  const tz = viewer.timezone;
  const tasks = (t.data as unknown as Task[] | null) ?? [];
  const openTasks = tasks.filter((x) => x.status !== "done" && x.status !== "cancelled");
  const doneTasks = tasks.length - openTasks.length;
  const meetings = (m.data as unknown as Meeting[] | null) ?? [];
  const g = groupFollowUps((f.data as unknown as FollowUp[] | null) ?? [], now);
  const follow = [...g.mine, ...g.theirs];

  return (
    <>
      <PageHeader
        title={project.code ? `${project.name} · #${project.code}` : project.name}
        subtitle={`${PROJECT_STATUS_LABELS[project.status]}${project.client ? ` · ${project.client.name}` : ""} · ${doneTasks}/${tasks.length} tareas terminadas`}
        action={
          <Link href="/proyectos?vista=proyectos" className="rounded-xl border border-border px-3 py-2 text-sm text-muted">
            Volver
          </Link>
        }
      />
      <Notice params={sp} />
      <div className="space-y-4">
        <Card title={`Tareas abiertas · ${openTasks.length}`}>
          {openTasks.length ? (
            <ul className="divide-y divide-border">
              {openTasks.map((x) => (
                <TaskItem key={x.id} task={x} now={now} timeZone={tz} />
              ))}
            </ul>
          ) : (
            <EmptyState>Sin tareas abiertas. Al crear una tarea, elige este proyecto.</EmptyState>
          )}
          <Link href="/tareas/nueva" className="mt-2 inline-block text-sm font-medium text-accent">
            + Nueva tarea
          </Link>
        </Card>

        <Card title={`Seguimientos · ${follow.length}`}>
          {follow.length ? (
            <ul className="mb-4 divide-y divide-border">
              {follow.map((x) => (
                <FollowUpItem key={x.id} f={x} now={now} timeZone={tz} />
              ))}
            </ul>
          ) : null}
          <FollowUpForm contacts={contacts} projects={[]} clients={[]} projectId={project.id} />
        </Card>

        {meetings.length ? (
          <Card title="Reuniones">
            <ul className="divide-y divide-border">
              {meetings.map((x) => (
                <MeetingItem key={x.id} meeting={x} now={now} timeZone={tz} />
              ))}
            </ul>
          </Card>
        ) : null}

        <Card title="Datos del proyecto">
          <form action={updateProject} className="space-y-3">
            <input type="hidden" name="id" value={project.id} />
            <input type="hidden" name="version" value={project.updated_at} />
            <div className="grid gap-3 sm:grid-cols-[1fr_10rem]">
              <input name="name" required maxLength={160} defaultValue={project.name} aria-label="Nombre" className={inputCls} />
              <input name="code" maxLength={40} defaultValue={project.code ?? ""} placeholder="Pedido / código" aria-label="Pedido o código" className={inputCls} />
            </div>
            <textarea
              name="description"
              rows={3}
              maxLength={4000}
              defaultValue={project.description ?? ""}
              placeholder="Descripción"
              aria-label="Descripción"
              className={inputCls}
            />
            <div className="grid gap-3 sm:grid-cols-2">
              <ClientSelect clients={rel.clients} defaultValue={project.client_id ?? ""} />
              <select name="status" defaultValue={project.status} aria-label="Estado" className={inputCls}>
                {Object.entries(PROJECT_STATUS_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-sm text-muted">
                Inicio
                <input name="start_date" type="date" defaultValue={project.start_date ?? ""} className={inputCls} />
              </label>
              <label className="text-sm text-muted">
                Entrega
                <input name="due_date" type="date" defaultValue={project.due_date ?? ""} className={inputCls} />
              </label>
            </div>
            <button type="submit" className="rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-accent-text">
              Guardar cambios
            </button>
          </form>
        </Card>

        <form action={deleteProject}>
          <input type="hidden" name="id" value={project.id} />
          <ConfirmButton message="¿Eliminar este proyecto? Sus tareas y seguimientos se conservan sin proyecto." danger>
            Eliminar proyecto
          </ConfirmButton>
        </form>
      </div>
    </>
  );
}
