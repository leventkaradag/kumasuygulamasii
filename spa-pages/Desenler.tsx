"use client";

import { useEffect, useMemo, useState } from "react";
import { Search, SlidersHorizontal, X } from "lucide-react";
import Layout from "@/components/Layout";
import { PatternDetailPanel } from "@/components/PatternDetailPanel";
import { PatternListItem } from "@/components/PatternListItem";
import { PatternModal } from "@/components/desen/PatternModal";
import type { Pattern } from "@/lib/domain/pattern";
import { Stage } from "@/lib/domain/movement";
import { patternsLocalRepo } from "@/lib/repos/patternsLocalRepo";
import { patternsRepo } from "@/lib/repos/patternsRepo";
import { cn } from "@/lib/cn";

const stageOrder: Record<Stage, number> = {
  DOKUMA: 0,
  BOYAHANE: 1,
  DEPO: 2,
};

const sortPatternsByStage = (items: Pattern[]) =>
  [...items].sort((a, b) => {
    const stageDiff = stageOrder[a.currentStage] - stageOrder[b.currentStage];
    if (stageDiff !== 0) return stageDiff;
    return a.fabricCode.localeCompare(b.fabricCode, "tr-TR");
  });

const seedPatterns = sortPatternsByStage(patternsRepo.list());

type PatternTab = "ALL" | Stage | "ARCHIVE";

const patternTabs: { label: string; value: PatternTab }[] = [
  { label: "Hepsi", value: "ALL" },
  { label: "Dokuma", value: "DOKUMA" },
  { label: "Boyahane", value: "BOYAHANE" },
  { label: "Depo", value: "DEPO" },
  { label: "Arşivdekiler", value: "ARCHIVE" },
];

type PatternFilters = {
  partyNo?: string;
  customer?: string;
  dateFrom?: string;
  dateTo?: string;
  gramajMin?: number;
  gramajMax?: number;
  eniMin?: number;
  eniMax?: number;
};

type PatternFilterMeta = Pattern &
  Partial<{
    customer: string;
    customerName: string;
    musteri: string;
    musteriAdi: string;
    createdAt: string;
    gramaj: number | string;
    eni: number | string;
  }>;

const normalizeQuery = (query: string) => query.trim().toLocaleLowerCase("tr-TR");
const normalizeOptionalQuery = (value?: string) => normalizeQuery(value ?? "");

const toFiniteNumber = (value: unknown): number | undefined => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return undefined;
  const parsed = Number(value.trim().replace(",", "."));
  return Number.isFinite(parsed) ? parsed : undefined;
};

const toDate = (value?: string): Date | undefined => {
  if (!value) return undefined;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return undefined;
  return parsed;
};

const atStartOfDay = (date: Date) => {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
};

const atEndOfDay = (date: Date) => {
  const next = new Date(date);
  next.setHours(23, 59, 59, 999);
  return next;
};

const getFilteredPatterns = (
  items: Pattern[],
  tab: PatternTab,
  query: string,
  filters: PatternFilters
) => {
  const normalizedQuery = normalizeQuery(query);
  const normalizedPartyNo = normalizeOptionalQuery(filters.partyNo);
  const normalizedCustomer = normalizeOptionalQuery(filters.customer);
  const fromDate = toDate(filters.dateFrom);
  const toDateValue = toDate(filters.dateTo);
  const fromBoundary = fromDate ? atStartOfDay(fromDate) : undefined;
  const toBoundary = toDateValue ? atEndOfDay(toDateValue) : undefined;

  return items.filter((pattern) => {
    const meta = pattern as PatternFilterMeta;
    const matchesTab =
      tab === "ARCHIVE"
        ? pattern.archived === true
        : pattern.archived !== true && (tab === "ALL" || pattern.currentStage === tab);

    if (!matchesTab) return false;

    const matchesSearchPartiNos = (pattern.partiNos ?? []).some((partiNo) =>
      partiNo.toLocaleLowerCase("tr-TR").includes(normalizedQuery)
    );
    const matchesSearch =
      !normalizedQuery ||
      pattern.fabricCode.toLocaleLowerCase("tr-TR").includes(normalizedQuery) ||
      pattern.fabricName.toLocaleLowerCase("tr-TR").includes(normalizedQuery) ||
      matchesSearchPartiNos;
    if (!matchesSearch) return false;

    if (normalizedPartyNo) {
      const hasPartyMatch = (pattern.partiNos ?? []).some((partiNo) =>
        partiNo.toLocaleLowerCase("tr-TR").includes(normalizedPartyNo)
      );
      if (!hasPartyMatch) return false;
    }

    if (normalizedCustomer) {
      const customerValue = normalizeOptionalQuery(
        meta.customer ?? meta.customerName ?? meta.musteri ?? meta.musteriAdi ?? ""
      );
      if (!customerValue.includes(normalizedCustomer)) return false;
    }

    if (fromBoundary || toBoundary) {
      const createdAt = toDate(meta.createdAt);
      if (!createdAt) return false;
      if (fromBoundary && createdAt < fromBoundary) return false;
      if (toBoundary && createdAt > toBoundary) return false;
    }

    const gramaj = toFiniteNumber(meta.gramaj);
    if (typeof filters.gramajMin === "number" && (gramaj === undefined || gramaj < filters.gramajMin)) {
      return false;
    }
    if (typeof filters.gramajMax === "number" && (gramaj === undefined || gramaj > filters.gramajMax)) {
      return false;
    }

    const eni = toFiniteNumber(meta.eni);
    if (typeof filters.eniMin === "number" && (eni === undefined || eni < filters.eniMin)) {
      return false;
    }
    if (typeof filters.eniMax === "number" && (eni === undefined || eni > filters.eniMax)) {
      return false;
    }

    return true;
  });
};

const emptyPatternForCreate: Pattern = {
  id: "",
  createdAt: new Date().toISOString(),
  fabricCode: "",
  fabricName: "",
  weaveType: "",
  warpCount: "",
  weftCount: "",
  totalEnds: "",
  variants: [],
  partiNos: [],
  musteri: "",
  depoNo: "",
  currentStage: "DEPO",
  totalProducedMeters: 0,
  stockMeters: 0,
  defectMeters: 0,
  inDyehouseMeters: 0,
  note: "",
};

export default function DesenlerPage() {
  const [patterns, setPatterns] = useState<Pattern[]>(seedPatterns);
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<PatternTab>("ALL");
  const [filters, setFilters] = useState<PatternFilters>({});
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string>(seedPatterns[0]?.id ?? "");
  const [showPatternModal, setShowPatternModal] = useState(false);
  const [patternModalMode, setPatternModalMode] = useState<"add" | "edit">("edit");

  useEffect(() => {
    setPatterns(sortPatternsByStage(patternsLocalRepo.list()));
  }, []);

  const filteredPatterns = useMemo(
    () => getFilteredPatterns(patterns, activeTab, search, filters),
    [patterns, activeTab, search, filters]
  );

  useEffect(() => {
    if (selectedId && filteredPatterns.some((pattern) => pattern.id === selectedId)) return;
    setSelectedId(filteredPatterns[0]?.id ?? "");
  }, [filteredPatterns, selectedId]);

  useEffect(() => {
    if (!isFilterOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsFilterOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isFilterOpen]);

  const selectedPattern = filteredPatterns.find((pattern) => pattern.id === selectedId) ?? null;
  const modalPattern = patternModalMode === "add" ? emptyPatternForCreate : selectedPattern;

  const refreshPatterns = (preferredId?: string) => {
    const refreshed = sortPatternsByStage(patternsLocalRepo.list());
    setPatterns(refreshed);

    const refreshedFiltered = getFilteredPatterns(refreshed, activeTab, search, filters);
    if (preferredId && refreshedFiltered.some((pattern) => pattern.id === preferredId)) {
      setSelectedId(preferredId);
      return;
    }

    if (selectedId && refreshedFiltered.some((pattern) => pattern.id === selectedId)) {
      return;
    }

    setSelectedId(refreshedFiltered[0]?.id ?? "");
  };

  const handlePatternSave = (savedPattern: Pattern) => {
    refreshPatterns(savedPattern.id);
  };

  const handlePatternUpdated = (updatedPattern?: Pattern) => {
    const preferredId =
      updatedPattern && getFilteredPatterns([updatedPattern], activeTab, search, filters).length > 0
        ? updatedPattern.id
        : undefined;
    refreshPatterns(preferredId);
  };

  const handleNumberFilterChange = (
    key: "gramajMin" | "gramajMax" | "eniMin" | "eniMax",
    rawValue: string
  ) => {
    const trimmed = rawValue.trim();
    const parsed = Number(trimmed.replace(",", "."));
    setFilters((prev) => ({
      ...prev,
      [key]: trimmed && Number.isFinite(parsed) ? parsed : undefined,
    }));
  };

  const openAddPatternModal = () => {
    setPatternModalMode("add");
    setShowPatternModal(true);
  };

  const openEditPatternModal = () => {
    if (!selectedPattern) return;
    setPatternModalMode("edit");
    setShowPatternModal(true);
  };

  return (
    <Layout title="Desenler">
      <div className="flex h-full min-h-0 flex-col gap-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-xl font-semibold text-neutral-900">Desenler</h1>
            <p className="text-sm text-neutral-600">Desen listesi ve görsel önizleme</p>
          </div>
          <div className="flex w-full flex-col gap-2 md:max-w-lg">
            <div className="w-full">
              <label className="relative block">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
                <input
                  type="search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Kumaş kodu / adı ara"
                  className={cn(
                    "w-full rounded-xl border border-black/5 bg-white px-10 py-2.5 text-sm text-neutral-900 shadow-[0_6px_14px_rgba(0,0,0,0.06)]",
                    "placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-coffee-primary"
                  )}
                />
              </label>
            </div>
            <div className="flex flex-wrap gap-2" role="tablist" aria-label="Desen sekmeleri">
              {patternTabs.map(({ label, value }) => {
                const active = activeTab === value;
                const archiveTab = value === "ARCHIVE";

                return (
                  <button
                    key={value}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => setActiveTab(value)}
                    className={cn(
                      "rounded-lg border px-3 py-1.5 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coffee-primary/60",
                      active
                        ? archiveTab
                          ? "border-emerald-500/50 bg-emerald-50 text-emerald-700"
                          : "border-coffee-primary bg-coffee-primary/10 text-coffee-primary"
                        : "border-black/10 bg-white text-neutral-700 hover:border-coffee-primary/40 hover:bg-white"
                    )}
                  >
                    {label}
                  </button>
                );
              })}
              <button
                type="button"
                onClick={() => setIsFilterOpen(true)}
                className="inline-flex items-center gap-2 rounded-lg border border-black/10 bg-white px-3 py-1.5 text-sm font-semibold text-neutral-700 transition hover:border-coffee-primary/40"
              >
                <SlidersHorizontal className="h-4 w-4" />
                Filtre
              </button>
              <div className="grow" />
              <button
                type="button"
                onClick={openAddPatternModal}
                className="rounded-lg border border-coffee-primary bg-coffee-primary/10 px-3 py-1.5 text-sm font-semibold text-coffee-primary transition hover:border-coffee-primary/70"
              >
                + Desen Ekle
              </button>
              <button
                type="button"
                disabled={!selectedPattern}
                onClick={openEditPatternModal}
                className={cn(
                  "rounded-lg border px-3 py-1.5 text-sm font-semibold transition",
                  selectedPattern
                    ? "border-coffee-primary bg-coffee-primary/10 text-coffee-primary"
                    : "cursor-not-allowed border-black/10 bg-white text-neutral-400"
                )}
              >
                Deseni Düzenle
              </button>
            </div>
          </div>
        </div>

        <div className="min-h-0 h-[calc(100vh-220px)]">
          <div className="min-h-0 h-full grid gap-6 md:grid-cols-[320px,1fr]">
          <div className="min-h-0 h-full overflow-auto rounded-2xl border border-black/5 bg-white/80 p-3 shadow-[0_10px_30px_rgba(0,0,0,0.08)]">
            <div className="space-y-2 pr-1">
              {filteredPatterns.map((pattern) => (
                <PatternListItem
                  key={pattern.id}
                  pattern={pattern}
                  selected={pattern.id === selectedId}
                  onSelect={setSelectedId}
                />
              ))}
              {filteredPatterns.length === 0 && (
                <div className="flex items-center justify-center rounded-xl border border-dashed border-black/10 bg-coffee-surface px-4 py-10 text-sm text-neutral-500">
                  Arama sonucu bulunamadı
                </div>
              )}
            </div>
          </div>

          <div className="min-h-0 h-full overflow-auto md:pr-1">
            <PatternDetailPanel
              pattern={selectedPattern}
              onPatternUpdated={handlePatternUpdated}
              showArchived={activeTab === "ARCHIVE"}
            />
          </div>
          </div>
        </div>

        {showPatternModal && modalPattern && (
          <PatternModal
            pattern={modalPattern}
            onClose={() => setShowPatternModal(false)}
            onSave={handlePatternSave}
          />
        )}

        {isFilterOpen && (
          <div
            className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4"
            onClick={() => setIsFilterOpen(false)}
          >
            <div
              className="w-full max-w-md rounded-2xl border border-black/10 bg-white shadow-2xl"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="flex max-h-[80vh] flex-col">
            <div className="flex items-center justify-between border-b border-black/10 px-4 py-3">
              <div>
                <h2 className="text-sm font-semibold text-neutral-900">Filtreler</h2>
                <p className="text-xs text-neutral-500">Liste anlık güncellenir</p>
              </div>
              <button
                type="button"
                onClick={() => setIsFilterOpen(false)}
                className="rounded-lg border border-black/10 p-1.5 text-neutral-600 transition hover:border-coffee-primary/40"
                aria-label="Filtre modalını kapat"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 space-y-4 overflow-auto px-4 py-4">
              <label className="space-y-1 text-sm text-neutral-700">
                <span>Parti No</span>
                <input
                  type="text"
                  value={filters.partyNo ?? ""}
                  onChange={(event) =>
                    setFilters((prev) => ({
                      ...prev,
                      partyNo: event.target.value || undefined,
                    }))
                  }
                  placeholder="Parti no filtrele"
                  className="w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-coffee-primary"
                />
              </label>

              <label className="space-y-1 text-sm text-neutral-700">
                <span>Müşteri</span>
                <input
                  type="text"
                  value={filters.customer ?? ""}
                  onChange={(event) =>
                    setFilters((prev) => ({
                      ...prev,
                      customer: event.target.value || undefined,
                    }))
                  }
                  placeholder="Müşteri filtrele"
                  className="w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-coffee-primary"
                />
              </label>

              <div className="grid grid-cols-2 gap-2">
                <label className="space-y-1 text-sm text-neutral-700">
                  <span>Tarih Başlangıç</span>
                  <input
                    type="date"
                    value={filters.dateFrom ?? ""}
                    onChange={(event) =>
                      setFilters((prev) => ({
                        ...prev,
                        dateFrom: event.target.value || undefined,
                      }))
                    }
                    className="w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-coffee-primary"
                  />
                </label>
                <label className="space-y-1 text-sm text-neutral-700">
                  <span>Tarih Bitiş</span>
                  <input
                    type="date"
                    value={filters.dateTo ?? ""}
                    onChange={(event) =>
                      setFilters((prev) => ({
                        ...prev,
                        dateTo: event.target.value || undefined,
                      }))
                    }
                    className="w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-coffee-primary"
                  />
                </label>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <label className="space-y-1 text-sm text-neutral-700">
                  <span>Gramaj Min</span>
                  <input
                    type="number"
                    step="0.01"
                    value={filters.gramajMin ?? ""}
                    onChange={(event) => handleNumberFilterChange("gramajMin", event.target.value)}
                    placeholder="0"
                    className="w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-coffee-primary"
                  />
                </label>
                <label className="space-y-1 text-sm text-neutral-700">
                  <span>Gramaj Max</span>
                  <input
                    type="number"
                    step="0.01"
                    value={filters.gramajMax ?? ""}
                    onChange={(event) => handleNumberFilterChange("gramajMax", event.target.value)}
                    placeholder="0"
                    className="w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-coffee-primary"
                  />
                </label>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <label className="space-y-1 text-sm text-neutral-700">
                  <span>Eni Min</span>
                  <input
                    type="number"
                    step="0.01"
                    value={filters.eniMin ?? ""}
                    onChange={(event) => handleNumberFilterChange("eniMin", event.target.value)}
                    placeholder="0"
                    className="w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-coffee-primary"
                  />
                </label>
                <label className="space-y-1 text-sm text-neutral-700">
                  <span>Eni Max</span>
                  <input
                    type="number"
                    step="0.01"
                    value={filters.eniMax ?? ""}
                    onChange={(event) => handleNumberFilterChange("eniMax", event.target.value)}
                    placeholder="0"
                    className="w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-coffee-primary"
                  />
                </label>
              </div>
            </div>

            <div className="border-t border-black/10 px-4 py-3">
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setFilters({})}
                  className="rounded-lg border border-coffee-primary bg-coffee-primary/10 px-3 py-2 text-sm font-semibold text-coffee-primary transition hover:border-coffee-primary/70"
                >
                  Filtreleri Temizle
                </button>
                <button
                  type="button"
                  onClick={() => setIsFilterOpen(false)}
                  className="rounded-lg border border-black/10 bg-white px-3 py-2 text-sm font-semibold text-neutral-700 transition hover:border-coffee-primary/40"
                >
                  Kapat
                </button>
              </div>
            </div>
          </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}

