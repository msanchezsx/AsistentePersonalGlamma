"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getViewer } from "@/lib/session";
import { readVersion } from "@/lib/concurrency";
import { incidentSchema, parseAnalysis, solutionSchema } from "@/lib/incidents";
import { zonedToUtc } from "@/lib/zoned-time";

const BASE = "/dashboard/incidencias";
const uuid = z.string().uuid();

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return { supabase, user };
}

function readIncident(formData: FormData) {
  return incidentSchema.safeParse({
    title: String(formData.get("title") ?? ""),
    description: String(formData.get("description") ?? ""),
    severity: String(formData.get("severity") ?? "medium"),
    occurred_on: String(formData.get("occurred_on") ?? ""),
  });
}

export async function createIncident(formData: FormData): Promise<void> {
  const p = readIncident(formData);
  if (!p.success) redirect(`${BASE}/nueva?error=1`);
  const { supabase, user } = await requireUser();
  const tz = (await getViewer()).timezone;
  const { data, error } = await supabase
    .from("incidents")
    .insert({
      user_id: user.id,
      title: p.data.title,
      description: p.data.description,
      severity: p.data.severity,
      occurred_at: p.data.occurred_on ? zonedToUtc(p.data.occurred_on, "12:00", tz).toISOString() : null,
    })
    .select("id")
    .single();
  if (error || !data) redirect(`${BASE}/nueva?error=1`);
  revalidatePath(BASE);
  redirect(`${BASE}/${data.id}?creado=1`);
}

/** Guarda datos generales, estado y análisis (con bloqueo optimista). */
export async function saveIncident(formData: FormData): Promise<void> {
  const id = uuid.safeParse(formData.get("id"));
  if (!id.success) redirect(BASE);
  const p = readIncident(formData);
  if (!p.success) redirect(`${BASE}/${id.data}?error=1`);
  const status = z
    .enum(["open", "analyzing", "action_plan", "monitoring", "closed"])
    .safeParse(formData.get("status"));
  const { supabase } = await requireUser();
  const tz = (await getViewer()).timezone;
  const version = readVersion(formData);
  let q = supabase
    .from("incidents")
    .update(
      {
        title: p.data.title,
        description: p.data.description,
        severity: p.data.severity,
        occurred_at: p.data.occurred_on ? zonedToUtc(p.data.occurred_on, "12:00", tz).toISOString() : null,
        status: status.success ? status.data : "open",
        closed_at: status.success && status.data === "closed" ? new Date().toISOString() : null,
        analysis: parseAnalysis(formData),
      },
      { count: "exact" },
    )
    .eq("id", id.data);
  if (version) q = q.eq("updated_at", version);
  const { error, count } = await q;
  if (error) redirect(`${BASE}/${id.data}?error=1`);
  if (count === 0) redirect(`${BASE}/${id.data}?conflicto=1`);
  revalidatePath(BASE);
  redirect(`${BASE}/${id.data}?guardado=1`);
}

export async function deleteIncident(formData: FormData): Promise<void> {
  const id = uuid.safeParse(formData.get("id"));
  if (!id.success) return;
  const { supabase } = await requireUser();
  await supabase.from("incidents").delete().eq("id", id.data);
  revalidatePath(BASE);
  redirect(`${BASE}?eliminado=1`);
}

export async function addSolution(formData: FormData): Promise<void> {
  const incidentId = uuid.safeParse(formData.get("incident_id"));
  if (!incidentId.success) redirect(BASE);
  const p = solutionSchema.safeParse({
    action_type: formData.get("action_type"),
    description: String(formData.get("description") ?? ""),
    owner_name: String(formData.get("owner_name") ?? ""),
    due_date: String(formData.get("due_date") ?? ""),
  });
  if (!p.success) redirect(`${BASE}/${incidentId.data}?error=1#acciones`);
  const { supabase, user } = await requireUser();
  await supabase.from("solutions").insert({ user_id: user.id, incident_id: incidentId.data, ...p.data });
  revalidatePath(`${BASE}/${incidentId.data}`);
  redirect(`${BASE}/${incidentId.data}#acciones`);
}

export async function setSolutionStatus(formData: FormData): Promise<void> {
  const id = uuid.safeParse(formData.get("id"));
  const incidentId = uuid.safeParse(formData.get("incident_id"));
  const status = z.enum(["planned", "in_progress", "done", "cancelled"]).safeParse(formData.get("status"));
  if (!id.success || !incidentId.success || !status.success) return;
  const { supabase } = await requireUser();
  await supabase.from("solutions").update({ status: status.data }).eq("id", id.data);
  revalidatePath(`${BASE}/${incidentId.data}`);
  redirect(`${BASE}/${incidentId.data}#acciones`);
}
