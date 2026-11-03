import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { DEVICE_COOKIE, hashDeviceToken, isValidDeviceToken } from "@/lib/device";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Dispositivo" };
export const dynamic = "force-dynamic";

/** Pantalla para dispositivos pendientes de aprobación o revocados. */
export default async function DevicePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const token = (await cookies()).get(DEVICE_COOKIE)?.value;
  let status: string | null = null;
  if (isValidDeviceToken(token)) {
    const { data } = await supabase.rpc("device_status", { p_token_hash: await hashDeviceToken(token) });
    status = (data as string | null) ?? null;
  }
  if (status === "active") redirect("/");

  const content =
    status === "pending"
      ? {
          title: "Dispositivo pendiente de autorización",
          text: "Abre la aplicación en tu dispositivo ya autorizado, entra a Configuración → Dispositivos y autoriza este dispositivo. Después recarga esta página.",
        }
      : status === "revoked"
        ? {
            title: "Dispositivo revocado",
            text: "El acceso desde este dispositivo fue revocado. Si fue un error, autorízalo de nuevo desde otro dispositivo o contacta al administrador.",
          }
        : {
            title: "Dispositivo no registrado",
            text: "Cierra sesión y vuelve a entrar con el enlace de acceso desde este dispositivo para registrarlo.",
          };

  return (
    <main className="grid min-h-dvh place-items-center px-4">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-surface p-6 text-center">
        <h1 className="text-lg font-semibold">{content.title}</h1>
        <p className="mt-2 text-sm text-muted">{content.text}</p>
        <div className="mt-6 flex flex-col gap-2">
          <a href="/dispositivo" className="rounded-xl bg-accent px-4 py-3 text-sm font-semibold text-accent-text">
            Volver a comprobar
          </a>
          <form action="/auth/signout" method="post">
            <button className="w-full rounded-xl border border-border px-4 py-3 text-sm font-medium">
              Cerrar sesión
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
