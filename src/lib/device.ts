/**
 * Identificación de dispositivos autorizados.
 *
 * Cada dispositivo recibe un token aleatorio de 32 bytes guardado en una
 * cookie httpOnly. En la base de datos solo se guarda su hash SHA-256, de
 * modo que una filtración de la tabla `devices` no permite suplantar
 * dispositivos. Funciona en el runtime Edge (middleware) y en Node.
 */

export const DEVICE_COOKIE = "ae_device";
export const DEVICE_COOKIE_MAX_AGE = 60 * 60 * 24 * 400; // 400 días (máximo de los navegadores)

export type DeviceStatus = "pending" | "active" | "revoked";

export function generateDeviceToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return toBase64Url(bytes);
}

export function isValidDeviceToken(token: string | undefined | null): token is string {
  return typeof token === "string" && /^[A-Za-z0-9_-]{43}$/.test(token);
}

export async function hashDeviceToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

export const deviceCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: DEVICE_COOKIE_MAX_AGE,
};

/** Nombre legible a partir del User-Agent (sin guardar el UA completo). */
export function describeDevice(userAgent: string | null): { name: string; platform: string | null } {
  const ua = userAgent ?? "";
  const android = /Android/i.test(ua);
  const mobile = /Mobile/i.test(ua);
  if (android) {
    return { name: mobile ? "Celular Android" : "Tablet Android", platform: "android" };
  }
  if (/iPhone|iPad/i.test(ua)) return { name: "Dispositivo iOS", platform: "ios" };
  if (/Windows/i.test(ua)) return { name: "Equipo Windows", platform: "windows" };
  if (/Macintosh/i.test(ua)) return { name: "Equipo Mac", platform: "macos" };
  if (/Linux/i.test(ua)) return { name: "Equipo Linux", platform: "linux" };
  return { name: "Dispositivo", platform: null };
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  bytes.forEach((b) => (binary += String.fromCharCode(b)));
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
