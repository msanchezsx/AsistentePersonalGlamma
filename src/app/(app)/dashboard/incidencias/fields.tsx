import { SEVERITY_LABELS } from "@/lib/incidents";

export const inputCls =
  "w-full rounded-xl border border-border bg-bg px-3.5 py-3 text-base outline-none focus:border-accent focus:ring-2 focus:ring-accent/30";

export function Label({ htmlFor, children, hint }: { htmlFor: string; children: React.ReactNode; hint?: string }) {
  return (
    <label htmlFor={htmlFor} className="mb-1.5 block text-sm font-medium">
      {children}
      {hint ? <span className="ml-1 font-normal text-muted">{hint}</span> : null}
    </label>
  );
}

/** Campos generales del problema (alta y edición). */
export function IncidentFields({
  d,
}: {
  d: { title: string; description: string; severity: string; occurred_on: string };
}) {
  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="title">Problema</Label>
        <input id="title" name="title" required maxLength={300} defaultValue={d.title} className={inputCls} />
      </div>
      <div>
        <Label htmlFor="description">Descripción</Label>
        <textarea id="description" name="description" rows={3} maxLength={8000} defaultValue={d.description} className={inputCls} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="severity">Gravedad</Label>
          <select id="severity" name="severity" defaultValue={d.severity} className={inputCls}>
            {Object.entries(SEVERITY_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label htmlFor="occurred_on">Fecha en que ocurrió</Label>
          <input id="occurred_on" name="occurred_on" type="date" defaultValue={d.occurred_on} className={inputCls} />
        </div>
      </div>
    </div>
  );
}
