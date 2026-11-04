import type { Metadata } from "next";
import { cookies } from "next/headers";
import { Card, DeviceStatusBadge, EmptyState, PageHeader } from "@/components/ui";
import { DEVICE_COOKIE, hashDeviceToken, isValidDeviceToken, type DeviceStatus } from "@/lib/device";
import { formatLongDate } from "@/lib/datetime";
import { getViewer } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { DeviceActions } from "./device-actions";
import { NameForm } from "./name-form";
import { NotificationsSetting } from "./notifications-setting";
import { pushConfig, pushConfigIssues } from "@/lib/push";
import Link from "next/link";

export const metadata: Metadata = { title: "Configuración" };
export const dynamic = "force-dynamic";

type DeviceRow = {
  id: string;
  name: string;
  platform: string | null;
  status: DeviceStatus;
  token_hash: string;
  created_at: string;
  last_seen_at: string | null;
};

type Prefs = {
  work_days: number[];
  work_start: string;
  work_end: string;
  max_devices: number;
};

const DAYS = ["", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"];

export default async function ConfigPage() {
  const viewer = await getViewer();
  let devices: DeviceRow[] = [];
  let prefs: Prefs | null = null;
  let currentHash: string | null = null;

  if (!viewer.preview) {
    const supabase = await createClient();
    const token = (await cookies()).get(DEVICE_COOKIE)?.value;
    currentHash = isValidDeviceToken(token) ? await hashDeviceToken(token) : null;
    const [d, p] = await Promise.all([
      supabase
        .from("devices")
        .select("id, name, platform, status, token_hash, created_at, last_seen_at")
        .order("created_at", { ascending: true }),
      supabase.from("user_preferences").select("work_days, work_start, work_end, max_devices").maybeSingle(),
    ]);
    devices = (d.data as DeviceRow[] | null) ?? [];
    prefs = (p.data as Prefs | null) ?? null;
  }

  return (
    <>
      <PageHeader title="Configuración" subtitle="Cuenta, jornada laboral y dispositivos autorizados." />
      <div className="space-y-4">
        <Card title="Cuenta">
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-muted">Correo</dt>
              <dd className="font-medium">{viewer.email ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-muted">Zona horaria</dt>
              <dd className="font-medium">{viewer.timezone}</dd>
            </div>
          </dl>
          <div className="mt-4">
            <NameForm defaultName={viewer.displayName ?? ""} />
          </div>
        </Card>

        <Card title="Avisos">
          <NotificationsSetting vapidKey={pushConfig()?.publicKey ?? null} />
          {pushConfigIssues().length ? (
            <Link href="/configuracion/servidor-avisos" className="mt-3 inline-block text-sm font-medium text-accent">
              Configurar avisos con la app cerrada
            </Link>
          ) : null}
        </Card>

        <Card title="Jornada laboral">
          {prefs ? (
            <p className="text-sm">
              {prefs.work_days.map((d) => DAYS[d]).join(", ")} · {prefs.work_start.slice(0, 5)} a{" "}
              {prefs.work_end.slice(0, 5)}
            </p>
          ) : (
            <EmptyState>Sin datos de jornada todavía.</EmptyState>
          )}
        </Card>

        <Card title={`Dispositivos autorizados${prefs ? ` (máximo ${prefs.max_devices})` : ""}`}>
          {devices.length === 0 ? (
            <EmptyState>No hay dispositivos registrados.</EmptyState>
          ) : (
            <ul className="divide-y divide-border">
              {devices.map((d) => {
                const isCurrent = d.token_hash === currentHash;
                return (
                  <li key={d.id} className="flex items-center justify-between gap-3 py-3">
                    <div className="min-w-0">
                      <p className="flex flex-wrap items-center gap-2 font-medium">
                        {d.name}
                        {isCurrent ? <span className="text-xs text-muted">(este dispositivo)</span> : null}
                        <DeviceStatusBadge status={d.status} />
                      </p>
                      <p className="text-xs text-muted">
                        Registrado el {formatLongDate(new Date(d.created_at), viewer.timezone)}
                      </p>
                    </div>
                    <DeviceActions deviceId={d.id} status={d.status} isCurrent={isCurrent} />
                  </li>
                );
              })}
            </ul>
          )}
          <p className="mt-3 text-xs text-muted">
            Un dispositivo nuevo queda pendiente hasta que lo autorices desde un dispositivo ya autorizado.
          </p>
        </Card>
      </div>
    </>
  );
}
