"use client";

import { cn } from "@/lib/cn";
import {
  SummaryInfoPill,
  summaryToneConfig,
  type SummaryTone,
} from "@/components/summary/SummaryPrimitives";

export const fmtMetres = (value: number) =>
  value.toLocaleString("tr-TR", { maximumFractionDigits: value >= 100 ? 0 : 2 });

export const fmtPercent = (value: number) =>
  `${(value * 100).toLocaleString("tr-TR", { maximumFractionDigits: 1 })}%`;

export const normalizeSearch = (value: string) =>
  value.trim().toLocaleLowerCase("tr-TR").replace(/\s+/g, " ");

type RankedRowProps = {
  label: string;
  primaryText: string;
  secondaryText?: string;
  share: number;
  tone: SummaryTone;
  selected?: boolean;
  onClick?: () => void;
};

export function RankedRow({
  label,
  primaryText,
  secondaryText,
  share,
  tone,
  selected = false,
  onClick,
}: RankedRowProps) {
  const toneConfig = summaryToneConfig[tone];
  const width = `${Math.max(Math.min(share * 100, 100), 6)}%`;

  const content = (
    <>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-neutral-900">{label}</div>
          {secondaryText ? (
            <div className="mt-1 text-xs text-neutral-500">{secondaryText}</div>
          ) : null}
        </div>
        <div className="shrink-0 text-right text-sm font-semibold text-neutral-900">
          {primaryText}
        </div>
      </div>
      <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-black/5">
        <div
          className="h-full rounded-full transition-all"
          style={{
            width,
            background: `linear-gradient(90deg, ${toneConfig.solid}, ${toneConfig.soft})`,
          }}
        />
      </div>
    </>
  );

  if (!onClick) {
    return (
      <div className="rounded-[20px] border border-black/8 bg-white/80 px-3 py-3 shadow-[0_10px_24px_rgba(15,23,42,0.04)]">
        {content}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "w-full rounded-[20px] border px-3 py-3 text-left transition",
        selected
          ? "border-black/10 bg-neutral-50 shadow-[0_12px_28px_rgba(15,23,42,0.06)]"
          : "border-black/5 bg-white/80 hover:border-black/10 hover:bg-neutral-50/90"
      )}
    >
      {content}
    </button>
  );
}

type SnapshotRowProps = {
  label: string;
  value: string;
};

export function SnapshotRow({ label, value }: SnapshotRowProps) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl bg-white/80 px-3 py-2">
      <div className="text-sm text-neutral-500">{label}</div>
      <div className="text-right text-sm font-semibold text-neutral-900">{value}</div>
    </div>
  );
}

type InsightCardProps = {
  title: string;
  value: string;
  description: string;
  tone: SummaryTone;
};

export function InsightCard({
  title,
  value,
  description,
  tone,
}: InsightCardProps) {
  return (
    <div
      className={cn(
        "rounded-[22px] border p-4",
        summaryToneConfig[tone].cardClassName
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="text-xs uppercase tracking-[0.2em] text-neutral-500">{title}</div>
        <SummaryInfoPill label={value} tone={tone} />
      </div>
      <p className="mt-3 text-sm leading-6 text-neutral-600">{description}</p>
    </div>
  );
}

type MiniStatCardProps = {
  title: string;
  value: string;
  meta: string;
  tone: SummaryTone;
};

export function MiniStatCard({ title, value, meta, tone }: MiniStatCardProps) {
  return (
    <div
      className={cn(
        "rounded-[22px] border px-4 py-3 shadow-[0_12px_28px_rgba(15,23,42,0.05)]",
        summaryToneConfig[tone].cardClassName
      )}
    >
      <div className="text-xs uppercase tracking-[0.18em] text-neutral-500">{title}</div>
      <div className="mt-2 text-xl font-semibold tracking-tight text-neutral-950">{value}</div>
      <div className="mt-1 text-xs text-neutral-500">{meta}</div>
    </div>
  );
}

type PlaceholderSurfaceProps = {
  title: string;
};

export function PlaceholderSurface({ title }: PlaceholderSurfaceProps) {
  return (
    <div className="rounded-[24px] border border-dashed border-black/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.85),rgba(248,244,238,0.85))] p-4">
      <div className="text-xs uppercase tracking-[0.2em] text-neutral-400">{title}</div>
      <div className="mt-4 space-y-3">
        <div className="h-4 w-3/4 rounded-full bg-black/[0.05]" />
        <div className="h-16 rounded-[18px] bg-black/[0.04]" />
        <div className="grid grid-cols-2 gap-3">
          <div className="h-20 rounded-[18px] bg-black/[0.04]" />
          <div className="h-20 rounded-[18px] bg-black/[0.04]" />
        </div>
      </div>
    </div>
  );
}
