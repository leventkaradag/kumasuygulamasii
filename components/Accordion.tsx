"use client";

import type { ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cn } from "../lib/cn";

type AccordionProps = {
  title: string;
  children: ReactNode;
  defaultOpen?: boolean;
};

export function Accordion({ title, children, defaultOpen = false }: AccordionProps) {
  const [open, setOpen] = useState(defaultOpen);
  const [contentHeight, setContentHeight] = useState(0);
  const contentRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;

    const contentEl = contentRef.current;
    if (!contentEl) return;

    const syncHeight = () => {
      setContentHeight(contentEl.scrollHeight);
    };

    syncHeight();

    const observer = new ResizeObserver(() => {
      syncHeight();
    });
    observer.observe(contentEl);

    return () => {
      observer.disconnect();
    };
  }, [open, children]);

  return (
    <div className="rounded-xl border border-black/5 bg-white/80 shadow-[0_6px_14px_rgba(0,0,0,0.04)]">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left text-sm font-semibold text-neutral-900"
      >
        <span>{title}</span>
        <ChevronDown
          className={cn(
            "h-4 w-4 text-neutral-500 transition-transform",
            open ? "rotate-180" : "rotate-0"
          )}
          aria-hidden
        />
      </button>
      <div
        className={cn(
          "overflow-hidden px-4 pb-4 transition-[max-height,opacity,transform]",
          open ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-1"
        )}
        style={{ maxHeight: open ? `${contentHeight}px` : "0px" }}
        aria-hidden={!open}
      >
        <div ref={contentRef} className="pt-1 text-sm text-neutral-700">
          {children}
        </div>
      </div>
    </div>
  );
}
