import "server-only";

import type { createClient } from "@/lib/supabase/server";
import { toDueFields } from "@/lib/tasks/model";
import { toMeetingTimes } from "@/lib/meetings/model";
import { payloadSchemas } from "@/lib/assistant/tools";

type Supa = Awaited<ReturnType<typeof createClient>>;

export type PendingAction = {
  id: string;
  conversation_id: string;
  kind: keyof typeof payloadSchemas;
  payload: unknown;
  summary: string;
  status: "pending" | "confirmed" | "rejected" | "failed";
  result_id: string | null;
  created_at: string;
};

/**
 * Ejecuta una acción propuesta por el asistente, solo tras la confirmación
 * explícita del usuario. Devuelve el id creado/afectado o un error legible.
 */
export async function executeAction(
  supabase: Supa,
  userId: string,
  action: PendingAction,
  timeZone: string,
): Promise<{ ok: true; resultId: string | null } | { ok: false; message: string }> {
  switch (action.kind) {
    case "create_task": {
      const p = payloadSchemas.create_task.safeParse(action.payload);
      if (!p.success) return { ok: false, message: "La propuesta de tarea no es válida." };
      const v = p.data;
      const due = toDueFields({ due_date: v.fecha || null, due_time: v.hora || null }, timeZone);
      const { data, error } = await supabase
        .from("tasks")
        .insert({
          user_id: userId,
          title: v.titulo,
          description: v.descripcion.trim() || null,
          priority: v.prioridad,
          is_urgent: v.urgente,
          is_important: v.importante,
          source: "assistant",
          ...due,
        })
        .select("id")
        .single();
      if (error || !data) return { ok: false, message: "No se pudo crear la tarea." };
      return { ok: true, resultId: data.id };
    }
    case "create_meeting": {
      const p = payloadSchemas.create_meeting.safeParse(action.payload);
      if (!p.success) return { ok: false, message: "La propuesta de reunión no es válida." };
      const v = p.data;
      const times = toMeetingTimes({ date: v.fecha, start_time: v.hora_inicio, end_time: v.hora_fin || null }, timeZone);
      const { data, error } = await supabase
        .from("meetings")
        .insert({
          user_id: userId,
          title: v.titulo,
          location: v.lugar.trim() || null,
          status: "scheduled",
          source: "assistant",
          confirmed_at: new Date().toISOString(),
          ...times,
        })
        .select("id")
        .single();
      if (error || !data) return { ok: false, message: "No se pudo agendar la reunión." };
      const names = Array.from(new Set(v.participantes.map((n) => n.trim()).filter(Boolean)));
      if (names.length) {
        await supabase
          .from("meeting_participants")
          .insert(names.map((display_name) => ({ user_id: userId, meeting_id: data.id, display_name })));
      }
      return { ok: true, resultId: data.id };
    }
    case "complete_task": {
      const p = payloadSchemas.complete_task.safeParse(action.payload);
      if (!p.success) return { ok: false, message: "La propuesta no es válida." };
      const { error, count } = await supabase
        .from("tasks")
        .update(
          { status: "done", completed_at: new Date().toISOString(), completion_confirmed: true },
          { count: "exact" },
        )
        .eq("id", p.data.tarea_id);
      if (error || count === 0) return { ok: false, message: "No se encontró la tarea." };
      await supabase
        .from("reminders")
        .update({ status: "cancelled" })
        .eq("task_id", p.data.tarea_id)
        .eq("status", "scheduled");
      return { ok: true, resultId: p.data.tarea_id };
    }
    case "remember": {
      const p = payloadSchemas.remember.safeParse(action.payload);
      if (!p.success) return { ok: false, message: "La propuesta no es válida." };
      const { data, error } = await supabase
        .from("assistant_memory")
        .insert({
          user_id: userId,
          category: p.data.categoria,
          subject: p.data.tema,
          content: p.data.contenido,
          source: "conversation",
          confirmed: true,
        })
        .select("id")
        .single();
      if (error || !data) return { ok: false, message: "No se pudo guardar en la memoria." };
      return { ok: true, resultId: data.id };
    }
    default:
      return { ok: false, message: "Acción no permitida." };
  }
}
