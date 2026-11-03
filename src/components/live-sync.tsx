"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { isEditing } from "@/lib/concurrency";

/** Cada cuánto se vuelven a pedir los datos mientras la app está a la vista. */
const INTERVAL_MS = 60_000;
/** Mínimo entre dos actualizaciones seguidas (evita repetir al cambiar de app rápido). */
const MIN_GAP_MS = 5_000;

/**
 * Sincronización entre dispositivos: los datos viven en Supabase, así que basta
 * con volver a pedirlos cuando la app regresa al frente, recupera la conexión
 * o pasa un minuto a la vista. También avisa cuando no hay conexión.
 */
export function LiveSync() {
  const router = useRouter();
  const pathname = usePathname();
  const [offline, setOffline] = useState(false);
  const last = useRef(Date.now());
  const pathRef = useRef(pathname);
  pathRef.current = pathname;

  useEffect(() => {
    setOffline(!navigator.onLine);

    const refresh = (force = false) => {
      if (document.visibilityState !== "visible" || !navigator.onLine) return;
      if (!force && isEditing(pathRef.current)) return;
      if (Date.now() - last.current < MIN_GAP_MS) return;
      last.current = Date.now();
      router.refresh();
    };
    const onVisible = () => refresh();
    const onOnline = () => {
      setOffline(false);
      refresh();
    };
    const onOffline = () => setOffline(true);

    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    const timer = setInterval(() => refresh(), INTERVAL_MS);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      clearInterval(timer);
    };
  }, [router]);

  if (!offline) return null;
  return (
    <div
      role="status"
      className="fixed inset-x-0 top-0 z-50 bg-warn px-4 py-2 text-center text-sm font-medium text-white"
      style={{ paddingTop: "max(0.5rem, env(safe-area-inset-top))" }}
    >
      Sin conexión. Lo que ves puede no estar al día; los cambios no se guardarán hasta reconectar.
    </div>
  );
}
