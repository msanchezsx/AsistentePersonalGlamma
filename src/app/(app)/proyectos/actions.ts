"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getViewer } from "@/lib/session";
import { readVersion } from "@/lib/concurrency";
import { clientSchema, contactSchema, fd, followUpDueAt, followUpSchema, projectSchema } from "@/lib/projects";

const uuid = z.string().uuid();
const BASE = "/proyectos";

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return { supabase, user };
}

function done(path: string) {
  revalidatePath(BASE, "layout");
  revalidatePath("/");
  redirect(path);
}

/** Primer mensaje de error de zod, para mostrarlo en la URL. */
function errParam(issues: { message: string }[]) {
  return encodeURIComponent(issues[0]?.message ?? "Revisa los datos");
}

// ------------------------------------------------------------ seguimientos

export async function createFollowUp(formData: FormData): Promise<void> {
  const back = fd(formData, "back") === "proyecto" ? `${BASE}/${fd(formData, "project_id")}` : `${BASE}?vista=seguimientos`;
  const p = followUpSchema.safeParse({
    title: fd(formData, "title"),
    owner_side: fd(formData, "owner_side") || "mine",
    kind: fd(formData, "owner_side") === "theirs" ? "commitment" : "follow_up",
    due_date: fd(formData, "due_date"),
    contact_id: fd(formData, "contact_id"),
    new_contact: fd(formData, "new_contact"),
    client_id: fd(formData, "client_id"),
    project_id: fd(formData, "project_id"),
  });
  if (!p.success) redirect(`${back}${back.includes("?") ? "&" : "?"}error=${errParam(p.error.issues)}`);
  const { supabase, user } = await requireUser();
  const tz = (await getViewer()).timezone;
  let contactId = p.data.contact_id;
  if (!contactId && p.data.new_contact) {
    const { data } = await supabase
      .from("contacts")
      .insert({ user_id: user.id, full_name: p.data.new_contact, client_id: p.data.client_id })
      .select("id")
      .single();
    contactId = data?.id ?? null;
  }
  const { error } = await supabase.from("follow_ups").insert({
    user_id: user.id,
    title: p.data.title,
    owner_side: p.data.owner_side,
    kind: p.data.kind,
    due_at: followUpDueAt(p.data.due_date, tz),
    contact_id: contactId,
    client_id: p.data.client_id,
    project_id: p.data.project_id,
  });
  if (error) redirect(`${back}${back.includes("?") ? "&" : "?"}error=${encodeURIComponent("No se pudo guardar")}`);
  done(back);
}

export async function setFollowUpStatus(formData: FormData): Promise<void> {
  const id = uuid.safeParse(fd(formData, "id"));
  const status = z.enum(["open", "done", "cancelled"]).safeParse(fd(formData, "status"));
  if (!id.success || !status.success) return;
  const { supabase } = await requireUser();
  await supabase
    .from("follow_ups")
    .update({ status: status.data, closed_at: status.data === "open" ? null : new Date().toISOString() })
    .eq("id", id.data);
  revalidatePath(BASE, "layout");
  revalidatePath("/");
}

// ------------------------------------------------------------ proyectos

function readProject(formData: FormData) {
  return projectSchema.safeParse({
    name: fd(formData, "name"),
    code: fd(formData, "code"),
    description: fd(formData, "description"),
    client_id: fd(formData, "client_id"),
    status: fd(formData, "status") || "active",
    start_date: fd(formData, "start_date"),
    due_date: fd(formData, "due_date"),
  });
}

export async function createProject(formData: FormData): Promise<void> {
  const p = readProject(formData);
  if (!p.success) redirect(`${BASE}?vista=proyectos&error=${errParam(p.error.issues)}`);
  const { supabase, user } = await requireUser();
  const { data, error } = await supabase
    .from("projects")
    .insert({ user_id: user.id, ...p.data })
    .select("id")
    .single();
  if (error || !data) redirect(`${BASE}?vista=proyectos&error=${encodeURIComponent("No se pudo guardar")}`);
  done(`${BASE}/${data.id}?creado=1`);
}

export async function updateProject(formData: FormData): Promise<void> {
  const id = uuid.safeParse(fd(formData, "id"));
  if (!id.success) redirect(BASE);
  const p = readProject(formData);
  if (!p.success) redirect(`${BASE}/${id.data}?error=${errParam(p.error.issues)}`);
  const { supabase } = await requireUser();
  const version = readVersion(formData);
  let q = supabase.from("projects").update(p.data, { count: "exact" }).eq("id", id.data);
  if (version) q = q.eq("updated_at", version);
  const { error, count } = await q;
  if (error) redirect(`${BASE}/${id.data}?error=${encodeURIComponent("No se pudo guardar")}`);
  if (count === 0) redirect(`${BASE}/${id.data}?conflicto=1`);
  done(`${BASE}/${id.data}?guardado=1`);
}

export async function deleteProject(formData: FormData): Promise<void> {
  const id = uuid.safeParse(fd(formData, "id"));
  if (!id.success) return;
  const { supabase } = await requireUser();
  await supabase.from("projects").delete().eq("id", id.data);
  done(`${BASE}?vista=proyectos&eliminado=1`);
}

// ------------------------------------------------------------ clientes y contactos

function readClient(formData: FormData) {
  return clientSchema.safeParse({
    name: fd(formData, "name"),
    code: fd(formData, "code"),
    notes: fd(formData, "notes"),
    status: fd(formData, "status") || "active",
  });
}

export async function createClientRecord(formData: FormData): Promise<void> {
  const p = readClient(formData);
  if (!p.success) redirect(`${BASE}?vista=clientes&error=${errParam(p.error.issues)}`);
  const { supabase, user } = await requireUser();
  const { data, error } = await supabase
    .from("clients")
    .insert({ user_id: user.id, ...p.data })
    .select("id")
    .single();
  if (error || !data)
    redirect(
      `${BASE}?vista=clientes&error=${encodeURIComponent(error?.code === "23505" ? "Ya existe un cliente con ese nombre" : "No se pudo guardar")}`,
    );
  done(`${BASE}/clientes/${data.id}?creado=1`);
}

export async function updateClientRecord(formData: FormData): Promise<void> {
  const id = uuid.safeParse(fd(formData, "id"));
  if (!id.success) redirect(BASE);
  const p = readClient(formData);
  const path = `${BASE}/clientes/${id.data}`;
  if (!p.success) redirect(`${path}?error=${errParam(p.error.issues)}`);
  const { supabase } = await requireUser();
  const version = readVersion(formData);
  let q = supabase.from("clients").update(p.data, { count: "exact" }).eq("id", id.data);
  if (version) q = q.eq("updated_at", version);
  const { error, count } = await q;
  if (error)
    redirect(`${path}?error=${encodeURIComponent(error.code === "23505" ? "Ya existe un cliente con ese nombre" : "No se pudo guardar")}`);
  if (count === 0) redirect(`${path}?conflicto=1`);
  done(`${path}?guardado=1`);
}

export async function createContact(formData: FormData): Promise<void> {
  const clientId = uuid.safeParse(fd(formData, "client_id"));
  if (!clientId.success) redirect(BASE);
  const path = `${BASE}/clientes/${clientId.data}`;
  const p = contactSchema.safeParse({
    full_name: fd(formData, "full_name"),
    role: fd(formData, "role"),
    relationship: fd(formData, "relationship") || "client",
    email: fd(formData, "email"),
    phone: fd(formData, "phone"),
  });
  if (!p.success) redirect(`${path}?error=${errParam(p.error.issues)}#contactos`);
  const { supabase, user } = await requireUser();
  const { error } = await supabase.from("contacts").insert({ user_id: user.id, client_id: clientId.data, ...p.data });
  if (error)
    redirect(`${path}?error=${encodeURIComponent(error.code === "23505" ? "Ese correo ya está en otro contacto" : "No se pudo guardar")}#contactos`);
  done(`${path}#contactos`);
}

export async function deleteContact(formData: FormData): Promise<void> {
  const id = uuid.safeParse(fd(formData, "id"));
  const clientId = uuid.safeParse(fd(formData, "client_id"));
  if (!id.success || !clientId.success) return;
  const { supabase } = await requireUser();
  await supabase.from("contacts").delete().eq("id", id.data);
  done(`${BASE}/clientes/${clientId.data}#contactos`);
}
