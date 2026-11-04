import type { Metadata } from "next";
import Link from "next/link";
import { Card, EmptyState, PageHeader } from "@/components/ui";
import { captureFormHref, describeCapture, parseCapture } from "@/lib/capture";
import { createClient } from "@/lib/supabase/server";
import { getViewer } from "@/lib/session";
import { firstLine, readShared, sharedDescription, stripChatHeaders } from "@/lib/share";
import { localDateKey } from "@/lib/zoned-time";
import { saveSharedNote } from "./actions";

export const metadata: Metadata = { title: "Compartido" };
export const dynamic = "force-dynamic";

type Note = { id: string; subject: string | null; summary: string | null; occurred_at: string };

export default async function SharePage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const viewer = await getViewer();
  const shared = readShared(sp);
  const raw = [shared.title, shared.text].filter(Boolean).join("\n").trim();
  const { body, author } = stripChatHeaders(raw);
  const has = Boolean(body || shared.url);

  let notes: Note[] = [];
  if (!viewer.preview) {
    const supabase = await createClient();
    const { data } = await supabase
      .from("communications")
      .select("id, subject, summary, occurred_at")
      .eq("channel", "whatsapp")
      .order("occurred_at", { ascending: false })
      .limit(20);
    notes = (data as Note[] | null) ?? [];
  }

  const today = localDateKey(new Date(), viewer.timezone);
  const parsed = body ? parseCapture(firstLine(body, 300), today) : null;
  const desc = sharedDescription(shared, author, body);
  const withDesc = (href: string) => `${href}&desc=${encodeURIComponent(desc)}`;
  const taskHref = parsed ? withDesc(captureFormHref({ ...parsed, kind: "task" })) : null;
  const meetingHref = parsed ? withDesc(captureFormHref({ ...parsed, kind: "meeting" })) : null;

  return (
    <>
      <PageHeader
        title="Compartido"
        subtitle="Mensajes que compartes desde WhatsApp u otras apps. Tú decides qué hacer con cada uno."
      />
      {sp.guardado ? (
        <p role="status" className="mb-4 rounded-xl bg-ok-soft px-4 py-2.5 text-sm text-ok">
          Nota guardada.
        </p>
      ) : null}
      {sp.error ? (
        <p role="alert" className="mb-4 rounded-xl bg-danger-soft px-4 py-2.5 text-sm text-danger">
          No se pudo guardar. Intenta de nuevo.
        </p>
      ) : null}

      <div className="space-y-4">
        {has ? (
          <Card title="Recibido">
            {author ? <p className="mb-1 text-xs text-muted">De {author}</p> : null}
            <p className="whitespace-pre-wrap rounded-xl bg-surface-2 px-4 py-3 text-sm">{body || shared.url}</p>
            {shared.url && body ? (
              <p className="mt-2 truncate text-xs text-muted">{shared.url}</p>
            ) : null}
            {parsed ? (
              <ul className="mt-3 space-y-0.5 text-xs text-muted">
                {describeCapture(parsed).map((l) => (
                  <li key={l}>{l}</li>
                ))}
              </ul>
            ) : null}
            <div className="mt-4 flex flex-wrap gap-2">
              {taskHref ? (
                <Link href={taskHref} className="rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-accent-text">
                  Crear tarea
                </Link>
              ) : null}
              {meetingHref ? (
                <Link href={meetingHref} className="rounded-xl border border-border px-4 py-2.5 text-sm font-medium">
                  Crear reunión
                </Link>
              ) : null}
              {!viewer.preview ? (
                <form action={saveSharedNote}>
                  <input type="hidden" name="subject" value={firstLine(body || shared.url, 200)} />
                  <input type="hidden" name="summary" value={desc} />
                  <button type="submit" className="rounded-xl border border-border px-4 py-2.5 text-sm font-medium">
                    Guardar como nota
                  </button>
                </form>
              ) : null}
            </div>
            <p className="mt-3 text-xs text-muted">Nada se guarda hasta que elijas una opción.</p>
          </Card>
        ) : (
          <Card title="Cómo compartir">
            <ol className="list-decimal space-y-1 pl-5 text-sm">
              <li>En WhatsApp, mantén presionado el mensaje.</li>
              <li>Toca los tres puntos (⋮) → Compartir.</li>
              <li>Elige “Asistente”. El mensaje llega aquí para que lo conviertas en tarea, reunión o nota.</li>
            </ol>
            <p className="mt-2 text-xs text-muted">
              Si “Asistente” no aparece en la lista, reinstala la app desde Chrome (menú ⋮ → Agregar a pantalla de inicio).
            </p>
          </Card>
        )}

        <Card title="Notas guardadas">
          {notes.length === 0 ? (
            <EmptyState>Aún no guardas notas compartidas.</EmptyState>
          ) : (
            <ul className="divide-y divide-border">
              {notes.map((n) => (
                <li key={n.id} className="py-3">
                  <p className="text-xs text-muted">{localDateKey(new Date(n.occurred_at), viewer.timezone)}</p>
                  <p className="whitespace-pre-wrap text-sm">{n.summary}</p>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
