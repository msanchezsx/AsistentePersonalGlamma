import { z } from "zod";
import { DEFAULT_TIMEZONE } from "@/lib/constants";
import { localDateKey, zonedToUtc } from "@/lib/zoned-time";

export const MEETING_STATUS_LABELS = {
  draft: "Borrador",
  scheduled: "Programada",
  held: "Realizada",
  cancelled: "Cancelada",
  missed: "No asistí",
} as const;
export type MeetingStatus = keyof typeof MEETING_STATUS_LABELS;

export type Meeting = {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  starts_at: string;
  ends_at: string;
  status: MeetingStatus;
  source: string;
  project_id: string | null;
  client_id: string | null;
  created_at: string;
  project?: { id: string; name: string; code: string | null } | null;
  client?: { id: string; name: string } | null;
  participants?: { id: string; display_name: string | null; contact: { full_name: string } | null }[];
};

export const MEETING_SELECT =
  "id, title, description, location, starts_at, ends_at, status, source, project_id, client_id, created_at, project:projects(id, name, code), client:clients(id, name), participants:meeting_participants(id, display_name, contact:contacts(full_name))";

const optionalUuid = z
  .string()
  .trim()
  .transform((v) => (v === "" ? null : v))
  .pipe(z.string().uuid().nullable());

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Máximo ${max} caracteres`)
    .transform((v) => (v === "" ? null : v));

export const meetingFormSchema = z
  .object({
    title: z.string().trim().min(1, "Escribe un título").max(200, "Máximo 200 caracteres"),
    description: optionalText(4000),
    location: optionalText(300),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Indica la fecha"),
    start_time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Indica la hora de inicio"),
    end_time: z
      .string()
      .trim()
      .refine((v) => v === "" || /^([01]\d|2[0-3]):[0-5]\d$/.test(v), "Hora inválida")
      .transform((v) => (v === "" ? null : v)),
    participants: z
      .string()
      .max(2000)
      .transform((v) =>
        Array.from(
          new Set(
            v
              .split(/[,;\n]/)
              .map((p) => p.trim())
              .filter(Boolean)
              .map((p) => p.slice(0, 160)),
          ),
        ).slice(0, 30),
      ),
    project_id: optionalUuid,
    client_id: optionalUuid,
  })
  .refine((v) => !v.end_time || v.end_time > v.start_time, {
    message: "La hora de fin debe ser posterior al inicio",
    path: ["end_time"],
  });

export type MeetingFormValues = z.infer<typeof meetingFormSchema>;

export function parseMeetingForm(formData: FormData) {
  const s = (k: string) => String(formData.get(k) ?? "");
  return meetingFormSchema.safeParse({
    title: s("title"),
    description: s("description"),
    location: s("location"),
    date: s("date"),
    start_time: s("start_time"),
    end_time: s("end_time"),
    participants: s("participants"),
    project_id: s("project_id"),
    client_id: s("client_id"),
  });
}

/** Inicio y fin en UTC. Sin hora de fin, la reunión dura 1 hora. */
export function toMeetingTimes(
  v: Pick<MeetingFormValues, "date" | "start_time" | "end_time">,
  timeZone: string = DEFAULT_TIMEZONE,
): { starts_at: string; ends_at: string } {
  const start = zonedToUtc(v.date, v.start_time, timeZone);
  const end = v.end_time ? zonedToUtc(v.date, v.end_time, timeZone) : new Date(start.getTime() + 3600_000);
  return { starts_at: start.toISOString(), ends_at: end.toISOString() };
}

export function participantNames(m: Pick<Meeting, "participants">): string[] {
  return (m.participants ?? []).map((p) => p.contact?.full_name ?? p.display_name ?? "").filter(Boolean);
}

export function isActiveMeeting(m: Pick<Meeting, "status">): boolean {
  return m.status === "scheduled" || m.status === "draft";
}

/** Agrupa por día local, en orden cronológico. */
export function groupMeetingsByDay(
  meetings: Meeting[],
  timeZone: string = DEFAULT_TIMEZONE,
): { dateKey: string; items: Meeting[] }[] {
  const map = new Map<string, Meeting[]>();
  for (const m of [...meetings].sort((a, b) => a.starts_at.localeCompare(b.starts_at))) {
    const key = localDateKey(new Date(m.starts_at), timeZone);
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(m);
  }
  return Array.from(map, ([dateKey, items]) => ({ dateKey, items }));
}
