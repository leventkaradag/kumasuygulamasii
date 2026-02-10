"use client";

import { useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
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

const stageFilters: { label: string; value: Stage | "ALL" }[] = [
  { label: "Hepsi", value: "ALL" },
  { label: "Dokuma", value: "DOKUMA" },
  { label: "Boyahane", value: "BOYAHANE" },
  { label: "Depo", value: "DEPO" },
];

const emptyPatternForCreate: Pattern = {
  id: "",
  fabricCode: "",
  fabricName: "",
  weaveType: "",
  warpCount: "",
  weftCount: "",
  totalEnds: "",
  variants: [],
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
  const [stageFilter, setStageFilter] = useState<Stage | "ALL">("ALL");
  const [showArchived, setShowArchived] = useState(false);
  const [selectedId, setSelectedId] = useState<string>(seedPatterns[0]?.id ?? "");
  const [showPatternModal, setShowPatternModal] = useState(false);
  const [patternModalMode, setPatternModalMode] = useState<"add" | "edit">("edit");

  useEffect(() => {
    setPatterns(sortPatternsByStage(patternsLocalRepo.list()));
  }, []);

  const visiblePatterns = useMemo(
    () => patterns.filter((p) => showArchived || !p.archived),
    [patterns, showArchived]
  );

  useEffect(() => {
    if (selectedId && visiblePatterns.some((p) => p.id === selectedId)) return;
    if (visiblePatterns[0]) {
      setSelectedId(visiblePatterns[0].id);
      return;
    }
    setSelectedId("");
  }, [visiblePatterns, selectedId]);

  const filteredPatterns = useMemo(() => {
    const query = search.trim().toLowerCase();
    return visiblePatterns.filter((p) => {
      const matchesSearch =
        !query ||
        p.fabricCode.toLowerCase().includes(query) ||
        p.fabricName.toLowerCase().includes(query);
      const matchesStage = stageFilter === "ALL" || p.currentStage === stageFilter;
      return matchesSearch && matchesStage;
    });
  }, [visiblePatterns, search, stageFilter]);

  const selectedPattern = visiblePatterns.find((p) => p.id === selectedId) ?? null;
  const modalPattern = patternModalMode === "add" ? emptyPatternForCreate : selectedPattern;

  const refreshPatterns = (preferredId?: string) => {
    const refreshed = sortPatternsByStage(patternsLocalRepo.list());
    setPatterns(refreshed);

    const refreshedVisible = refreshed.filter((p) => showArchived || !p.archived);
    if (preferredId && refreshedVisible.some((p) => p.id === preferredId)) {
      setSelectedId(preferredId);
      return;
    }

    if (selectedId && refreshedVisible.some((p) => p.id === selectedId)) {
      return;
    }

    setSelectedId(refreshedVisible[0]?.id ?? "");
  };

  const handlePatternSave = (savedPattern: Pattern) => {
    refreshPatterns(savedPattern.id);
  };

  const handlePatternUpdated = (updatedPattern?: Pattern) => {
    const preferredId =
      updatedPattern && (showArchived || !updatedPattern.archived)
        ? updatedPattern.id
        : undefined;
    refreshPatterns(preferredId);
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
      <div className="space-y-4">
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
            <div className="flex flex-wrap gap-2">
              {stageFilters.map(({ label, value }) => {
                const active =
                  stageFilter === value && !(value === "ALL" && showArchived);
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setStageFilter(value)}
                    className={cn(
                      "rounded-lg border px-3 py-1.5 text-sm font-semibold transition",
                      active
                        ? "border-coffee-primary bg-coffee-primary/10 text-coffee-primary"
                        : "border-black/10 bg-white text-neutral-700 hover:border-coffee-primary/40"
                    )}
                  >
                    {label}
                  </button>
                );
              })}
              <button
                type="button"
                onClick={() => setShowArchived((prev) => !prev)}
                className={cn(
                  "rounded-lg border px-3 py-1.5 text-sm font-semibold transition",
                  showArchived
                    ? "border-emerald-500/50 bg-emerald-50 text-emerald-700"
                    : "border-black/10 bg-white text-neutral-700 hover:border-coffee-primary/40"
                )}
              >
                Arşivdekiler
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

        <div className="grid gap-6 md:grid-cols-[320px,1fr]">
          <div className="rounded-2xl border border-black/5 bg-white/80 p-3 shadow-[0_10px_30px_rgba(0,0,0,0.08)]">
            <div className="max-h-[70vh] space-y-2 overflow-auto pr-1">
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

          <PatternDetailPanel
            pattern={selectedPattern}
            onPatternUpdated={handlePatternUpdated}
            showArchived={showArchived}
          />
        </div>

        {showPatternModal && modalPattern && (
          <PatternModal
            pattern={modalPattern}
            onClose={() => setShowPatternModal(false)}
            onSave={handlePatternSave}
          />
        )}
      </div>
    </Layout>
  );
}
