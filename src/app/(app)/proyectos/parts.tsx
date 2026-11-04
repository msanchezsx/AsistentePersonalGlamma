import Link from "next/link";
import type { Option } from "@/lib/tasks/types";
import { dueLabel, isFollowUpOverdue, type FollowUp } from "@/lib/projects";
import { createFollowUp, setFollowUpStatus } from "./actions";

export const inputCls =
  "w-full rounded-xl border border-border bg-bg px-3.5 py-3 text-base outline-none focus:border-accent focus:ring-2 focus:ring-accent/30";

export function Notice({ params }: { params: Record<string, string> }) {
  if (params.error)
    return (
      <p role="alert" className="mb-4 rounded-xl bg-danger-soft px-4 py-2.5 text-sm text-danger">
        {params.error.slice(0, 200)}
      </p>
    );
  if (params.conflicto)
    return (
      <p role="alert" className="mb-4 rounded-xl bg-danger-soft px-4 py-2.5 text-sm text-danger">
        Esto se modificó en otro dispositivo mientras lo editabas. Recarga la página y vuelve a aplicar tus cambios.
      </p>
    );
  const ok = params.guardado ? "Cambios guardados." : params.creado ? "Guardado." : params.eliminado ? "Eliminado." : null;
  return ok ? (
    <p role="status" className="mb-4 rounded-xl bg-ok-soft px-4 py-2.5 text-sm text-ok">
      {ok}
    </p>
  ) : null;
}

export function FollowUpItem({ f, now, timeZone }: { f: FollowUp; now: Date; timeZone: string }) {
  const overdue = isFollowUpOverdue(f, now);
  const due = dueLabel(f.due_at, now, timeZone);
  const open = f.status === "open";
  const meta = [
    f.contact?.full_name,
    f.project ? (f.project.code ? `${f.project.name} (${f.project.code})` : f.project.name) : f.client?.name,
  ].filter(Boolean);
  return (
    <li className="flex items-start gap-3 py-3">
      <form action={setFollowUpStatus} className="pt-0.5">
        <input type="hidden" name="id" value={f.id} />
        <input type="hidden" name="status" value={open ? "done" : "open"} />
        <button
          type="submit"
          aria-label={open ? `Marcar "${f.title}" como cumplido` : `Reabrir "${f.title}"`}
          className={`grid size-6 place-items-center rounded-full border-2 ${open ? "border-border hover:border-accent" : "border-ok bg-ok text-white"}`}
        >
          {open ? null : (
            <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth={3}>
              <path d="M5 12l5 5 9-10" />
            </svg>
          )}
        </button>
      </form>
      <div className="min-w-0 flex-1">
        <p className={`text-sm font-medium ${open ? "" : "text-muted line-through"}`}>{f.title}</p>
        <p className="text-xs text-muted">
          {due ? <span className={overdue ? "font-medium text-danger" : ""}>{due}</span> : null}
          {due && meta.length ? " · " : ""}
          {meta.join(" · ")}
        </p>
      </div>
      {f.project ? (
        <Link href={`/proyectos/${f.project.id}`} className="text-xs text-accent">
          Ver
        </Link>
      ) : null}
    </li>
  );
}

/** Alta rápida de un seguimiento. */
export function FollowUpForm({
  contacts,
  projects,
  clients,
  projectId,
}: {
  contacts: Option[];
  projects: Option[];
  clients: Option[];
  projectId?: string;
}) {
  return (
    <form action={createFollowUp} className="space-y-3">
      {projectId ? (
        <>
          <input type="hidden" name="project_id" value={projectId} />
          <input type="hidden" name="back" value="proyecto" />
        </>
      ) : null}
      <input name="title" required maxLength={300} placeholder="¿Qué hay que seguir? (p. ej. Enviar cotización)" aria-label="Seguimiento" className={inputCls} />
      <div className="grid gap-3 sm:grid-cols-2">
        <select name="owner_side" aria-label="Quién se comprometió" defaultValue="mine" className={inputCls}>
          <option value="mine">Yo me comprometí</option>
          <option value="theirs">Otra persona se comprometió conmigo</option>
        </select>
        <input name="due_date" type="date" aria-label="Fecha compromiso" className={inputCls} />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <select name="contact_id" aria-label="Persona" defaultValue="" className={inputCls}>
          <option value="">Persona (opcional)</option>
          {contacts.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </select>
        <input name="new_contact" maxLength={160} placeholder="…o escribe un nombre nuevo" aria-label="Persona nueva" className={inputCls} />
      </div>
      {projectId ? null : (
        <div className="grid gap-3 sm:grid-cols-2">
          <select name="project_id" aria-label="Proyecto" defaultValue="" className={inputCls}>
            <option value="">Proyecto / pedido (opcional)</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
          <select name="client_id" aria-label="Cliente" defaultValue="" className={inputCls}>
            <option value="">Cliente (opcional)</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
      )}
      <button type="submit" className="rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-accent-text">
        Agregar seguimiento
      </button>
    </form>
  );
}

export function ClientSelect({ clients, defaultValue = "" }: { clients: Option[]; defaultValue?: string }) {
  return (
    <select name="client_id" aria-label="Cliente" defaultValue={defaultValue} className={inputCls}>
      <option value="">Sin cliente</option>
      {clients.map((c) => (
        <option key={c.id} value={c.id}>
          {c.label}
        </option>
      ))}
    </select>
  );
}
