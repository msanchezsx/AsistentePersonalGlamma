/**
 * Qué avisos enviar en una pasada del programador (cada ~5 min). Lógica pura:
 * recordatorios que ya llegaron y avisos críticos cuyo momento llegó, dentro
 * de una ventana para no mandar avisos viejos. La llave evita duplicados.
 */
import type { CriticalItem, ReminderRow } from "@/lib/briefing";
import { reminderUrl } from "@/lib/briefing";

export const PUSH_WINDOW_MS = 30 * 60_000;

export type PlannedPush = {
  dedupeKey: string;
  kind: "reminder" | "alert";
  reminderId: string | null;
  title: string;
  body: string;
  url: string;
  critical: boolean;
};

export function planPushes(now: Date, reminders: ReminderRow[], critical: CriticalItem[]): PlannedPush[] {
  const t = now.getTime();
  const inWindow = (iso: string) => {
    const at = new Date(iso).getTime();
    return at <= t && at > t - PUSH_WINDOW_MS;
  };
  const out: PlannedPush[] = [];
  const coveredReminders = new Set<string>();

  for (const c of critical) {
    if (!inWindow(c.showAt)) continue;
    if (c.reminderId) coveredReminders.add(c.reminderId);
    out.push({
      dedupeKey: `push:${c.key}`,
      kind: "alert",
      reminderId: c.reminderId,
      title: `⚠ ${c.title}`,
      body: c.detail,
      url: c.url,
      critical: true,
    });
  }
  for (const r of reminders) {
    if (coveredReminders.has(r.id) || !inWindow(r.remind_at)) continue;
    out.push({
      dedupeKey: `push:reminder:${r.id}:${r.remind_at}`,
      kind: "reminder",
      reminderId: r.id,
      title: r.title || "Recordatorio",
      body: "Recordatorio",
      url: reminderUrl(r),
      critical: false,
    });
  }
  return out;
}

/** Comparación en tiempo constante del secreto del programador. */
export function secretMatches(given: string | null | undefined, expected: string | null | undefined): boolean {
  if (!given || !expected || given.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < given.length; i++) diff |= given.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0;
}
