"use client";

import Link from "next/link";
import { GlamaLogo } from "@/components/glama-logo";
import { usePathname } from "next/navigation";
import { Icon } from "@/components/icon";
import { MOBILE_PRIMARY, NAV_ITEMS } from "@/lib/navigation";

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

/** Menú lateral (tablet) y barra inferior (celular). */
export function AppNav() {
  const pathname = usePathname();
  const primary = NAV_ITEMS.filter((i) => MOBILE_PRIMARY.includes(i.href));
  const moreActive = !primary.some((i) => isActive(pathname, i.href));

  return (
    <>
      <nav
        aria-label="Menú principal"
        className="hidden md:flex md:w-60 md:shrink-0 md:flex-col md:gap-1 md:border-r md:border-border md:bg-surface md:px-3 md:py-5"
      >
        <div className="mb-4 flex flex-col items-center gap-1 px-3">
          <GlamaLogo className="w-28" priority />
          <span className="text-sm font-semibold">Asistente</span>
        </div>
        {NAV_ITEMS.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                active ? "bg-accent-soft text-accent" : "text-muted hover:bg-surface-2 hover:text-text"
              }`}
            >
              <Icon name={item.icon} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <nav
        aria-label="Menú principal"
        className="pb-safe fixed inset-x-0 bottom-0 z-20 border-t border-border bg-surface/95 backdrop-blur md:hidden"
      >
        <ul className="grid grid-cols-5">
          {primary.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={`flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium ${
                    active ? "text-accent" : "text-muted"
                  }`}
                >
                  <Icon name={item.icon} className="size-6" />
                  {item.label}
                </Link>
              </li>
            );
          })}
          <li>
            <Link
              href="/menu"
              aria-current={moreActive ? "page" : undefined}
              className={`flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium ${
                moreActive ? "text-accent" : "text-muted"
              }`}
            >
              <Icon name="menu" className="size-6" />
              Más
            </Link>
          </li>
        </ul>
      </nav>
    </>
  );
}
