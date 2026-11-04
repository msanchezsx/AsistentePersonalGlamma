"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { CriticalItem } from "@/lib/briefing";
import { changeTaskStatus } from "@/app/(app)/tareas/actions";
import { changeMeetingStatus } from "@/app/(app)/agenda/actions";
import { dismissReminder } from "@/app/(app)/resumen/actions";
import { showSystemNotification } from "@/components/reminder-notifier";

const ACK_KEY = "ae-criticos-atendidos";
const SNOOZE_KEY = "ae-criticos-pospuestos";
const SNOOZE_MS = 10 * 60_000;

function read<T>(key: string, fallback: T): T {
  try {
    return JSON.parse(localStorage.getItem(key) ?? "") as T;
  } catch {
    return fallback;
  }
}
function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Sin almacenamiento el aviso puede repetirse, pero no se pierde.
  }
}

function acknowledge(key: string) {
  write(ACK_KEY, [...read<string[]>(ACK_KEY, []).filter((k) => k !== key), key].slice(-300));
}

/**
 * Aviso a pantalla completa para tareas y reuniones críticas, con
 * "Enterado", "Ya lo realicé", "Cancelar" y "Recordar en 10 min".
 */
export function CriticalAlert({ items }: { items: CriticalItem[] }) {
  const [now, setNow] = useState<number | null>(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(t);
  }, []);

  const current =
    now === null
      ? null
      : (() => {
          const acked = new Set(read<string[]>(ACK_KEY, []));
          const snoozed = read<Record<string, number>>(SNOOZE_KEY, {});
          return (
            items.find((i) => new Date(i.showAt).getTime() <= now && !acked.has(i.key) && (snoozed[i.key] ?? 0) <= now) ??
            null
          );
        })();

  // Aviso del sistema la primera vez que aparece (por si la app está en segundo plano).
  useEffect(() => {
    if (!current) return;
    const notified = read<string[]>("ae-criticos-notificados", []);
    if (notified.includes(current.key)) return;
    write("ae-criticos-notificados", [...notified, current.key].slice(-300));
    void showSystemNotification(`⚠ ${current.title}`, current.detail, current.url, current.key, { critical: true });
    try {
      navigator.vibrate?.([300, 150, 300]);
    } catch {
      // Sin vibración.
    }
  }, [current]);

  if (!current) return null;
  const close = () => {
    acknowledge(current.key);
    setVersion(version + 1);
  };
  const snooze = () => {
    write(SNOOZE_KEY, { ...read<Record<string, number>>(SNOOZE_KEY, {}), [current.key]: Date.now() + SNOOZE_MS });
    setVersion(version + 1);
  };
  const isTask = current.kind === "task";
  const btn = "w-full rounded-xl px-4 py-3.5 text-base font-semibold";

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="critico-titulo"
      className="fixed inset-0 z-[70] grid place-items-center p-4"
      style={{ backgroundColor: "rgba(0, 0, 0, 0.65)" }}
    >
      <div className="w-full max-w-md overflow-hidden rounded-3xl bg-surface shadow-2xl">
        <div className="bg-danger px-6 py-4 text-white">
          <p className="text-sm font-semibold uppercase tracking-wide">Aviso crítico</p>
        </div>
        <div className="space-y-2 px-6 pt-5">
          <h2 id="critico-titulo" className="text-2xl font-semibold leading-tight">
            {current.title}
          </h2>
          <p className="text-muted">{current.detail}</p>
          <Link href={current.url} onClick={snooze} className="inline-block text-sm font-medium text-accent">
            Ver detalle
          </Link>
        </div>
        <div className="grid gap-2 p-6">
          {current.reminderId ? (
            <form action={dismissReminder} onSubmit={close}>
              <input type="hidden" name="id" value={current.reminderId} />
              <button type="submit" className={`${btn} bg-accent text-accent-text`}>
                Enterado
              </button>
            </form>
          ) : (
            <button type="button" onClick={close} className={`${btn} bg-accent text-accent-text`}>
              Enterado
            </button>
          )}
          <form action={isTask ? changeTaskStatus : changeMeetingStatus} onSubmit={close}>
            <input type="hidden" name="id" value={current.id} />
            {isTask ? <input type="hidden" name="action" value="complete" /> : <input type="hidden" name="status" value="held" />}
            <button type="submit" className={`${btn} bg-ok text-white`}>
              Ya lo realicé
            </button>
          </form>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={snooze} className={`${btn} border border-border text-sm`}>
              Recordar en 10 min
            </button>
            <form
              action={isTask ? changeTaskStatus : changeMeetingStatus}
              onSubmit={(e) => {
                if (!confirm(isTask ? "¿Cancelar esta tarea?" : "¿Cancelar esta reunión?")) {
                  e.preventDefault();
                  return;
                }
                close();
              }}
            >
              <input type="hidden" name="id" value={current.id} />
              {isTask ? <input type="hidden" name="action" value="cancel" /> : <input type="hidden" name="status" value="cancelled" />}
              <button type="submit" className={`${btn} border border-border text-sm text-danger`}>
                Cancelar
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
