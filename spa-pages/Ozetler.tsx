"use client";

import { useMemo, useState } from "react";
import { Boxes, ChevronLeft, ChevronRight, Droplets, Search, Waves } from "lucide-react";

import Layout from "@/components/Layout";
import { cn } from "@/lib/cn";
import type { Customer } from "@/lib/domain/customer";
import type { FabricRoll } from "@/lib/domain/depo";
import type { Pattern } from "@/lib/domain/pattern";
import type { DepoTransaction, DepoTransactionLine } from "@/lib/domain/depoTransaction";
import { customersLocalRepo } from "@/lib/repos/customersLocalRepo";
import { depoLocalRepo } from "@/lib/repos/depoLocalRepo";
import { depoTransactionsLocalRepo } from "@/lib/repos/depoTransactionsLocalRepo";
import { patternsLocalRepo } from "@/lib/repos/patternsLocalRepo";
import type {
  SummaryDateRange,
  SummaryModule,
  SummaryRangePreset,
  SummaryTimeScale,
  WarehouseCustomerDistributionRow,
} from "@/lib/summary/summaryTypes";
import {
  buildRangeForPreset,
  formatDateInputValue,
  formatRangeLabel,
  normalizeDateRange,
  parseDateInputValue,
  shiftDateRange,
} from "@/lib/summary/summaryUtils";
import { buildWarehouseSummary } from "@/lib/summary/warehouseSummary";
import {
  SegmentedTabs,
  SummaryInfoPill,
} from "@/components/summary/SummaryPrimitives";
import { WarehouseOverviewPanel } from "@/components/summary/WarehouseOverviewPanel";
import { WarehouseCustomerDistributionPanel } from "@/components/summary/WarehouseCustomerDistributionPanel";
import { WarehousePatternAnalysisPanel } from "@/components/summary/WarehousePatternAnalysisPanel";
import { WarehouseCustomerDetailPanel } from "@/components/summary/WarehouseCustomerDetailPanel";
import { SummaryPlaceholderModule } from "@/components/summary/SummaryPlaceholderModule";

type WarehouseView = "OVERVIEW" | "CUSTOMERS" | "PATTERNS" | "CUSTOMER_DETAIL";

const moduleOptions: Array<{
  value: SummaryModule;
  label: string;
  icon: typeof Boxes;
  description: string;
}> = [
  {
    value: "WAREHOUSE",
    label: "Depo",
    icon: Boxes,
    description:
      "Depoya giren, sevk edilen ve iade gelen hareketleri tek panelde okuyun.",
  },
  {
    value: "DYEHOUSE",
    label: "Boyahane",
    icon: Droplets,
    description:
      "Boyahane KPI, termin ve proses ozetleri icin yapisal panel hazir.",
  },
  {
    value: "WEAVING",
    label: "Dokuma",
    icon: Waves,
    description:
      "Dokuma ritmi, aktif desenler ve kalite sinyalleri ayni sahneye tasiniyor.",
  },
];

const warehouseViewOptions: Array<{ value: WarehouseView; label: string }> = [
  { value: "OVERVIEW", label: "Genel Bakis" },
  { value: "CUSTOMERS", label: "Musteri Dagilimi" },
  { value: "PATTERNS", label: "Desen Bazli" },
  { value: "CUSTOMER_DETAIL", label: "Musteri Detayi" },
];

const timeScaleOptions: Array<{ value: SummaryTimeScale; label: string }> = [
  { value: "DAY", label: "Gun" },
  { value: "MONTH", label: "Ay" },
  { value: "YEAR", label: "Yil" },
];

const presetOptions: Array<{ value: SummaryRangePreset; label: string }> = [
  { value: "THIS_MONTH", label: "Bu Ay" },
  { value: "PREVIOUS_MONTH", label: "Onceki Ay" },
  { value: "LAST_3_MONTHS", label: "Son 3 Ay" },
  { value: "LAST_12_MONTHS", label: "Son 12 Ay" },
  { value: "THIS_YEAR", label: "Bu Yil" },
  { value: "CUSTOM", label: "Ozel Aralik" },
];

const normalizeSearch = (value: string) =>
  value.trim().toLocaleLowerCase("tr-TR").replace(/\s+/g, " ");

const scaleLabelMap: Record<SummaryTimeScale, string> = {
  DAY: "Gunluk",
  MONTH: "Aylik",
  YEAR: "Yillik",
};

const getDefaultPresetForScale = (scale: SummaryTimeScale): SummaryRangePreset => {
  if (scale === "DAY") return "THIS_MONTH";
  if (scale === "YEAR") return "THIS_YEAR";
  return "LAST_12_MONTHS";
};

const rebaseCustomerShares = (rows: WarehouseCustomerDistributionRow[]) => {
  const totalMetres = rows.reduce((sum, row) => sum + row.totalMetres, 0);
  return rows.map((row) => ({
    ...row,
    share: totalMetres > 0 ? row.totalMetres / totalMetres : 0,
  }));
};

const buildDonutRows = (rows: WarehouseCustomerDistributionRow[]) => {
  if (rows.length <= 5) return rows;

  const topRows = rows.slice(0, 5);
  const otherRows = rows.slice(5);
  const otherMetres = otherRows.reduce((sum, row) => sum + row.totalMetres, 0);
  const otherTops = otherRows.reduce((sum, row) => sum + row.totalTops, 0);
  const totalMetres = rows.reduce((sum, row) => sum + row.totalMetres, 0);

  return [
    ...topRows,
    {
      customerKey: "__other__",
      customerId: null,
      customerName: "Diger Musteriler",
      totalMetres: otherMetres,
      totalTops: otherTops,
      share: totalMetres > 0 ? otherMetres / totalMetres : 0,
    },
  ];
};

export default function OzetlerPage() {
  const [activeModule, setActiveModule] = useState<SummaryModule>("WAREHOUSE");
  const [warehouseView, setWarehouseView] = useState<WarehouseView>("OVERVIEW");
  const [timeScale, setTimeScale] = useState<SummaryTimeScale>("MONTH");
  const [rangePreset, setRangePreset] = useState<SummaryRangePreset>("LAST_12_MONTHS");
  const [range, setRange] = useState<SummaryDateRange>(() =>
    buildRangeForPreset("LAST_12_MONTHS")
  );

  const [patterns] = useState<Pattern[]>(() => patternsLocalRepo.list());
  const [customers] = useState<Customer[]>(() => customersLocalRepo.list());
  const [rolls] = useState<FabricRoll[]>(() => depoLocalRepo.listRolls());
  const [transactions] = useState<DepoTransaction[]>(() =>
    depoTransactionsLocalRepo.listTransactions()
  );
  const [transactionLines] = useState<DepoTransactionLine[]>(() =>
    depoTransactionsLocalRepo.listLines()
  );

  const [customerDistributionQuery, setCustomerDistributionQuery] = useState("");
  const [patternQuery, setPatternQuery] = useState("");

  const warehouseSummary = useMemo(
    () =>
      buildWarehouseSummary({
        range,
        scale: timeScale,
        rolls,
        transactions,
        transactionLines,
        patterns,
        customers,
      }),
    [customers, patterns, range, rolls, timeScale, transactionLines, transactions]
  );

  const periodLabel = useMemo(() => formatRangeLabel(range, timeScale), [range, timeScale]);

  const filteredCustomerDistributionRows = useMemo(() => {
    const normalized = normalizeSearch(customerDistributionQuery);
    const baseRows =
      normalized.length === 0
        ? warehouseSummary.customers
        : warehouseSummary.customers.filter((row) =>
            normalizeSearch(row.customerName).includes(normalized)
          );

    return rebaseCustomerShares(baseRows);
  }, [customerDistributionQuery, warehouseSummary.customers]);

  const donutRows = useMemo(
    () => buildDonutRows(filteredCustomerDistributionRows),
    [filteredCustomerDistributionRows]
  );

  const filteredPatternRows = useMemo(() => {
    const normalized = normalizeSearch(patternQuery);
    if (!normalized) return warehouseSummary.patterns;

    return warehouseSummary.patterns.filter((row) =>
      normalizeSearch(row.patternLabel).includes(normalized)
    );
  }, [patternQuery, warehouseSummary.patterns]);

  const currentModule = moduleOptions.find((module) => module.value === activeModule) ?? moduleOptions[0];

  const applyPreset = (nextPreset: SummaryRangePreset) => {
    setRangePreset(nextPreset);
    if (nextPreset !== "CUSTOM") {
      setRange(buildRangeForPreset(nextPreset));
    }
  };

  const handleScaleChange = (nextScale: SummaryTimeScale) => {
    setTimeScale(nextScale);
    const nextPreset = getDefaultPresetForScale(nextScale);
    setRangePreset(nextPreset);
    setRange(buildRangeForPreset(nextPreset));
  };

  const handleCustomDateChange = (field: "start" | "end", value: string) => {
    const parsed = parseDateInputValue(value);
    if (!parsed) return;

    setRangePreset("CUSTOM");
    setRange((current) =>
      normalizeDateRange({
        start: field === "start" ? parsed : current.start,
        end: field === "end" ? parsed : current.end,
      })
    );
  };

  const shiftPeriod = (direction: -1 | 1) => {
    setRange((current) => shiftDateRange(current, rangePreset, direction));
  };

  const renderWarehouseContext = () => {
    if (warehouseView === "CUSTOMERS") {
      return (
        <label className="relative block w-full max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
          <input
            type="search"
            value={customerDistributionQuery}
            onChange={(event) => setCustomerDistributionQuery(event.target.value)}
            placeholder="Musteri ara..."
            className="w-full rounded-2xl border border-black/10 bg-white px-10 py-2.5 text-sm text-neutral-900 shadow-[0_8px_24px_rgba(15,23,42,0.04)] focus:outline-none focus:ring-2 focus:ring-coffee-primary/60"
          />
        </label>
      );
    }

    if (warehouseView === "PATTERNS") {
      return (
        <label className="relative block w-full max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
          <input
            type="search"
            value={patternQuery}
            onChange={(event) => setPatternQuery(event.target.value)}
            placeholder="Desen kodu veya adi ara..."
            className="w-full rounded-2xl border border-black/10 bg-white px-10 py-2.5 text-sm text-neutral-900 shadow-[0_8px_24px_rgba(15,23,42,0.04)] focus:outline-none focus:ring-2 focus:ring-coffee-primary/60"
          />
        </label>
      );
    }

    if (warehouseView === "CUSTOMER_DETAIL") {
      return <SummaryInfoPill label="Musteri secimi panel icinde" tone="rose" />;
    }

    return <SummaryInfoPill label={`${scaleLabelMap[timeScale]} gorunum`} tone="slate" />;
  };

  return (
    <Layout title="Operasyon Ozetleri">
      <div className="flex h-full min-h-0 flex-col gap-4">
        <section className="rounded-[28px] border border-black/10 bg-[linear-gradient(135deg,rgba(255,255,255,0.96),rgba(248,244,238,0.92))] p-5 shadow-[0_18px_42px_rgba(15,23,42,0.08)]">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-3xl">
              <div className="text-xs uppercase tracking-[0.24em] text-neutral-500">
                Tek Sahne Ozet Paneli
              </div>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-neutral-950">
                {currentModule.label} odakli ozetler
              </h2>
              <p className="mt-2 text-sm leading-6 text-neutral-600">
                {currentModule.description}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <SummaryInfoPill label={scaleLabelMap[timeScale]} tone="cyan" />
              <SummaryInfoPill label={periodLabel} tone="slate" />
            </div>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-3">
            {moduleOptions.map((module) => {
              const Icon = module.icon;
              const isActive = module.value === activeModule;

              return (
                <button
                  key={module.value}
                  type="button"
                  onClick={() => setActiveModule(module.value)}
                  className={cn(
                    "rounded-[24px] border px-4 py-4 text-left transition",
                    isActive
                      ? "border-coffee-primary/30 bg-coffee-primary/10 shadow-[0_16px_36px_rgba(15,23,42,0.08)]"
                      : "border-black/8 bg-white/80 hover:border-black/12 hover:bg-white"
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-neutral-900">{module.label}</div>
                      <div className="mt-1 text-xs leading-5 text-neutral-500">
                        {module.description}
                      </div>
                    </div>
                    <div
                      className={cn(
                        "flex h-10 w-10 items-center justify-center rounded-2xl",
                        isActive ? "bg-white text-coffee-primary" : "bg-black/5 text-neutral-500"
                      )}
                    >
                      <Icon className="h-5 w-5" aria-hidden />
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[30px] border border-black/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.92),rgba(247,243,237,0.9))] p-4 shadow-[0_20px_48px_rgba(15,23,42,0.08)]">
          {activeModule === "WAREHOUSE" ? (
            <>
              <div className="space-y-4 border-b border-black/8 pb-4">
                <div className="rounded-[24px] border border-black/8 bg-white/75 p-3 shadow-[0_12px_30px_rgba(15,23,42,0.04)]">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-3">
                      <SegmentedTabs
                        value={timeScale}
                        options={timeScaleOptions}
                        onChange={handleScaleChange}
                        size="sm"
                      />
                      <div className="flex flex-wrap items-center gap-2">
                        {presetOptions.map((option) => (
                          <button
                            key={option.value}
                            type="button"
                            onClick={() => applyPreset(option.value)}
                            className={cn(
                              "rounded-full border px-3 py-1.5 text-xs font-semibold transition",
                              option.value === rangePreset
                                ? "border-coffee-primary/30 bg-coffee-primary/10 text-neutral-900"
                                : "border-black/10 bg-white text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900"
                            )}
                          >
                            {option.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => shiftPeriod(-1)}
                        className="rounded-full border border-black/10 bg-white p-2 text-neutral-600 transition hover:bg-neutral-50 hover:text-neutral-900"
                        aria-label="Onceki donem"
                      >
                        <ChevronLeft className="h-4 w-4" aria-hidden />
                      </button>
                      <button
                        type="button"
                        onClick={() => shiftPeriod(1)}
                        className="rounded-full border border-black/10 bg-white p-2 text-neutral-600 transition hover:bg-neutral-50 hover:text-neutral-900"
                        aria-label="Sonraki donem"
                      >
                        <ChevronRight className="h-4 w-4" aria-hidden />
                      </button>
                    </div>
                  </div>

                  {rangePreset === "CUSTOM" ? (
                    <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:max-w-md">
                      <input
                        type="date"
                        value={formatDateInputValue(range.start)}
                        onChange={(event) => handleCustomDateChange("start", event.target.value)}
                        className="w-full rounded-2xl border border-black/10 bg-white px-3 py-2 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-coffee-primary/60"
                      />
                      <input
                        type="date"
                        value={formatDateInputValue(range.end)}
                        onChange={(event) => handleCustomDateChange("end", event.target.value)}
                        className="w-full rounded-2xl border border-black/10 bg-white px-3 py-2 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-coffee-primary/60"
                      />
                    </div>
                  ) : null}
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3">
                  <SegmentedTabs
                    value={warehouseView}
                    options={warehouseViewOptions}
                    onChange={setWarehouseView}
                    size="md"
                  />
                  <div className="w-full md:w-auto">{renderWarehouseContext()}</div>
                </div>
              </div>

              <div className="mt-4 min-h-0 flex-1 overflow-auto">
                {warehouseView === "OVERVIEW" ? (
                  <WarehouseOverviewPanel
                    data={warehouseSummary}
                    periodLabel={periodLabel}
                    scaleLabel={scaleLabelMap[timeScale]}
                  />
                ) : warehouseView === "CUSTOMERS" ? (
                  <WarehouseCustomerDistributionPanel
                    rows={filteredCustomerDistributionRows}
                    donutRows={donutRows}
                    totalMetres={filteredCustomerDistributionRows.reduce(
                      (sum, row) => sum + row.totalMetres,
                      0
                    )}
                  />
                ) : warehouseView === "PATTERNS" ? (
                  <WarehousePatternAnalysisPanel rows={filteredPatternRows} />
                ) : (
                  <WarehouseCustomerDetailPanel rows={warehouseSummary.customerDetails} />
                )}
              </div>
            </>
          ) : activeModule === "DYEHOUSE" ? (
            <SummaryPlaceholderModule module="DYEHOUSE" />
          ) : (
            <SummaryPlaceholderModule module="WEAVING" />
          )}
        </section>
      </div>
    </Layout>
  );
}
