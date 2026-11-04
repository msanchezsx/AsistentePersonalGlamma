import { NextResponse, type NextRequest } from "next/server";
import { buildCriticalItems, type ReminderRow } from "@/lib/briefing";
import { MEETING_SELECT, type Meeting } from "@/lib/meetings/model";
import { planPushes, secretMatches } from "@/lib/push-plan";
import { createAdminClient, pushConfig, sendPush, type PushTarget } from "@/lib/push";
import { TASK_SELECT, type Task } from "@/lib/tasks/model";
import { DEFAULT_TIMEZONE } from "@/lib/constants";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Envío programado de avisos (Fase 4). Lo llama un programador externo cada
 * ~5 minutos con el secreto CRON_SECRET (encabezado Authorization: Bearer …
 * o parámetro ?clave=). Solo envía; nunca modifica tareas ni reuniones.
 */
export async function GET(request: NextRequest) {
  const expected = process.env.CRON_SECRET?.trim();
  const auth = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
  const given = auth || request.nextUrl.searchParams.get("clave");
  if (!expected || !secretMatches(given, expected)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const admin = createAdminClient();
  if (!admin || !pushConfig()) {
    return NextResponse.json({ error: "not_configured" }, { status: 503 });
  }

  const now = new Date();
  const { data: subs, error: subsError } = await admin
    .from("push_subscriptions")
    .select("id, user_id, endpoint, p256dh, auth_key");
  if (subsError) return NextResponse.json({ error: "db" }, { status: 500 });

  const byUser = new Map<string, (PushTarget & { id: string })[]>();
  for (const s of subs ?? []) byUser.set(s.user_id, [...(byUser.get(s.user_id) ?? []), s]);

  let sent = 0;
  let removed = 0;
  for (const [userId, targets] of byUser) {
    const horizon = new Date(now.getTime() + 24 * 3600_000).toISOString();
    const [profile, reminders, tasks, meetings, critical] = await Promise.all([
      admin.from("profiles").select("timezone").eq("id", userId).maybeSingle(),
      admin
        .from("reminders")
        .select("id, title, remind_at, task_id, meeting_id")
        .eq("user_id", userId)
        .eq("status", "scheduled")
        .lte("remind_at", horizon)
        .limit(200),
      admin
        .from("tasks")
        .select(TASK_SELECT)
        .eq("user_id", userId)
        .in("status", ["pending", "in_progress", "waiting"])
        .not("due_at", "is", null)
        .lte("due_at", horizon)
        .limit(500),
      admin
        .from("meetings")
        .select(MEETING_SELECT)
        .eq("user_id", userId)
        .eq("status", "scheduled")
        .gte("ends_at", now.toISOString())
        .lte("starts_at", horizon)
        .limit(200),
      admin.from("meetings").select("id").eq("user_id", userId).eq("is_critical", true).gte("ends_at", now.toISOString()),
    ]);
    const tz = (profile.data as { timezone?: string } | null)?.timezone || DEFAULT_TIMEZONE;
    const criticalIds = new Set(critical.error ? [] : ((critical.data as { id: string }[] | null) ?? []).map((r) => r.id));
    const reminderRows = (reminders.data as ReminderRow[] | null) ?? [];
    const items = buildCriticalItems(
      now,
      (tasks.data as unknown as Task[] | null) ?? [],
      (meetings.data as unknown as Meeting[] | null) ?? [],
      reminderRows,
      criticalIds,
      tz,
    );

    for (const p of planPushes(now, reminderRows, items)) {
      // Se registra antes de enviar: la llave única evita mandar dos veces.
      const { data: inserted } = await admin
        .from("notifications")
        .upsert(
          {
            user_id: userId,
            reminder_id: p.reminderId,
            kind: p.kind,
            title: p.title.slice(0, 200),
            body: p.body.slice(0, 1000),
            url: p.url,
            dedupe_key: p.dedupeKey,
            status: "sent",
            sent_at: now.toISOString(),
          },
          { onConflict: "user_id,dedupe_key", ignoreDuplicates: true },
        )
        .select("id");
      if (!inserted?.length) continue;
      for (const t of targets) {
        const r = await sendPush(t, { title: p.title, body: p.body, url: p.url, tag: p.dedupeKey, critical: p.critical });
        if (r === "ok") sent++;
        if (r === "gone") {
          await admin.from("push_subscriptions").delete().eq("id", t.id);
          removed++;
        }
      }
    }
  }
  return NextResponse.json({ ok: true, sent, removed, at: now.toISOString() });
}
