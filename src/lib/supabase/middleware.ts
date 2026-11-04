import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getPublicEnv } from "@/lib/env";
import { DEVICE_COOKIE, hashDeviceToken, isValidDeviceToken, type DeviceStatus } from "@/lib/device";

/** Rutas accesibles sin sesión. */
// /api/cron: lo llama el programador externo; se protege con CRON_SECRET.
const PUBLIC_PATHS = ["/login", "/auth/callback", "/offline", "/api/health", "/api/cron"];
/** Rutas accesibles con sesión pero sin dispositivo aprobado. */
const DEVICE_PATHS = ["/dispositivo", "/auth/signout"];

function matches(pathname: string, list: string[]) {
  return list.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

function redirectTo(request: NextRequest, pathname: string, base: NextResponse) {
  const url = request.nextUrl.clone();
  url.pathname = pathname;
  url.search = "";
  const res = NextResponse.redirect(url);
  // Conservar las cookies de sesión que Supabase haya refrescado.
  base.cookies.getAll().forEach((c) => res.cookies.set(c));
  return res;
}

/**
 * 1. Refresca la sesión de Supabase.
 * 2. Exige sesión en todas las rutas privadas.
 * 3. Exige que el dispositivo esté aprobado (status = active).
 */
export async function updateSession(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const env = getPublicEnv();
  let response = NextResponse.next({ request });

  if (!env) {
    // Vista previa de la interfaz: solo en `next dev` con UI_PREVIEW=1.
    if (process.env.NODE_ENV === "development" && process.env.UI_PREVIEW === "1") return response;
    // Sin Supabase configurado solo se muestra el login con el aviso.
    return matches(pathname, PUBLIC_PATHS) ? response : redirectTo(request, "/login", response);
  }

  const supabase = createServerClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  // getUser() valida el token con Supabase (no confía solo en la cookie).
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return matches(pathname, PUBLIC_PATHS) ? response : redirectTo(request, "/login", response);
  }

  if (matches(pathname, PUBLIC_PATHS)) {
    return pathname === "/login" ? redirectTo(request, "/", response) : response;
  }

  const token = request.cookies.get(DEVICE_COOKIE)?.value;
  let status: DeviceStatus | null = null;
  if (isValidDeviceToken(token)) {
    const { data } = await supabase.rpc("device_status", { p_token_hash: await hashDeviceToken(token) });
    status = (data as DeviceStatus | null) ?? null;
  }

  if (status !== "active") {
    if (matches(pathname, DEVICE_PATHS)) return response;
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "device_not_authorized" }, { status: 403 });
    }
    return redirectTo(request, "/dispositivo", response);
  }

  return response;
}
