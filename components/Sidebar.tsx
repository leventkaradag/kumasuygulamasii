"use client";

import clsx from "clsx";
import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/desenler", label: "Desenler" },
  { href: "/dokuma", label: "Dokuma" },
  { href: "/boyahane", label: "Boyahane" },
  { href: "/depo", label: "Depo" },
  { href: "/raporlar", label: "Raporlar" },
  { href: "/ayarlar", label: "Ayarlar" },
];

export default function Sidebar() {
  const pathname = usePathname() ?? "";

  return (
    <aside className="flex min-h-screen w-56 flex-col border-r border-coffee-primary/20 bg-white/80 backdrop-blur">
      <div className="px-4 py-5 text-lg font-semibold text-coffee-accent">
        Kumasci Panel
      </div>
      <nav className="flex-1 space-y-1 px-3 pb-4">
        {links.map(({ href, label }) => {
          const isActive =
            pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={href}
              href={href}
              className={clsx(
                "block rounded-md px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-coffee-primary text-white shadow-sm"
                  : "text-slate-700 hover:bg-coffee-surface hover:text-slate-900"
              )}
            >
              {label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
