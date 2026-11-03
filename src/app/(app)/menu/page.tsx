import type { Metadata } from "next";
import Link from "next/link";
import { Icon } from "@/components/icon";
import { PageHeader } from "@/components/ui";
import { NAV_ITEMS } from "@/lib/navigation";

export const metadata: Metadata = { title: "Menú" };

export default function MenuPage() {
  return (
    <>
      <PageHeader title="Menú" />
      <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface">
        {NAV_ITEMS.map((item) => (
          <li key={item.href}>
            <Link href={item.href} className="flex items-center gap-4 px-4 py-3.5 hover:bg-surface-2">
              <span className="grid size-9 place-items-center rounded-lg bg-accent-soft text-accent">
                <Icon name={item.icon} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-medium">{item.label}</span>
                <span className="block truncate text-xs text-muted">{item.description}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
      <form action="/auth/signout" method="post" className="mt-6">
        <button className="flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-surface px-4 py-3 text-sm font-medium text-danger">
          <Icon name="logout" />
          Cerrar sesión
        </button>
      </form>
    </>
  );
}
