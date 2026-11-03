import { NextResponse } from "next/server";
import { getAllowedEmails, isSupabaseConfigured, publicEnvIssues } from "@/lib/env";

export const dynamic = "force-dynamic";

/** Comprobación de estado para monitoreo. No expone secretos. */
export function GET() {
  return NextResponse.json({
    status: "ok",
    app: "asistente-ejecutivo",
    version: process.env.npm_package_version ?? "0.1.0",
    supabaseConfigured: isSupabaseConfigured(),
    // Solo nombres de variables con problema, nunca sus valores.
    configIssues: [...publicEnvIssues(), ...(getAllowedEmails().length === 0 ? ["ALLOWED_EMAILS"] : [])],
    time: new Date().toISOString(),
  });
}
