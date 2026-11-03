"use client";

import { useEffect } from "react";

/** Registra el service worker de la PWA (solo en producción). */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {
      // Si falla, la app sigue funcionando en línea.
    });
  }, []);
  return null;
}
