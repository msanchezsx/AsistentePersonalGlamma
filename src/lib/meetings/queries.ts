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

/** Reuniones que empiezan dentro del rango UTC [from, to). */
export async function listMeetingsInRange(from: string, to: string) {
  await ensureSeries();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("meetings")
    .select(MEETING_SELECT)
    .gte("starts_at", from)
    .lt("starts_at", to)
    .order("starts_at")
    .limit(500);
  return { meetings: (data as unknown as Meeting[] | null) ?? [], error: Boolean(error) };
}

/**
 * Ids de reuniones críticas. Consulta aparte y tolerante: si la migración
 * 0005 (is_critical) aún no se aplica, devuelve vacío y nada se rompe.
 */
export const listCriticalMeetingIds = cache(async (): Promise<Set<string>> => {
  const viewer = await getViewer();
  if (viewer.preview || !viewer.id) return new Set();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("meetings")
    .select("id")
    .eq("is_critical", true)
    .gte("ends_at", new Date(Date.now() - 86400_000).toISOString())
    .limit(500);
  if (error) return new Set();
  return new Set(((data as { id: string }[] | null) ?? []).map((r) => r.id));
});

/** ¿Esta reunión es crítica? (falso si la columna aún no existe). */
export async function isMeetingCritical(id: string): Promise<boolean> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("meetings").select("is_critical").eq("id", id).maybeSingle();
  return !error && Boolean((data as { is_critical?: boolean } | null)?.is_critical);
}
