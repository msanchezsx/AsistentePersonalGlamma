import { DEFAULT_TIMEZONE } from "@/lib/constants";
import type { Task } from "@/lib/tasks/model";
import { addDaysKey, localDateKey, localTimeKey } from "@/lib/zoned-time";

/** "Hoy 4:00 p.m.", "Mañana", "Ayer 9:00 a.m.", "vie 7 nov" … */
export function formatDue(
  task: Pick<Task, "due_at" | "due_all_day">,
  now: Date,
  timeZone: string = DEFAULT_TIMEZONE,
): string {
  if (!task.due_at) return "";
  const due = new Date(task.due_at);
  const key = localDateKey(due, timeZone);
  const today = localDateKey(now, timeZone);

  let day: string;
  if (key === today) day = "hoy";
  else if (key === addDaysKey(today, 1)) day = "mañana";
  else if (key === addDaysKey(today, -1)) day = "ayer";
  else {
    day = new Intl.DateTimeFormat("es-MX", {
      weekday: "short",
      day: "numeric",
      month: "short",
      timeZone,
      ...(key.slice(0, 4) !== today.slice(0, 4) ? { year: "numeric" } : {}),
    })
      .format(due)
      .replace(/\./g, "");
  }
  day = day.charAt(0).toUpperCase() + day.slice(1);
  if (task.due_all_day) return day;
  const time = new Intl.DateTimeFormat("es-MX", { hour: "numeric", minute: "2-digit", hour12: true, timeZone }).format(
    due,
  );
  return `${day} ${time}`;
}

/** Valores de fecha/hora para precargar el formulario. */
export function dueFormDefaults(
  task: Pick<Task, "due_at" | "due_all_day">,
  timeZone: string = DEFAULT_TIMEZONE,
): { due_date: string; due_time: string } {
  if (!task.due_at) return { due_date: "", due_time: "" };
  const d = new Date(task.due_at);
  return { due_date: localDateKey(d, timeZone), due_time: task.due_all_day ? "" : localTimeKey(d, timeZone) };
}
