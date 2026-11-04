import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, EmptyState, PageHeader } from "@/components/ui";
import { ConfirmButton } from "@/components/confirm-button";
import { CONFLICT_MESSAGE } from "@/lib/concurrency";
import { createClient } from "@/lib/supabase/server";
import { getViewer } from "@/lib/session";
import { localDateKey } from "@/lib/zoned-time";
import {
  ACTION_TYPE_LABELS,
  INCIDENT_STATUS_LABELS,
  ISHIKAWA,
  SOLUTION_STATUS_LABELS,
  analysisGaps,
  type Incident,
  type Solution,
} from "@/lib/incidents";
import { addSolution, deleteIncident, saveIncident, setSolutionStatus } from "../actions";
import { IncidentFields, Label, inputCls } from "../fields";

export const metadata: Metadata = { title: "Problema" };
export const dynamic = "force-dynamic";

const NEXT_STATUS: Record<Solution["status"], Solution["status"] | null> = {
  planned: "in_progress",
  in_progress: "done",
  done: null,
  cancelled: null,
};

export default async function IncidentPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string>>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const viewer = await getViewer();
  if (viewer.preview || !/^[0-9a-f-]{36}$/.test(id)) notFound();
  const supabase = await createClient();
  const [{ data: inc }, { data: sols }] = await Promise.all([
    supabase
      .from("incidents")
      .select("id, title, description, severity, status, analysis, occurred_at, closed_at, created_at, updated_at")
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("solutions")
      .select("id, incident_id, action_type, description, owner_name, due_date, status, result, created_at")
      .eq("incident_id", id)
      .order("created_at"),
  ]);
  const incident = inc as Incident | null;
  if (!incident) notFound();
  const solutions = (sols as Solution[] | null) ?? [];
  const a = incident.analysis ?? {};
  const gaps = analysisGaps(a, solutions);
  const tz = viewer.timezone;
  const whys = Array.from({ length: 5 }, (_, i) => a.five_whys?.[i]?.answer ?? "");

  return (
    <>
      <PageHeader
        title={incident.title}
        subtitle={`${INCIDENT_STATUS_LABELS[incident.status]} · registrado el ${localDateKey(new Date(incident.created_at), tz)}`}
        action={
          <Link href="/dashboard/incidencias" className="rounded-xl border border-border px-3 py-2 text-sm text-muted">
            Volver
          </Link>
        }
      />

      {sp.guardado || sp.creado ? (
        <p role="status" className="mb-4 rounded-xl bg-ok-soft px-4 py-2.5 text-sm text-ok">
          {sp.creado ? "Problema registrado. Ahora completa el análisis." : "Cambios guardados."}
        </p>
      ) : null}
      {sp.conflicto ? (
        <p role="alert" className="mb-4 rounded-xl bg-danger-soft px-4 py-2.5 text-sm text-danger">
          {CONFLICT_MESSAGE}
        </p>
      ) : null}
      {sp.error ? (
        <p role="alert" className="mb-4 rounded-xl bg-danger-soft px-4 py-2.5 text-sm text-danger">
          Revisa los datos e intenta de nuevo.
        </p>
      ) : null}

      <div className="space-y-4">
        {gaps.length ? (
          <Card title="Para completar el análisis">
            <ul className="list-disc space-y-1 pl-5 text-sm">
              {gaps.map((g) => (
                <li key={g}>{g}</li>
              ))}
            </ul>
          </Card>
        ) : null}

        <form action={saveIncident} className="space-y-4">
          <input type="hidden" name="id" value={incident.id} />
          <input type="hidden" name="version" value={incident.updated_at} />
          <Card title="Datos generales">
            <IncidentFields
              d={{
                title: incident.title,
                description: incident.description ?? "",
                severity: incident.severity,
                occurred_on: incident.occurred_at ? localDateKey(new Date(incident.occurred_at), tz) : "",
              }}
            />
            <div className="mt-4">
              <Label htmlFor="status">Estado</Label>
              <select id="status" name="status" defaultValue={incident.status} className={inputCls}>
                {Object.entries(INCIDENT_STATUS_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </div>
          </Card>

          <Card title="Hechos">
            <Label htmlFor="facts" hint="(uno por renglón: qué, cuándo, dónde, cuánto)">
              Lo que se sabe con certeza
            </Label>
            <textarea id="facts" name="facts" rows={4} defaultValue={(a.facts ?? []).join("\n")} className={inputCls} />
          </Card>

          <Card title="5 porqués">
            <div className="space-y-3">
              {whys.map((w, i) => (
                <div key={i}>
                  <Label htmlFor={`why${i + 1}`}>
                    {i === 0 ? "¿Por qué ocurrió el problema?" : `¿Por qué? (${i + 1})`}
                  </Label>
                  <input id={`why${i + 1}`} name={`why${i + 1}`} maxLength={500} defaultValue={w} className={inputCls} />
                </div>
              ))}
            </div>
          </Card>

          <Card title="Diagrama de Ishikawa (6M)">
            <div className="grid gap-3 sm:grid-cols-2">
              {ISHIKAWA.map(([k, label]) => (
                <div key={k}>
                  <Label htmlFor={`ish_${k}`}>{label}</Label>
                  <textarea
                    id={`ish_${k}`}
                    name={`ish_${k}`}
                    rows={2}
                    defaultValue={(a.ishikawa?.[k] ?? []).join("\n")}
                    className={inputCls}
                  />
                </div>
              ))}
            </div>
          </Card>

          <Card title="Causa raíz y recomendaciones">
            <div className="space-y-3">
              <div>
                <Label htmlFor="root_causes" hint="(una por renglón)">
                  Causa raíz
                </Label>
                <textarea id="root_causes" name="root_causes" rows={2} defaultValue={(a.root_causes ?? []).join("\n")} className={inputCls} />
              </div>
              <div>
                <Label htmlFor="recommendations" hint="(una por renglón)">
                  Recomendaciones
                </Label>
                <textarea
                  id="recommendations"
                  name="recommendations"
                  rows={2}
                  defaultValue={(a.recommendations ?? []).join("\n")}
                  className={inputCls}
                />
              </div>
            </div>
          </Card>

          <button type="submit" className="w-full rounded-xl bg-accent px-5 py-3 text-sm font-semibold text-accent-text sm:w-auto">
            Guardar análisis
          </button>
        </form>

        <Card title="Plan de acción">
          <div id="acciones" />
          {solutions.length === 0 ? (
            <EmptyState>Sin acciones todavía.</EmptyState>
          ) : (
            <ul className="divide-y divide-border">
              {solutions.map((s) => {
                const next = NEXT_STATUS[s.status];
                return (
                  <li key={s.id} className="flex items-start gap-3 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold uppercase tracking-wide text-accent">{ACTION_TYPE_LABELS[s.action_type]}</p>
                      <p className={`text-sm ${s.status === "cancelled" ? "text-muted line-through" : ""}`}>{s.description}</p>
                      <p className="text-xs text-muted">
                        {SOLUTION_STATUS_LABELS[s.status]}
                        {s.owner_name ? ` · ${s.owner_name}` : ""}
                        {s.due_date ? ` · para el ${s.due_date}` : ""}
                      </p>
                    </div>
                    {next ? (
                      <form action={setSolutionStatus}>
                        <input type="hidden" name="id" value={s.id} />
                        <input type="hidden" name="incident_id" value={incident.id} />
                        <input type="hidden" name="status" value={next} />
                        <button type="submit" className="rounded-lg border border-border px-2.5 py-1 text-xs">
                          {next === "done" ? "Marcar hecha" : "Iniciar"}
                        </button>
                      </form>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
          <form action={addSolution} className="mt-4 space-y-3 border-t border-border pt-4">
            <input type="hidden" name="incident_id" value={incident.id} />
            <div className="grid gap-3 sm:grid-cols-[10rem_1fr]">
              <select name="action_type" aria-label="Tipo de acción" defaultValue="corrective" className={inputCls}>
                {Object.entries(ACTION_TYPE_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
              <input name="description" required maxLength={4000} placeholder="Acción a tomar" aria-label="Acción" className={inputCls} />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <input name="owner_name" maxLength={160} placeholder="Responsable" aria-label="Responsable" className={inputCls} />
              <input name="due_date" type="date" aria-label="Fecha compromiso" className={inputCls} />
            </div>
            <button type="submit" className="rounded-xl border border-border px-4 py-2.5 text-sm font-medium">
              Agregar acción
            </button>
          </form>
        </Card>

        <form action={deleteIncident}>
          <input type="hidden" name="id" value={incident.id} />
          <ConfirmButton message="¿Eliminar este problema y su plan de acción?" danger>
            Eliminar problema
          </ConfirmButton>
        </form>
      </div>
    </>
  );
}
