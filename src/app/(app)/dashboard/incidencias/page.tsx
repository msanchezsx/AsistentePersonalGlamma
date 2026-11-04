import type { Metadata } from "next";
import Link from "next/link";
import { Card, EmptyState, PageHeader } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { getViewer } from "@/lib/session";
import { INCIDENT_STATUS_LABELS, SEVERITY_LABELS, type Incident } from "@/lib/incidents";

export const metadata: Metadata = { title: "Análisis de problemas" };
export const dynamic = "force-dynamic";

const SEV_TONE: Record<string, string> = {
  low: "bg-surface-2 text-muted",
  medium: "bg-accent-soft text-accent",
  high: "bg-warn-soft text-warn",
  critical: "bg-danger-soft text-danger",
};

export default async function IncidentsPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const params = await searchParams;
  const viewer = await getViewer();
  let items: Incident[] = [];
  if (!viewer.preview) {
    const supabase = await createClient();
    const { data } = await supabase
      .from("incidents")
      .select("id, title, description, severity, status, analysis, occurred_at, closed_at, created_at, updated_at")
      .order("created_at", { ascending: false })
      .limit(100);
    items = (data as Incident[] | null) ?? [];
  }
  const open = items.filter((i) => i.status !== "closed");
  const closed = items.filter((i) => i.status === "closed");

  return (
    <>
      <PageHeader
        title="Análisis de problemas"
        subtitle="Registra un problema, encuentra la causa raíz y da seguimiento al plan de acción."
        action={
          <Link href="/dashboard/incidencias/nueva" className="rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-accent-text">
            Nuevo
          </Link>
        }
      />
      {params.eliminado ? (
        <p role="status" className="mb-4 rounded-xl bg-ok-soft px-4 py-2.5 text-sm text-ok">
          Problema eliminado.
        </p>
      ) : null}
      <div className="space-y-4">
        {[
          { title: "Abiertos", list: open },
          { title: "Cerrados", list: closed },
        ].map((g) => (
          <Card key={g.title} title={`${g.title} · ${g.list.length}`}>
            {g.list.length === 0 ? (
              <EmptyState>{g.title === "Abiertos" ? "No hay problemas abiertos." : "Aún no hay problemas cerrados."}</EmptyState>
            ) : (
              <ul className="divide-y divide-border">
                {g.list.map((i) => (
                  <li key={i.id}>
                    <Link href={`/dashboard/incidencias/${i.id}`} className="flex items-center gap-3 py-3">
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${SEV_TONE[i.severity]}`}>
                        {SEVERITY_LABELS[i.severity]}
                      </span>
                      <span className="min-w-0 flex-1 truncate font-medium">{i.title}</span>
                      <span className="text-xs text-muted">{INCIDENT_STATUS_LABELS[i.status]}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        ))}
      </div>
    </>
  );
}
