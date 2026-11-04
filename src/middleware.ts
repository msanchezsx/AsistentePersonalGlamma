import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    // Todo excepto archivos estáticos, iconos, logo, manifest y service worker
    // (el logo se ve en la pantalla de inicio de sesión, antes de entrar).
    "/((?!_next/static|_next/image|icons/|brand/|favicon.ico|manifest.webmanifest|sw.js|robots.txt).*)",
  ],
};
