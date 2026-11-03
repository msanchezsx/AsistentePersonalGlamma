import type { Metadata } from "next";
import Link from "next/link";
import { Icon } from "@/components/icon";
import { Card, EmptyState, PageHeader } from "@/components/ui";
import { groupMeetingsByDay, isActiveMeeting, type Meeting } from "@/lib/meetings/model";
import { listMeetings } from "@/lib/meetings/queries";
import { getViewer } from "@/lib/session";
import { addDaysKey, localDateKey } from "@/lib/zoned-time";
import { MeetingItem } from "./meeting-item";

export const metadata: Metadata = { title: "Agenda" };
export const dynamic = "force-dynamic";

const NOTICES: Record<string, string> = {
  creada: "Reunión agendada.",
  actualizada: "Reunión actualizada.",
  eliminada: "Reunión eliminada.",
};

function dayTitle(dateKey: string, todayKey: string): string {
  if (dateKey === todayKey) return "Hoy";
  if (dateKey === addDaysKey(todayKey, 1)) return "Mañana";
  const [y, m, d] = dateKey.split("-").map(Number);
  const text = new Intl.DateTimeFormat("es-MX", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(y, m - 1, d, 12)));
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export default async function AgendaPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const params = await searchParams;
  const notice = Object.keys(NOTICES).find((k) => k in params);
  const viewer = await getViewer();
  const now = new Date();
  const todayKey = localDateKey(now, viewer.timezone);
  const { meetings, error } = viewer.preview ? { meetings: [] as Meeting[], error: false } : await listMeetings();

  // Desde hoy: las de días anteriores no se muestran aquí.
  const visible = meetings.filter((m) => localDateKey(new Date(m.ends_at), viewer.timezone) >= todayKey);
  const days = groupMeetingsByDay(visible, viewer.timezone);
  const todayActive = visible.filter(
    (m) => isActiveMeeting(m) && localDateKey(new Date(m.starts_at), viewer.timezone) === todayKey,
  ).length;

  return (
    <>
      <PageHeader
        title="Agenda"
        subtitle={todayActive ? `${todayActive} reunión${todayActive === 1 ? "" : "es"} hoy` : "Sin reuniones hoy"}
        action={
          <Link
            href="/agenda/nueva"
            className="flex items-center gap-1.5 rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-accent-text"
          >
            <Icon name="plus" className="size-4" />
            Reunión
          </Link>
        }
      />

      {notice ? (
        <p role="status" className="mb-4 rounded-xl bg-ok-soft px-4 py-2.5 text-sm text-ok">
          {NOTICES[notice]}
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="mb-4 rounded-xl bg-danger-soft px-4 py-2.5 text-sm text-danger">
          No se pudo cargar la agenda. Revisa tu conexión y recarga.
        </p>
      ) : null}

      <div className="space-y-4">
        {days.length === 0 && !error ? (
          <Card>
            <EmptyState>No tienes reuniones próximas. Agenda una con el botón &quot;Reunión&quot;.</EmptyState>
          </Card>
        ) : null}
        {days.map((d) => (
          <Card key={d.dateKey}>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
              {dayTitle(d.dateKey, todayKey)}
            </h2>
            <ul className="divide-y divide-border">
              {d.items.map((m) => (
                <MeetingItem key={m.id} meeting={m} now={now} timeZone={viewer.timezone} />
              ))}
            </ul>
          </Card>
        ))}
      </div>
    </>
  );
}
