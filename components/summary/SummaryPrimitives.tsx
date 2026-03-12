"use client";

import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/cn";

export type SummaryTone =
  | "teal"
  | "indigo"
  | "amber"
  | "rose"
  | "cyan"
  | "emerald"
  | "slate";

type ToneConfig = {
  solid: string;
  soft: string;
  cardClassName: string;
  iconClassName: string;
  pillClassName: string;
};

export const summaryToneConfig: Record<SummaryTone, ToneConfig> = {
  teal: {
    solid: "#14b8a6",
    soft: "rgba(20, 184, 166, 0.14)",
    cardClassName:
      "border-teal-500/15 bg-[linear-gradient(180deg,rgba(240,253,250,0.96),rgba(255,255,255,0.96))]",
    iconClassName: "bg-teal-500/14 text-teal-700",
    pillClassName: "border-teal-500/20 bg-teal-500/10 text-teal-700",
  },
  indigo: {
    solid: "#6366f1",
    soft: "rgba(99, 102, 241, 0.14)",
    cardClassName:
      "border-indigo-500/15 bg-[linear-gradient(180deg,rgba(238,242,255,0.96),rgba(255,255,255,0.96))]",
    iconClassName: "bg-indigo-500/14 text-indigo-700",
    pillClassName: "border-indigo-500/20 bg-indigo-500/10 text-indigo-700",
  },
  amber: {
    solid: "#f59e0b",
    soft: "rgba(245, 158, 11, 0.14)",
    cardClassName:
      "border-amber-500/15 bg-[linear-gradient(180deg,rgba(255,251,235,0.96),rgba(255,255,255,0.96))]",
    iconClassName: "bg-amber-500/14 text-amber-700",
    pillClassName: "border-amber-500/20 bg-amber-500/10 text-amber-700",
  },
  rose: {
    solid: "#f43f5e",
    soft: "rgba(244, 63, 94, 0.14)",
    cardClassName:
      "border-rose-500/15 bg-[linear-gradient(180deg,rgba(255,241,242,0.96),rgba(255,255,255,0.96))]",
    iconClassName: "bg-rose-500/14 text-rose-700",
    pillClassName: "border-rose-500/20 bg-rose-500/10 text-rose-700",
  },
  cyan: {
    solid: "#06b6d4",
    soft: "rgba(6, 182, 212, 0.14)",
    cardClassName:
      "border-cyan-500/15 bg-[linear-gradient(180deg,rgba(236,254,255,0.96),rgba(255,255,255,0.96))]",
    iconClassName: "bg-cyan-500/14 text-cyan-700",
    pillClassName: "border-cyan-500/20 bg-cyan-500/10 text-cyan-700",
  },
  emerald: {
    solid: "#10b981",
    soft: "rgba(16, 185, 129, 0.14)",
    cardClassName:
      "border-emerald-500/15 bg-[linear-gradient(180deg,rgba(236,253,245,0.96),rgba(255,255,255,0.96))]",
    iconClassName: "bg-emerald-500/14 text-emerald-700",
    pillClassName: "border-emerald-500/20 bg-emerald-500/10 text-emerald-700",
  },
  slate: {
    solid: "#64748b",
    soft: "rgba(100, 116, 139, 0.14)",
    cardClassName:
      "border-slate-500/15 bg-[linear-gradient(180deg,rgba(248,250,252,0.96),rgba(255,255,255,0.96))]",
    iconClassName: "bg-slate-500/14 text-slate-700",
    pillClassName: "border-slate-500/20 bg-slate-500/10 text-slate-700",
  },
};

type SegmentedOption<T extends string> = {
  value: T;
  label: string;
  description?: string;
};

type SegmentedTabsProps<T extends string> = {
  value: T;
  options: SegmentedOption<T>[];
  onChange: (value: T) => void;
  size?: "sm" | "md" | "lg";
  stretch?: boolean;
  className?: string;
};

export function SegmentedTabs<T extends string>({
  value,
  options,
  onChange,
  size = "md",
  stretch = false,
  className,
}: SegmentedTabsProps<T>) {
  const sizeClassName =
    size === "lg"
      ? "px-4 py-2.5 text-sm"
      : size === "sm"
        ? "px-3 py-1.5 text-xs"
        : "px-3.5 py-2 text-sm";

  return (
    <div
      className={cn(
        "inline-flex flex-wrap rounded-2xl border border-black/10 bg-white/75 p-1 shadow-[0_8px_24px_rgba(15,23,42,0.04)] backdrop-blur",
        className
      )}
    >
      {options.map((option) => {
        const isActive = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={cn(
              "rounded-xl font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coffee-primary/60",
              sizeClassName,
              stretch ? "flex-1 text-center" : "",
              isActive
                ? "bg-[linear-gradient(180deg,rgba(255,255,255,1),rgba(248,244,238,1))] text-neutral-900 shadow-[0_8px_24px_rgba(15,23,42,0.08)]"
                : "text-neutral-600 hover:bg-white hover:text-neutral-900"
            )}
            title={option.description}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

type SummarySectionCardProps = {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
};

export function SummarySectionCard({
  title,
  description,
  action,
  children,
  className,
  bodyClassName,
}: SummarySectionCardProps) {
  return (
    <section
      className={cn(
        "flex min-h-0 flex-col rounded-[26px] border border-black/10 bg-white/90 p-4 shadow-[0_18px_40px_rgba(15,23,42,0.08)] backdrop-blur",
        className
      )}
    >
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h3 className="text-sm font-semibold text-neutral-900">{title}</h3>
          {description ? <p className="text-xs leading-5 text-neutral-500">{description}</p> : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      <div className={cn("min-h-0 flex-1", bodyClassName)}>{children}</div>
    </section>
  );
}

type SummaryKpiCardProps = {
  title: string;
  value: string;
  unit?: string;
  hint?: string;
  meta?: string;
  tone: SummaryTone;
  icon: LucideIcon;
  className?: string;
};

export function SummaryKpiCard({
  title,
  value,
  unit,
  hint,
  meta,
  tone,
  icon: Icon,
  className,
}: SummaryKpiCardProps) {
  const toneConfig = summaryToneConfig[tone];

  return (
    <div
      className={cn(
        "rounded-[24px] border p-4 shadow-[0_14px_34px_rgba(15,23,42,0.06)]",
        toneConfig.cardClassName,
        className
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs uppercase tracking-[0.22em] text-neutral-500">{title}</div>
          <div className="mt-3 flex items-end gap-2">
            <div className="text-3xl font-semibold tracking-tight text-neutral-950">{value}</div>
            {unit ? <div className="pb-1 text-sm font-medium text-neutral-500">{unit}</div> : null}
          </div>
        </div>
        <div className={cn("flex h-11 w-11 items-center justify-center rounded-2xl", toneConfig.iconClassName)}>
          <Icon className="h-5 w-5" aria-hidden />
        </div>
      </div>
      {hint ? <p className="mt-3 text-sm leading-5 text-neutral-600">{hint}</p> : null}
      {meta ? (
        <div className={cn("mt-3 inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold", toneConfig.pillClassName)}>
          {meta}
        </div>
      ) : null}
    </div>
  );
}

type SummaryEmptyStateProps = {
  title: string;
  description: string;
  icon?: LucideIcon;
  className?: string;
};

export function SummaryEmptyState({
  title,
  description,
  icon: Icon,
  className,
}: SummaryEmptyStateProps) {
  return (
    <div
      className={cn(
        "flex h-full min-h-[220px] flex-col items-center justify-center rounded-[24px] border border-dashed border-black/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.85),rgba(248,244,238,0.85))] px-6 text-center",
        className
      )}
    >
      {Icon ? (
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-black/5 text-neutral-500">
          <Icon className="h-6 w-6" aria-hidden />
        </div>
      ) : null}
      <div className="text-base font-semibold text-neutral-900">{title}</div>
      <p className="mt-2 max-w-md text-sm leading-6 text-neutral-500">{description}</p>
    </div>
  );
}

type SummaryInfoPillProps = {
  label: string;
  tone?: SummaryTone;
  className?: string;
};

export function SummaryInfoPill({
  label,
  tone = "slate",
  className,
}: SummaryInfoPillProps) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold",
        summaryToneConfig[tone].pillClassName,
        className
      )}
    >
      {label}
    </span>
  );
}
