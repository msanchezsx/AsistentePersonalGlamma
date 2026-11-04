/**
 * Proyectos, clientes, contactos y seguimientos (Fase 1). Sin dependencias
 * de servidor: etiquetas, validación y agrupación.
 */
import { z } from "zod";
import { DEFAULT_TIMEZONE } from "@/lib/constants";
import { localDateKey, zonedToUtc } from "@/lib/zoned-time";

export const PROJECT_STATUS_LABELS = {
  planned: "Planeado",
  active: "Activo",
  on_hold: "En pausa",
  completed: "Terminado",
  cancelled: "Cancelado",
} as const;
export type ProjectStatus = keyof typeof PROJECT_STATUS_LABELS;

export const RELATIONSHIP_LABELS = {
  client: "Cliente",
  boss: "Jefe",
  team: "Equipo",
  supplier: "Proveedor",
  colleague: "Colega",
  other: "Otro",
} as const;

export type Project = {
  id: string;
  name: string;
  code: string | null;
  description: string | null;
  status: ProjectStatus;
  start_date: string | null;
  due_date: string | null;
  client_id: string | null;
  updated_at: string;
  client?: { id: string; name: string } | null;
};
export const PROJECT_SELECT =
  "id, name, code, description, status, start_date, due_date, client_id, updated_at, client:clients(id, name)";

export type Client = { id: string; name: string; code: string | null; notes: string | null; status: "active" | "inactive"; updated_at: string };
export type Contact = {
  id: string;
  full_name: string;
  role: string | null;
  relationship: keyof typeof RELATIONSHIP_LABELS;
  email: string | null;
  phone: string | null;
  client_id: string | null;
};

export type FollowUp = {
  id: string;
  kind: "follow_up" | "commitment";
  owner_side: "mine" | "theirs";
  title: string;
  description: string | null;
  status: "open" | "done" | "cancelled";
  due_at: string | null;
  closed_at: string | null;
  created_at: string;
  contact?: { id: string; full_name: string } | null;
  client?: { id: string; name: string } | null;
  project?: { id: string; name: string; code: string | null } | null;
};
export const FOLLOW_UP_SELECT =
  "id, kind, owner_side, title, description, status, due_at, closed_at, created_at, contact:contacts(id, full_name), client:clients(id, name), project:projects(id, name, code)";

const opt = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => v || null);
const optUuid = z
  .string()
  .trim()
  .transform((v) => (v === "" ? null : v))
  .pipe(z.string().uuid().nullable());
const optDate = z
  .string()
  .trim()
  .refine((v) => v === "" || /^\d{4}-\d{2}-\d{2}$/.test(v), "Fecha inválida")
  .transform((v) => v || null);

export const projectSchema = z
  .object({
    name: z.string().trim().min(1, "Escribe el nombre").max(160),
    code: opt(40),
    description: opt(4000),
    client_id: optUuid,
    status: z.enum(["planned", "active", "on_hold", "completed", "cancelled"]),
    start_date: optDate,
    due_date: optDate,
  })
  .refine((v) => !v.start_date || !v.due_date || v.due_date >= v.start_date, {
    message: "La fecha de entrega no puede ser antes del inicio",
    path: ["due_date"],
  });

export const clientSchema = z.object({
  name: z.string().trim().min(1, "Escribe el nombre").max(160),
  code: opt(40),
  notes: opt(4000),
  status: z.enum(["active", "inactive"]),
});

export const contactSchema = z.object({
  full_name: z.string().trim().min(1, "Escribe el nombre").max(160),
  role: opt(120),
  relationship: z.enum(["client", "boss", "team", "supplier", "colleague", "other"]),
  email: z
    .string()
    .trim()
    .max(254)
    .refine((v) => v === "" || /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v), "Correo inválido")
    .transform((v) => v || null),
  phone: opt(30),
});

export const followUpSchema = z.object({
  title: z.string().trim().min(1, "Escribe qué hay que seguir").max(300),
  owner_side: z.enum(["mine", "theirs"]),
  kind: z.enum(["follow_up", "commitment"]),
  due_date: optDate,
  contact_id: optUuid,
  new_contact: opt(160),
  client_id: optUuid,
  project_id: optUuid,
});

/** Un dato de FormData como texto (vacío si no viene). */
export function fd(formData: FormData, key: string): string {
  const v = formData.get(key);
  return typeof v === "string" ? v : "";
}

/** Fecha compromiso sin hora → fin del día local. */
export function followUpDueAt(dateKey: string | null, timeZone: string = DEFAULT_TIMEZONE): string | null {
  return dateKey ? zonedToUtc(dateKey, "23:59:59", timeZone).toISOString() : null;
}

export function isFollowUpOverdue(f: Pick<FollowUp, "status" | "due_at">, now: Date): boolean {
  return f.status === "open" && f.due_at !== null && new Date(f.due_at) < now;
}

/** Abiertos: "yo debo" y "me deben", vencidos y con fecha primero. */
export function groupFollowUps(items: FollowUp[], now: Date) {
  const order = (a: FollowUp, b: FollowUp) =>
    Number(isFollowUpOverdue(b, now)) - Number(isFollowUpOverdue(a, now)) ||
    (a.due_at ?? "9999").localeCompare(b.due_at ?? "9999") ||
    a.created_at.localeCompare(b.created_at);
  const open = items.filter((f) => f.status === "open");
  return {
    mine: open.filter((f) => f.owner_side === "mine").sort(order),
    theirs: open.filter((f) => f.owner_side === "theirs").sort(order),
    overdue: open.filter((f) => isFollowUpOverdue(f, now)).length,
    closed: items
      .filter((f) => f.status !== "open")
      .sort((a, b) => (b.closed_at ?? "").localeCompare(a.closed_at ?? "")),
  };
}

export function dueLabel(dueAt: string | null, now: Date, timeZone: string = DEFAULT_TIMEZONE): string | null {
  if (!dueAt) return null;
  const key = localDateKey(new Date(dueAt), timeZone);
  const today = localDateKey(now, timeZone);
  if (key === today) return "Hoy";
  const [y, m, d] = key.split("-").map(Number);
  const text = new Intl.DateTimeFormat("es-MX", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }).format(
    new Date(Date.UTC(y, m - 1, d, 12)),
  );
  return key < today ? `Venció ${text}` : text;
}
