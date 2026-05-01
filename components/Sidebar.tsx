"use client";

import clsx from "clsx";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { X } from "lucide-react";
import { useEffect, useState } from "react";
import { useAuthProfile } from "./AuthProfileProvider";

export const PANEL_NAV_OPEN_EVENT = "panel-nav:open";
export const PANEL_NAV_CLOSE_EVENT = "panel-nav:close";
export const PANEL_NAV_TOGGLE_EVENT = "panel-nav:toggle";

type SidebarContentProps = {
  pathname: string;
  menuItems: Array<{ href: string; key: string; label: string }>;
  displayName: string;
  email: string;
  role: string;
  isReadOnly: boolean;
  onNavigate?: () => void;
  mobile?: boolean;
};

function SidebarContent({
  pathname,
  menuItems,
  displayName,
  email,
  role,
  isReadOnly,
  onNavigate,
  mobile = false,
}: SidebarContentProps) {
  return (
    <>
      <div
        className={clsx(
          "text-lg font-semibold text-coffee-accent",
          mobile ? "flex items-center justify-between px-4 py-4" : "px-4 py-5"
        )}
      >
        <span>Kumasci Panel</span>
        {mobile ? (
          <button
            type="button"
            onClick={onNavigate}
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-coffee-primary/15 bg-white/80 text-slate-700 transition hover:border-coffee-primary/30 hover:bg-coffee-surface"
            aria-label="Menuyu kapat"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        ) : null}
      </div>
      <nav className="flex-1 space-y-1 px-3 pb-4">
        {menuItems.map(({ href, key, label }) => {
          const isActive =
            pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={key}
              href={href}
              onClick={onNavigate}
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
        <div className="mt-1 text-xs text-slate-500">{email}</div>
        <div className="mt-2 text-xs uppercase tracking-[0.16em] text-slate-500">
          Rol: {role}
        </div>
        {isReadOnly ? (
          <div className="mt-3 inline-flex rounded-full border border-amber-500/30 bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-700">
            Salt okunur
          </div>
        ) : null}
      </div>
    </>
  );
}

export default function Sidebar() {
  const pathname = usePathname() ?? "";
  const { displayName, isReadOnly, menuItems, profile, role } = useAuthProfile();
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  useEffect(() => {
    const openSidebar = () => setIsMobileOpen(true);
    const closeSidebar = () => setIsMobileOpen(false);
    const toggleSidebar = () => setIsMobileOpen((current) => !current);
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsMobileOpen(false);
      }
    };

    window.addEventListener(PANEL_NAV_OPEN_EVENT, openSidebar);
    window.addEventListener(PANEL_NAV_CLOSE_EVENT, closeSidebar);
    window.addEventListener(PANEL_NAV_TOGGLE_EVENT, toggleSidebar);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener(PANEL_NAV_OPEN_EVENT, openSidebar);
      window.removeEventListener(PANEL_NAV_CLOSE_EVENT, closeSidebar);
      window.removeEventListener(PANEL_NAV_TOGGLE_EVENT, toggleSidebar);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  useEffect(() => {
    setIsMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!isMobileOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isMobileOpen]);

  const closeMobileSidebar = () => setIsMobileOpen(false);
  const email = profile?.email ?? "-";

  return (
    <>
      <aside className="hidden min-h-screen w-56 shrink-0 border-r border-coffee-primary/20 bg-white/80 backdrop-blur lg:flex lg:flex-col">
        <SidebarContent
          pathname={pathname}
          menuItems={menuItems}
          displayName={displayName}
          email={email}
          role={role}
          isReadOnly={isReadOnly}
        />
      </aside>

      <div
        className={clsx(
          "fixed inset-0 z-40 lg:hidden",
          isMobileOpen ? "pointer-events-auto" : "pointer-events-none"
        )}
        aria-hidden={!isMobileOpen}
      >
        <button
          type="button"
          onClick={closeMobileSidebar}
          className={clsx(
            "absolute inset-0 bg-black/35 backdrop-blur-[2px] transition-opacity",
            isMobileOpen ? "opacity-100" : "opacity-0"
          )}
          aria-label="Menuyu kapat"
        />

        <aside
          className={clsx(
            "absolute left-0 top-0 flex h-screen w-[min(20rem,calc(100vw-1rem))] max-w-full flex-col border-r border-coffee-primary/20 bg-white/95 shadow-[0_18px_40px_rgba(0,0,0,0.16)] backdrop-blur transition-transform",
            isMobileOpen ? "translate-x-0" : "-translate-x-full"
          )}
        >
          <SidebarContent
            pathname={pathname}
            menuItems={menuItems}
            displayName={displayName}
            email={email}
            role={role}
            isReadOnly={isReadOnly}
            onNavigate={closeMobileSidebar}
            mobile
          />
        </aside>
      </div>
    </>
  );
}
