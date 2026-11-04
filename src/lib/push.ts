import "server-only";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import webpush from "web-push";
import { getPublicEnv } from "@/lib/env";

/** Configuración de Web Push (solo servidor). */
export function pushConfig() {
  const publicKey = (process.env.VAPID_PUBLIC_KEY || process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "").trim();
  const privateKey = (process.env.VAPID_PRIVATE_KEY || "").trim();
  const subject = (process.env.VAPID_SUBJECT || "").trim() || "mailto:avisos@example.com";
  return publicKey && privateKey ? { publicKey, privateKey, subject } : null;
}

/** Variables del servidor de avisos que faltan (solo nombres, nunca valores). */
export function pushConfigIssues(): string[] {
  const missing: string[] = [];
  if (!(process.env.VAPID_PUBLIC_KEY || process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY)) missing.push("VAPID_PUBLIC_KEY");
  if (!process.env.VAPID_PRIVATE_KEY) missing.push("VAPID_PRIVATE_KEY");
  if (!process.env.CRON_SECRET) missing.push("CRON_SECRET");
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) missing.push("SUPABASE_SERVICE_ROLE_KEY");
  return missing;
}

/**
 * Cliente con la clave de servicio (salta RLS). Solo para el envío programado
 * de avisos y para registrar la suscripción del dispositivo ya verificado.
 */
export function createAdminClient() {
  const env = getPublicEnv();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!env || !key) return null;
  return createSupabaseClient(env.NEXT_PUBLIC_SUPABASE_URL, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export type PushPayload = { title: string; body: string; url: string; tag: string; critical?: boolean };
export type PushTarget = { endpoint: string; p256dh: string; auth_key: string };

/** Envía un aviso. "gone" = la suscripción ya no existe y debe borrarse. */
export async function sendPush(target: PushTarget, payload: PushPayload): Promise<"ok" | "gone" | "error"> {
  const cfg = pushConfig();
  if (!cfg) return "error";
  try {
    await webpush.sendNotification(
      { endpoint: target.endpoint, keys: { p256dh: target.p256dh, auth: target.auth_key } },
      JSON.stringify(payload),
      { vapidDetails: cfg, TTL: 3600, urgency: payload.critical ? "high" : "normal" },
    );
    return "ok";
  } catch (e) {
    const status = (e as { statusCode?: number }).statusCode;
    return status === 404 || status === 410 ? "gone" : "error";
  }
}

export function generateVapidKeys() {
  return webpush.generateVAPIDKeys();
}
