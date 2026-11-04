import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { z } from "zod";
import { ConfirmButton } from "@/components/confirm-button";
import { Card, PageHeader } from "@/components/ui";
import { formatLongDate, formatTime } from "@/lib/datetime";
import { MEETING_STATUS_LABELS, participantNames } from "@/lib/meetings/model";
import { getMeeting, isMeetingCritical } from "@/lib/meetings/queries";
import { minutesBefore, reminderLabel } from "@/lib/reminders";
import { getScheduledReminder } from "@/lib/reminders-server";
import { getViewer } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { listRelationOptions } from "@/lib/tasks/queries";
import { localDateKey, localTimeKey } from "@/lib/zoned-time";
import { describeRrule } from "@/lib/recurrence";
import { changeMeetingStatus, deleteMeeting, stopMeetingSeries, updateMeeting } from "../actions";
import { MeetingForm } from "../meeting-form";

export const metadata: Metadata = { title: "Reunión" };
export const dynamic = "force-dynamic";

export default async function MeetingPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string>>;
}) {
  const { id } = await params;
  const { aviso } = await searchParams;
  if (!z.string().uuid().safeParse(id).success) notFound();
  const viewer = await getViewer();
  const supabase = await createClient();
  const [meeting, options, reminder, critical] = await Promise.all([
    getMeeting(id),
    listRelationOptions(),
    getScheduledReminder(supabase, { kind: "meeting", id }),
    isMeetingCritical(id),
  ]);
  if (!meeting) notFound();

  const tz = viewer.timezone;
  const start = new Date(meeting.starts_at);
  const end = new Date(meeting.ends_at);
  const reminderValue = minutesBefore(meeting.starts_at, reminder?.remind_at ?? null);
  const people = participantNames(meeting);
  const typedPeople = (meeting.participants ?? []).filter((p) => !p.contact).map((p) => p.display_name ?? "");

  const statusButtons: { status: string; label: string; primary?: boolean }[] =
    meeting.status === "scheduled" || meeting.status === "draft"
      ? [
          { status: "held", label: "Marcar como realizada", primary: true },
          { status: "missed", label: "No asistí" },
        ]
      : [{ status: "scheduled", label: "Volver a programar", primary: true }];

  return (
    <>
      <PageHeader title={meeting.title} subtitle={`Estado: ${MEETING_STATUS_LABELS[meeting.status]}`} />
      <div className="space-y-4">
        {aviso === "parcial" ? (
          <p role="alert" className="rounded-xl bg-warn-soft px-4 py-2.5 text-sm text-warn">
            La reunión se guardó, pero no los participantes o el recordatorio. Revísalos abajo y guarda de nuevo.
          </p>
        ) : null}
        {aviso === "serie-detenida" ? (
          <p role="status" className="rounded-xl bg-ok-soft px-4 py-2.5 text-sm text-ok">
            Listo: la serie termina con esta reunión y se quitaron las siguientes programadas.
          </p>
        ) : null}

        <Card>
          <p className="font-medium">
            {formatLongDate(start, tz)} · {formatTime(start, tz)} a {formatTime(end, tz)}
          </p>
          {people.length ? <p className="mt-1 text-sm text-muted">Con {people.join(", ")}</p> : null}
          {meeting.location ? <p className="mt-1 text-sm text-muted">{meeting.location}</p> : null}
          <p className="mt-1 text-sm text-muted">
            Recordatorio: {reminderValue ? reminderLabel(reminderValue).toLowerCase() : "ninguno programado"}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {statusButtons.map((b) => (
              <form key={b.status} action={changeMeetingStatus}>
                <input type="hidden" name="id" value={meeting.id} />
                <input type="hidden" name="status" value={b.status} />
                <button
                  className={`rounded-xl px-4 py-2.5 text-sm font-medium ${
                    b.primary ? "bg-ok text-white" : "border border-border bg-surface"
                  }`}
                >
                  {b.label}
                </button>
              </form>
            ))}
          </div>
        </Card>

        {meeting.recurrence ? (
          <Card>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm">
                <span className="font-medium">Se repite:</span>{" "}
                {describeRrule(meeting.recurrence.rrule, meeting.recurrence.until_date)}
                <span className="block text-xs text-muted">
                  Los cambios de abajo aplican solo a esta reunión. Para no repetirla más, detén la serie.
                </span>
              </p>
              <form action={stopMeetingSeries}>
                <input type="hidden" name="id" value={meeting.id} />
                <ConfirmButton message="¿Detener la serie? Se quitarán las reuniones siguientes que aún estén programadas.">
                  Detener repetición desde aquí
                </ConfirmButton>
              </form>
            </div>
          </Card>
        ) : null}

        <Card title="Editar">
          <MeetingForm
            action={updateMeeting}
            submitLabel="Guardar cambios"
            projects={options.projects}
            clients={options.clients}
            defaults={{
              id: meeting.id,
              version: meeting.updated_at,
              title: meeting.title,
              description: meeting.description ?? "",
              location: meeting.location ?? "",
              date: localDateKey(start, tz),
              start_time: localTimeKey(start, tz),
              end_time: localTimeKey(end, tz),
              participants: typedPeople.join(", "),
              project_id: meeting.project_id ?? "",
              client_id: meeting.client_id ?? "",
              reminder: reminderValue,
              is_critical: critical,
            }}
          />
        </Card>

        <Card>
          <div className="flex flex-wrap gap-2">
            {meeting.status !== "cancelled" ? (
              <form action={changeMeetingStatus}>
                <input type="hidden" name="id" value={meeting.id} />
                <input type="hidden" name="status" value="cancelled" />
                <ConfirmButton message="¿Cancelar esta reunión? Seguirá en tu historial.">
                  Cancelar reunión
                </ConfirmButton>
              </form>
            ) : null}
            <form action={deleteMeeting}>
              <input type="hidden" name="id" value={meeting.id} />
              <ConfirmButton message="¿Eliminar esta reunión definitivamente?" danger>
                Eliminar
              </ConfirmButton>
            </form>
          </div>
        </Card>
      </div>
    </>
  );
}
