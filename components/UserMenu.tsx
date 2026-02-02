"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, LogOut, Settings2, UserRound, UserRoundCog } from "lucide-react";
import { useRouter } from "next/navigation";
import { USER_MOCK } from "../config/userMock";
import { cn } from "../lib/cn";
import { useOutsideClick } from "../hooks/useOutsideClick";
import { logout } from "../auth/auth";

export function UserMenu() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  useOutsideClick(wrapperRef, () => setOpen(false));

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  const handleLogout = () => {
    logout();
    setOpen(false);
    router.replace("/login");
  };

  return (
    <div ref={wrapperRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex items-center gap-3 rounded-full border border-black/5 bg-white/80 px-3 py-2 text-sm font-semibold text-neutral-800 shadow-[0_6px_14px_rgba(0,0,0,0.06)] backdrop-blur-sm transition hover:-translate-y-0.5 hover:shadow-[0_10px_18px_rgba(0,0,0,0.08)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-coffee-primary"
        aria-expanded={open}
        aria-label="Kullanıcı menüsü"
      >
        <div className="hidden sm:flex flex-col items-start leading-tight">
          <span className="text-sm font-semibold text-neutral-900">{USER_MOCK.name}</span>
          <span className="inline-flex items-center gap-1 rounded-full bg-coffee-surface px-2 py-0.5 text-[11px] font-semibold text-neutral-700">
            <UserRoundCog className="h-3.5 w-3.5 text-coffee-primary" aria-hidden />
            {USER_MOCK.role}
          </span>
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-coffee-accent text-white text-base font-semibold">
          {USER_MOCK.name.charAt(0).toUpperCase()}
        </div>
        <ChevronDown className="h-4 w-4 text-neutral-500" aria-hidden />
      </button>

      <div
        className={cn(
          "absolute right-0 mt-2 w-48 rounded-xl border border-black/5 bg-white p-2 shadow-[0_16px_32px_rgba(0,0,0,0.12)] transition",
          "origin-top-right",
          open ? "scale-100 opacity-100" : "pointer-events-none scale-95 opacity-0"
        )}
        role="menu"
        aria-hidden={!open}
      >
        <MenuItem disabled icon={<UserRound className="h-4 w-4" />} label="Profil" />
        <MenuItem
          icon={<Settings2 className="h-4 w-4" />}
          label="Ayarlar"
          onClick={() => {
            router.push("/ayarlar");
            setOpen(false);
          }}
        />
        <MenuItem icon={<LogOut className="h-4 w-4" />} label="Çıkış" onClick={handleLogout} />
      </div>
    </div>
  );
}

type MenuItemProps = {
  icon: React.ReactNode;
  label: string;
  disabled?: boolean;
  onClick?: () => void;
};

function MenuItem({ icon, label, disabled, onClick }: MenuItemProps) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-neutral-800 transition",
        disabled
          ? "cursor-not-allowed text-neutral-400"
          : "hover:bg-coffee-surface focus-visible:outline focus-visible:outline-2 focus-visible:outline-coffee-primary/70"
      )}
      role="menuitem"
      aria-disabled={disabled}
    >
      {icon}
      <span>{label}</span>
      {disabled && <span className="ml-auto text-[11px] text-neutral-400">Pasif</span>}
    </button>
  );
}
