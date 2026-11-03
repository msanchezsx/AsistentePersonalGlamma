"use server";

import { z } from "zod";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { getPublicEnv, isEmailAllowed } from "@/lib/env";

export type LoginState = { ok: boolean; message: string } | null;

const schema = z.object({ email: z.string().trim().toLowerCase().email().max(254) });

export async function requestMagicLink(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const env = getPublicEnv();
  if (!env) return { ok: false, message: "La aplicación todavía no está conectada a Supabase." };

  const parsed = schema.safeParse({ email: formData.get("email") });
  if (!parsed.success) return { ok: false, message: "Escribe un correo electrónico válido." };

  // Mismo mensaje para correos no autorizados: no revelar qué cuentas existen.
  const genericOk = {
    ok: true,
    message: "Si el correo está autorizado, recibirás un enlace para entrar. Ábrelo en este mismo dispositivo.",
  };
  if (!isEmailAllowed(parsed.data.email)) return genericOk;

  const origin = env.NEXT_PUBLIC_SITE_URL || (await headers()).get("origin") || "";
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email: parsed.data.email,
    options: {
      shouldCreateUser: false, // Solo usuarios creados por invitación.
      emailRedirectTo: `${origin}/auth/callback`,
    },
  });
  if (error && error.status !== 422 && error.status !== 400) {
    return { ok: false, message: "No se pudo enviar el enlace. Intenta de nuevo en unos minutos." };
  }
  return genericOk;
}
