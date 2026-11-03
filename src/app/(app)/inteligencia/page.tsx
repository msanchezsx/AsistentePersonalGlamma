import type { Metadata } from "next";
import Link from "next/link";
import { Card, EmptyState, PageHeader } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { getViewer } from "@/lib/session";
import { isAssistantConfigured } from "@/lib/assistant/run";
import { ChatInput } from "./chat-input";
import { decideAction, deleteConversation } from "./actions";

export const metadata: Metadata = { title: "Asistente" };
export const dynamic = "force-dynamic";
// Un turno con varias consultas puede tardar; las acciones de servidor heredan este límite.
export const maxDuration = 120;

type Conversation = { id: string; title: string; updated_at: string };
type Message = { id: string; role: "user" | "assistant"; display_text: string; created_at: string };
type Action = { id: string; kind: string; summary: string; status: string; created_at: string };

const KIND_LABEL: Record<string, string> = {
  create_task: "Crear tarea",
  create_meeting: "Agendar reunión",
  complete_task: "Marcar tarea como terminada",
  remember: "Guardar en memoria",
};

const STATUS: Record<string, { label: string; tone: string }> = {
  pending: { label: "Esperando tu confirmación", tone: "bg-warn-soft text-warn" },
  confirmed: { label: "Hecho", tone: "bg-ok-soft text-ok" },
  rejected: { label: "Descartado", tone: "bg-surface-2 text-muted" },
  failed: { label: "No se pudo hacer", tone: "bg-danger-soft text-danger" },
};

export default async function AssistantPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const params = await searchParams;
  const viewer = await getViewer();
  const configured = isAssistantConfigured();

  let conversations: Conversation[] = [];
  let messages: Message[] = [];
  let actions: Action[] = [];
  let current: Conversation | null = null;

  if (!viewer.preview) {
    const supabase = await createClient();
    const { data } = await supabase
      .from("assistant_conversations")
      .select("id, title, updated_at")
      .order("updated_at", { ascending: false })
      .limit(20);
    conversations = (data as Conversation[] | null) ?? [];
    current = conversations.find((c) => c.id === params.c) ?? null;
    if (current) {
      const [m, a] = await Promise.all([
        supabase
          .from("assistant_messages")
          .select("id, role, display_text, created_at")
          .eq("conversation_id", current.id)
          .neq("display_text", "")
          .order("created_at")
          .limit(400),
        supabase
          .from("assistant_actions")
          .select("id, kind, summary, status, created_at")
          .eq("conversation_id", current.id)
          .order("created_at"),
      ]);
      messages = (m.data as Message[] | null) ?? [];
      actions = (a.data as Action[] | null) ?? [];
    }
  }

  // Mensajes y propuestas en orden de aparición.
  const timeline = [
    ...messages.map((m) => ({ type: "message" as const, at: m.created_at, m })),
    ...actions.map((a) => ({ type: "action" as const, at: a.created_at, a })),
  ].sort((x, y) => x.at.localeCompare(y.at));

  return (
    <>
      <PageHeader
        title="Asistente"
        subtitle="Pregunta por tu agenda y tareas, o pide que te proponga algo."
        action={
          <Link href="/inteligencia/memoria" className="rounded-xl border border-border px-3 py-2 text-sm text-muted hover:text-accent">
            Memoria
          </Link>
        }
      />

      {!configured ? (
        <Card className="mb-4">
          <p className="text-sm">
            El asistente aún no está conectado a Claude. Falta agregar la clave <code>ANTHROPIC_API_KEY</code> en Vercel
            (solo servidor). Mientras tanto puedes seguir usando Agenda, Tareas y Capturar.
          </p>
        </Card>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[16rem_1fr]">
        <aside className="order-2 lg:order-1">
          <Card title="Conversaciones">
            <ul className="space-y-1">
              <li>
                <Link
                  href="/inteligencia"
                  className={`block rounded-lg px-3 py-2 text-sm ${!current ? "bg-accent-soft text-accent" : "hover:bg-surface-2"}`}
                >
                  + Nueva conversación
                </Link>
              </li>
              {conversations.map((c) => (
                <li key={c.id}>
                  <Link
                    href={`/inteligencia?c=${c.id}`}
                    className={`block truncate rounded-lg px-3 py-2 text-sm ${current?.id === c.id ? "bg-accent-soft text-accent" : "hover:bg-surface-2"}`}
                  >
                    {c.title}
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        </aside>

        <section className="order-1 space-y-3 lg:order-2">
          {current ? (
            <div className="flex items-center justify-between gap-2">
              <h2 className="truncate text-sm font-semibold text-muted">{current.title}</h2>
              <form action={deleteConversation}>
                <input type="hidden" name="id" value={current.id} />
                <button type="submit" className="text-xs text-muted hover:text-danger">
                  Borrar conversación
                </button>
              </form>
            </div>
          ) : null}

          {timeline.length === 0 ? (
            <EmptyState>
              {viewer.preview
                ? "Vista previa: aquí aparecerá la conversación."
                : "Escribe una pregunta. El asistente consulta tus datos reales y solo propone cambios: tú confirmas cada uno."}
            </EmptyState>
          ) : (
            <ol className="space-y-3">
              {timeline.map((item) =>
                item.type === "message" ? (
                  <li key={item.m.id} className={item.m.role === "user" ? "flex justify-end" : "flex justify-start"}>
                    <div
                      className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm ${
                        item.m.role === "user" ? "bg-accent text-accent-text" : "border border-border bg-surface"
                      }`}
                    >
                      {item.m.display_text}
                    </div>
                  </li>
                ) : (
                  <li key={item.a.id}>
                    <ActionCard action={item.a} />
                  </li>
                ),
              )}
            </ol>
          )}

          {params.error ? (
            <p role="alert" className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">
              No se obtuvo respuesta. Intenta de nuevo.
            </p>
          ) : null}

          {configured && !viewer.preview ? (
            <ChatInput conversationId={current?.id ?? null} showSuggestions={timeline.length === 0} />
          ) : null}
        </section>
      </div>
    </>
  );
}

function ActionCard({ action }: { action: Action }) {
  const s = STATUS[action.status] ?? STATUS.pending;
  return (
    <div className="rounded-2xl border border-accent/40 bg-accent-soft/40 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-accent">
          Propuesta · {KIND_LABEL[action.kind] ?? action.kind}
        </p>
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${s.tone}`}>{s.label}</span>
      </div>
      <p className="mt-2 text-sm">{action.summary}</p>
      {action.status === "pending" ? (
        <form action={decideAction} className="mt-3 flex gap-2">
          <input type="hidden" name="id" value={action.id} />
          <button
            type="submit"
            name="decision"
            value="confirm"
            className="rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-accent-text"
          >
            Confirmar
          </button>
          <button type="submit" name="decision" value="reject" className="rounded-xl border border-border px-4 py-2 text-sm">
            Descartar
          </button>
        </form>
      ) : null}
    </div>
  );
}
