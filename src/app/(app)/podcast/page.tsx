import type { Metadata } from "next";
import Link from "next/link";
import { Card, EmptyState, PageHeader } from "@/components/ui";
import { briefingScript } from "@/lib/briefing";
import { loadBriefing } from "@/lib/briefing-server";
import { getViewer } from "@/lib/session";
import { shortDayLabel } from "@/lib/planner";
import { addDaysKey, localDateKey } from "@/lib/zoned-time";
import { PodcastPlayer } from "./player";

export const metadata: Metadata = { title: "Podcast" };
export const dynamic = "force-dynamic";

export default async function PodcastPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const params = await searchParams;
  const viewer = await getViewer();
  const tz = viewer.timezone;
  const today = localDateKey(new Date(), tz);
  const fecha = /^\d{4}-\d{2}-\d{2}$/.test(params.fecha ?? "") && params.fecha < today ? params.fecha : undefined;
  const kind = fecha ? "closing" : params.tipo === "cierre" ? "closing" : params.tipo === "manana" ? "morning" : undefined;
  const { briefing, error } = await loadBriefing({ kind, dateKey: fecha });
  const history = Array.from({ length: 7 }, (_, i) => addDaysKey(today, -(i + 1)));

  return (
    <>
      <PageHeader
        title="Podcast"
        subtitle={
          fecha
            ? "Cierre de un día anterior, armado con tus datos de ese día."
            : briefing?.kind === "closing"
              ? "Tu cierre del día en audio."
              : "Tu resumen de la mañana en audio."
        }
      />
      <div className="grid gap-4 lg:grid-cols-[1fr_14rem]">
        <Card>
          {error || !briefing ? (
            <EmptyState>No se pudo armar el guion. Revisa tu conexión e intenta de nuevo.</EmptyState>
          ) : (
            <PodcastPlayer
              key={`${briefing.dateKey}-${briefing.kind}`}
              paragraphs={briefingScript(briefing, viewer.displayName, tz)}
            />
          )}
        </Card>
        <Card title="Historial">
          <ul className="space-y-1 text-sm">
            <li>
              <Link
                href="/podcast"
                className={`block rounded-lg px-3 py-2 ${!fecha ? "bg-accent-soft text-accent" : "hover:bg-surface-2"}`}
              >
                Hoy
              </Link>
            </li>
            {history.map((d) => {
              const l = shortDayLabel(d);
              return (
                <li key={d}>
                  <Link
                    href={`/podcast?fecha=${d}`}
                    className={`block rounded-lg px-3 py-2 ${fecha === d ? "bg-accent-soft text-accent" : "hover:bg-surface-2"}`}
                  >
                    {l.weekday} {l.day}
                  </Link>
                </li>
              );
            })}
          </ul>
        </Card>
      </div>
    </>
  );
}
