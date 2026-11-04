"use client";

import { useEffect, useState } from "react";
import { showSystemNotification } from "@/components/reminder-notifier";

type State = "unsupported" | "default" | "granted" | "denied";

/** Permiso para mostrar los recordatorios como avisos del sistema. */
export function NotificationsSetting() {
  const [state, setState] = useState<State>("default");
  const [tested, setTested] = useState<string | null>(null);

  useEffect(() => {
    setState(typeof Notification === "undefined" ? "unsupported" : (Notification.permission as State));
  }, []);

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
            onClick={async () => setState((await Notification.requestPermission()) as State)}
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
      <p className="text-xs text-muted">
        Los avisos llegan mientras la app está abierta o en segundo plano. Si Android cierra la app, los verás en
        Inicio → Alertas al volver.
      </p>
    </div>
  );
}
