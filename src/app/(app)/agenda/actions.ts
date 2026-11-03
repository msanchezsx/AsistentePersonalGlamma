"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getViewer } from "@/lib/session";
import { parseMeetingForm, toMeetingTimes, type MeetingFormValues } from "@/lib/meetings/model";
import { parseReminderMinutes } from "@/lib/reminders";
import { syncReminder } from "@/lib/reminders-server";
import { buildRrule, parseRepeatInput } from "@/lib/recurrence";
import { createRule, endRule, getRule, materializeMeetings } from "@/lib/recurrence-server";
import { localDateKey } from "@/lib/zoned-time";

export type MeetingFormState = { ok: boolean; message?: string; fieldErrors?: Record<string, string> } | null;

const idSchema = z.string().uuid();

function revalidateViews() {
  revalidatePath("/agenda");
  revalidatePath("/");
}

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return { supabase, user };
}

function fieldErrorsFrom(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) out[String(issue.path[0] ?? "form")] ??= issue.message;
  return out;
}

type Supa = Awaited<ReturnType<typeof createClient>>;

/** Reemplaza los participantes sin contacto por la lista escrita en el formulario. */
async function replaceParticipants(supabase: Supa, userId: string, meetingId: string, names: string[]) {
  const del = await supabase.from("meeting_participants").delete().eq("meeting_id", meetingId).is("contact_id", null);
  if (del.error) return false;
  if (names.length === 0) return true;
  const ins = await supabase
    .from("meeting_participants")
    .insert(names.map((display_name) => ({ user_id: userId, meeting_id: meetingId, display_name })));
  return !ins.error;
}

function meetingRow(v: MeetingFormValues, timeZone: string) {
  return {
    title: v.title,
    description: v.description,
    location: v.location,
    project_id: v.project_id,
    client_id: v.client_id,
    ...toMeetingTimes(v, timeZone),
  };
}

export async function createMeeting(_prev: MeetingFormState, formData: FormData): Promise<MeetingFormState> {
  const parsed = parseMeetingForm(formData);
  if (!parsed.success) return { ok: false, fieldErrors: fieldErrorsFrom(parsed.error) };
  const repeat = parseRepeatInput(formData, parsed.data.date);
  if (!repeat.ok) return { ok: false, fieldErrors: { [repeat.field]: repeat.message } };
  const reminder = parseReminderMinutes(formData.get("reminder"));

  const { supabase, user } = await requireUser();
  const viewer = await getViewer();
  const row = meetingRow(parsed.data, viewer.timezone);

  let recurrence_rule_id: string | null = null;
  if (repeat.value.option) {
    recurrence_rule_id = await createRule(supabase, user.id, {
      applies_to: "meeting",
      rrule: buildRrule(repeat.value.option, parsed.data.date)!,
      timezone: viewer.timezone,
      starts_on: parsed.data.date,
      until_date: repeat.value.untilKey,
      reminder_minutes: reminder,
    });
    if (!recurrence_rule_id) return { ok: false, message: "No se pudo guardar la repetición. Intenta de nuevo." };
  }

  // Creada por el usuario de forma explícita: queda programada y confirmada.
  const { data, error } = await supabase
    .from("meetings")
    .insert({
      ...row,
      user_id: user.id,
      status: "scheduled",
      source: "manual",
      confirmed_at: new Date().toISOString(),
      recurrence_rule_id,
    })
    .select("id")
    .single();
  if (error || !data) return { ok: false, message: "No se pudo guardar la reunión. Intenta de nuevo." };

  if (recurrence_rule_id) {
    const rule = await getRule(supabase, recurrence_rule_id);
    if (rule) {
      await materializeMeetings(
        supabase,
        user.id,
        rule,
        {
          title: row.title,
          description: row.description,
          location: row.location,
          project_id: row.project_id,
          client_id: row.client_id,
          start_time: parsed.data.start_time,
          duration_minutes: Math.round((new Date(row.ends_at).getTime() - new Date(row.starts_at).getTime()) / 60000),
          participants: parsed.data.participants,
        },
        parsed.data.date,
      );
    }
  }

  const okP = await replaceParticipants(supabase, user.id, data.id, parsed.data.participants);
  const okR = await syncReminder(
    supabase,
    user.id,
    { kind: "meeting", id: data.id },
    row.starts_at,
    reminder,
    parsed.data.title,
  );

  revalidateViews();
  if (!okP || !okR.ok) {
    redirect(`/agenda/${data.id}?aviso=parcial`);
  }
  redirect("/agenda?creada=1");
}

export async function updateMeeting(_prev: MeetingFormState, formData: FormData): Promise<MeetingFormState> {
  const id = idSchema.safeParse(formData.get("id"));
  if (!id.success) return { ok: false, message: "Reunión inválida." };
  const parsed = parseMeetingForm(formData);
  if (!parsed.success) return { ok: false, fieldErrors: fieldErrorsFrom(parsed.error) };
  const reminder = parseReminderMinutes(formData.get("reminder"));

  const { supabase, user } = await requireUser();
  const viewer = await getViewer();
  const row = meetingRow(parsed.data, viewer.timezone);
  const { error, count } = await supabase.from("meetings").update(row, { count: "exact" }).eq("id", id.data);
  if (error || count === 0) return { ok: false, message: "No se pudo actualizar la reunión." };

  const okP = await replaceParticipants(supabase, user.id, id.data, parsed.data.participants);
  const okR = await syncReminder(
    supabase,
    user.id,
    { kind: "meeting", id: id.data },
    row.starts_at,
    reminder,
    parsed.data.title,
  );
  if (!okP || !okR.ok)
    return { ok: false, message: "Se guardó la reunión, pero no los participantes o el recordatorio." };

  revalidateViews();
  redirect("/agenda?actualizada=1");
}

const statusSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(["scheduled", "held", "cancelled", "missed"]),
});

export async function changeMeetingStatus(formData: FormData): Promise<void> {
  const parsed = statusSchema.safeParse({ id: formData.get("id"), status: formData.get("status") });
  if (!parsed.success) return;
  const { supabase } = await requireUser();
  await supabase.from("meetings").update({ status: parsed.data.status }).eq("id", parsed.data.id);
  // Una reunión cancelada no debe avisar.
  if (parsed.data.status === "cancelled") {
    await supabase
      .from("reminders")
      .update({ status: "cancelled" })
      .eq("meeting_id", parsed.data.id)
      .eq("status", "scheduled");
  }
  revalidateViews();
  revalidatePath(`/agenda/${parsed.data.id}`);
}

/**
 * Detiene la serie desde esta reunión: no habrá repeticiones después de ella
 * y se eliminan las siguientes que siguen programadas (las ya realizadas,
 * canceladas o pasadas se conservan en el historial).
 */
export async function stopMeetingSeries(formData: FormData): Promise<void> {
  const id = idSchema.safeParse(formData.get("id"));
  if (!id.success) return;
  const { supabase } = await requireUser();
  const viewer = await getViewer();
  const { data } = await supabase.from("meetings").select("starts_at, recurrence_rule_id").eq("id", id.data).maybeSingle();
  const m = data as { starts_at: string; recurrence_rule_id: string | null } | null;
  if (!m?.recurrence_rule_id) return;
  await endRule(supabase, m.recurrence_rule_id, localDateKey(new Date(m.starts_at), viewer.timezone));
  await supabase
    .from("meetings")
    .delete()
    .eq("recurrence_rule_id", m.recurrence_rule_id)
    .eq("status", "scheduled")
    .gt("starts_at", m.starts_at);
  revalidateViews();
  redirect(`/agenda/${id.data}?aviso=serie-detenida`);
}

export async function deleteMeeting(formData: FormData): Promise<void> {
  const id = idSchema.safeParse(formData.get("id"));
  if (!id.success) return;
  const { supabase } = await requireUser();
  await supabase.from("meetings").delete().eq("id", id.data);
  revalidateViews();
  redirect("/agenda?eliminada=1");
}
