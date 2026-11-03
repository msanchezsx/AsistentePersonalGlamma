import "server-only";

import { createClient } from "@/lib/supabase/server";
import { cache } from "react";
import { MEETING_SELECT, type Meeting } from "@/lib/meetings/model";
import { topUpMeetingSeries } from "@/lib/recurrence-server";
import { getViewer } from "@/lib/session";

/** Una vez por request: agenda las siguientes repeticiones de las series activas. */
const ensureSeries = cache(async () => {
  const viewer = await getViewer();
  if (!viewer.id) return;
  try {
    await topUpMeetingSeries(await createClient(), viewer.id);
  } catch {
    // Si falla, la agenda se muestra igual con lo que ya existe.
  }
});

/** Reuniones desde hace `pastDays` días hasta dentro de `futureDays`. */
export async function listMeetings(opts: { pastDays?: number; futureDays?: number } = {}) {
  const { pastDays = 1, futureDays = 60 } = opts;
  await ensureSeries();
  const supabase = await createClient();
  const from = new Date(Date.now() - pastDays * 86400_000).toISOString();
  const to = new Date(Date.now() + futureDays * 86400_000).toISOString();
  const { data, error } = await supabase
    .from("meetings")
    .select(MEETING_SELECT)
    .gte("ends_at", from)
    .lte("starts_at", to)
    .order("starts_at")
    .limit(500);
  return { meetings: (data as unknown as Meeting[] | null) ?? [], error: Boolean(error) };
}

export async function getMeeting(id: string): Promise<Meeting | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("meetings").select(MEETING_SELECT).eq("id", id).maybeSingle();
  return (data as unknown as Meeting | null) ?? null;
}
