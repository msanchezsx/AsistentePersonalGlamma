import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isEmailAllowed } from "@/lib/env";
import {
  DEVICE_COOKIE,
  deviceCookieOptions,
  describeDevice,
  generateDeviceToken,
  hashDeviceToken,
  isValidDeviceToken,
} from "@/lib/device";

/**
 * Destino del enlace mágico. Intercambia el código por una sesión, valida que
 * el correo esté autorizado y registra el dispositivo.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const fail = (reason: string) => NextResponse.redirect(new URL(`/login?error=${reason}`, origin));

  if (!code) return fail("enlace_invalido");

  const supabase = await createClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error || !data.user) return fail("enlace_expirado");

  if (!data.user.email || !isEmailAllowed(data.user.email)) {
    await supabase.auth.signOut();
    return fail("no_autorizado");
  }

  let token = request.cookies.get(DEVICE_COOKIE)?.value;
  if (!isValidDeviceToken(token)) token = generateDeviceToken();

  const { name, platform } = describeDevice(request.headers.get("user-agent"));
  const { data: status, error: rpcError } = await supabase.rpc("register_device", {
    p_token_hash: await hashDeviceToken(token),
    p_name: name,
    p_platform: platform,
  });
  if (rpcError) return fail("error_dispositivo");

  const res = NextResponse.redirect(new URL(status === "active" ? "/" : "/dispositivo", origin));
  res.cookies.set(DEVICE_COOKIE, token, deviceCookieOptions);
  return res;
}
