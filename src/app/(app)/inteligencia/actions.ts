"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getViewer } from "@/lib/session";
import { runTurn } from "@/lib/assistant/run";
import { executeAction, type PendingAction } from "@/lib/assistant/execute";

export type ChatState = { ok: boolean; message?: string } | null;

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return { supabase, user };
}

const sendSchema = z.object({
  conversationId: z
    .string()
    .trim()
    .transform((v) => (v === "" ? null : v))
    .pipe(z.string().uuid().nullable()),
  text: z.string().trim().min(1, "Escribe tu mensaje").max(4000, "Máximo 4000 caracteres"),
});

export async function sendMessage(_prev: ChatState, formData: FormData): Promise<ChatState> {
  const parsed = sendSchema.safeParse({
    conversationId: String(formData.get("conversationId") ?? ""),
    text: String(formData.get("text") ?? ""),
  });
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0].message };

  const { supabase, user } = await requireUser();
  const viewer = await getViewer();
  let conversationId = parsed.data.conversationId;
  if (!conversationId) {
    const title = parsed.data.text.replace(/\s+/g, " ").slice(0, 60);
    const { data, error } = await supabase
      .from("assistant_conversations")
      .insert({ user_id: user.id, title })
      .select("id")
      .single();
    if (error || !data) return { ok: false, message: "No se pudo iniciar la conversación." };
    conversationId = data.id;
  }

  const result = await runTurn(supabase, {
    userId: user.id,
    conversationId: conversationId!,
    text: parsed.data.text,
    displayName: viewer.displayName,
    timeZone: viewer.timezone,
  });
  await supabase.from("assistant_conversations").update({ updated_at: new Date().toISOString() }).eq("id", conversationId);

  revalidatePath("/inteligencia");
  if (!result.ok) {
    if (!parsed.data.conversationId) redirect(`/inteligencia?c=${conversationId}&error=1`);
    return { ok: false, message: result.message };
  }
  if (!parsed.data.conversationId) redirect(`/inteligencia?c=${conversationId}`);
  return { ok: true };
}

const decideSchema = z.object({ id: z.string().uuid(), decision: z.enum(["confirm", "reject"]) });

/** Confirmar o descartar una acción propuesta por el asistente. */
export async function decideAction(formData: FormData): Promise<void> {
  const parsed = decideSchema.safeParse({ id: formData.get("id"), decision: formData.get("decision") });
  if (!parsed.success) return;
  const { supabase, user } = await requireUser();
  const viewer = await getViewer();
  const { data } = await supabase
    .from("assistant_actions")
    .select("id, conversation_id, kind, payload, summary, status, result_id, created_at")
    .eq("id", parsed.data.id)
    .maybeSingle();
  const action = data as PendingAction | null;
  if (!action || action.status !== "pending") return;

  const now = new Date().toISOString();
  if (parsed.data.decision === "reject") {
    await supabase
      .from("assistant_actions")
      .update({ status: "rejected", decided_at: now })
      .eq("id", action.id)
      .eq("status", "pending");
  } else {
    // Se marca primero para que un doble toque no la ejecute dos veces.
    const lock = await supabase
      .from("assistant_actions")
      .update({ status: "confirmed", decided_at: now }, { count: "exact" })
      .eq("id", action.id)
      .eq("status", "pending");
    if (lock.error || lock.count === 0) return;
    const r = await executeAction(supabase, user.id, action, viewer.timezone);
    await supabase
      .from("assistant_actions")
      .update(r.ok ? { result_id: r.resultId } : { status: "failed" })
      .eq("id", action.id);
  }
  revalidatePath("/inteligencia");
  revalidatePath("/tareas");
  revalidatePath("/agenda");
  revalidatePath("/");
}

export async function deleteConversation(formData: FormData): Promise<void> {
  const id = z.string().uuid().safeParse(formData.get("id"));
  if (!id.success) return;
  const { supabase } = await requireUser();
  await supabase.from("assistant_conversations").delete().eq("id", id.data);
  revalidatePath("/inteligencia");
  redirect("/inteligencia");
}

/** Olvidar un recuerdo: queda inactivo (se conserva en el historial de auditoría). */
export async function forgetMemory(formData: FormData): Promise<void> {
  const id = z.string().uuid().safeParse(formData.get("id"));
  if (!id.success) return;
  const { supabase } = await requireUser();
  await supabase.from("assistant_memory").update({ is_active: false }).eq("id", id.data);
  revalidatePath("/inteligencia/memoria");
}
