"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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

const seedPatterns = patternsRepo.list();

const stageFilters: { label: string; value: Stage | "ALL" }[] = [
  { label: "Hepsi", value: "ALL" },
  { label: "Dokuma", value: "DOKUMA" },
  { label: "Boyahane", value: "BOYAHANE" },
  { label: "Depo", value: "DEPO" },
];

export default function DesenlerPage() {
  const [patterns, setPatterns] = useState<Pattern[]>(seedPatterns);
  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState<Stage | "ALL">("ALL");
  const [selectedId, setSelectedId] = useState<string>(seedPatterns[0]?.id ?? "");
  const [showPatternModal, setShowPatternModal] = useState(false);
  const objectUrlsRef = useRef<Record<string, { digital?: string; final?: string }>>({});

  useEffect(() => {
    setPatterns(patternsLocalRepo.list());
  }, []);

  useEffect(() => {
    if (selectedId && patterns.some((p) => p.id === selectedId)) return;
    if (patterns[0]) setSelectedId(patterns[0].id);
  }, [patterns, selectedId]);

  const filteredPatterns = useMemo(() => {
    const query = search.trim().toLowerCase();
    return patterns.filter((p) => {
      const matchesSearch =
        !query ||
        p.fabricCode.toLowerCase().includes(query) ||
        p.fabricName.toLowerCase().includes(query);
      const matchesStage = stageFilter === "ALL" || p.currentStage === stageFilter;
      return matchesSearch && matchesStage;
    });
  }, [patterns, search, stageFilter]);

  const selectedPattern = patterns.find((p) => p.id === selectedId) ?? null;

  const handlePatternSave = (
    fields: Pick<Pattern, "fabricCode" | "fabricName" | "weaveType" | "warpCount" | "weftCount" | "totalEnds">
  ) => {
    if (!selectedPattern) return;
    patternsLocalRepo.update(selectedPattern.id, fields);
    setPatterns((prev) => prev.map((p) => (p.id === selectedPattern.id ? { ...p, ...fields } : p)));
  };

  const assignUrl = (type: "digital" | "final", file?: File) => {
    if (!file || !selectedId) return;
    const newUrl = URL.createObjectURL(file);
    const existing = objectUrlsRef.current[selectedId]?.[type];
    if (existing) URL.revokeObjectURL(existing);

    objectUrlsRef.current[selectedId] = {
      ...objectUrlsRef.current[selectedId],
      [type]: newUrl,
    };

    setPatterns((prev) =>
      prev.map((p) =>
        p.id === selectedId
          ? {
              ...p,
              ...(type === "digital" ? { digitalImageUrl: newUrl } : { finalImageUrl: newUrl }),
            }
          : p
      )
    );
  };

  useEffect(
    () => () => {
      Object.values(objectUrlsRef.current).forEach((entry) => {
        if (entry.digital) URL.revokeObjectURL(entry.digital);
        if (entry.final) URL.revokeObjectURL(entry.final);
      });
    },
    []
  );

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
                const active = stageFilter === value;
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
              <div className="grow" />
              <button
                type="button"
                disabled={!selectedPattern}
                onClick={() => setShowPatternModal(true)}
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
            onSelectDigital={(file) => assignUrl("digital", file)}
            onSelectFinal={(file) => assignUrl("final", file)}
          />
        </div>

        {showPatternModal && selectedPattern && (
          <PatternModal
            pattern={selectedPattern}
            onClose={() => setShowPatternModal(false)}
            onSave={handlePatternSave}
          />
        )}
      </div>
    </Layout>
  );
}
