import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/ui";
import { getViewer } from "@/lib/session";
import { localDateKey } from "@/lib/zoned-time";
import { CaptureBox } from "./capture-box";

export const metadata: Metadata = { title: "Capturar" };
export const dynamic = "force-dynamic";

export default async function CapturePage() {
  const viewer = await getViewer();
  return (
    <>
      <PageHeader title="Capturar" subtitle="Escribe o dicta una tarea o reunión. La revisas antes de guardarla." />
      <CaptureBox todayKey={localDateKey(new Date(), viewer.timezone)} />
      <p className="mt-4 text-sm text-muted">
        ¿Te llegó por WhatsApp? Compártelo directo a la app.{" "}
        <Link href="/compartir" className="font-medium text-accent">
          Ver mensajes compartidos
        </Link>
      </p>
    </>
  );
}
