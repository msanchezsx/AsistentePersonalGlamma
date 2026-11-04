import type { Metadata } from "next";
import Link from "next/link";
import { Card, EmptyState, PageHeader } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { getViewer } from "@/lib/session";
import { listContactOptions, listRelationOptions } from "@/lib/tasks/queries";
import {
  FOLLOW_UP_SELECT,
  PROJECT_SELECT,
  PROJECT_STATUS_LABELS,
  groupFollowUps,
  type Client,
  type FollowUp,
  type Project,
} from "@/lib/projects";
import { createClientRecord, createProject } from "./actions";
import { ClientSelect, FollowUpForm, FollowUpItem, Notice, inputCls } from "./parts";

export const metadata: Metadata = { title: "Proyectos" };
export const dynamic = "force-dynamic";

const TABS = [
  { k: "seguimientos", label: "Seguimientos" },
  { k: "proyectos", label: "Proyectos" },
  { k: "clientes", label: "Clientes" },
] as const;

export default async function ProjectsPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const params = await searchParams;
  const tab = TABS.find((t) => t.k === params.vista)?.k ?? "seguimientos";
  const viewer = await getViewer();

  return (
    <>
      <PageHeader title="Proyectos" subtitle="Seguimientos, proyectos o pedidos, y clientes con sus contactos." />
      <nav aria-label="Sección" className="mb-4 inline-flex rounded-xl border border-border bg-surface p-1">
        {TABS.map((t) => (
          <Link
            key={t.k}
            href={`/proyectos?vista=${t.k}`}
            aria-current={tab === t.k ? "page" : undefined}
            className={`rounded-lg px-3 py-2 text-sm font-medium sm:px-4 ${tab === t.k ? "bg-accent text-accent-text" : "text-muted"}`}
          >
            {t.label}
          </Link>
        ))}
      </nav>
      <Notice params={params} />
      {viewer.preview ? (
        <EmptyState>Vista previa local sin base de datos.</EmptyState>
      ) : tab === "seguimientos" ? (
        <FollowUps timeZone={viewer.timezone} />
      ) : tab === "proyectos" ? (
        <Projects />
      ) : (
        <Clients />
      )}
    </>
  );
}

async function FollowUps({ timeZone }: { timeZone: string }) {
  const supabase = await createClient();
  const since = new Date(Date.now() - 14 * 86400_000).toISOString();
  const [{ data }, rel, contacts] = await Promise.all([
    supabase
      .from("follow_ups")
      .select(FOLLOW_UP_SELECT)
      .or(`status.eq.open,closed_at.gte."${since}"`)
      .order("due_at", { ascending: true, nullsFirst: false })
      .limit(300),
    listRelationOptions(),
    listContactOptions(),
  ]);
  const now = new Date();
  const g = groupFollowUps((data as unknown as FollowUp[] | null) ?? [], now);
  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title={`Yo debo · ${g.mine.length}`}>
          {g.mine.length ? (
            <ul className="divide-y divide-border">
              {g.mine.map((f) => (
                <FollowUpItem key={f.id} f={f} now={now} timeZone={timeZone} />
              ))}
            </ul>
          ) : (
            <EmptyState>No tienes compromisos abiertos.</EmptyState>
          )}
        </Card>
        <Card title={`Me deben · ${g.theirs.length}`}>
          {g.theirs.length ? (
            <ul className="divide-y divide-border">
              {g.theirs.map((f) => (
                <FollowUpItem key={f.id} f={f} now={now} timeZone={timeZone} />
              ))}
            </ul>
          ) : (
            <EmptyState>Nadie te debe nada por ahora.</EmptyState>
          )}
        </Card>
      </div>
      <Card title="Nuevo seguimiento">
        <FollowUpForm contacts={contacts} projects={rel.projects} clients={rel.clients} />
      </Card>
      {g.closed.length ? (
        <Card title="Cumplidos (últimos 14 días)">
          <ul className="divide-y divide-border">
            {g.closed.map((f) => (
              <FollowUpItem key={f.id} f={f} now={now} timeZone={timeZone} />
            ))}
          </ul>
        </Card>
      ) : null}
    </div>
  );
}

async function Projects() {
  const supabase = await createClient();
  const [{ data }, rel] = await Promise.all([
    supabase.from("projects").select(PROJECT_SELECT).order("updated_at", { ascending: false }).limit(300),
    listRelationOptions(),
  ]);
  const items = (data as unknown as Project[] | null) ?? [];
  const active = items.filter((p) => p.status === "active" || p.status === "planned" || p.status === "on_hold");
  const closed = items.filter((p) => p.status === "completed" || p.status === "cancelled");
  return (
    <div className="space-y-4">
      <Card title={`En curso · ${active.length}`}>
        <ProjectList items={active} empty="No hay proyectos en curso." />
      </Card>
      <Card title="Nuevo proyecto o pedido">
        <form action={createProject} className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-[1fr_10rem]">
            <input name="name" required maxLength={160} placeholder="Nombre" aria-label="Nombre" className={inputCls} />
            <input name="code" maxLength={40} placeholder="Pedido / código" aria-label="Pedido o código" className={inputCls} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <ClientSelect clients={rel.clients} />
            <input name="due_date" type="date" aria-label="Fecha de entrega" className={inputCls} />
          </div>
          <button type="submit" className="rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-accent-text">
            Crear proyecto
          </button>
        </form>
      </Card>
      {closed.length ? (
        <Card title={`Terminados o cancelados · ${closed.length}`}>
          <ProjectList items={closed} empty="" />
        </Card>
      ) : null}
    </div>
  );
}

function ProjectList({ items, empty }: { items: Project[]; empty: string }) {
  if (!items.length) return <EmptyState>{empty}</EmptyState>;
  return (
    <ul className="divide-y divide-border">
      {items.map((p) => (
        <li key={p.id}>
          <Link href={`/proyectos/${p.id}`} className="flex items-center gap-3 py-3">
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">
                {p.name}
                {p.code ? <span className="ml-2 text-sm font-normal text-muted">#{p.code}</span> : null}
              </p>
              <p className="text-xs text-muted">
                {[p.client?.name, p.due_date ? `Entrega ${p.due_date}` : null].filter(Boolean).join(" · ") || "Sin cliente"}
              </p>
            </div>
            <span className="text-xs text-muted">{PROJECT_STATUS_LABELS[p.status]}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

async function Clients() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("clients")
    .select("id, name, code, notes, status, updated_at")
    .order("name")
    .limit(300);
  const items = (data as Client[] | null) ?? [];
  return (
    <div className="space-y-4">
      <Card title={`Clientes · ${items.length}`}>
        {items.length ? (
          <ul className="divide-y divide-border">
            {items.map((c) => (
              <li key={c.id}>
                <Link href={`/proyectos/clientes/${c.id}`} className="flex items-center gap-3 py-3">
                  <span className={`min-w-0 flex-1 truncate font-medium ${c.status === "inactive" ? "text-muted" : ""}`}>
                    {c.name}
                  </span>
                  {c.code ? <span className="text-xs text-muted">{c.code}</span> : null}
                  {c.status === "inactive" ? <span className="text-xs text-muted">Inactivo</span> : null}
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState>Aún no registras clientes.</EmptyState>
        )}
      </Card>
      <Card title="Nuevo cliente">
        <form action={createClientRecord} className="grid gap-3 sm:grid-cols-[1fr_10rem_auto]">
          <input name="name" required maxLength={160} placeholder="Nombre del cliente" aria-label="Nombre" className={inputCls} />
          <input name="code" maxLength={40} placeholder="Clave (opcional)" aria-label="Clave" className={inputCls} />
          <button type="submit" className="rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-accent-text">
            Agregar
          </button>
        </form>
      </Card>
    </div>
  );
}
