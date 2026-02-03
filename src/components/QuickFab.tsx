import { useEffect, useRef, useState } from "react";
import { Factory, Layers, Warehouse } from "lucide-react";
import { useRouter } from "next/navigation";
import { UI_FLAGS } from "../config/uiFlags";
import { cn } from "../lib/cn";

const shortcuts = [
  { label: "Depo", to: "/depo", Icon: Warehouse },
  { label: "Dokuma", to: "/dokuma", Icon: Factory },
  { label: "Boyahane", to: "/boyahane", Icon: Layers },
];

export function QuickFab() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  if (!UI_FLAGS.quickFab) return null;

  const handleNavigate = (to: string) => {
    router.push(to);
    setOpen(false);
  };

  return (
    <div
      ref={wrapperRef}
      className="fixed bottom-4 right-4 z-50 md:bottom-6 md:right-6"
      aria-label="Hızlı menü"
    >
      <div
        className={cn(
          "mb-3 flex flex-col gap-2 rounded-xl border border-black/5 bg-white p-3 shadow-[0_10px_30px_rgba(0,0,0,0.12)] transition",
          "origin-bottom-right",
          open
            ? "pointer-events-auto scale-100 opacity-100 translate-y-0"
            : "pointer-events-none scale-95 opacity-0 translate-y-2"
        )}
        role="menu"
        aria-hidden={!open}
      >
        {shortcuts.map(({ label, to, Icon }) => (
          <button
            key={to}
            type="button"
            onClick={() => handleNavigate(to)}
            className="flex items-center gap-3 rounded-lg border border-transparent px-3 py-2 text-sm font-semibold text-neutral-800 transition hover:border-coffee-primary/30 hover:bg-coffee-surface"
            role="menuitem"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-coffee-primary/15 text-coffee-primary">
              <Icon className="h-4 w-4" aria-hidden />
            </span>
            <span className="whitespace-nowrap">{label}</span>
          </button>
        ))}
      </div>

      <button
        type="button"
        aria-label={open ? "Hızlı menüyü kapat" : "Hızlı menüyü aç"}
        aria-expanded={open}
        onClick={() => setOpen((prev) => !prev)}
        className="flex h-14 w-14 items-center justify-center rounded-full bg-coffee-primary text-white shadow-[0_10px_24px_rgba(0,0,0,0.18)] transition hover:scale-105 active:scale-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-coffee-primary"
      >
        <span className="text-xl leading-none">{open ? "×" : "+"}</span>
      </button>
    </div>
  );
}
