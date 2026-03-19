"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { createClient } from "@/lib/supabase/client";
import { useAuthProfile } from "@/components/AuthProfileProvider";
import { cn } from "../lib/cn";

/**
 * @param {{
 *   title?: string;
 *   description?: string;
 *   children: import("react").ReactNode;
 * }} props
 */
export default function Layout({ title, description = undefined, children }) {
  const supabase = createClient();
  const router = useRouter();
  const pathname = usePathname();
  const rootRef = useRef(null);
  const { displayName, isReadOnly, menuItems, profile, role } = useAuthProfile();

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.fromTo(
        "[data-anim='nav']",
        { y: -18, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.6, ease: "power3.out", stagger: 0.08 }
      );
      gsap.fromTo(
        "[data-anim='hero']",
        { y: 24, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.7, ease: "power3.out", delay: 0.1 }
      );
      gsap.fromTo(
        "[data-anim='panel']",
        { y: 32, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.8, ease: "power3.out", delay: 0.18 }
      );
      gsap.to("[data-anim='orb']", {
        y: -12,
        duration: 6,
        ease: "sine.inOut",
        repeat: -1,
        yoyo: true,
        stagger: 1.2,
      });
    }, rootRef);

    return () => ctx.revert();
  }, [pathname]);

  const onLogout = async () => {
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  };

  return (
    <div ref={rootRef} className="page-shell relative flex min-h-screen flex-col text-neutral-900">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div
          data-anim="orb"
          className="absolute -left-24 top-8 h-72 w-72 rounded-full bg-[radial-gradient(circle_at_30%_30%,rgba(245,213,174,0.85),rgba(245,213,174,0))] blur-2xl"
        />
        <div
          data-anim="orb"
          className="absolute right-0 top-32 h-80 w-80 rounded-full bg-[radial-gradient(circle_at_30%_30%,rgba(199,160,122,0.45),rgba(199,160,122,0))] blur-3xl"
        />
        <div className="page-grid absolute inset-0 opacity-60" />
      </div>

      <header className="sticky top-0 z-20 border-b border-black/5 bg-white/70 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-4">
          <div className="flex items-center gap-4">
            <div data-anim="nav" className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-coffee-primary text-white shadow-[0_8px_20px_rgba(0,0,0,0.12)]">
                KP
              </div>
              <div>
                <div className="font-display text-lg font-semibold text-neutral-900">Kumasci Panel</div>
                <div className="text-xs uppercase tracking-[0.2em] text-neutral-500">Atelier Ops</div>
              </div>
            </div>
            <nav data-anim="nav" className="hidden flex-wrap items-center gap-2 md:flex">
              {menuItems.map((item) => {
                const isActive =
                  pathname === item.href || pathname.startsWith(`${item.href}/`);
                return (
                  <Link
                    key={item.key}
                    href={item.href}
                    className={cn(
                      "rounded-full border px-3 py-1.5 text-sm font-semibold transition",
                      isActive
                        ? "border-coffee-primary/40 bg-coffee-primary/15 text-neutral-900 shadow-[0_6px_16px_rgba(0,0,0,0.08)]"
                        : "border-transparent text-neutral-700 hover:border-black/10 hover:bg-white"
                    )}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>

          <div data-anim="nav" className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <div className="text-sm font-semibold text-neutral-900">{displayName}</div>
              <div className="text-xs text-neutral-500">
                {profile?.email || "-"} | rol: {role}
              </div>
              {isReadOnly ? (
                <div className="mt-2 inline-flex rounded-full border border-amber-500/30 bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-700">
                  Salt okunur erisim
                </div>
              ) : null}
            </div>
            <button
              onClick={onLogout}
              className="rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-semibold text-neutral-800 shadow-[0_6px_16px_rgba(0,0,0,0.08)] transition hover:-translate-y-0.5 hover:border-black/20 hover:shadow-[0_10px_20px_rgba(0,0,0,0.12)]"
            >
              Cikis
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-6xl min-h-0 flex-1 flex-col px-6 pb-16 pt-10">
        <div data-anim="hero" className="mb-6 space-y-2">
          <div className="text-xs uppercase tracking-[0.3em] text-neutral-500">Kumasci Studio</div>
          <h1 className="font-display text-3xl font-semibold text-neutral-900 md:text-4xl">
            {title || "Panel"}
          </h1>
          <p className="text-sm text-neutral-600 md:text-base">
            {description || "Operasyon akislari, desen takibi ve ekip koordinasyonu tek ekranda."}
          </p>
          {isReadOnly ? (
            <div className="inline-flex rounded-full border border-amber-500/30 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
              Bu hesap yalnizca goruntuleme yetkisine sahiptir.
            </div>
          ) : null}
        </div>

        <section
          data-anim="panel"
          className="flex min-h-0 flex-1 flex-col rounded-[28px] border border-black/5 bg-white/80 p-6 shadow-[0_20px_50px_rgba(0,0,0,0.12)] backdrop-blur"
        >
          <div className="h-full min-h-0 overflow-hidden">{children}</div>
        </section>

        <footer className="mt-4 px-2 text-center text-[11px] text-neutral-500 sm:text-right">
          Designed & developed by Ömer Levent Karadağ
        </footer>
      </main>
    </div>
  );
}
