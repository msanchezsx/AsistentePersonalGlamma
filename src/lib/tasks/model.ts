import { z } from "zod";
import { DEFAULT_TIMEZONE } from "@/lib/constants";
import { addDaysKey, localDateKey, zonedToUtc } from "@/lib/zoned-time";

export { PRIORITY_LABELS, STATUS_LABELS, TASK_STATUSES, type TaskStatus } from "@/lib/tasks/labels";
import type { TaskStatus } from "@/lib/tasks/labels";

export type Task = {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: number;
  is_urgent: boolean;
  is_important: boolean;
  due_at: string | null;
  due_all_day: boolean;
  completed_at: string | null;
  completion_confirmed: boolean;
  project_id: string | null;
  client_id: string | null;
  source: string;
  created_at: string;
  updated_at: string;
  project?: { id: string; name: string; code: string | null } | null;
  client?: { id: string; name: string } | null;
  recurrence_rule_id?: string | null;
  recurrence?: { id: string; rrule: string; until_date: string | null } | null;
};

export const TASK_SELECT =
  "id, title, description, status, priority, is_urgent, is_important, due_at, due_all_day, completed_at, completion_confirmed, project_id, client_id, source, created_at, updated_at, project:projects(id, name, code), client:clients(id, name), recurrence_rule_id, recurrence:recurrence_rules(id, rrule, until_date)";

const optionalUuid = z
  .string()
  .trim()
  .transform((v) => (v === "" ? null : v))
  .pipe(z.string().uuid().nullable());

const dateKey = z
  .string()
  .trim()
  .refine((v) => v === "" || /^\d{4}-\d{2}-\d{2}$/.test(v), "Fecha inválida")
  .transform((v) => (v === "" ? null : v));

const timeKey = z
  .string()
  .trim()
  .refine((v) => v === "" || /^([01]\d|2[0-3]):[0-5]\d$/.test(v), "Hora inválida")
  .transform((v) => (v === "" ? null : v));

/** Datos del formulario de tarea (todo llega como texto desde FormData). */
export const taskFormSchema = z
  .object({
    title: z.string().trim().min(1, "Escribe un título").max(300, "Máximo 300 caracteres"),
    description: z
      .string()
      .trim()
      .max(4000, "Máximo 4000 caracteres")
      .transform((v) => (v === "" ? null : v)),
    priority: z.coerce.number().int().min(1).max(5),
    is_urgent: z.boolean(),
    is_important: z.boolean(),
    due_date: dateKey,
    due_time: timeKey,
    project_id: optionalUuid,
    client_id: optionalUuid,
  })
  .refine((v) => !(v.due_time && !v.due_date), { message: "Indica también la fecha", path: ["due_date"] });

export type TaskFormValues = z.infer<typeof taskFormSchema>;

export function parseTaskForm(formData: FormData) {
  return taskFormSchema.safeParse({
    title: String(formData.get("title") ?? ""),
    description: String(formData.get("description") ?? ""),
    priority: String(formData.get("priority") ?? "3"),
    is_urgent: formData.get("is_urgent") === "on",
    is_important: formData.get("is_important") === "on",
    due_date: String(formData.get("due_date") ?? ""),
    due_time: String(formData.get("due_time") ?? ""),
    project_id: String(formData.get("project_id") ?? ""),
    client_id: String(formData.get("client_id") ?? ""),
  });
}

/** Convierte fecha/hora local en los campos due_at / due_all_day. */
export function toDueFields(
  values: Pick<TaskFormValues, "due_date" | "due_time">,
  timeZone: string = DEFAULT_TIMEZONE,
): { due_at: string | null; due_all_day: boolean } {
  if (!values.due_date) return { due_at: null, due_all_day: false };
  if (!values.due_time) {
    return { due_at: zonedToUtc(values.due_date, "23:59:59", timeZone).toISOString(), due_all_day: true };
  }
  return { due_at: zonedToUtc(values.due_date, values.due_time, timeZone).toISOString(), due_all_day: false };
}

export function isOpen(task: Pick<Task, "status">): boolean {
  return task.status === "pending" || task.status === "in_progress" || task.status === "waiting";
}

export function isOverdue(task: Pick<Task, "status" | "due_at">, now: Date): boolean {
  return isOpen(task) && task.due_at !== null && new Date(task.due_at).getTime() < now.getTime();
}

export type TaskGroups = {
  overdue: Task[];
  today: Task[];
  tomorrow: Task[];
  upcoming: Task[];
  noDate: Task[];
  closed: Task[];
};

/** Orden: urgente+importante primero, luego prioridad, luego fecha. */
export function compareTasks(a: Task, b: Task): number {
  const quadrant = (t: Task) => (t.is_urgent && t.is_important ? 0 : t.is_important ? 1 : t.is_urgent ? 2 : 3);
  return (
    quadrant(a) - quadrant(b) ||
    a.priority - b.priority ||
    (a.due_at ?? "9999").localeCompare(b.due_at ?? "9999") ||
    a.created_at.localeCompare(b.created_at)
  );
}

export function groupTasks(tasks: Task[], now: Date, timeZone: string = DEFAULT_TIMEZONE): TaskGroups {
  const todayKey = localDateKey(now, timeZone);
  const tomorrowKey = addDaysKey(todayKey, 1);
  const groups: TaskGroups = { overdue: [], today: [], tomorrow: [], upcoming: [], noDate: [], closed: [] };

  for (const t of tasks) {
    if (!isOpen(t)) {
      groups.closed.push(t);
      continue;
    }
    if (!t.due_at) {
      groups.noDate.push(t);
      continue;
    }
    if (isOverdue(t, now)) {
      groups.overdue.push(t);
      continue;
    }
    const key = localDateKey(new Date(t.due_at), timeZone);
    if (key === todayKey) groups.today.push(t);
    else if (key === tomorrowKey) groups.tomorrow.push(t);
    else groups.upcoming.push(t);
  }

  groups.overdue.sort(compareTasks);
  groups.today.sort(compareTasks);
  groups.tomorrow.sort(compareTasks);
  groups.noDate.sort(compareTasks);
  groups.upcoming.sort((a, b) => (a.due_at ?? "").localeCompare(b.due_at ?? "") || compareTasks(a, b));
  groups.closed.sort((a, b) => (b.completed_at ?? b.updated_at).localeCompare(a.completed_at ?? a.updated_at));
  return groups;
}
