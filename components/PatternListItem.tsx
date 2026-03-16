"use client";

import type { ReactNode } from "react";
import { AlertTriangle, Image as ImageIcon, Package, Palette } from "lucide-react";
import { cn } from "@/lib/cn";
import type { Pattern } from "@/lib/domain/pattern";
import type { PatternMetricSummary } from "@/lib/patternMetrics";

type PatternListItemProps = {
  pattern: Pattern;
  metrics?: PatternMetricSummary;
  selected?: boolean;
  onSelect?: (id: string) => void;
};

const stageLabel: Record<Pattern["currentStage"], string> = {
  DEPO: "Depo",
  BOYAHANE: "Boyahane",
  DOKUMA: "Dokuma",
};

const fmt = (n: number | null | undefined) => {
  const safe = Number(n);
  return Number.isFinite(safe) ? safe.toLocaleString("tr-TR") : "0";
};

export function PatternListItem({
  pattern,
  metrics,
  selected,
  onSelect,
}: PatternListItemProps) {
  const thumb = pattern.finalImageUrl ?? pattern.digitalImageUrl ?? null;
  const summary = metrics ?? {
    totalProducedMeters: pattern.totalProducedMeters,
    stockMeters: pattern.stockMeters,
    inDyehouseMeters: pattern.inDyehouseMeters,
    defectMeters: pattern.defectMeters,
  };

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
        {thumb ? (
          <img
            src={thumb}
            alt={pattern.fabricName}
            className="h-12 w-12 rounded-lg object-cover"
            loading="lazy"
          />
        ) : (
          <ImageIcon className="h-5 w-5 text-coffee-primary" aria-hidden />
        )}
      </div>

      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex items-start justify-between gap-2">
          <div className="truncate text-sm font-semibold text-neutral-900">
            {pattern.fabricCode} - {pattern.fabricName}
          </div>

          <span className="shrink-0 rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] font-semibold text-neutral-700">
            {stageLabel[pattern.currentStage] ?? pattern.currentStage}
          </span>
        </div>

        <div className="truncate text-[11px] font-semibold text-neutral-600">
          {pattern.weaveType} | Cozgu: {pattern.warpCount} | Atki: {pattern.weftCount} | Tel:{" "}
          {pattern.totalEnds}
        </div>

        <div className="mt-1 flex flex-wrap gap-2 text-[11px] font-semibold">
          <Badge icon={<Package className="h-3.5 w-3.5" />} label="Stok" value={`${fmt(summary.stockMeters)} m`} />
          <Badge
            icon={<AlertTriangle className="h-3.5 w-3.5" />}
            label="Hatali"
            value={`${fmt(summary.defectMeters)} m`}
          />
          <Badge
            icon={<Palette className="h-3.5 w-3.5" />}
            label="Boyahane"
            value={`${fmt(summary.inDyehouseMeters)} m`}
          />
          <Badge
            icon={<Package className="h-3.5 w-3.5" />}
            label="Uretim"
            value={`${fmt(summary.totalProducedMeters)} m`}
          />
        </div>
      </div>
    </button>
  );
}

type BadgeProps = { icon: ReactNode; label: string; value: string };

function Badge({ icon, label, value }: BadgeProps) {
  return (
    <span className="inline-flex max-w-full items-center gap-2 rounded-2xl border border-[#dccbbb] bg-[#f8f2ec] px-2.5 py-1.5 text-neutral-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.6)]">
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/80 text-coffee-primary">
        {icon}
      </span>
      <span className="min-w-0 leading-none">
        <span className="block text-[9px] uppercase tracking-[0.18em] text-[#7a6656]">{label}</span>
        <span className="block truncate pt-1 text-[11px] font-bold text-[#2f241d]">{value}</span>
      </span>
    </span>
  );
}
