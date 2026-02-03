import { useEffect, useMemo, useRef, useState } from "react";
import { Search } from "lucide-react";
import { PatternDetailPanel } from "../components/PatternDetailPanel";
import { PatternListItem } from "../components/PatternListItem";
import { PATTERNS, type Pattern } from "../mock/patterns";
import { cn } from "../lib/cn";
import Layout from "../components/Layout";

export default function DesenlerPage() {
  const [patterns, setPatterns] = useState<Pattern[]>(PATTERNS);
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string>(PATTERNS[0]?.id ?? "");
  const objectUrlsRef = useRef<Record<string, { digital?: string; final?: string }>>({});

  const filteredPatterns = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return patterns;
    return patterns.filter(
      (p) =>
        p.patternNo.toLowerCase().includes(query) ||
        p.patternName.toLowerCase().includes(query)
    );
  }, [patterns, search]);

  const selectedPattern = patterns.find((p) => p.id === selectedId) ?? null;

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
          <div className="w-full max-w-md">
            <label className="relative block">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Desen no / adı ara"
                className={cn(
                  "w-full rounded-xl border border-black/5 bg-white px-10 py-2.5 text-sm text-neutral-900 shadow-[0_6px_14px_rgba(0,0,0,0.06)]",
                  "placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-coffee-primary"
                )}
              />
            </label>
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
      </div>
    </Layout>
  );
}
