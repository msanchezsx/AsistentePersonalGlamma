import type { Metadata } from "next";
import { Card, PageHeader } from "@/components/ui";
import { listRelationOptions } from "@/lib/tasks/queries";
import { getViewer } from "@/lib/session";
import { localDateKey } from "@/lib/zoned-time";
import { createMeeting } from "../actions";
import { MeetingForm } from "../meeting-form";

export const metadata: Metadata = { title: "Nueva reunión" };
export const dynamic = "force-dynamic";

export default async function NewMeetingPage() {
  const viewer = await getViewer();
  const { projects, clients } = viewer.preview ? { projects: [], clients: [] } : await listRelationOptions();
  return (
    <>
      <PageHeader title="Nueva reunión" />
      <Card>
        <MeetingForm
          action={createMeeting}
          submitLabel="Agendar"
          projects={projects}
          clients={clients}
          defaults={{
            title: "",
            description: "",
            location: "",
            date: localDateKey(new Date(), viewer.timezone),
            start_time: "",
            end_time: "",
            participants: "",
            project_id: "",
            client_id: "",
            reminder: "15",
          }}
        />
      </Card>
    </>
  );
}
