import type { Metadata } from "next";
import { isSupabaseConfigured } from "@/lib/env";
import { LoginForm } from "./login-form";
import { GlamaLogo } from "@/components/glama-logo";

export const metadata: Metadata = { title: "Iniciar sesión" };
export const dynamic = "force-dynamic";

const ERRORS: Record<string, string> = {
  enlace_invalido: "El enlace no es válido. Solicita uno nuevo.",
  enlace_expirado: "El enlace expiró o ya se usó. Solicita uno nuevo.",
  no_autorizado: "Esta cuenta no está autorizada para usar la aplicación.",
  error_dispositivo: "No se pudo registrar este dispositivo. Intenta de nuevo.",
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  const configured = isSupabaseConfigured();

  return (
    <main className="grid min-h-dvh place-items-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <GlamaLogo className="mx-auto mb-4 w-40" priority />
          <h1 className="text-2xl font-semibold tracking-tight">Asistente</h1>
          <p className="mt-1 text-sm text-muted">Acceso privado</p>
        </div>

        <div className="rounded-2xl border border-border bg-surface p-5">
          {!configured ? (
            <p className="mb-4 rounded-lg bg-warn-soft px-3 py-2 text-sm text-warn">
              La aplicación todavía no está conectada a Supabase. Configura las variables de entorno (ver .env.example).
            </p>
          ) : null}
          {error && ERRORS[error] ? (
            <p role="alert" className="mb-4 rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">
              {ERRORS[error]}
            </p>
          ) : null}
          <LoginForm disabled={!configured} />
        </div>

        <p className="mt-6 text-center text-xs text-muted">
          Solo dispositivos autorizados. Los nuevos dispositivos requieren aprobación.
        </p>
      </div>
    </main>
  );
}
