"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "./Icon";

const tabs = [
  { href: "/", label: "Today", icon: "home" },
  { href: "/wardrobe", label: "Wardrobe", icon: "hanger" },
  { href: "/add", label: "Add", icon: "plus" },
  { href: "/outfits", label: "Outfits", icon: "heart" },
  { href: "/gaps", label: "Gaps", icon: "sparkle" },
] as const;

export function BottomNav() {
  const path = usePathname();
  return (
    <nav className="pb-safe fixed inset-x-0 bottom-0 z-40 border-t border-line bg-bg/90 backdrop-blur">
      <ul className="mx-auto grid max-w-xl grid-cols-5">
        {tabs.map((t) => {
          const active = t.href === "/" ? path === "/" : path.startsWith(t.href);
          return (
            <li key={t.href}>
              <Link
                href={t.href}
                className={`flex flex-col items-center gap-1 py-2.5 text-[11px] ${
                  active ? "text-ink" : "text-muted"
                }`}
              >
                <Icon name={t.icon} className="h-6 w-6" />
                {t.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
