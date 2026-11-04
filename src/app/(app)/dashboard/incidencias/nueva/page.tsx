import type { Metadata } from "next";
import Link from "next/link";
import { Card, PageHeader } from "@/components/ui";
import { createIncident } from "../actions";
import { IncidentFields } from "../fields";

export const metadata: Metadata = { title: "Nuevo problema" };

export default async function NewIncidentPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const params = await searchParams;
  return (
    <>
      <PageHeader title="Nuevo problema" subtitle="Describe qué pasó. El análisis lo completas después." />
      <Card>
        <form action={createIncident} className="space-y-5">
          {params.error ? (
            <p role="alert" className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">
              Revisa los datos e intenta de nuevo.
            </p>
          ) : null}
          <IncidentFields d={{ title: "", description: "", severity: "medium", occurred_on: "" }} />
          <div className="flex gap-2">
            <button type="submit" className="rounded-xl bg-accent px-5 py-3 text-sm font-semibold text-accent-text">
              Guardar
            </button>
            <Link href="/dashboard/incidencias" className="rounded-xl border border-border px-5 py-3 text-sm">
              Cancelar
            </Link>
          </div>
        </form>
      </Card>
    </>
  );
}
