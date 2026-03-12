"use client";

import { useState } from "react";
import { SwatchBook } from "lucide-react";

import type { WarehousePatternBreakdownRow } from "@/lib/summary/summaryTypes";
import {
  SummaryEmptyState,
  SummaryInfoPill,
  SummarySectionCard,
} from "@/components/summary/SummaryPrimitives";
import {
  fmtMetres,
  fmtPercent,
  MiniStatCard,
  RankedRow,
} from "@/components/summary/WarehousePanelShared";

type WarehousePatternAnalysisPanelProps = {
  rows: WarehousePatternBreakdownRow[];
};

export function WarehousePatternAnalysisPanel({
  rows,
}: WarehousePatternAnalysisPanelProps) {
  const [selectedPatternKey, setSelectedPatternKey] = useState<string | null>(null);

  const resolvedSelectedPatternKey =
    selectedPatternKey && rows.some((row) => row.patternKey === selectedPatternKey)
      ? selectedPatternKey
      : rows[0]?.patternKey ?? null;

  const selectedPattern =
    rows.find((row) => row.patternKey === resolvedSelectedPatternKey) ?? rows[0] ?? null;
  const topPatternMetres = rows[0]?.totalMetres ?? 0;

  return (
    <div className="grid h-full min-h-0 gap-4 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.25fr)]">
      <SummarySectionCard
        title="En Cok Sevk Edilen Desenler"
        description="Liste metreye gore siralanir, top sayisi ikincil sinyal olarak korunur."
        className="min-h-0"
        bodyClassName="min-h-0 overflow-auto"
      >
        {rows.length > 0 ? (
          <div className="space-y-2">
            {rows.map((row) => (
              <RankedRow
                key={row.patternKey}
                label={row.patternLabel}
                primaryText={`${fmtMetres(row.totalMetres)} m`}
                secondaryText={`${row.totalTops} top • ${row.colorCount} renk`}
                share={topPatternMetres > 0 ? row.totalMetres / topPatternMetres : 0}
                tone="indigo"
                selected={row.patternKey === selectedPattern?.patternKey}
                onClick={() => setSelectedPatternKey(row.patternKey)}
              />
            ))}
          </div>
        ) : (
          <SummaryEmptyState
            icon={SwatchBook}
            title="Desen dagilimi olusmadi"
            description="Secilen aralikta sevk gormeyen desenler bu listede yer almaz."
          />
        )}
      </SummarySectionCard>

      <div className="grid min-h-0 gap-4 xl:grid-rows-[auto_minmax(0,1fr)]">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <MiniStatCard
            title="Secilen Desen"
            value={selectedPattern ? fmtMetres(selectedPattern.totalMetres) : "-"}
            meta="toplam metre"
            tone="indigo"
          />
          <MiniStatCard
            title="Top Sayisi"
            value={selectedPattern ? selectedPattern.totalTops.toLocaleString("tr-TR") : "-"}
            meta="adet top"
            tone="teal"
          />
          <MiniStatCard
            title="Renk Cesidi"
            value={selectedPattern ? selectedPattern.colorCount.toLocaleString("tr-TR") : "-"}
            meta="aktif renk"
            tone="amber"
          />
          <MiniStatCard
            title="En Guclu Renk"
            value={selectedPattern?.topColorName ?? "-"}
            meta="renk lideri"
            tone="rose"
          />
        </div>

        <SummarySectionCard
          title={selectedPattern ? `${selectedPattern.patternLabel} renk dagilimi` : "Renk Dagilimi"}
          description="Metre ve top birlikte okunur; operasyon onceligi tek bir panelde toplanir."
          className="min-h-0"
          bodyClassName="min-h-0 overflow-auto"
        >
          {selectedPattern ? (
            <div className="space-y-3">
              <div className="rounded-[22px] border border-black/5 bg-[linear-gradient(180deg,rgba(238,242,255,0.8),rgba(255,255,255,0.96))] p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="text-xs uppercase tracking-[0.2em] text-neutral-500">
                      Desen Ozet
                    </div>
                    <div className="mt-1 text-lg font-semibold text-neutral-900">
                      {selectedPattern.patternLabel}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <SummaryInfoPill
                      label={`${fmtMetres(selectedPattern.totalMetres)} m`}
                      tone="indigo"
                    />
                    <SummaryInfoPill
                      label={`${selectedPattern.totalTops} top`}
                      tone="teal"
                    />
                    <SummaryInfoPill
                      label={`${selectedPattern.colorCount} renk`}
                      tone="rose"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                {selectedPattern.colors.map((color) => (
                  <RankedRow
                    key={color.colorKey}
                    label={color.colorName}
                    primaryText={`${fmtMetres(color.totalMetres)} m`}
                    secondaryText={`${color.totalTops} top • ${fmtPercent(color.share)}`}
                    share={color.share}
                    tone="cyan"
                  />
                ))}
              </div>
            </div>
          ) : (
            <SummaryEmptyState
              title="Secili desen yok"
              description="Soldaki listeden bir desen secildiginde renk kirilimi ve top-metraj ozeti burada acilir."
            />
          )}
        </SummarySectionCard>
      </div>
    </div>
  );
}
