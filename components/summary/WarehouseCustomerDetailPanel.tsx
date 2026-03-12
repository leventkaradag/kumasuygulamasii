"use client";

import { useMemo, useState } from "react";
import { ArrowUpRight, Boxes, Layers3, Search, Users2 } from "lucide-react";

import type { WarehouseCustomerDetailRow } from "@/lib/summary/summaryTypes";
import {
  SummaryEmptyState,
  SummaryInfoPill,
  SummaryKpiCard,
  SummarySectionCard,
} from "@/components/summary/SummaryPrimitives";
import {
  fmtMetres,
  fmtPercent,
  MiniStatCard,
  normalizeSearch,
  RankedRow,
} from "@/components/summary/WarehousePanelShared";

type WarehouseCustomerDetailPanelProps = {
  rows: WarehouseCustomerDetailRow[];
};

export function WarehouseCustomerDetailPanel({
  rows,
}: WarehouseCustomerDetailPanelProps) {
  const [query, setQuery] = useState("");
  const [selectedCustomerKey, setSelectedCustomerKey] = useState<string | null>(null);
  const [selectedPatternKey, setSelectedPatternKey] = useState<string | null>(null);

  const filteredCustomers = useMemo(() => {
    const normalized = normalizeSearch(query);
    if (!normalized) return rows;
    return rows.filter((row) =>
      normalizeSearch(row.customerName).includes(normalized)
    );
  }, [rows, query]);

  const resolvedSelectedCustomerKey =
    selectedCustomerKey && filteredCustomers.some((row) => row.customerKey === selectedCustomerKey)
      ? selectedCustomerKey
      : filteredCustomers[0]?.customerKey ?? null;

  const selectedCustomer =
    filteredCustomers.find((row) => row.customerKey === resolvedSelectedCustomerKey) ??
    filteredCustomers[0] ??
    null;

  const resolvedSelectedPatternKey =
    selectedPatternKey && selectedCustomer?.patterns.some((row) => row.patternKey === selectedPatternKey)
      ? selectedPatternKey
      : selectedCustomer?.patterns[0]?.patternKey ?? null;

  const selectedPattern =
    selectedCustomer?.patterns.find((row) => row.patternKey === resolvedSelectedPatternKey) ??
    selectedCustomer?.patterns[0] ??
    null;
  const topPatternTops = selectedCustomer?.patterns[0]?.totalTops ?? 0;

  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
      <SummarySectionCard
        title="Musteri Secici"
        description="Musteriyi yazip secin; desen ve renk dagilimi ayni sahnede guncellensin."
      >
        <div className="space-y-3">
          <label className="relative block">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Musteri ara..."
              className="w-full rounded-2xl border border-black/10 bg-white px-10 py-3 text-sm text-neutral-900 shadow-[0_8px_24px_rgba(15,23,42,0.04)] focus:outline-none focus:ring-2 focus:ring-coffee-primary/60"
            />
          </label>

          <div className="flex flex-wrap gap-2">
            {filteredCustomers.slice(0, 6).map((row) => (
              <button
                key={row.customerKey}
                type="button"
                onClick={() => setSelectedCustomerKey(row.customerKey)}
                className={`rounded-full border px-3 py-1.5 text-sm font-semibold transition ${
                  row.customerKey === selectedCustomer?.customerKey
                    ? "border-coffee-primary/30 bg-coffee-primary/10 text-neutral-900 shadow-[0_8px_20px_rgba(15,23,42,0.05)]"
                    : "border-black/10 bg-white text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900"
                }`}
              >
                {row.customerName}
              </button>
            ))}
          </div>
        </div>
      </SummarySectionCard>

      <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-4">
        <SummaryKpiCard
          title="Toplam Sevk"
          value={selectedCustomer ? fmtMetres(selectedCustomer.totalMetres) : "0"}
          unit="m"
          hint="Secili musteriye giden toplam metre."
          tone="indigo"
          icon={ArrowUpRight}
        />
        <SummaryKpiCard
          title="Top Sayisi"
          value={selectedCustomer ? selectedCustomer.totalTops.toLocaleString("tr-TR") : "0"}
          hint="Musteri bazinda operasyonel yogunluk."
          tone="teal"
          icon={Boxes}
        />
        <SummaryKpiCard
          title="Desen Sayisi"
          value={selectedCustomer ? selectedCustomer.patternCount.toLocaleString("tr-TR") : "0"}
          hint="Bu donemde musteriye dokunan desen cesidi."
          tone="amber"
          icon={Layers3}
        />
        <MiniStatCard
          title="En Cok Giden"
          value={selectedCustomer?.topPatternLabel ?? "-"}
          meta="top adedi bazinda lider desen"
          tone="rose"
        />
      </div>

      <div className="grid min-h-0 flex-1 gap-4 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.2fr)]">
        <SummarySectionCard
          title="Desen Listesi"
          description="Liste once top sayisina, sonra metreye gore siralanir."
          className="min-h-0"
          bodyClassName="min-h-0 overflow-auto"
        >
          {selectedCustomer ? (
            <div className="space-y-2">
              {selectedCustomer.patterns.map((row) => (
                <RankedRow
                  key={row.patternKey}
                  label={row.patternLabel}
                  primaryText={`${row.totalTops} top`}
                  secondaryText={`${fmtMetres(row.totalMetres)} m • ${row.colorCount} renk`}
                  share={topPatternTops > 0 ? row.totalTops / topPatternTops : 0}
                  tone="indigo"
                  selected={row.patternKey === selectedPattern?.patternKey}
                  onClick={() => setSelectedPatternKey(row.patternKey)}
                />
              ))}
            </div>
          ) : (
            <SummaryEmptyState
              icon={Users2}
              title="Musteri secilmedi"
              description="Yukaridan bir musteri secildiginde en cok giden desenler burada listelenecek."
            />
          )}
        </SummarySectionCard>

        <SummarySectionCard
          title={selectedPattern ? `${selectedPattern.patternLabel} renk dagilimi` : "Renk Kirilimi"}
          description="Secilen musteride ilgili desenin renk, top ve metre kirilimi."
          className="min-h-0"
          bodyClassName="min-h-0 overflow-auto"
        >
          {selectedPattern ? (
            <div className="space-y-3">
              <div className="rounded-[22px] border border-black/5 bg-[linear-gradient(180deg,rgba(255,241,242,0.7),rgba(255,255,255,0.96))] p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="text-xs uppercase tracking-[0.2em] text-neutral-500">Musteri Desen Ozeti</div>
                    <div className="mt-1 text-lg font-semibold text-neutral-900">
                      {selectedPattern.patternLabel}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <SummaryInfoPill label={`${selectedPattern.totalTops} top`} tone="teal" />
                    <SummaryInfoPill label={`${fmtMetres(selectedPattern.totalMetres)} m`} tone="indigo" />
                    <SummaryInfoPill label={`${selectedPattern.colorCount} renk`} tone="rose" />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                {selectedPattern.colors.map((row) => (
                  <RankedRow
                    key={row.colorKey}
                    label={row.colorName}
                    primaryText={`${row.totalTops} top`}
                    secondaryText={`${fmtMetres(row.totalMetres)} m • ${fmtPercent(row.share)}`}
                    share={row.share}
                    tone="rose"
                  />
                ))}
              </div>
            </div>
          ) : (
            <SummaryEmptyState
              title="Desen secilmedi"
              description="Soldaki listeden bir desen secildiginde renk bazli top ve metre dagilimi burada gosterilecek."
            />
          )}
        </SummarySectionCard>
      </div>
    </div>
  );
}
