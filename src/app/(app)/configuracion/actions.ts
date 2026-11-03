"use server";

import { z } from "zod";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { DEVICE_COOKIE, hashDeviceToken, isValidDeviceToken } from "@/lib/device";

const idSchema = z.string().uuid();

async function callerHash(): Promise<string> {
  const token = (await cookies()).get(DEVICE_COOKIE)?.value;
  if (!isValidDeviceToken(token)) throw new Error("Dispositivo no identificado.");
  return hashDeviceToken(token);
}

export type DeviceActionState = { ok: boolean; message: string } | null;

const ERRORS: Record<string, string> = {
  "device limit reached": "Ya tienes el máximo de dispositivos autorizados. Revoca uno antes de aprobar otro.",
  "caller device is not active": "Este dispositivo no está autorizado para hacer cambios.",
  "device not found": "El dispositivo ya no está disponible.",
};

function friendly(message: string): string {
  const key = Object.keys(ERRORS).find((k) => message.includes(k));
  return key ? ERRORS[key] : "No se pudo completar la acción.";
}

export async function approveDevice(_prev: DeviceActionState, formData: FormData): Promise<DeviceActionState> {
  const id = idSchema.safeParse(formData.get("deviceId"));
  if (!id.success) return { ok: false, message: "Solicitud inválida." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("approve_device", {
    p_device_id: id.data,
    p_caller_token_hash: await callerHash(),
  });
  if (error) return { ok: false, message: friendly(error.message) };
  revalidatePath("/configuracion");
  return { ok: true, message: "Dispositivo autorizado." };
}

export async function revokeDevice(_prev: DeviceActionState, formData: FormData): Promise<DeviceActionState> {
  const id = idSchema.safeParse(formData.get("deviceId"));
  if (!id.success) return { ok: false, message: "Solicitud inválida." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("revoke_device", {
    p_device_id: id.data,
    p_caller_token_hash: await callerHash(),
  });
  if (error) return { ok: false, message: friendly(error.message) };
  revalidatePath("/configuracion");
  return { ok: true, message: "Dispositivo revocado." };
}

export type NameActionState = { ok: boolean; message: string } | null;

const nameSchema = z.string().trim().max(60, "Máximo 60 caracteres");

/** Nombre con el que te saluda el asistente (perfil propio; RLS limita a tu fila). */
export async function updatePreferredName(_prev: NameActionState, formData: FormData): Promise<NameActionState> {
  const parsed = nameSchema.safeParse(String(formData.get("preferred_name") ?? ""));
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0].message };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Tu sesión expiró. Vuelve a entrar." };
  const { error, count } = await supabase
    .from("profiles")
    .update({ preferred_name: parsed.data === "" ? null : parsed.data }, { count: "exact" })
    .eq("id", user.id);
  if (error || count === 0) return { ok: false, message: "No se pudo guardar el nombre. Intenta de nuevo." };
  revalidatePath("/", "layout");
  return { ok: true, message: "Nombre guardado." };
}
