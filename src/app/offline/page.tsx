import type { Metadata } from "next";

export const metadata: Metadata = { title: "Sin conexión" };

export default function OfflinePage() {
  return (
    <main className="grid min-h-dvh place-items-center px-4">
      <div className="max-w-sm text-center">
        <h1 className="text-lg font-semibold">Sin conexión</h1>
        <p className="mt-2 text-sm text-muted">
          No hay conexión a internet. Tus datos están seguros en la nube; vuelve a intentarlo cuando recuperes la señal.
        </p>
        {/* Recarga completa a propósito: reintenta la red en lugar de navegar en el cliente. */}
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
        <a href="/" className="mt-6 inline-block rounded-xl bg-accent px-5 py-3 text-sm font-semibold text-accent-text">
          Reintentar
        </a>
      </div>
    </main>
  );
}
