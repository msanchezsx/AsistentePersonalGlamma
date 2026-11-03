import type { Metadata } from "next";
import { ModulePlaceholder } from "@/components/module-placeholder";
import { NAV_ITEMS } from "@/lib/navigation";

export const metadata: Metadata = { title: NAV_ITEMS.find((i) => i.href === "/proyectos")?.label };

export default function Page() {
  return <ModulePlaceholder href="/proyectos" />;
}
