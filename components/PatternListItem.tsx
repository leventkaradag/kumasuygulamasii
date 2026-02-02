"use client";

import type { ReactNode } from "react";
import { AlertTriangle, Image as ImageIcon, Package, Palette } from "lucide-react";
import { cn } from "../lib/cn";
import type { Pattern } from "../mock/patterns";

type PatternListItemProps = {
  pattern: Pattern;
  selected?: boolean;
  onSelect?: (id: string) => void;
};

export function PatternListItem({ pattern, selected, onSelect }: PatternListItemProps) {
  return (
    <button
      type="button"
      onClick={() => onSelect?.(pattern.id)}
      className={cn(
        "flex w-full items-center gap-3 rounded-xl border border-transparent px-3 py-2 text-left transition",
        "hover:border-coffee-primary/40 hover:bg-white/80",
        selected
          ? "border-coffee-primary/60 bg-white shadow-[0_8px_16px_rgba(0,0,0,0.06)]"
          : "bg-white/70"
      )}
    >
      <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-lg border border-black/5 bg-coffee-accent/20">
        {pattern.finalImageUrl ? (
          <img
            src={pattern.finalImageUrl}
            alt={pattern.patternName}
            className="h-full w-full object-cover"
            loading="lazy"
          />
        ) : pattern.digitalImageUrl ? (
          <img
            src={pattern.digitalImageUrl}
            alt={pattern.patternName}
            className="h-full w-full object-cover"
            loading="lazy"
          />
        ) : (
          <ImageIcon className="h-5 w-5 text-coffee-primary" aria-hidden />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold text-neutral-900 truncate">
          {pattern.patternNo} · {pattern.patternName}
        </div>
        <div className="mt-1 flex flex-wrap gap-2 text-[11px] font-semibold">
          <Badge icon={<Package className="h-3.5 w-3.5" />} label="Stok" value={`${pattern.stockMeters} m`} />
          <Badge
            icon={<AlertTriangle className="h-3.5 w-3.5" />}
            label="Hatalı"
            value={`${pattern.defectMeters} m`}
          />
          <Badge icon={<Palette className="h-3.5 w-3.5" />} label="Boyahane" value={`${pattern.inDyehouseMeters} m`} />
        </div>
      </div>
    </button>
  );
}

type BadgeProps = { icon: ReactNode; label: string; value: string };

function Badge({ icon, label, value }: BadgeProps) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-coffee-surface px-2 py-1 text-neutral-700">
      {icon}
      <span className="uppercase tracking-wide text-[10px]">{label}</span>
      <span className="font-bold text-neutral-900">{value}</span>
    </span>
  );
}
