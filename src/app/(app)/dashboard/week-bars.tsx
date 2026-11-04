import { shortDayLabel } from "@/lib/planner";

/** Barras verticales de una sola serie por semana (el título nombra la serie). */
export function WeekBars({
  title,
  points,
  format = (v: number) => String(v),
}: {
  title: string;
  points: { weekKey: string; value: number }[];
  format?: (v: number) => string;
}) {
  const max = Math.max(1, ...points.map((p) => p.value));
  const label = (k: string) => {
    const l = shortDayLabel(k);
    return `Sem. ${l.day}`;
  };
  return (
    <figure>
      <figcaption className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">{title}</figcaption>
      <div className="flex h-36 items-end gap-3 border-b border-border" role="img" aria-label={title}>
        {points.map((p, i) => {
          const last = i === points.length - 1;
          return (
            <div key={p.weekKey} className="group flex h-full flex-1 flex-col items-center justify-end">
              <span className={`mb-1 text-xs tabular-nums ${last ? "font-semibold text-text" : "text-muted"}`}>
                {format(p.value)}
              </span>
              <div
                title={`${label(p.weekKey)}: ${format(p.value)}`}
                className={`w-full max-w-12 rounded-t-[4px] ${last ? "bg-accent" : "bg-accent/45"} group-hover:bg-accent`}
                style={{ height: `${p.value === 0 ? 0 : Math.max(4, (p.value / max) * 100)}%` }}
              />
            </div>
          );
        })}
      </div>
      <div className="mt-1.5 flex gap-3">
        {points.map((p, i) => (
          <span key={p.weekKey} className="flex-1 text-center text-xs text-muted">
            {i === points.length - 1 ? "Esta" : label(p.weekKey)}
          </span>
        ))}
      </div>
    </figure>
  );
}
