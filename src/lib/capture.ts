/**
 * Intérprete de frases en español para registrar tareas y reuniones por
 * texto o voz. Sin IA ni red: reglas deterministas. El resultado SIEMPRE se
 * muestra al usuario en el formulario para revisarlo antes de guardar.
 *
 * Ejemplos:
 *   "Junta con Ana y Luis mañana a las 10 por 30 minutos"
 *   "Recuérdame enviar la cotización el viernes urgente"
 *   "Revisar inventario todos los lunes a las 9"
 */
import type { RepeatOption } from "@/lib/recurrence";
import { addDaysKey } from "@/lib/zoned-time";
import { formatClock } from "@/lib/planner";

export type CaptureResult = {
  kind: "task" | "meeting";
  title: string;
  dateKey: string | null;
  /** "HH:mm" */
  time: string | null;
  endTime: string | null;
  participants: string[];
  urgent: boolean;
  important: boolean;
  repeat: RepeatOption;
};

const DAYS = ["lunes", "martes", "miercoles", "jueves", "viernes", "sabado", "domingo"];
const MONTHS = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];
const NUMBER_WORDS: Record<string, number> = {
  una: 1,
  un: 1,
  uno: 1,
  dos: 2,
  tres: 3,
  cuatro: 4,
  cinco: 5,
  seis: 6,
  siete: 7,
  ocho: 8,
  nueve: 9,
  diez: 10,
  once: 11,
  doce: 12,
};

const MEETING_WORDS = /\b(reunion|junta|cita|llamada|videollamada|videoconferencia|visita|comida con|desayuno con)\b/;

/** Quita acentos sin cambiar la longitud (para poder borrar por posición). */
function fold(s: string): string {
  const map: Record<string, string> = { á: "a", é: "e", í: "i", ó: "o", ú: "u", ü: "u", Á: "a", É: "e", Í: "i", Ó: "o", Ú: "u", Ü: "u", ñ: "n", Ñ: "n" };
  return Array.from(s.toLowerCase(), (c) => map[c] ?? c)
    .join("")
    .slice(0, s.length);
}

function isoWeekday(key: string): number {
  const [y, m, d] = key.split("-").map(Number);
  return (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7;
}

function validDay(y: number, m: number, d: number): boolean {
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

function key(y: number, m: number, d: number): string {
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function hhmm(h: number, m: number): string {
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function addMinutes(time: string, minutes: number): string | null {
  const [h, m] = time.split(":").map(Number);
  const total = h * 60 + m + minutes;
  if (total >= 24 * 60) return null;
  return hhmm(Math.floor(total / 60), total % 60);
}

class Text {
  orig: string;
  norm: string;
  constructor(s: string) {
    // Si la normalización cambiara la longitud (caracteres raros), se trabaja sobre ella.
    const n = fold(s);
    this.orig = n.length === s.length ? s : n;
    this.norm = n;
  }
  /** Busca en el texto normalizado y borra la coincidencia de ambos textos. */
  take(re: RegExp): RegExpExecArray | null {
    const m = re.exec(this.norm);
    if (!m) return null;
    const blank = " ".repeat(m[0].length);
    this.norm = this.norm.slice(0, m.index) + blank + this.norm.slice(m.index + m[0].length);
    this.orig = this.orig.slice(0, m.index) + blank + this.orig.slice(m.index + m[0].length);
    return m;
  }
  test(re: RegExp): boolean {
    return re.test(this.norm);
  }
}

/** Hora con sufijos y modificadores; null si no parece una hora. */
function toTime(hStr: string, mStr: string | undefined, suffix: string | undefined, part: string | undefined) {
  let h = NUMBER_WORDS[hStr] ?? Number(hStr);
  const m = mStr ? Number(mStr) : 0;
  if (!Number.isFinite(h) || h > 23 || m > 59) return null;
  const s = (suffix ?? "").replace(/[\s.]/g, "");
  if (s === "pm" && h < 12) h += 12;
  else if (s === "am" && h === 12) h = 0;
  else if (part === "tarde" || part === "noche") {
    if (h < 12) h += 12;
  } else if (part === "manana") {
    if (h === 12) h = 0;
  } else if (!s && h >= 1 && h <= 7) {
    // Sin indicación, 1–7 se interpreta como de la tarde (jornada 9:00–17:00).
    h += 12;
  }
  return hhmm(h, m);
}

const H = "(\\d{1,2}|una|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce)";
const SUFFIX = "(a\\.?\\s?m\\.?|p\\.?\\s?m\\.?|hrs|horas|h)?";
const PART = "(?:\\s+de\\s+la\\s+(manana|tarde|noche))?";

export function parseCapture(input: string, todayKey: string): CaptureResult {
  const t = new Text(` ${input.trim().replace(/\s+/g, " ")} `);
  const result: CaptureResult = {
    kind: "task",
    title: "",
    dateKey: null,
    time: null,
    endTime: null,
    participants: [],
    urgent: false,
    important: false,
    repeat: "",
  };

  // ---- Tipo
  if (t.test(MEETING_WORDS)) result.kind = "meeting";
  t.take(/^\s*(recuerdame|recordarme|recordar|recuerda|tarea|pendiente|anota|agrega|agendar?|agenda)\b:?\s*(que\s+)?/);
  if (t.test(/^\s*(tengo\s+(una\s+)?)?(reunion|junta|cita)\b/)) t.take(/^\s*tengo\s+(una\s+)?/);

  // ---- Prioridad
  if (t.take(/\b(muy\s+)?urgente\b/)) result.urgent = true;
  if (t.take(/\b(muy\s+)?importante\b/)) result.important = true;

  // ---- Repetición (antes que las fechas, porque usa nombres de días)
  let weeklyDay: number | null = null;
  if (t.take(/\b(de lunes a viernes|entre semana|todos los dias habiles|dias habiles|cada dia habil)\b/)) {
    result.repeat = "weekdays";
  } else if (t.take(/\b(todos los dias|diario|diariamente|cada dia)\b/)) {
    result.repeat = "daily";
  } else if (t.take(/\b(cada (2|dos) semanas|cada quince dias|quincenal(mente)?)\b/)) {
    result.repeat = "biweekly";
  } else {
    const w = t.take(new RegExp(`\\b(cada|todos los|los)\\s+(${DAYS.join("|")})\\b`));
    if (w) {
      result.repeat = "weekly";
      weeklyDay = DAYS.indexOf(w[2]);
    } else if (t.take(/\b(cada semana|semanal(mente)?|todas las semanas)\b/)) {
      result.repeat = "weekly";
    } else if (t.take(/\b(cada mes|mensual(mente)?|todos los meses)\b/)) {
      result.repeat = "monthly";
    }
  }
  if (result.repeat === "biweekly") {
    const w = t.take(new RegExp(`\\b(el|los)\\s+(${DAYS.join("|")})\\b`));
    if (w) weeklyDay = DAYS.indexOf(w[2]);
  }

  // ---- Momento del día sin fecha ("en la mañana") — se descarta para no confundir con "mañana"
  const partOfDay = t.take(/\b(en|por|de)\s+la\s+(manana|tarde|noche)\b/);

  // ---- Fecha
  const [ty, tm, td] = todayKey.split("-").map(Number);
  let m: RegExpExecArray | null;
  if (t.take(/\bpasado\s+manana\b/)) result.dateKey = addDaysKey(todayKey, 2);
  else if (t.take(/\bmanana\b/)) result.dateKey = addDaysKey(todayKey, 1);
  else if (t.take(/\bhoy\b/)) result.dateKey = todayKey;
  else if ((m = t.take(new RegExp(`\\b(?:el\\s+)?(\\d{1,2})\\s+de\\s+(${MONTHS.join("|")})(?:\\s+(?:de|del)\\s+(\\d{4}))?\\b`)))) {
    const d = Number(m[1]);
    const mo = MONTHS.indexOf(m[2]) + 1;
    let y = m[3] ? Number(m[3]) : ty;
    if (!m[3] && key(y, mo, d) < todayKey) y += 1;
    if (validDay(y, mo, d)) result.dateKey = key(y, mo, d);
  } else if ((m = t.take(/\b(?:el\s+)?(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/))) {
    const d = Number(m[1]);
    const mo = Number(m[2]);
    let y = m[3] ? Number(m[3].length === 2 ? `20${m[3]}` : m[3]) : ty;
    if (!m[3] && key(y, mo, d) < todayKey) y += 1;
    if (validDay(y, mo, d)) result.dateKey = key(y, mo, d);
  } else if ((m = t.take(new RegExp(`\\b(?:el|este|esta|para el)?\\s*(proximo|siguiente)?\\s*(${DAYS.join("|")})(\\s+(proximo|que viene))?\\b`)))) {
    const target = DAYS.indexOf(m[2]);
    const diff = (target - isoWeekday(todayKey) + 7) % 7;
    result.dateKey = addDaysKey(todayKey, diff === 0 ? 7 : diff);
  } else if ((m = t.take(/\bel\s+(?:dia\s+)?(\d{1,2})\b(?!\s*(:|am|pm|a\.|p\.|hrs|horas|h\b))/))) {
    const d = Number(m[1]);
    let y = ty;
    let mo = tm;
    if (d < td) {
      mo += 1;
      if (mo > 12) {
        mo = 1;
        y += 1;
      }
    }
    if (validDay(y, mo, d)) result.dateKey = key(y, mo, d);
  }

  // Una serie semanal empieza en el próximo día indicado.
  if (weeklyDay !== null && !result.dateKey) {
    const diff = (weeklyDay - isoWeekday(todayKey) + 7) % 7;
    result.dateKey = addDaysKey(todayKey, diff);
  }
  if (result.repeat && !result.dateKey) result.dateKey = todayKey;

  // ---- Hora: rango "de 10 a 11", luego "a las 10", "10:30", "4 pm", "mediodía"
  if ((m = t.take(new RegExp(`\\b(?:de|desde)\\s+(?:las\\s+)?${H}(?::(\\d{2}))?\\s*${SUFFIX}\\s+(?:a|hasta)\\s+(?:las\\s+)?${H}(?::(\\d{2}))?\\s*${SUFFIX}${PART}`)))) {
    const part = m[7];
    const start = toTime(m[1], m[2], m[3] || m[6], part);
    const end = toTime(m[4], m[5], m[6], part);
    if (start && end && end > start) {
      result.time = start;
      result.endTime = end;
    } else if (start) result.time = start;
  } else if ((m = t.take(new RegExp(`\\b(?:a\\s+las|a\\s+la|alas|como\\s+a\\s+las)\\s+${H}(?::(\\d{2}))?\\s*${SUFFIX}${PART}`)))) {
    result.time = toTime(m[1], m[2], m[3], m[4] ?? partOfDay?.[2]);
  } else if ((m = t.take(/\b(\d{1,2}):(\d{2})\s*(a\.?\s?m\.?|p\.?\s?m\.?|hrs|horas|h)?(?:\s+de\s+la\s+(manana|tarde|noche))?/))) {
    result.time = toTime(m[1], m[2], m[3], m[4] ?? partOfDay?.[2]);
  } else if ((m = t.take(/\b(\d{1,2})\s*(a\.?\s?m\.?|p\.?\s?m\.?|hrs)(?=\s|$)/))) {
    result.time = toTime(m[1], undefined, m[2], undefined);
  } else if (t.take(/\b(a\s+)?(medio\s?dia)\b/)) {
    result.time = "12:00";
  }

  // ---- Duración
  if ((m = t.take(/\b(?:por|durante|de)\s+(\d+|una|un|dos|tres|media)\s*(hora|horas|hr|hrs|minutos|min|mins)\b/))) {
    const n = m[1] === "media" ? 0.5 : (NUMBER_WORDS[m[1]] ?? Number(m[1]));
    const minutes = /^h/.test(m[2]) ? Math.round(n * 60) : n;
    if (result.time && minutes > 0 && minutes <= 12 * 60) result.endTime = addMinutes(result.time, minutes);
  } else if (t.take(/\b(?:por|durante)\s+media\s+hora\b/) && result.time) {
    result.endTime = addMinutes(result.time, 30);
  }

  // ---- Participantes (solo reuniones): "con Ana, Luis y Pedro"
  if (result.kind === "meeting") {
    const pm = /\bcon\s+([^,.;]+(?:\s*,\s*[^,.;]+)*)/.exec(t.orig);
    if (pm) {
      const names = pm[1]
        .split(/\s*,\s*|\s+y\s+|\s+e\s+/)
        .map((s) => s.trim().replace(/^(el|la|los|las)\s+/i, ""))
        .filter((s) => s && s.length <= 80 && !/^\s*$/.test(s));
      // Cortar en el primer hueco largo (lo que se quitó: fecha/hora)
      result.participants = names
        .map((n) => n.split(/\s{2,}/)[0].trim())
        .filter(Boolean)
        .map((n) => n.charAt(0).toUpperCase() + n.slice(1))
        .slice(0, 10);
    }
  }

  // ---- Título: lo que queda, sin conectores sueltos en los extremos
  let title = t.orig.replace(/\s+/g, " ").trim();
  const edge = /^(y|el|la|los|las|de|del|a|al|para|que|me|en|por|este|esta|,|\.|-|:)\s+|\s+(y|el|la|los|las|de|del|a|al|para|que|en|por|este|esta|,|\.|-|:)$/i;
  for (let i = 0; i < 6 && edge.test(title); i++) title = title.replace(edge, "").trim();
  title = title.replace(/[\s,.;:-]+$/, "").replace(/^[\s,.;:-]+/, "");
  title = title.charAt(0).toUpperCase() + title.slice(1);
  result.title = title.slice(0, result.kind === "meeting" ? 200 : 300);
  return result;
}

/** Resumen legible de lo interpretado (para mostrar antes de revisar). */
export function describeCapture(r: CaptureResult): string[] {
  const lines: string[] = [];
  lines.push(r.kind === "meeting" ? "Tipo: reunión" : "Tipo: tarea");
  if (r.dateKey) {
    const [y, m, d] = r.dateKey.split("-").map(Number);
    const text = new Intl.DateTimeFormat("es-MX", {
      weekday: "long",
      day: "numeric",
      month: "long",
      timeZone: "UTC",
    }).format(new Date(Date.UTC(y, m - 1, d, 12)));
    lines.push(`Fecha: ${text}`);
  }
  if (r.time) lines.push(`Hora: ${formatClock(r.time)}${r.endTime ? ` a ${formatClock(r.endTime)}` : ""}`);
  if (r.participants.length) lines.push(`Con: ${r.participants.join(", ")}`);
  if (r.repeat) lines.push("Se repite");
  if (r.urgent) lines.push("Urgente");
  if (r.important) lines.push("Importante");
  return lines;
}

/** URL del formulario precargado con lo interpretado. */
export function captureFormHref(r: CaptureResult): string {
  const q = new URLSearchParams();
  q.set("titulo", r.title);
  if (r.dateKey) q.set("fecha", r.dateKey);
  if (r.time) q.set("hora", r.time);
  if (r.repeat) q.set("repetir", r.repeat);
  if (r.kind === "meeting") {
    if (r.endTime) q.set("fin", r.endTime);
    if (r.participants.length) q.set("con", r.participants.join(", "));
    return `/agenda/nueva?${q}`;
  }
  if (r.urgent) q.set("urgente", "1");
  if (r.important) q.set("importante", "1");
  return `/tareas/nueva?${q}`;
}
