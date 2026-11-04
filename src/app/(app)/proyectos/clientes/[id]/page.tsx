import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, EmptyState, PageHeader } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { getViewer } from "@/lib/session";
import { PROJECT_STATUS_LABELS, RELATIONSHIP_LABELS, type Client, type Contact, type Project } from "@/lib/projects";
import { createContact, deleteContact, updateClientRecord } from "../../actions";
import { Notice, inputCls } from "../../parts";

export const metadata: Metadata = { title: "Cliente" };
export const dynamic = "force-dynamic";

export default async function ClientPage({
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
  const [{ data: cl }, { data: cts }, { data: prj }] = await Promise.all([
    supabase.from("clients").select("id, name, code, notes, status, updated_at").eq("id", id).maybeSingle(),
    supabase.from("contacts").select("id, full_name, role, relationship, email, phone, client_id").eq("client_id", id).order("full_name"),
    supabase.from("projects").select("id, name, code, status").eq("client_id", id).order("updated_at", { ascending: false }),
  ]);
  const client = cl as Client | null;
  if (!client) notFound();
  const contacts = (cts as Contact[] | null) ?? [];
  const projects = (prj as Pick<Project, "id" | "name" | "code" | "status">[] | null) ?? [];

  return (
    <>
      <PageHeader
        title={client.name}
        subtitle={client.status === "inactive" ? "Cliente inactivo" : `${projects.length} proyectos · ${contacts.length} contactos`}
        action={
          <Link href="/proyectos?vista=clientes" className="rounded-xl border border-border px-3 py-2 text-sm text-muted">
            Volver
          </Link>
        }
      />
      <Notice params={sp} />
      <div className="space-y-4">
        <Card title="Contactos">
          <div id="contactos" />
          {contacts.length ? (
            <ul className="mb-4 divide-y divide-border">
              {contacts.map((c) => (
                <li key={c.id} className="flex items-start gap-3 py-3">
                  <div className="min-w-0 flex-1 text-sm">
                    <p className="font-medium">{c.full_name}</p>
                    <p className="text-xs text-muted">
                      {[c.role, RELATIONSHIP_LABELS[c.relationship]].filter(Boolean).join(" · ")}
                    </p>
                    <p className="text-xs">
                      {c.phone ? (
                        <a href={`tel:${c.phone}`} className="mr-3 text-accent">
                          {c.phone}
                        </a>
                      ) : null}
                      {c.email ? (
                        <a href={`mailto:${c.email}`} className="text-accent">
                          {c.email}
                        </a>
                      ) : null}
                    </p>
                  </div>
                  <form action={deleteContact}>
                    <input type="hidden" name="id" value={c.id} />
                    <input type="hidden" name="client_id" value={client.id} />
                    <button type="submit" className="text-xs text-muted hover:text-danger">
                      Quitar
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState>Sin contactos.</EmptyState>
          )}
          <form action={createContact} className="mt-3 space-y-3 border-t border-border pt-4">
            <input type="hidden" name="client_id" value={client.id} />
            <div className="grid gap-3 sm:grid-cols-2">
              <input name="full_name" required maxLength={160} placeholder="Nombre" aria-label="Nombre" className={inputCls} />
              <input name="role" maxLength={120} placeholder="Puesto" aria-label="Puesto" className={inputCls} />
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <input name="phone" type="tel" maxLength={30} placeholder="Teléfono" aria-label="Teléfono" className={inputCls} />
              <input name="email" type="email" maxLength={254} placeholder="Correo" aria-label="Correo" className={inputCls} />
              <select name="relationship" defaultValue="client" aria-label="Relación" className={inputCls}>
                {Object.entries(RELATIONSHIP_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </div>
            <button type="submit" className="rounded-xl border border-border px-4 py-2.5 text-sm font-medium">
              Agregar contacto
            </button>
          </form>
        </Card>

        <Card title="Proyectos">
          {projects.length ? (
            <ul className="divide-y divide-border">
              {projects.map((p) => (
                <li key={p.id}>
                  <Link href={`/proyectos/${p.id}`} className="flex items-center gap-3 py-3 text-sm">
                    <span className="min-w-0 flex-1 truncate font-medium">
                      {p.name}
                      {p.code ? <span className="ml-2 font-normal text-muted">#{p.code}</span> : null}
                    </span>
                    <span className="text-xs text-muted">{PROJECT_STATUS_LABELS[p.status]}</span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState>Sin proyectos. Créalos en Proyectos y elige este cliente.</EmptyState>
          )}
        </Card>

        <Card title="Datos del cliente">
          <form action={updateClientRecord} className="space-y-3">
            <input type="hidden" name="id" value={client.id} />
            <input type="hidden" name="version" value={client.updated_at} />
            <div className="grid gap-3 sm:grid-cols-[1fr_10rem]">
              <input name="name" required maxLength={160} defaultValue={client.name} aria-label="Nombre" className={inputCls} />
              <input name="code" maxLength={40} defaultValue={client.code ?? ""} placeholder="Clave" aria-label="Clave" className={inputCls} />
            </div>
            <textarea name="notes" rows={3} maxLength={4000} defaultValue={client.notes ?? ""} placeholder="Notas" aria-label="Notas" className={inputCls} />
            <select name="status" defaultValue={client.status} aria-label="Estado" className={inputCls}>
              <option value="active">Activo</option>
              <option value="inactive">Inactivo</option>
            </select>
            <button type="submit" className="rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-accent-text">
              Guardar cambios
            </button>
          </form>
        </Card>
      </div>
    </>
  );
}
