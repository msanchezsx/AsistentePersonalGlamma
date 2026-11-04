"use client";

import { useEffect, useState } from "react";
import { showSystemNotification } from "@/components/reminder-notifier";
import { savePushSubscription } from "./actions";

type State = "unsupported" | "default" | "granted" | "denied";

function base64ToBytes(base64: string): Uint8Array<ArrayBuffer> {
  const padded = (base64 + "=".repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(padded);
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

/** Registra este dispositivo para recibir avisos con la app cerrada. */
async function subscribe(vapidKey: string): Promise<string> {
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub =
      (await reg.pushManager.getSubscription()) ??
      (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: base64ToBytes(vapidKey) }));
    const r = await savePushSubscription(JSON.stringify(sub.toJSON()));
    return r.ok ? "Avisos con la app cerrada: activos en este dispositivo." : (r.message ?? "No se pudo activar.");
  } catch {
    return "Este navegador no permitió activar los avisos con la app cerrada.";
  }
}

/** Permiso para mostrar los recordatorios como avisos del sistema. */
export function NotificationsSetting({ vapidKey }: { vapidKey: string | null }) {
  const [state, setState] = useState<State>("default");
  const [tested, setTested] = useState<string | null>(null);
  const [push, setPush] = useState<string | null>(null);

  useEffect(() => {
    const s = typeof Notification === "undefined" ? "unsupported" : (Notification.permission as State);
    setState(s);
    if (s === "granted" && vapidKey && "PushManager" in window) void subscribe(vapidKey).then(setPush);
  }, [vapidKey]);

  if (state === "unsupported")
    return <p className="text-sm text-muted">Este navegador no permite avisos. Los verás dentro de la app.</p>;

  return (
    <div className="space-y-2 text-sm">
      <p>
        {state === "granted"
          ? "Avisos activados en este dispositivo."
          : state === "denied"
            ? "Los avisos están bloqueados. Actívalos en Chrome → Configuración del sitio → Notificaciones."
            : "Activa los avisos para que los recordatorios aparezcan aunque estés en otra app."}
      </p>
      <div className="flex flex-wrap gap-2">
        {state === "default" ? (
          <button
            type="button"
            onClick={async () => {
              const s = (await Notification.requestPermission()) as State;
              setState(s);
              if (s === "granted" && vapidKey && "PushManager" in window) setPush(await subscribe(vapidKey));
            }}
            className="rounded-xl bg-accent px-4 py-2 font-semibold text-accent-text"
          >
            Activar avisos
          </button>
        ) : null}
        {state === "granted" ? (
          <button
            type="button"
            onClick={async () =>
              setTested(
                (await showSystemNotification("Prueba de aviso", "Así se verán tus recordatorios.", "/", "prueba"))
                  ? "Aviso enviado."
                  : "No se pudo mostrar el aviso.",
              )
            }
            className="rounded-xl border border-border px-4 py-2"
          >
            Probar aviso
          </button>
        ) : null}
      </div>
      {tested ? <p className="text-muted">{tested}</p> : null}
      {push ? <p className="text-muted">{push}</p> : null}
      <p className="text-xs text-muted">
        {vapidKey
          ? "Con los avisos activados te llegan aunque la app esté cerrada (puede haber hasta 5 minutos de diferencia)."
          : "Por ahora los avisos llegan mientras la app está abierta o en segundo plano; con la app cerrada los verás en Inicio → Alertas."}
      </p>
    </div>
  );
}
