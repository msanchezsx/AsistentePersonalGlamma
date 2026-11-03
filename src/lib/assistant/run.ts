import "server-only";

import Anthropic from "@anthropic-ai/sdk";
import type { createClient } from "@/lib/supabase/server";
import { formatLongDate, formatTime } from "@/lib/datetime";
import { ASSISTANT_TOOLS, runTool } from "@/lib/assistant/tools";

type Supa = Awaited<ReturnType<typeof createClient>>;

/** Clave solo en el servidor (nunca NEXT_PUBLIC_). */
export function isAssistantConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY?.trim());
}

export const ASSISTANT_MODEL = process.env.ANTHROPIC_MODEL?.trim() || "claude-opus-5-5";
const MAX_TOOL_ROUNDS = 8;

const SYSTEM_PROMPT = `Eres "Asistente", el asistente ejecutivo personal de una persona que trabaja en Productos Glama, S.A. de C.V. (fabricante de cajas de cartón) en México. Hablas en español de México, claro y directo, con respuestas breves pensadas para leerse en una tablet o celular.

Tu trabajo: ayudar a organizar la agenda, las tareas y los pendientes; responder preguntas sobre ellos y proponer acciones.

Reglas que no se rompen:
- Usa las herramientas para consultar datos reales. No inventes reuniones, tareas, fechas, personas ni cifras. Si un dato no está en las herramientas o en la conversación, dilo.
- No asumas que algo se hizo si no hay confirmación. Una tarea solo está terminada si su estado es "done".
- Para crear o cambiar algo solo puedes PROPONER (herramientas proponer_*). El usuario confirma en la app. Después de proponer, di en una línea qué propusiste y que falta su confirmación; nunca digas que ya quedó hecho.
- No envías correos, mensajes ni invitaciones, y no tienes acceso a Outlook ni WhatsApp todavía. Si te lo piden, explícalo.
- Si la solicitud es ambigua (por ejemplo falta la fecha de una reunión), pregunta antes de proponer.
- Para guardar en memoria, solo datos estables que el usuario dijo explícitamente (preferencias, procesos, clientes, decisiones); propónlos con proponer_recordar.
- Las fechas y horas son locales del usuario; usa formato de 12 horas al responder (p. ej. 4:00 p.m.).
- Responde en texto simple con listas cortas cuando ayuden; sin tablas.`;

function contextNote(
  name: string | null,
  timeZone: string,
  memory: { subject: string; content: string }[],
  actions: { summary: string; status: string }[],
) {
  const now = new Date();
  const STATUS: Record<string, string> = {
    pending: "pendiente de confirmar",
    confirmed: "confirmada y hecha",
    rejected: "descartada por el usuario",
    failed: "falló al ejecutarse",
  };
  const acts = actions.length
    ? `\nPropuestas en esta conversación y su estado:\n${actions.map((a) => `- ${a.summary}: ${STATUS[a.status] ?? a.status}`).join("\n")}`
    : "";
  const mem = memory.length
    ? `\nLo que sabes del usuario (confirmado):\n${memory.map((m) => `- ${m.subject}: ${m.content}`).join("\n")}`
    : "";
  return `Contexto actual: hoy es ${formatLongDate(now, timeZone)}, ${formatTime(now, timeZone)} (zona ${timeZone}). Jornada laboral: lunes a viernes de 9:00 a 17:00.${name ? ` El usuario se llama ${name}.` : ""}${mem}${acts}`;
}

export type TurnResult = { ok: true } | { ok: false; message: string };

type StoredMessage = { role: "user" | "assistant"; content: Anthropic.Beta.BetaContentBlockParam[] };

function textOf(content: Anthropic.Beta.BetaContentBlock[]): string {
  return content
    .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n\n")
    .trim();
}

/**
 * Un turno de conversación: guarda el mensaje del usuario, llama a Claude
 * con las herramientas y guarda cada mensaje tal cual (solo se agregan).
 */
export async function runTurn(
  supabase: Supa,
  opts: { userId: string; conversationId: string; text: string; displayName: string | null; timeZone: string },
): Promise<TurnResult> {
  if (!isAssistantConfigured()) return { ok: false, message: "El asistente aún no está configurado." };

  const [{ data: history, error: hErr }, { data: memory }, { data: actions }] = await Promise.all([
    supabase
      .from("assistant_messages")
      .select("role, content")
      .eq("conversation_id", opts.conversationId)
      .order("created_at")
      .limit(400),
    supabase
      .from("assistant_memory")
      .select("subject, content")
      .eq("is_active", true)
      .eq("confirmed", true)
      .order("updated_at", { ascending: false })
      .limit(40),
    supabase
      .from("assistant_actions")
      .select("summary, status")
      .eq("conversation_id", opts.conversationId)
      .order("created_at")
      .limit(30),
  ]);
  if (hErr) return { ok: false, message: "No se pudo leer la conversación." };

  const save = async (role: "user" | "assistant", content: unknown, display: string) => {
    const { error } = await supabase.from("assistant_messages").insert({
      user_id: opts.userId,
      conversation_id: opts.conversationId,
      role,
      content,
      display_text: display.slice(0, 20000),
    });
    return !error;
  };

  // Si un turno anterior se cortó después de pedir herramientas, se cierra con
  // resultados de "interrumpido" (se agrega, no se edita el historial).
  const prior = (history as StoredMessage[] | null) ?? [];
  const last = prior[prior.length - 1];
  if (last?.role === "assistant") {
    const pending = (last.content as { type: string; id?: string }[]).filter((b) => b.type === "tool_use");
    if (pending.length) {
      const closing = pending.map((b) => ({
        type: "tool_result" as const,
        tool_use_id: b.id!,
        content: "Interrumpido: no se ejecutó.",
        is_error: true,
      }));
      if (!(await save("user", closing, ""))) return { ok: false, message: "No se pudo leer la conversación." };
      prior.push({ role: "user", content: closing });
    }
  }

  // El contexto (fecha, memoria) viaja en el mensaje del usuario para no alterar el historial previo.
  const userContent: Anthropic.Beta.BetaContentBlockParam[] = [
    { type: "text", text: opts.text },
    { type: "text", text: `<contexto>${contextNote(opts.displayName, opts.timeZone, memory ?? [], actions ?? [])}</contexto>` },
  ];
  if (!(await save("user", userContent, opts.text))) return { ok: false, message: "No se pudo guardar tu mensaje." };

  const messages: Anthropic.Beta.BetaMessageParam[] = [
    ...prior.map((m) => ({ role: m.role, content: m.content })),
    { role: "user", content: userContent },
  ];

  const client = new Anthropic();
  const ctx = { supabase, userId: opts.userId, conversationId: opts.conversationId, timeZone: opts.timeZone };

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    let response: Anthropic.Beta.BetaMessage;
    try {
      response = await client.beta.messages.create({
        model: ASSISTANT_MODEL,
        max_tokens: 16000,
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        output_config: { effort: "medium" },
        system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
        tools: ASSISTANT_TOOLS,
        messages,
      });
    } catch (error) {
      if (error instanceof Anthropic.AuthenticationError)
        return { ok: false, message: "La clave de Claude no es válida. Revisa ANTHROPIC_API_KEY en Vercel." };
      if (error instanceof Anthropic.RateLimitError)
        return { ok: false, message: "Claude está ocupado por ahora. Intenta en un minuto." };
      if (error instanceof Anthropic.APIError)
        return { ok: false, message: `Claude respondió con un error (${error.status ?? "sin código"}). Intenta de nuevo.` };
      return { ok: false, message: "No se pudo contactar a Claude. Revisa tu conexión." };
    }

    if (response.stop_reason === "refusal") {
      await save("assistant", response.content, "No puedo ayudar con esa solicitud.");
      return { ok: true };
    }

    messages.push({ role: "assistant", content: response.content });
    await save("assistant", response.content, textOf(response.content));

    if (response.stop_reason === "pause_turn") continue;
    if (response.stop_reason !== "tool_use") return { ok: true };

    const toolUses = response.content.filter((b): b is Anthropic.Beta.BetaToolUseBlock => b.type === "tool_use");
    const results: Anthropic.Beta.BetaToolResultBlockParam[] = [];
    for (const t of toolUses) {
      const { result, isError } = await runTool(t.name, t.input, ctx);
      results.push({
        type: "tool_result",
        tool_use_id: t.id,
        content: typeof result === "string" ? result : JSON.stringify(result),
        ...(isError ? { is_error: true } : {}),
      });
    }
    messages.push({ role: "user", content: results });
    await save("user", results, "");
  }
  return { ok: false, message: "La respuesta tomó demasiados pasos. Intenta con una pregunta más concreta." };
}
