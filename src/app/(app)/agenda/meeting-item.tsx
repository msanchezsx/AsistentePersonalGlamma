import Link from "next/link";
import { formatTime } from "@/lib/datetime";
import { MEETING_STATUS_LABELS, participantNames, type Meeting } from "@/lib/meetings/model";

export function MeetingItem({ meeting, now, timeZone }: { meeting: Meeting; now: Date; timeZone: string }) {
  const start = new Date(meeting.starts_at);
  const end = new Date(meeting.ends_at);
  const inProgress = meeting.status === "scheduled" && start <= now && end > now;
  const past = end <= now;
  const inactive = meeting.status === "cancelled" || meeting.status === "missed";
  const people = participantNames(meeting);

  return (
    <li>
      <Link href={`/agenda/${meeting.id}`} className="flex gap-3 py-3">
        <div className="w-20 shrink-0 text-sm">
          <p className={`font-semibold ${inactive ? "text-muted line-through" : ""}`}>{formatTime(start, timeZone)}</p>
          <p className="text-xs text-muted">{formatTime(end, timeZone)}</p>
        </div>
        <div
          className={`min-w-0 flex-1 border-l-2 pl-3 ${
            inProgress ? "border-ok" : inactive || past ? "border-border" : "border-accent"
          }`}
        >
          <p className={`font-medium ${inactive ? "text-muted line-through" : ""}`}>{meeting.title}</p>
          <p className="mt-0.5 flex flex-wrap gap-x-2 text-xs text-muted">
            {inProgress ? <span className="font-medium text-ok">En curso</span> : null}
            {meeting.status !== "scheduled" ? <span>{MEETING_STATUS_LABELS[meeting.status]}</span> : null}
            {people.length ? <span>Con {people.join(", ")}</span> : null}
            {meeting.location ? <span>· {meeting.location}</span> : null}
            {meeting.project ? <span>· {meeting.project.code ?? meeting.project.name}</span> : null}
            {meeting.client ? <span>· {meeting.client.name}</span> : null}
          </p>
        </div>
      </Link>
    </li>
  );
}
