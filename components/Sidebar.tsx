"use client";

import clsx from "clsx";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuthProfile } from "./AuthProfileProvider";

const baseLinks = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/ozetler", label: "Ozetler" },
  { href: "/desenler", label: "Desenler" },
  { href: "/dokuma", label: "Dokuma" },
  { href: "/boyahane", label: "Boyahane" },
  { href: "/depo", label: "Depo" },
  { href: "/sevk-rezerv", label: "Sevk/Rezerv Belgeleri" },
  { href: "/raporlar", label: "Raporlar" },
  { href: "/ayarlar", label: "Ayarlar" },
];

export default function Sidebar() {
  const pathname = usePathname() ?? "";
  const { displayName, profile, role, isSuperadmin } = useAuthProfile();
  const links = isSuperadmin
    ? [...baseLinks, { href: "/onay-paneli", label: "Onay Paneli" }]
    : baseLinks;

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
      <div className="border-t border-coffee-primary/10 px-4 py-4">
        <div className="text-sm font-semibold text-slate-900">{displayName}</div>
        <div className="mt-1 text-xs text-slate-500">{profile?.email ?? "-"}</div>
        <div className="mt-2 text-xs uppercase tracking-[0.16em] text-slate-500">
          Rol: {role}
        </div>
      </div>
    </aside>
  );
}
