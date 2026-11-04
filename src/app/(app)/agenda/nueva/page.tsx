import type { Metadata } from "next";
import { Card, CaptureNotice, PageHeader } from "@/components/ui";
import { readPrefill } from "@/lib/prefill";
import { listRelationOptions } from "@/lib/tasks/queries";
import { getViewer } from "@/lib/session";
import { localDateKey } from "@/lib/zoned-time";
import { createMeeting } from "../actions";
import { MeetingForm } from "../meeting-form";

export const metadata: Metadata = { title: "Nueva reunión" };
export const dynamic = "force-dynamic";

export default async function NewMeetingPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const pre = readPrefill(await searchParams);
  const viewer = await getViewer();
  const { projects, clients } = viewer.preview ? { projects: [], clients: [] } : await listRelationOptions();
  return (
    <>
      <PageHeader title="Nueva reunión" />
      {pre.fromCapture ? <CaptureNotice /> : null}
      <Card>
        <MeetingForm
          action={createMeeting}
          submitLabel="Agendar"
          showRepeat
          projects={projects}
          clients={clients}
          defaults={{
            title: pre.title.slice(0, 200),
            description: pre.description,
            location: "",
            date: pre.date || localDateKey(new Date(), viewer.timezone),
            start_time: pre.time,
            end_time: pre.end,
            participants: pre.participants,
            project_id: "",
            client_id: "",
            reminder: "15",
            repeat: pre.repeat,
          }}
        />
      </Card>
    </>
  );
}
