"use client";

import { Image as ImageIcon } from "lucide-react";
import { cn } from "@/lib/cn";
import type { Pattern } from "@/lib/domain/pattern";
import { getPatternThumbnailSrc, type PatternImageFields } from "@/lib/patternImage";
import type { PatternMetricSummary } from "@/lib/patternMetrics";

type PatternListDisplayPattern = Pattern & PatternImageFields;

type PatternListItemProps = {
  pattern: PatternListDisplayPattern;
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
  const thumb = getPatternThumbnailSrc(pattern);
  const summary = metrics ?? {
    totalProducedMeters: pattern.totalProducedMeters,
    stockMeters: pattern.stockMeters,
    inDyehouseMeters: pattern.inDyehouseMeters,
    defectMeters: pattern.defectMeters,
  };
  const summaryMetrics = [
    { label: "Uretim", value: `${fmt(summary.totalProducedMeters)} m` },
    { label: "Boyahane", value: `${fmt(summary.inDyehouseMeters)} m` },
    { label: "Stok", value: `${fmt(summary.stockMeters)} m` },
    { label: "Hatali", value: `${fmt(summary.defectMeters)} m` },
  ];

  return (
    <button
      type="button"
      onClick={() => onSelect?.(pattern.id)}
      className={cn(
        "flex min-h-[152px] w-full items-start gap-3.5 rounded-2xl border border-transparent px-3 py-2.5 text-left transition",
        "hover:border-coffee-primary/35 hover:bg-white/85",
        selected
          ? "border-coffee-primary/60 bg-white shadow-[0_14px_28px_rgba(63,48,38,0.08)]"
          : "bg-white/72 shadow-[0_6px_14px_rgba(63,48,38,0.04)]"
      )}
    >
      <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-[#d7c5b4] bg-[#f5ece2] shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]">
        {thumb ? (
          <img
            src={thumb}
            alt={pattern.fabricName}
            className="h-12 w-12 rounded-xl object-cover"
            loading="lazy"
          />
        ) : (
          <ImageIcon className="h-4 w-4 text-coffee-primary" aria-hidden />
        )}
      </div>

      <div className="min-w-0 flex-1 space-y-2.5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 space-y-1">
            <div className="truncate text-[13px] font-semibold text-neutral-900">
              {pattern.fabricCode} - {pattern.fabricName}
            </div>
            <div className="truncate text-[10px] font-semibold text-[#7b6a5d]">
              {pattern.weaveType} | Cozgu: {pattern.warpCount} | Atki: {pattern.weftCount}
            </div>
          </div>

          <span className="shrink-0 rounded-full border border-[#e2d5c7] bg-[#faf6f1] px-2.5 py-0.5 text-[10px] font-semibold text-[#6d5b4f]">
            {stageLabel[pattern.currentStage] ?? pattern.currentStage}
          </span>
        </div>

        <div className="flex items-center gap-2 text-[10px] font-medium text-[#867567]">
          <span className="rounded-full bg-[#f6eee6] px-2 py-0.5">Tel: {pattern.totalEnds}</span>
        </div>

        <div className="overflow-hidden rounded-xl border border-[#dccbbb] bg-[linear-gradient(180deg,rgba(248,242,236,0.96),rgba(244,235,226,0.96))] shadow-[inset_0_1px_0_rgba(255,255,255,0.62)]">
          <div className="grid grid-cols-2">
            {summaryMetrics.map((metric, index) => (
              <span
                key={metric.label}
                className={cn(
                  "min-w-0 px-2.5 py-2",
                  index < 2 && "border-b border-[#e2d5c8]",
                  index % 2 === 0 && "border-r border-[#e2d5c8]"
                )}
              >
                <span className="block text-[8px] uppercase tracking-[0.16em] text-[#7a6656]">
                  {metric.label}
                </span>
                <span className="mt-1 block truncate text-[12px] font-semibold leading-none tracking-[-0.01em] text-[#2f241d]">
                  {metric.value}
                </span>
              </span>
            ))}
          </div>
        </div>
      </div>
    </button>
  );
}
