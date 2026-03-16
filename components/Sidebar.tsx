"use client";

import clsx from "clsx";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuthProfile } from "./AuthProfileProvider";

export default function Sidebar() {
  const pathname = usePathname() ?? "";
  const { displayName, isReadOnly, menuItems, profile, role } = useAuthProfile();

  return (
    <aside className="flex min-h-screen w-56 flex-col border-r border-coffee-primary/20 bg-white/80 backdrop-blur">
      <div className="px-4 py-5 text-lg font-semibold text-coffee-accent">
        Kumasci Panel
      </div>
      <nav className="flex-1 space-y-1 px-3 pb-4">
        {menuItems.map(({ href, key, label }) => {
          const isActive =
            pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={key}
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
        {isReadOnly ? (
          <div className="mt-3 inline-flex rounded-full border border-amber-500/30 bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-700">
            Salt okunur
          </div>
        ) : null}
      </div>
    </aside>
  );
}
