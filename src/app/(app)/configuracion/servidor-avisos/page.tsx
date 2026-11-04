import type { Metadata } from "next";
import Link from "next/link";
import { randomBytes } from "node:crypto";
import { Card, PageHeader } from "@/components/ui";
import { generateVapidKeys, pushConfigIssues } from "@/lib/push";
import { getPublicEnv } from "@/lib/env";
import { CopyField } from "./copy-field";

export const metadata: Metadata = { title: "Avisos con la app cerrada" };
export const dynamic = "force-dynamic";

const LABELS: Record<string, string> = {
  VAPID_PUBLIC_KEY: "Llave pública de avisos",
  VAPID_PRIVATE_KEY: "Llave privada de avisos",
  CRON_SECRET: "Secreto del programador",
  SUPABASE_SERVICE_ROLE_KEY: "Clave de servicio de Supabase",
};

/**
 * Asistente de configuración: genera aquí (en el servidor, sin guardarlas)
 * las llaves de avisos y el secreto del programador para copiarlas a Vercel.
 */
export default function PushSetupPage() {
  const missing = pushConfigIssues();
  const needVapid = missing.includes("VAPID_PUBLIC_KEY") || missing.includes("VAPID_PRIVATE_KEY");
  const vapid = needVapid ? generateVapidKeys() : null;
  const secret = missing.includes("CRON_SECRET") ? randomBytes(24).toString("base64url") : null;
  const site = getPublicEnv()?.NEXT_PUBLIC_SITE_URL ?? "";

  return (
    <>
      <PageHeader
        title="Avisos con la app cerrada"
        subtitle="Configuración única. Las claves se generan aquí y no se guardan: cópialas directo a Vercel."
        action={
          <Link href="/configuracion" className="rounded-xl border border-border px-3 py-2 text-sm text-muted">
            Volver
          </Link>
        }
      />
      <div className="space-y-4">
        <Card title="Estado">
          <ul className="space-y-1 text-sm">
            {Object.keys(LABELS).map((k) => (
              <li key={k}>
                {missing.includes(k) ? "○" : "✓"} {LABELS[k]} <span className="font-mono text-xs text-muted">({k})</span>
              </li>
            ))}
          </ul>
          {missing.length === 0 ? (
            <p className="mt-3 text-sm text-ok">Todo configurado. Activa los avisos en Configuración → Avisos.</p>
          ) : null}
        </Card>

        {vapid || secret ? (
          <Card title="1. Copia estas claves a Vercel">
            <p className="mb-3 text-sm">
              En Vercel → tu proyecto → Settings → Environment Variables, agrega cada una como <strong>Secret</strong>. Si
              recargas esta página se generan otras: copia todas de una vez.
            </p>
            <div className="space-y-3">
              {vapid ? (
                <>
                  <CopyField name="VAPID_PUBLIC_KEY" value={vapid.publicKey} />
                  <CopyField name="VAPID_PRIVATE_KEY" value={vapid.privateKey} />
                </>
              ) : null}
              {secret ? <CopyField name="CRON_SECRET" value={secret} /> : null}
            </div>
          </Card>
        ) : null}

        {missing.includes("SUPABASE_SERVICE_ROLE_KEY") ? (
          <Card title="2. Clave de servicio de Supabase">
            <p className="text-sm">
              En Supabase → Project Settings → API Keys, copia la clave <strong>service_role</strong> (o “secret”). En
              Vercel agrégala como <span className="font-mono">SUPABASE_SERVICE_ROLE_KEY</span>, tipo <strong>Secret</strong>.
              Nunca la compartas ni la pongas con prefijo NEXT_PUBLIC.
            </p>
          </Card>
        ) : null}

        <Card title="3. Redeploy y programador">
          <ol className="list-decimal space-y-2 pl-5 text-sm">
            <li>En Vercel → Deployments → ⋮ del más reciente → Redeploy.</li>
            <li>
              Crea una cuenta gratuita en <strong>cron-job.org</strong> → Create cronjob.
            </li>
            <li>
              URL: <span className="break-all font-mono text-xs">{site}/api/cron/avisos?clave=EL_CRON_SECRET</span>{" "}
              (reemplaza EL_CRON_SECRET por el valor de arriba).
            </li>
            <li>Ejecución: cada 5 minutos. Guarda.</li>
            <li>En la app: Configuración → Avisos → Activar avisos (en cada dispositivo).</li>
          </ol>
        </Card>
      </div>
    </>
  );
}
