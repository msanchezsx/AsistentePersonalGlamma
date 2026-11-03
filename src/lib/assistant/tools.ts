import "server-only";

import type Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import type { createClient } from "@/lib/supabase/server";
import { addDaysKey, localDateKey, localTimeKey, zonedToUtc } from "@/lib/zoned-time";

type Supa = Awaited<ReturnType<typeof createClient>>;
type Ctx = { supabase: Supa; userId: string; conversationId: string; timeZone: string };

const dateRe = /^\d{4}-\d{2}-\d{2}$/;
const timeRe = /^([01]\d|2[0-3]):[0-5]\d$/;

export const MEMORY_CATEGORIES = [
  "profile",
  "preference",
  "habit",
  "priority",
  "process",
  "decision",
  "relationship",
  "project",
  "client",
  "other",
] as const;

/** Herramientas que Claude puede usar. Las de escritura solo PROPONEN; el usuario confirma en la app. */
export const ASSISTANT_TOOLS: Anthropic.Beta.BetaTool[] = [
  {
    name: "consultar_agenda",
    description:
      "Devuelve las reuniones y las tareas con fecha límite entre dos fechas locales (inclusive). Úsala para preguntas sobre el día, la semana, huecos libres o pendientes con fecha.",
    strict: true,
    input_schema: {
      type: "object",
      properties: {
        desde: { type: "string", description: "Fecha inicial YYYY-MM-DD" },
        hasta: { type: "string", description: "Fecha final YYYY-MM-DD (máximo 62 días después de desde)" },
      },
      required: ["desde", "hasta"],
      additionalProperties: false,
    },
  },
  {
    name: "buscar_tareas",
    description:
      "Busca tareas por texto y estado. Úsala para encontrar una tarea concreta (por ejemplo para obtener su id) o listar pendientes sin fecha o vencidas.",
    strict: true,
    input_schema: {
      type: "object",
      properties: {
        texto: { type: "string", description: "Texto a buscar en el título; vacío para todas" },
        estado: { type: "string", enum: ["abiertas", "cerradas", "todas"] },
        solo_vencidas: { type: "boolean" },
      },
      required: ["texto", "estado", "solo_vencidas"],
      additionalProperties: false,
    },
  },
  {
    name: "consultar_memoria",
    description:
      "Devuelve lo que se sabe del usuario (perfil, preferencias, procesos, clientes, decisiones). Solo los recuerdos confirmados son hechos.",
    strict: true,
    input_schema: { type: "object", properties: {}, required: [], additionalProperties: false },
  },
  {
    name: "proponer_tarea",
    description:
      "Propone crear una tarea. NO la crea: el usuario verá la propuesta con botones Confirmar/Descartar. Usa fecha y hora vacías si el usuario no las dio.",
    strict: true,
    input_schema: {
      type: "object",
      properties: {
        titulo: { type: "string" },
        descripcion: { type: "string" },
        fecha: { type: "string", description: "YYYY-MM-DD o vacío" },
        hora: { type: "string", description: "HH:mm (24 h) o vacío" },
        prioridad: { type: "integer", description: "1 (crítica) a 5 (mínima); 3 normal" },
        urgente: { type: "boolean" },
        importante: { type: "boolean" },
      },
      required: ["titulo", "descripcion", "fecha", "hora", "prioridad", "urgente", "importante"],
      additionalProperties: false,
    },
  },
  {
    name: "proponer_reunion",
    description:
      "Propone agendar una reunión en la agenda propia del usuario. NO la crea ni envía invitaciones: el usuario confirma en la app.",
    strict: true,
    input_schema: {
      type: "object",
      properties: {
        titulo: { type: "string" },
        fecha: { type: "string", description: "YYYY-MM-DD" },
        hora_inicio: { type: "string", description: "HH:mm (24 h)" },
        hora_fin: { type: "string", description: "HH:mm (24 h) o vacío (dura 1 hora)" },
        participantes: { type: "array", items: { type: "string" } },
        lugar: { type: "string" },
      },
      required: ["titulo", "fecha", "hora_inicio", "hora_fin", "participantes", "lugar"],
      additionalProperties: false,
    },
  },
  {
    name: "proponer_completar_tarea",
    description:
      "Propone marcar como terminada una tarea existente (usa su id de buscar_tareas o consultar_agenda). NO la marca: el usuario confirma. Nunca asumas que una tarea está hecha sin que el usuario lo diga.",
    strict: true,
    input_schema: {
      type: "object",
      properties: { tarea_id: { type: "string" } },
      required: ["tarea_id"],
      additionalProperties: false,
    },
  },
  {
    name: "proponer_recordar",
    description:
      "Propone guardar en la memoria un dato estable sobre el usuario (preferencia, proceso, cliente, decisión). Solo datos que el usuario dijo; el usuario confirma antes de guardarlo.",
    strict: true,
    input_schema: {
      type: "object",
      properties: {
        categoria: { type: "string", enum: [...MEMORY_CATEGORIES] },
        tema: { type: "string", description: "Tema corto, p. ej. 'Horario de junta con dirección'" },
        contenido: { type: "string" },
      },
      required: ["categoria", "tema", "contenido"],
      additionalProperties: false,
    },
  },
];

// ------------------------------------------------------------ validación

const agendaInput = z.object({ desde: z.string().regex(dateRe), hasta: z.string().regex(dateRe) });
const searchInput = z.object({
  texto: z.string().max(200),
  estado: z.enum(["abiertas", "cerradas", "todas"]),
  solo_vencidas: z.boolean(),
});
const taskInput = z.object({
  titulo: z.string().trim().min(1).max(300),
  descripcion: z.string().max(4000),
  fecha: z.string().refine((v) => v === "" || dateRe.test(v)),
  hora: z.string().refine((v) => v === "" || timeRe.test(v)),
  prioridad: z.number().int().min(1).max(5),
  urgente: z.boolean(),
  importante: z.boolean(),
});
const meetingInput = z.object({
  titulo: z.string().trim().min(1).max(200),
  fecha: z.string().regex(dateRe),
  hora_inicio: z.string().regex(timeRe),
  hora_fin: z.string().refine((v) => v === "" || timeRe.test(v)),
  participantes: z.array(z.string().trim().min(1).max(160)).max(30),
  lugar: z.string().max(300),
});
const completeInput = z.object({ tarea_id: z.string().uuid() });
const rememberInput = z.object({
  categoria: z.enum(MEMORY_CATEGORIES),
  tema: z.string().trim().min(1).max(200),
  contenido: z.string().trim().min(1).max(4000),
});

export type TaskPayload = z.infer<typeof taskInput>;
export type MeetingPayload = z.infer<typeof meetingInput>;
export type CompletePayload = z.infer<typeof completeInput> & { titulo: string };
export type RememberPayload = z.infer<typeof rememberInput>;
export const payloadSchemas = {
  create_task: taskInput,
  create_meeting: meetingInput,
  complete_task: completeInput.extend({ titulo: z.string() }),
  remember: rememberInput,
};

// ------------------------------------------------------------ ejecución

function fmtLocal(iso: string | null, tz: string, allDay = false) {
  if (!iso) return null;
  const d = new Date(iso);
  return allDay ? localDateKey(d, tz) : `${localDateKey(d, tz)} ${localTimeKey(d, tz)}`;
}

async function propose(ctx: Ctx, kind: string, payload: unknown, summary: string) {
  const { data, error } = await ctx.supabase
    .from("assistant_actions")
    .insert({
      user_id: ctx.userId,
      conversation_id: ctx.conversationId,
      kind,
      payload,
      summary: summary.slice(0, 500),
    })
    .select("id")
    .single();
  if (error || !data) return { error: "No se pudo registrar la propuesta." };
  return {
    propuesta_id: data.id,
    estado: "pendiente de confirmación",
    nota: "El usuario verá la propuesta con botones Confirmar/Descartar. No digas que ya se hizo.",
  };
}

export async function runTool(name: string, input: unknown, ctx: Ctx): Promise<{ result: unknown; isError?: boolean }> {
  const tz = ctx.timeZone;
  switch (name) {
    case "consultar_agenda": {
      const p = agendaInput.safeParse(input);
      if (!p.success || p.data.hasta < p.data.desde || p.data.hasta > addDaysKey(p.data.desde, 62))
        return { result: "Fechas inválidas (YYYY-MM-DD, máximo 62 días).", isError: true };
      const from = zonedToUtc(p.data.desde, "00:00", tz).toISOString();
      const to = zonedToUtc(addDaysKey(p.data.hasta, 1), "00:00", tz).toISOString();
      const [m, t] = await Promise.all([
        ctx.supabase
          .from("meetings")
          .select("id, title, starts_at, ends_at, status, location, participants:meeting_participants(display_name)")
          .gte("starts_at", from)
          .lt("starts_at", to)
          .order("starts_at")
          .limit(200),
        ctx.supabase
          .from("tasks")
          .select("id, title, status, priority, is_urgent, is_important, due_at, due_all_day")
          .gte("due_at", from)
          .lt("due_at", to)
          .order("due_at")
          .limit(200),
      ]);
      if (m.error || t.error) return { result: "No se pudo leer la agenda.", isError: true };
      return {
        result: {
          zona_horaria: tz,
          reuniones: (m.data ?? []).map((r) => ({
            id: r.id,
            titulo: r.title,
            inicio: fmtLocal(r.starts_at, tz),
            fin: fmtLocal(r.ends_at, tz),
            estado: r.status,
            lugar: r.location,
            participantes: ((r.participants as { display_name: string | null }[] | null) ?? [])
              .map((x) => x.display_name)
              .filter(Boolean),
          })),
          tareas: (t.data ?? []).map((r) => ({
            id: r.id,
            titulo: r.title,
            estado: r.status,
            prioridad: r.priority,
            urgente: r.is_urgent,
            importante: r.is_important,
            vence: fmtLocal(r.due_at, tz, r.due_all_day),
          })),
        },
      };
    }
    case "buscar_tareas": {
      const p = searchInput.safeParse(input);
      if (!p.success) return { result: "Parámetros inválidos.", isError: true };
      let q = ctx.supabase
        .from("tasks")
        .select("id, title, status, priority, is_urgent, is_important, due_at, due_all_day, completed_at")
        .order("due_at", { ascending: true, nullsFirst: false })
        .limit(50);
      const text = p.data.texto.replace(/[%_,()]/g, " ").trim();
      if (text) q = q.ilike("title", `%${text}%`);
      if (p.data.estado === "abiertas") q = q.in("status", ["pending", "in_progress", "waiting"]);
      if (p.data.estado === "cerradas") q = q.in("status", ["done", "cancelled"]);
      if (p.data.solo_vencidas) q = q.lt("due_at", new Date().toISOString()).in("status", ["pending", "in_progress", "waiting"]);
      const { data, error } = await q;
      if (error) return { result: "No se pudieron leer las tareas.", isError: true };
      return {
        result: (data ?? []).map((r) => ({
          id: r.id,
          titulo: r.title,
          estado: r.status,
          prioridad: r.priority,
          urgente: r.is_urgent,
          importante: r.is_important,
          vence: fmtLocal(r.due_at, tz, r.due_all_day),
          terminada: fmtLocal(r.completed_at, tz),
        })),
      };
    }
    case "consultar_memoria": {
      const { data, error } = await ctx.supabase
        .from("assistant_memory")
        .select("category, subject, content, confirmed, source")
        .eq("is_active", true)
        .order("updated_at", { ascending: false })
        .limit(100);
      if (error) return { result: "No se pudo leer la memoria.", isError: true };
      return { result: data ?? [] };
    }
    case "proponer_tarea": {
      const p = taskInput.safeParse(input);
      if (!p.success) return { result: "Datos de tarea inválidos.", isError: true };
      const when = p.data.fecha ? ` para el ${p.data.fecha}${p.data.hora ? ` a las ${p.data.hora}` : ""}` : "";
      return { result: await propose(ctx, "create_task", p.data, `Crear tarea "${p.data.titulo}"${when}`) };
    }
    case "proponer_reunion": {
      const p = meetingInput.safeParse(input);
      if (!p.success || (p.data.hora_fin && p.data.hora_fin <= p.data.hora_inicio))
        return { result: "Datos de reunión inválidos.", isError: true };
      const who = p.data.participantes.length ? ` con ${p.data.participantes.join(", ")}` : "";
      return {
        result: await propose(
          ctx,
          "create_meeting",
          p.data,
          `Agendar "${p.data.titulo}"${who} el ${p.data.fecha} a las ${p.data.hora_inicio}`,
        ),
      };
    }
    case "proponer_completar_tarea": {
      const p = completeInput.safeParse(input);
      if (!p.success) return { result: "Id de tarea inválido.", isError: true };
      const { data } = await ctx.supabase.from("tasks").select("id, title, status").eq("id", p.data.tarea_id).maybeSingle();
      if (!data) return { result: "No existe esa tarea.", isError: true };
      return {
        result: await propose(
          ctx,
          "complete_task",
          { tarea_id: data.id, titulo: data.title },
          `Marcar como terminada "${data.title}"`,
        ),
      };
    }
    case "proponer_recordar": {
      const p = rememberInput.safeParse(input);
      if (!p.success) return { result: "Datos inválidos.", isError: true };
      return { result: await propose(ctx, "remember", p.data, `Recordar: ${p.data.tema} — ${p.data.contenido}`) };
    }
    default:
      return { result: `Herramienta desconocida: ${name}`, isError: true };
  }
}
