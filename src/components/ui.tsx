import type { ReactNode } from "react";

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <header className="mb-6 flex items-start justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {subtitle ? <p className="mt-1 text-sm text-muted">{subtitle}</p> : null}
      </div>
      {action}
    </header>
  );
}

export function Card({ title, children, className = "" }: { title?: string; children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-2xl border border-border bg-surface p-4 sm:p-5 ${className}`}>
      {title ? <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">{title}</h2> : null}
      {children}
    </section>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <p className="rounded-xl bg-surface-2 px-4 py-3 text-sm text-muted">{children}</p>;
}

export function PhaseBadge({ phase }: { phase: number }) {
  return (
    <span className="inline-flex items-center rounded-full bg-accent-soft px-2.5 py-0.5 text-xs font-medium text-accent">
      Fase {phase}
    </span>
  );
}

const STATUS_STYLES = {
  active: "bg-ok-soft text-ok",
  pending: "bg-warn-soft text-warn",
  revoked: "bg-danger-soft text-danger",
} as const;

const STATUS_LABELS = { active: "Autorizado", pending: "Pendiente", revoked: "Revocado" } as const;

export function DeviceStatusBadge({ status }: { status: keyof typeof STATUS_STYLES }) {
  return (
    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLES[status]}`}>
      {STATUS_LABELS[status]}
    </span>
  );
}
