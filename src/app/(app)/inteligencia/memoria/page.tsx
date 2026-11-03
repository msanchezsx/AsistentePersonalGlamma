import type { Metadata } from "next";
import Link from "next/link";
import { Card, EmptyState, PageHeader } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { getViewer } from "@/lib/session";
import { forgetMemory } from "../actions";

export const metadata: Metadata = { title: "Memoria del asistente" };
export const dynamic = "force-dynamic";

type Memory = { id: string; category: string; subject: string; content: string; source: string; updated_at: string };

const CATEGORY: Record<string, string> = {
  profile: "Perfil",
  preference: "Preferencias",
  habit: "Hábitos",
  priority: "Prioridades",
  process: "Procesos",
  decision: "Decisiones",
  relationship: "Personas",
  project: "Proyectos",
  client: "Clientes",
  other: "Otros",
};

export default async function MemoryPage() {
  const viewer = await getViewer();
  let items: Memory[] = [];
  if (!viewer.preview) {
    const supabase = await createClient();
    const { data } = await supabase
      .from("assistant_memory")
      .select("id, category, subject, content, source, updated_at")
      .eq("is_active", true)
      .eq("confirmed", true)
      .order("category")
      .order("updated_at", { ascending: false });
    items = (data as Memory[] | null) ?? [];
  }

  const groups = Object.keys(CATEGORY)
    .map((key) => ({ key, items: items.filter((m) => m.category === key) }))
    .filter((g) => g.items.length);

  return (
    <>
      <PageHeader
        title="Memoria"
        subtitle="Lo que el asistente sabe de ti. Solo guarda lo que tú confirmas."
        action={
          <Link href="/inteligencia" className="rounded-xl border border-border px-3 py-2 text-sm text-muted hover:text-accent">
            Volver
          </Link>
        }
      />
      {groups.length === 0 ? (
        <EmptyState>
          Aún no hay recuerdos. Dile al asistente algo como “recuerda que los lunes reviso producción a las 8” y confirma la
          propuesta.
        </EmptyState>
      ) : (
        <div className="space-y-4">
          {groups.map((g) => (
            <Card key={g.key} title={CATEGORY[g.key]}>
              <ul className="divide-y divide-border">
                {g.items.map((m) => (
                  <li key={m.id} className="flex items-start justify-between gap-3 py-2.5">
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{m.subject}</p>
                      <p className="whitespace-pre-wrap text-sm text-muted">{m.content}</p>
                    </div>
                    <form action={forgetMemory}>
                      <input type="hidden" name="id" value={m.id} />
                      <button type="submit" className="shrink-0 text-xs text-muted hover:text-danger">
                        Olvidar
                      </button>
                    </form>
                  </li>
                ))}
              </ul>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
