import { DEFAULT_TIMEZONE } from "@/lib/constants";

/**
 * Conversión entre hora local (zona del usuario) y UTC sin dependencias.
 * Usa Intl para obtener el desfase real de la zona en esa fecha, por lo que
 * funciona aunque la zona tenga horario de verano.
 */

type Parts = { year: number; month: number; day: number; hour: number; minute: number; second: number };

function partsInZone(date: Date, timeZone: string): Parts {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const map = Object.fromEntries(fmt.formatToParts(date).map((p) => [p.type, p.value]));
  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
    hour: Number(map.hour),
    minute: Number(map.minute),
    second: Number(map.second),
  };
}

/** Desfase de la zona respecto a UTC, en minutos, en un instante dado. */
function offsetMinutes(date: Date, timeZone: string): number {
  const p = partsInZone(date, timeZone);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return Math.round((asUtc - Math.floor(date.getTime() / 1000) * 1000) / 60000);
}

/** "2026-11-03" + "16:00" en America/Mexico_City → instante UTC. */
export function zonedToUtc(dateStr: string, timeStr: string, timeZone: string = DEFAULT_TIMEZONE): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  const [hh, mm, ss = 0] = timeStr.split(":").map(Number);
  const guess = Date.UTC(y, m - 1, d, hh, mm, ss);
  // Dos pasadas para resolver correctamente los cambios de horario.
  let ts = guess - offsetMinutes(new Date(guess), timeZone) * 60000;
  ts = guess - offsetMinutes(new Date(ts), timeZone) * 60000;
  return new Date(ts);
}

/** Fecha local "YYYY-MM-DD" de un instante. */
export function localDateKey(date: Date, timeZone: string = DEFAULT_TIMEZONE): string {
  const p = partsInZone(date, timeZone);
  return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
}

/** Hora local "HH:mm" de un instante. */
export function localTimeKey(date: Date, timeZone: string = DEFAULT_TIMEZONE): string {
  const p = partsInZone(date, timeZone);
  return `${String(p.hour).padStart(2, "0")}:${String(p.minute).padStart(2, "0")}`;
}

/** Suma días a una fecha "YYYY-MM-DD" (calendario, sin zona). */
export function addDaysKey(dateKey: string, days: number): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return dt.toISOString().slice(0, 10);
}
