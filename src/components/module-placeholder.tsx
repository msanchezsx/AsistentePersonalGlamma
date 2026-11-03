import { notFound } from "next/navigation";
import { Card, PageHeader, PhaseBadge } from "@/components/ui";
import { NAV_ITEMS } from "@/lib/navigation";

/**
 * Pantalla base de un módulo que se construirá en una fase posterior.
 * No simula datos: indica claramente que el módulo aún no está disponible.
 */
export function ModulePlaceholder({ href }: { href: string }) {
  const item = NAV_ITEMS.find((i) => i.href === href);
  if (!item) notFound();
  return (
    <>
      <PageHeader title={item.label} subtitle={item.description} action={<PhaseBadge phase={item.phase} />} />
      <Card>
        <p className="text-sm text-muted">
          Este módulo se construirá en la <strong className="text-text">Fase {item.phase}</strong> del plan. Por ahora
          no muestra información para no presentar datos que todavía no existen.
        </p>
      </Card>
    </>
  );
}
