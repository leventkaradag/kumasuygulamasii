"use client";

import { useMemo, useState } from "react";

import type {
  WarehouseCustomerDistributionRow,
  WarehouseTrendBucket,
} from "@/lib/summary/summaryTypes";
import { cn } from "@/lib/cn";
import {
  SummaryEmptyState,
  SummaryInfoPill,
  summaryToneConfig,
  type SummaryTone,
} from "@/components/summary/SummaryPrimitives";
import { BarChart3, PieChart } from "lucide-react";

const fmtMetres = (value: number) =>
  value.toLocaleString("tr-TR", { maximumFractionDigits: value >= 100 ? 0 : 2 });

const fmtPercent = (value: number) =>
  `${(value * 100).toLocaleString("tr-TR", { maximumFractionDigits: 1 })}%`;

type TrendBarChartProps = {
  data: WarehouseTrendBucket[];
};

const trendSeries: Array<{
  key: "inboundMetres" | "shippedMetres" | "returnedMetres";
  label: string;
  tone: SummaryTone;
}> = [
  { key: "inboundMetres", label: "Gelen", tone: "teal" },
  { key: "shippedMetres", label: "Sevk", tone: "indigo" },
  { key: "returnedMetres", label: "Iade", tone: "amber" },
];

export function TrendBarChart({ data }: TrendBarChartProps) {
  const [activeKey, setActiveKey] = useState<string | null>(null);

  const resolvedActiveKey =
    activeKey && data.some((bucket) => bucket.key === activeKey)
      ? activeKey
      : data[data.length - 1]?.key ?? null;

  const activeBucket =
    data.find((bucket) => bucket.key === resolvedActiveKey) ?? data[data.length - 1] ?? null;

  const maxValue = useMemo(
    () =>
      Math.max(
        1,
        ...data.flatMap((bucket) =>
          trendSeries.map((series) => bucket[series.key] as number)
        )
      ),
    [data]
  );

  if (data.length === 0) {
    return (
      <SummaryEmptyState
        icon={BarChart3}
        title="Trend grafigi olusturulamadi"
        description="Secilen aralikta gosterilecek hareket bulunamadi."
      />
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="text-xs uppercase tracking-[0.22em] text-neutral-500">Aktif Dilim</div>
          <div className="text-lg font-semibold text-neutral-900">{activeBucket?.label ?? "-"}</div>
          <div className="text-sm text-neutral-500">
            Her kolon secilen zaman dilimindeki giris, sevk ve iadeyi birlikte okutur.
          </div>
        </div>

        {activeBucket ? (
          <div className="grid gap-2 sm:grid-cols-3">
            {trendSeries.map((series) => {
              const tone = summaryToneConfig[series.tone];
              const value = activeBucket[series.key];
              return (
                <div
                  key={series.key}
                  className="rounded-2xl border border-black/5 bg-white/85 px-3 py-2 shadow-[0_10px_24px_rgba(15,23,42,0.05)]"
                >
                  <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-neutral-500">
                    <span
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: tone.solid }}
                    />
                    {series.label}
                  </div>
                  <div className="mt-2 text-xl font-semibold text-neutral-950">{fmtMetres(value)}</div>
                  <div className="text-xs text-neutral-500">metre</div>
                </div>
              );
            })}
          </div>
        ) : null}
      </div>

      <div className="overflow-x-auto pb-1">
        <div className="relative h-[320px] min-w-full" style={{ width: `${Math.max(780, data.length * 72)}px` }}>
          <div className="absolute inset-x-0 bottom-10 top-4">
            <div className="flex h-full flex-col justify-between">
              {[1, 0.75, 0.5, 0.25, 0].map((ratio) => (
                <div key={ratio} className="relative border-t border-dashed border-black/8">
                  <span className="absolute -top-2 left-0 rounded-full bg-white/80 px-2 text-[10px] font-semibold text-neutral-400">
                    {fmtMetres(maxValue * ratio)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div
            className="absolute inset-x-10 bottom-0 top-0 grid gap-3"
            style={{
              gridTemplateColumns: `repeat(${data.length}, minmax(54px, 1fr))`,
            }}
          >
            {data.map((bucket) => {
              const isActive = bucket.key === activeBucket?.key;

              return (
                <button
                  key={bucket.key}
                  type="button"
                  onMouseEnter={() => setActiveKey(bucket.key)}
                  onFocus={() => setActiveKey(bucket.key)}
                  onClick={() => setActiveKey(bucket.key)}
                  className={cn(
                    "group relative flex h-full min-w-0 flex-col justify-end rounded-[22px] px-2 pb-3 pt-8 text-left transition",
                    isActive ? "bg-black/[0.035]" : "hover:bg-black/[0.025]"
                  )}
                >
                  <div className="flex h-full items-end justify-center gap-1.5">
                    {trendSeries.map((series) => {
                      const value = bucket[series.key];
                      const height = Math.max((value / maxValue) * 100, value > 0 ? 6 : 0);
                      const tone = summaryToneConfig[series.tone];

                      return (
                        <div
                          key={series.key}
                          className="relative flex h-full w-3 items-end rounded-full"
                          title={`${bucket.label}: ${series.label} ${fmtMetres(value)} m`}
                        >
                          <div
                            className="w-full rounded-full shadow-[0_8px_18px_rgba(15,23,42,0.08)] transition duration-200 group-hover:brightness-105"
                            style={{
                              height: `${height}%`,
                              background: `linear-gradient(180deg, ${tone.solid}, ${tone.soft})`,
                            }}
                          />
                        </div>
                      );
                    })}
                  </div>
                  <div className="mt-3 text-center text-[11px] font-semibold tracking-wide text-neutral-500">
                    {bucket.shortLabel}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {trendSeries.map((series) => (
          <SummaryInfoPill
            key={series.key}
            label={series.label}
            tone={series.tone}
          />
        ))}
      </div>
    </div>
  );
}

type DonutShareChartProps = {
  rows: WarehouseCustomerDistributionRow[];
  totalMetres: number;
};

const donutPalette = [
  summaryToneConfig.indigo.solid,
  summaryToneConfig.teal.solid,
  summaryToneConfig.rose.solid,
  summaryToneConfig.amber.solid,
  summaryToneConfig.cyan.solid,
  summaryToneConfig.emerald.solid,
  "#8b5cf6",
  "#ec4899",
];

export function DonutShareChart({ rows, totalMetres }: DonutShareChartProps) {
  const [activeKey, setActiveKey] = useState<string | null>(null);

  const resolvedActiveKey =
    activeKey && rows.some((row) => row.customerKey === activeKey)
      ? activeKey
      : rows[0]?.customerKey ?? null;

  const activeRow = rows.find((row) => row.customerKey === resolvedActiveKey) ?? rows[0] ?? null;

  if (rows.length === 0) {
    return (
      <SummaryEmptyState
        icon={PieChart}
        title="Dagilim bulunamadi"
        description="Secilen donemde musterilere cikis yapilmadiysa dairesel dagilim burada bos gorunur."
      />
    );
  }

  const radius = 68;
  const circumference = 2 * Math.PI * radius;
  const segments = rows.map((row, index) => {
    const progressBefore = rows
      .slice(0, index)
      .reduce((sum, currentRow) => sum + currentRow.share, 0);
    return {
      row,
      color: donutPalette[index % donutPalette.length],
      dash: circumference * row.share,
      offset: -progressBefore * circumference,
    };
  });

  return (
    <div className="grid h-full min-h-0 gap-6 xl:grid-cols-[300px_minmax(0,1fr)]">
      <div className="flex flex-col items-center justify-start rounded-[24px] border border-black/5 bg-[linear-gradient(180deg,rgba(248,250,252,0.75),rgba(255,255,255,0.95))] p-4">
        <svg viewBox="0 0 200 200" className="h-64 w-64">
          <circle
            cx="100"
            cy="100"
            r={radius}
            fill="none"
            stroke="rgba(15,23,42,0.08)"
            strokeWidth="18"
          />
          {segments.map(({ row, color, dash, offset }) => {
            return (
              <circle
                key={row.customerKey}
                cx="100"
                cy="100"
                r={radius}
                fill="none"
                stroke={color}
                strokeWidth={activeRow?.customerKey === row.customerKey ? 24 : 18}
                strokeDasharray={`${dash} ${circumference - dash}`}
                strokeDashoffset={offset}
                strokeLinecap="round"
                transform="rotate(-90 100 100)"
                className="cursor-pointer transition-all duration-200"
                onMouseEnter={() => setActiveKey(row.customerKey)}
                onFocus={() => setActiveKey(row.customerKey)}
                onClick={() => setActiveKey(row.customerKey)}
              />
            );
          })}

          <circle cx="100" cy="100" r="48" fill="white" />
          <text x="100" y="90" textAnchor="middle" className="fill-neutral-400 text-[10px] uppercase tracking-[0.22em]">
            Toplam Sevk
          </text>
          <text x="100" y="114" textAnchor="middle" className="fill-neutral-900 text-[22px] font-semibold">
            {fmtMetres(totalMetres)} m
          </text>
          <text x="100" y="132" textAnchor="middle" className="fill-neutral-400 text-[11px]">
            {rows.length} musteri
          </text>
        </svg>

        {activeRow ? (
          <div className="mt-2 w-full rounded-2xl border border-black/5 bg-white px-4 py-3 text-center shadow-[0_10px_24px_rgba(15,23,42,0.04)]">
            <div className="text-xs uppercase tracking-[0.18em] text-neutral-400">Aktif Dilim</div>
            <div className="mt-1 text-base font-semibold text-neutral-900">{activeRow.customerName}</div>
            <div className="mt-2 flex items-center justify-center gap-2 text-sm text-neutral-500">
              <span>{fmtMetres(activeRow.totalMetres)} m</span>
              <span className="text-neutral-300">•</span>
              <span>{activeRow.totalTops} top</span>
              <span className="text-neutral-300">•</span>
              <span>{fmtPercent(activeRow.share)}</span>
            </div>
          </div>
        ) : null}
      </div>

      <div className="min-h-0 overflow-auto rounded-[24px] border border-black/5 bg-white/80 p-2">
        <div className="space-y-2">
          {segments.map(({ row, color }) => {
            const isActive = row.customerKey === activeRow?.customerKey;

            return (
              <button
                key={row.customerKey}
                type="button"
                onMouseEnter={() => setActiveKey(row.customerKey)}
                onFocus={() => setActiveKey(row.customerKey)}
                onClick={() => setActiveKey(row.customerKey)}
                className={cn(
                  "flex w-full items-center justify-between gap-3 rounded-[20px] border px-3 py-3 text-left transition",
                  isActive
                    ? "border-black/10 bg-neutral-50 shadow-[0_10px_24px_rgba(15,23,42,0.05)]"
                    : "border-transparent hover:border-black/10 hover:bg-neutral-50/80"
                )}
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span
                    className="h-3 w-3 rounded-full"
                    style={{ backgroundColor: color }}
                  />
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-neutral-900">
                      {row.customerName}
                    </div>
                    <div className="mt-1 text-xs text-neutral-500">
                      {row.totalTops} top • {fmtMetres(row.totalMetres)} m
                    </div>
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <div className="text-sm font-semibold text-neutral-900">{fmtPercent(row.share)}</div>
                  <div className="mt-1 h-2.5 w-24 overflow-hidden rounded-full bg-black/5">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${Math.max(row.share * 100, 6)}%`,
                        backgroundColor: color,
                      }}
                    />
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
