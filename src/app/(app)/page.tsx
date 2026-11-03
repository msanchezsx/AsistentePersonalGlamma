import Link from "next/link";
import { Icon } from "@/components/icon";
import { LiveClock } from "@/components/live-clock";
import { Card, EmptyState, PhaseBadge } from "@/components/ui";
import { greetingFor } from "@/lib/datetime";
import { getViewer } from "@/lib/session";

export const dynamic = "force-dynamic";

const SECTIONS = [
  {
    title: "Resumen ejecutivo",
    phase: 4,
    text: "El resumen de inicio de jornada se generará automáticamente a partir de tu agenda, tareas y correos.",
  },
  { title: "Próximas reuniones", phase: 1, text: "Aquí verás tus próximas reuniones cuando se active la agenda." },
  { title: "Tareas prioritarias", phase: 1, text: "Aquí verás tus tareas urgentes e importantes." },
  { title: "Alertas", phase: 4, text: "Actividades vencidas y compromisos próximos a vencer." },
  { title: "Seguimientos", phase: 1, text: "Seguimientos y compromisos abiertos con clientes y colaboradores." },
];

export default async function HomePage() {
  const viewer = await getViewer();
  const now = new Date();
  const name = viewer.displayName ? `, ${viewer.displayName}` : "";

  return (
    <div className="space-y-5">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          {greetingFor(now, viewer.timezone)}
          {name}
        </h1>
        <LiveClock timeZone={viewer.timezone} initial={now.toISOString()} />
        {viewer.preview ? (
          <p className="pt-2 text-xs font-medium text-warn">Vista previa local sin base de datos.</p>
        ) : null}
      </header>

      {/* Accesos rápidos */}
      <div className="grid grid-cols-3 gap-3">
        <QuickAction icon="mic" label="Voz" phase={1} />
        <QuickAction icon="plus" label="Nueva tarea" phase={1} />
        <QuickAction icon="spark" label="Asistente" phase={2} href="/inteligencia" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {SECTIONS.map((s, i) => (
          <Card key={s.title} className={i === 0 ? "lg:col-span-2" : ""}>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">{s.title}</h2>
              <PhaseBadge phase={s.phase} />
            </div>
            <EmptyState>{s.text}</EmptyState>
          </Card>
        ))}
      </div>
    </div>
  );
}

function QuickAction({
  icon,
  label,
  phase,
  href,
}: {
  icon: "mic" | "plus" | "spark";
  label: string;
  phase: number;
  href?: string;
}) {
  const content = (
    <>
      <span className="grid size-11 place-items-center rounded-full bg-accent-soft text-accent">
        <Icon name={icon} className="size-5" />
      </span>
      <span className="text-sm font-medium">{label}</span>
      <span className="text-[11px] text-muted">Fase {phase}</span>
    </>
  );
  const cls = "flex flex-col items-center gap-1.5 rounded-2xl border border-border bg-surface px-2 py-4 text-center";
  return href ? (
    <Link href={href} className={`${cls} hover:bg-surface-2`}>
      {content}
    </Link>
  ) : (
    <button
      type="button"
      disabled
      aria-disabled="true"
      title={`Disponible en la Fase ${phase}`}
      className={`${cls} opacity-70`}
    >
      {content}
    </button>
  );
}
