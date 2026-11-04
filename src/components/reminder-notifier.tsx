"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export type UpcomingReminder = { id: string; title: string; at: string; url: string };

const SHOWN_KEY = "ae-avisos-mostrados";
/** Un recordatorio que llegó hace más de esto ya no se muestra como aviso nuevo. */
const LATE_MS = 15 * 60_000;

function readShown(): string[] {
  try {
    return JSON.parse(localStorage.getItem(SHOWN_KEY) ?? "[]") as string[];
  } catch {
    return [];
  }
}

function markShown(id: string): boolean {
  const shown = readShown();
  if (shown.includes(id)) return false;
  try {
    localStorage.setItem(SHOWN_KEY, JSON.stringify([...shown, id].slice(-200)));
  } catch {
    // Sin almacenamiento: se puede repetir el aviso, pero no se pierde.
  }
  return true;
}

/** Muestra un aviso del sistema (si hay permiso) o uno dentro de la app. */
export async function showSystemNotification(
  title: string,
  body: string,
  url: string,
  tag: string,
  opts: { critical?: boolean } = {},
): Promise<boolean> {
  if (typeof Notification === "undefined" || Notification.permission !== "granted") return false;
  try {
    const reg = await navigator.serviceWorker?.ready;
    if (reg) {
      await reg.showNotification(title, {
        body,
        tag,
        icon: "/icons/caja-192.png",
        badge: "/icons/caja-192.png",
        data: { url },
        // Los críticos se quedan en pantalla hasta que el usuario los atiende.
        requireInteraction: Boolean(opts.critical),
      });
      return true;
    }
    new Notification(title, { body, tag, icon: "/icons/caja-192.png" });
    return true;
  } catch {
    return false;
  }
}

/**
 * Avisos de recordatorios mientras la app está abierta (o en segundo plano
 * reciente). Sin servidor de envío: el aviso lo programa el propio equipo.
 */
export function ReminderNotifier({ reminders }: { reminders: UpcomingReminder[] }) {
  const router = useRouter();
  const [toast, setToast] = useState<UpcomingReminder | null>(null);

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    const fire = async (r: UpcomingReminder) => {
      if (!markShown(r.id)) return;
      const shown = await showSystemNotification(r.title, "Recordatorio", r.url, r.id);
      if (!shown || document.visibilityState === "visible") setToast(r);
      router.refresh();
    };
    for (const r of reminders) {
      const delay = new Date(r.at).getTime() - Date.now();
      if (delay <= 0) {
        if (-delay < LATE_MS) void fire(r);
      } else if (delay < 24 * 3600_000) {
        timers.push(setTimeout(() => void fire(r), delay));
      }
    }
    return () => timers.forEach(clearTimeout);
  }, [reminders, router]);

  if (!toast) return null;
  return (
    <div
      role="alert"
      className="fixed inset-x-3 bottom-24 z-50 mx-auto flex max-w-md items-center gap-3 rounded-2xl border border-border bg-surface p-4 shadow-lg md:bottom-6"
    >
      <span className="size-2.5 shrink-0 rounded-full bg-warn" />
      <div className="min-w-0 flex-1">
        <p className="text-xs text-muted">Recordatorio</p>
        <p className="truncate font-medium">{toast.title}</p>
      </div>
      <Link href={toast.url} onClick={() => setToast(null)} className="text-sm font-semibold text-accent">
        Ver
      </Link>
      <button type="button" onClick={() => setToast(null)} aria-label="Cerrar" className="px-1 text-muted">
        ✕
      </button>
    </div>
  );
}
