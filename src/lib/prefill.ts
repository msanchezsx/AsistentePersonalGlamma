import { isRepeatOption, type RepeatOption } from "@/lib/recurrence";

/** Valores precargados desde la URL (p. ej. desde "Capturar"). Todo se vuelve a validar al guardar. */
export function readPrefill(sp: Record<string, string | undefined>) {
  const str = (k: string, max: number) => (sp[k] ?? "").toString().slice(0, max);
  const date = /^\d{4}-\d{2}-\d{2}$/.test(sp.fecha ?? "") ? sp.fecha! : "";
  const time = (k: string) => (/^([01]\d|2[0-3]):[0-5]\d$/.test(sp[k] ?? "") ? sp[k]! : "");
  const repeat: RepeatOption = isRepeatOption(sp.repetir ?? "") ? (sp.repetir as RepeatOption) : "";
  return {
    title: str("titulo", 300),
    date,
    time: time("hora"),
    end: time("fin"),
    participants: str("con", 2000),
    repeat,
    urgent: sp.urgente === "1",
    important: sp.importante === "1",
    fromCapture: Boolean(sp.titulo),
  };
}
