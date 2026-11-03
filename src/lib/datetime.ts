import { DEFAULT_TIMEZONE as APP_TIMEZONE } from "@/lib/constants";

/** Hora local (0-23) en la zona horaria del usuario. */
export function localHour(date: Date, timeZone: string = APP_TIMEZONE): number {
  const hour = new Intl.DateTimeFormat("en-US", { hour: "numeric", hourCycle: "h23", timeZone }).format(date);
  return Number(hour);
}

export function greetingFor(date: Date, timeZone: string = APP_TIMEZONE): string {
  const h = localHour(date, timeZone);
  if (h >= 5 && h < 12) return "Buenos días";
  if (h >= 12 && h < 19) return "Buenas tardes";
  return "Buenas noches";
}

export function formatLongDate(date: Date, timeZone: string = APP_TIMEZONE): string {
  const text = new Intl.DateTimeFormat("es-MX", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone,
  }).format(date);
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function formatTime(date: Date, timeZone: string = APP_TIMEZONE): string {
  return new Intl.DateTimeFormat("es-MX", { hour: "2-digit", minute: "2-digit", hour12: true, timeZone }).format(date);
}

/** ¿Es día y hora laboral? (lunes a viernes, 9:00 a 17:00 por defecto) */
export function isWorkingTime(
  date: Date,
  opts: { timeZone?: string; workDays?: number[]; startHour?: number; endHour?: number } = {},
): boolean {
  const { timeZone = APP_TIMEZONE, workDays = [1, 2, 3, 4, 5], startHour = 9, endHour = 17 } = opts;
  const weekday = new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone }).format(date);
  const iso = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].indexOf(weekday) + 1;
  const h = localHour(date, timeZone);
  return workDays.includes(iso) && h >= startHour && h < endHour;
}
