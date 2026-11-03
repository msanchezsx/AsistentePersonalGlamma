/**
 * Recurrencias con un subconjunto de RRULE (RFC 5545), calculadas sobre
 * fechas de calendario locales ("YYYY-MM-DD") para no depender de la zona.
 * Sin dependencias: se puede usar en el cliente.
 *
 * Patrones soportados:
 *   FREQ=DAILY
 *   FREQ=DAILY;BYDAY=MO,TU,WE,TH,FR      (días laborables)
 *   FREQ=WEEKLY;INTERVAL=n;BYDAY=XX      (cada n semanas, un día)
 *   FREQ=MONTHLY;BYMONTHDAY=d            (cada mes el día d; se omiten meses sin ese día)
 */

export const REPEAT_OPTIONS = [
  { value: "", label: "No se repite" },
  { value: "daily", label: "Todos los días" },
  { value: "weekdays", label: "De lunes a viernes" },
  { value: "weekly", label: "Cada semana" },
  { value: "biweekly", label: "Cada 2 semanas" },
  { value: "monthly", label: "Cada mes" },
] as const;

export type RepeatOption = (typeof REPEAT_OPTIONS)[number]["value"];

const BYDAY = ["MO", "TU", "WE", "TH", "FR", "SA", "SU"]; // índice 0 = lunes
const DAY_NAMES = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"];

function parseKey(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function toKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** 0 = lunes … 6 = domingo */
export function isoWeekday(key: string): number {
  return (parseKey(key).getUTCDay() + 6) % 7;
}

export function isRepeatOption(v: string): v is RepeatOption {
  return REPEAT_OPTIONS.some((o) => o.value === v);
}

export function buildRrule(option: RepeatOption, startKey: string): string | null {
  switch (option) {
    case "daily":
      return "FREQ=DAILY";
    case "weekdays":
      return "FREQ=DAILY;BYDAY=MO,TU,WE,TH,FR";
    case "weekly":
      return `FREQ=WEEKLY;BYDAY=${BYDAY[isoWeekday(startKey)]}`;
    case "biweekly":
      return `FREQ=WEEKLY;INTERVAL=2;BYDAY=${BYDAY[isoWeekday(startKey)]}`;
    case "monthly":
      return `FREQ=MONTHLY;BYMONTHDAY=${Number(startKey.slice(8, 10))}`;
    default:
      return null;
  }
}

type Rule = { freq: string; interval: number; byday: number[] | null; bymonthday: number | null };

function parseRrule(rrule: string): Rule {
  const parts = Object.fromEntries(
    rrule.split(";").map((p) => {
      const [k, v] = p.split("=");
      return [k, v];
    }),
  );
  return {
    freq: parts.FREQ,
    interval: Math.max(1, Number(parts.INTERVAL ?? 1)),
    byday: parts.BYDAY ? parts.BYDAY.split(",").map((d: string) => BYDAY.indexOf(d)) : null,
    bymonthday: parts.BYMONTHDAY ? Number(parts.BYMONTHDAY) : null,
  };
}

export function repeatOptionOf(rrule: string | null | undefined): RepeatOption {
  if (!rrule) return "";
  const r = parseRrule(rrule);
  if (r.freq === "DAILY") return r.byday ? "weekdays" : "daily";
  if (r.freq === "WEEKLY") return r.interval === 2 ? "biweekly" : "weekly";
  if (r.freq === "MONTHLY") return "monthly";
  return "";
}

export function describeRrule(rrule: string | null | undefined, untilKey?: string | null): string {
  if (!rrule) return "No se repite";
  const r = parseRrule(rrule);
  let text: string;
  if (r.freq === "DAILY") text = r.byday ? "De lunes a viernes" : "Todos los días";
  else if (r.freq === "WEEKLY") {
    const day = r.byday?.length ? DAY_NAMES[r.byday[0]] : "";
    text = r.interval === 2 ? `Cada 2 semanas, el ${day}` : `Cada ${day}`;
  } else if (r.freq === "MONTHLY") text = `Cada mes, el día ${r.bymonthday}`;
  else text = "Se repite";
  if (untilKey) {
    const [y, m, d] = untilKey.split("-").map(Number);
    const fmt = new Intl.DateTimeFormat("es-MX", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
    text += ` hasta el ${fmt.format(new Date(Date.UTC(y, m - 1, d)))}`;
  }
  return text;
}

/**
 * Fechas de la serie posteriores a `afterKey` (exclusivo), sin pasar de
 * `untilKey` (inclusivo) ni de `limit` resultados. `startKey` es la primera
 * fecha de la serie y fija el ritmo (semana par/impar, día del mes).
 */
export function occurrencesAfter(
  rrule: string,
  startKey: string,
  afterKey: string,
  opts: { untilKey?: string | null; limit?: number; horizonKey?: string } = {},
): string[] {
  const { untilKey = null, limit = 60 } = opts;
  const r = parseRrule(rrule);
  const start = parseKey(startKey);
  const after = parseKey(afterKey);
  const until = untilKey ? parseKey(untilKey) : null;
  const horizon = opts.horizonKey ? parseKey(opts.horizonKey) : null;
  const out: string[] = [];
  const stop = (d: Date) => (until && d > until) || (horizon && d > horizon);

  if (r.freq === "MONTHLY") {
    const day = r.bymonthday ?? start.getUTCDate();
    for (let i = 0; out.length < limit && i < 1200; i++) {
      const y = start.getUTCFullYear();
      const m = start.getUTCMonth() + i * r.interval;
      const candidate = new Date(Date.UTC(y, m, day));
      if (candidate.getUTCDate() !== day) continue; // mes sin ese día (p. ej. 31)
      if (stop(candidate)) break;
      if (candidate > after && candidate >= start) out.push(toKey(candidate));
    }
    return out;
  }

  // DAILY / WEEKLY: recorrer día por día (series cortas, límite pequeño).
  const startMonday = new Date(start.getTime() - isoWeekday(startKey) * 86400_000);
  for (let i = 0; out.length < limit && i < 3660; i++) {
    const d = new Date(start.getTime() + i * 86400_000);
    if (stop(d)) break;
    if (d <= after) continue;
    const wd = (d.getUTCDay() + 6) % 7;
    if (r.freq === "DAILY") {
      if (i % r.interval !== 0) continue;
      if (r.byday && !r.byday.includes(wd)) continue;
    } else if (r.freq === "WEEKLY") {
      const week = Math.floor((d.getTime() - startMonday.getTime()) / (7 * 86400_000));
      if (week % r.interval !== 0) continue;
      const days = r.byday ?? [isoWeekday(startKey)];
      if (!days.includes(wd)) continue;
    } else {
      break;
    }
    out.push(toKey(d));
  }
  return out;
}

/** ¿La fecha inicial cumple la regla? (p. ej. "de lunes a viernes" empezando en sábado) */
export function startMatchesRule(rrule: string, startKey: string): boolean {
  const r = parseRrule(rrule);
  if (r.byday && (r.freq === "DAILY" || r.freq === "WEEKLY")) return r.byday.includes(isoWeekday(startKey));
  return true;
}

export type RepeatInput = { option: RepeatOption; untilKey: string | null };

/** Lee "repeat" y "repeat_until" del formulario. Devuelve error en texto si no es válido. */
export function parseRepeatInput(
  formData: FormData,
  startKey: string | null,
): { ok: true; value: RepeatInput } | { ok: false; field: "repeat" | "repeat_until"; message: string } {
  const raw = String(formData.get("repeat") ?? "");
  if (!isRepeatOption(raw)) return { ok: false, field: "repeat", message: "Opción de repetición inválida" };
  const untilRaw = String(formData.get("repeat_until") ?? "").trim();
  if (raw === "") return { ok: true, value: { option: "", untilKey: null } };
  if (!startKey) return { ok: false, field: "repeat", message: "Para repetir, indica la fecha" };
  if (untilRaw === "") return { ok: true, value: { option: raw, untilKey: null } };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(untilRaw)) return { ok: false, field: "repeat_until", message: "Fecha inválida" };
  if (untilRaw < startKey)
    return { ok: false, field: "repeat_until", message: "Debe ser igual o posterior a la fecha inicial" };
  return { ok: true, value: { option: raw, untilKey: untilRaw } };
}
