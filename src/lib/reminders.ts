/**
 * Recordatorios relativos ("15 minutos antes"). Se guardan en la tabla
 * `reminders`; el envío de notificaciones push se implementa en la Fase 4.
 * Este módulo no tiene dependencias para poder usarse en el cliente.
 */

export const REMINDER_OPTIONS: { value: string; label: string; minutes: number | null }[] = [
  { value: "", label: "Sin recordatorio", minutes: null },
  { value: "0", label: "A la hora", minutes: 0 },
  { value: "5", label: "5 minutos antes", minutes: 5 },
  { value: "10", label: "10 minutos antes", minutes: 10 },
  { value: "15", label: "15 minutos antes", minutes: 15 },
  { value: "30", label: "30 minutos antes", minutes: 30 },
  { value: "60", label: "1 hora antes", minutes: 60 },
  { value: "120", label: "2 horas antes", minutes: 120 },
  { value: "1440", label: "1 día antes", minutes: 1440 },
];

export function parseReminderMinutes(raw: FormDataEntryValue | null): number | null {
  const v = typeof raw === "string" ? raw.trim() : "";
  const opt = REMINDER_OPTIONS.find((o) => o.value === v);
  return opt ? opt.minutes : null;
}

export function reminderAt(targetIso: string, minutesBefore: number): string {
  return new Date(new Date(targetIso).getTime() - minutesBefore * 60000).toISOString();
}

/** Minutos de anticipación de un recordatorio existente (para precargar el formulario). */
export function minutesBefore(targetIso: string | null, remindAtIso: string | null): string {
  if (!targetIso || !remindAtIso) return "";
  const m = Math.round((new Date(targetIso).getTime() - new Date(remindAtIso).getTime()) / 60000);
  return REMINDER_OPTIONS.some((o) => o.minutes === m) ? String(m) : "";
}

export function reminderLabel(minutes: string): string {
  return REMINDER_OPTIONS.find((o) => o.value === minutes)?.label ?? "";
}
