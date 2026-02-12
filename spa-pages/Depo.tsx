"use client";

import { type ReactNode, useEffect, useMemo, useState } from "react";
import { Plus, Search } from "lucide-react";
import Layout from "@/components/Layout";
import { cn } from "@/lib/cn";
import type { FabricRoll, FabricRollStatus } from "@/lib/domain/depo";
import type { Pattern, Variant } from "@/lib/domain/pattern";
import { depoLocalRepo } from "@/lib/repos/depoLocalRepo";
import { patternsLocalRepo } from "@/lib/repos/patternsLocalRepo";

type PatternMeta = Pattern & Partial<{ __deleted?: boolean }>;
type ColorSummary = {
  color: string;
  totalMeters: number;
  totalRolls: number;
  reservedMeters: number;
  reservedRolls: number;
  availableMeters: number;
  availableRolls: number;
};

const statusLabel: Record<FabricRollStatus, string> = {
  IN_STOCK: "Stokta",
  RESERVED: "Rezerve",
  SHIPPED: "Sevk",
  RETURNED: "Iade",
  SCRAP: "Hurda",
};

const statusClass: Record<FabricRollStatus, string> = {
  IN_STOCK: "border-emerald-500/30 bg-emerald-50 text-emerald-700",
  RESERVED: "border-amber-500/30 bg-amber-50 text-amber-700",
  SHIPPED: "border-sky-500/30 bg-sky-50 text-sky-700",
  RETURNED: "border-violet-500/30 bg-violet-50 text-violet-700",
  SCRAP: "border-rose-500/30 bg-rose-50 text-rose-700",
};

const todayInput = () => new Date().toISOString().slice(0, 10);
const fmt = (n: number) => n.toLocaleString("tr-TR", { maximumFractionDigits: 2 });

const parseBoundary = (value: string, endOfDay: boolean) => {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const source = /^\d{4}-\d{2}-\d{2}$/.test(trimmed)
    ? `${trimmed}T${endOfDay ? "23:59:59.999" : "00:00:00.000"}`
    : trimmed;
  const parsed = new Date(source);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed.getTime();
};

const toIsoDate = (value: string, label: string) => {
  const trimmed = value.trim();
  if (!trimmed) throw new Error(`${label} gerekli`);
  const parsed = new Date(`${trimmed}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) throw new Error(`${label} gecersiz`);
  return parsed.toISOString();
};

const toPositiveNumber = (value: string, label: string) => {
  const parsed = Number(value.trim().replace(",", "."));
  if (!Number.isFinite(parsed) || parsed <= 0) throw new Error(`${label} 0'dan buyuk olmali`);
  return parsed;
};

const toTimestamp = (value: string) => {
  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
};

const isPatternVisible = (pattern: Pattern) => {
  const meta = pattern as PatternMeta;
  return pattern.archived !== true && meta.__deleted !== true;
};

const sortPatterns = (patterns: Pattern[]) =>
  [...patterns].sort((a, b) => a.fabricCode.localeCompare(b.fabricCode, "tr-TR"));

const getPatternImage = (pattern: Pattern) => pattern.finalImageUrl ?? pattern.digitalImageUrl;
const shortNote = (value?: string) => {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) return "Not yok";
  return trimmed.length > 90 ? `${trimmed.slice(0, 90)}...` : trimmed;
};

const variantName = (variant: Variant) => variant.colorName?.trim() || variant.name?.trim() || "Renk yok";

const rollColor = (roll: FabricRoll, pattern: Pattern) => {
  if (roll.variantId) {
    const variant = pattern.variants.find((item) => item.id === roll.variantId);
    if (variant) return variantName(variant);
  }
  return roll.colorName?.trim() || "Renk yok";
};

const buildColorSummary = (rolls: FabricRoll[], pattern: Pattern): ColorSummary[] => {
  const map = new Map<string, ColorSummary>();
  rolls.forEach((roll) => {
    const color = rollColor(roll, pattern);
    if (!map.has(color)) {
      map.set(color, {
        color,
        totalMeters: 0,
        totalRolls: 0,
        reservedMeters: 0,
        reservedRolls: 0,
        availableMeters: 0,
        availableRolls: 0,
      });
    }
    const bucket = map.get(color)!;
    if (roll.status === "IN_STOCK") {
      bucket.totalMeters += roll.meters;
      bucket.totalRolls += 1;
      bucket.availableMeters += roll.meters;
      bucket.availableRolls += 1;
    } else if (roll.status === "RESERVED") {
      bucket.totalMeters += roll.meters;
      bucket.totalRolls += 1;
      bucket.reservedMeters += roll.meters;
      bucket.reservedRolls += 1;
    }
  });
  return Array.from(map.values()).sort((a, b) => a.color.localeCompare(b.color, "tr-TR"));
};

export default function DepoPage() {
  const [patterns, setPatterns] = useState<Pattern[]>([]);
  const [rolls, setRolls] = useState<FabricRoll[]>([]);
  const [selectedPatternId, setSelectedPatternId] = useState<string | null>(null);
  const [searchPattern, setSearchPattern] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [rollSearch, setRollSearch] = useState("");
  const [rollStatus, setRollStatus] = useState<FabricRollStatus | "">("");

  const [addOpen, setAddOpen] = useState(false);
  const [addVariantId, setAddVariantId] = useState("__other");
  const [addColorName, setAddColorName] = useState("");
  const [addMeters, setAddMeters] = useState("");
  const [addRollNo, setAddRollNo] = useState("");
  const [addDate, setAddDate] = useState(todayInput());
  const [addNote, setAddNote] = useState("");
  const [addError, setAddError] = useState("");

  const [reserveRollId, setReserveRollId] = useState<string | null>(null);
  const [reserveFor, setReserveFor] = useState("");
  const [reserveDate, setReserveDate] = useState(todayInput());
  const [reserveError, setReserveError] = useState("");

  const [shipRollId, setShipRollId] = useState<string | null>(null);
  const [shipCounterparty, setShipCounterparty] = useState("");
  const [shipDate, setShipDate] = useState(todayInput());
  const [shipError, setShipError] = useState("");

  const refreshData = (preferredPatternId?: string | null) => {
    const nextPatterns = sortPatterns(patternsLocalRepo.list().filter(isPatternVisible));
    const nextRolls = depoLocalRepo.listRolls();
    setPatterns(nextPatterns);
    setRolls(nextRolls);
    setSelectedPatternId((currentId) => {
      if (preferredPatternId && nextPatterns.some((p) => p.id === preferredPatternId)) return preferredPatternId;
      if (currentId && nextPatterns.some((p) => p.id === currentId)) return currentId;
      return nextPatterns[0]?.id ?? null;
    });
  };

  useEffect(() => {
    refreshData();
  }, []);

  const fromBoundary = useMemo(() => parseBoundary(dateFrom, false), [dateFrom]);
  const toBoundary = useMemo(() => parseBoundary(dateTo, true), [dateTo]);

  const rollsInRange = useMemo(
    () =>
      rolls.filter((roll) => {
        const inAt = toTimestamp(roll.inAt);
        if (fromBoundary !== undefined && inAt < fromBoundary) return false;
        if (toBoundary !== undefined && inAt > toBoundary) return false;
        return true;
      }),
    [rolls, fromBoundary, toBoundary]
  );

  const filteredPatterns = useMemo(() => {
    const normalized = searchPattern.trim().toLocaleLowerCase("tr-TR");
    const hasDateFilter = !!dateFrom || !!dateTo;
    const patternIds = new Set(rollsInRange.map((roll) => roll.patternId));
    return patterns.filter((pattern) => {
      if (hasDateFilter && !patternIds.has(pattern.id)) return false;
      if (!normalized) return true;
      return (
        pattern.fabricCode.toLocaleLowerCase("tr-TR").includes(normalized) ||
        pattern.fabricName.toLocaleLowerCase("tr-TR").includes(normalized)
      );
    });
  }, [patterns, rollsInRange, searchPattern, dateFrom, dateTo]);

  useEffect(() => {
    if (selectedPatternId && filteredPatterns.some((item) => item.id === selectedPatternId)) return;
    setSelectedPatternId(filteredPatterns[0]?.id ?? null);
  }, [filteredPatterns, selectedPatternId]);

  const selectedPattern = filteredPatterns.find((item) => item.id === selectedPatternId) ?? null;

  const selectedPatternRolls = useMemo(() => {
    if (!selectedPattern) return [];
    return rollsInRange.filter((roll) => roll.patternId === selectedPattern.id);
  }, [rollsInRange, selectedPattern]);

  const visibleRolls = useMemo(() => {
    const normalized = rollSearch.trim().toLocaleLowerCase("tr-TR");
    return selectedPatternRolls.filter((roll) => {
      if (rollStatus && roll.status !== rollStatus) return false;
      if (!normalized) return true;
      const no = (roll.rollNo ?? "").toLocaleLowerCase("tr-TR");
      const color = selectedPattern ? rollColor(roll, selectedPattern).toLocaleLowerCase("tr-TR") : "";
      return no.includes(normalized) || color.includes(normalized);
    });
  }, [selectedPatternRolls, selectedPattern, rollSearch, rollStatus]);

  const colorSummary = useMemo(() => (selectedPattern ? buildColorSummary(selectedPatternRolls, selectedPattern) : []), [selectedPatternRolls, selectedPattern]);

  const totalRolls = rollsInRange.filter((roll) => roll.status === "IN_STOCK" || roll.status === "RESERVED");
  const reservedRolls = rollsInRange.filter((roll) => roll.status === "RESERVED");
  const availableRolls = rollsInRange.filter((roll) => roll.status === "IN_STOCK");

  const openAddModal = () => {
    if (!selectedPattern) return;
    setAddVariantId(selectedPattern.variants[0]?.id ?? "__other");
    setAddColorName("");
    setAddMeters("");
    setAddRollNo("");
    setAddDate(todayInput());
    setAddNote("");
    setAddError("");
    setAddOpen(true);
  };

  const handleAddRoll = () => {
    if (!selectedPattern) return;
    try {
      const meters = toPositiveNumber(addMeters, "Metre");
      const inAt = toIsoDate(addDate, "Giris tarihi");
      const variant = addVariantId !== "__other" ? selectedPattern.variants.find((item) => item.id === addVariantId) : undefined;
      const colorName = addVariantId === "__other" ? addColorName.trim() : variant?.colorName ?? variant?.name ?? "";
      if (!colorName && !variant) throw new Error("Renk seciniz.");

      depoLocalRepo.addRoll({
        patternId: selectedPattern.id,
        variantId: variant?.id,
        colorName: colorName || undefined,
        meters,
        rollNo: addRollNo.trim() || undefined,
        inAt,
        note: addNote.trim() || undefined,
      });
      setAddOpen(false);
      refreshData(selectedPattern.id);
    } catch (error) {
      setAddError(error instanceof Error ? error.message : "Top girisi kaydedilemedi");
    }
  };

  const handleReserve = () => {
    if (!reserveRollId) return;
    try {
      const dateISO = toIsoDate(reserveDate, "Tarih");
      const updated = depoLocalRepo.reserveRoll(reserveRollId, reserveFor, dateISO);
      if (!updated) throw new Error("Bu top sadece stokta iken rezerve edilebilir.");
      setReserveRollId(null);
      setReserveError("");
      refreshData(updated.patternId);
    } catch (error) {
      setReserveError(error instanceof Error ? error.message : "Rezerve islemi basarisiz");
    }
  };

  const handleShip = () => {
    if (!shipRollId) return;
    try {
      const dateISO = toIsoDate(shipDate, "Tarih");
      const updated = depoLocalRepo.shipRoll(shipRollId, shipCounterparty, dateISO);
      if (!updated) throw new Error("Bu top stokta veya rezerve olmali.");
      setShipRollId(null);
      setShipError("");
      refreshData(updated.patternId);
    } catch (error) {
      setShipError(error instanceof Error ? error.message : "Sevk islemi basarisiz");
    }
  };

  return (
    <Layout title="Depo">
      <div className="flex h-full min-h-0 flex-col gap-4">
        <div className="grid gap-3 md:grid-cols-3">
          <SummaryCard title="Toplam" meters={totalRolls.reduce((t, r) => t + r.meters, 0)} rolls={totalRolls.length} tone="neutral" />
          <SummaryCard title="Rezerve" meters={reservedRolls.reduce((t, r) => t + r.meters, 0)} rolls={reservedRolls.length} tone="amber" />
          <SummaryCard title="Kullanilabilir" meters={availableRolls.reduce((t, r) => t + r.meters, 0)} rolls={availableRolls.length} tone="emerald" />
        </div>

        <div className="grid min-h-0 h-[calc(100vh-280px)] gap-4 lg:grid-cols-[340px,1fr]">
          <aside className="min-h-0 overflow-auto rounded-2xl border border-black/5 bg-white/80 p-4 shadow-[0_10px_30px_rgba(0,0,0,0.08)]">
            <div className="space-y-3">
              <h2 className="text-lg font-semibold text-neutral-900">Desen Klasorleri</h2>
              <label className="relative block">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
                <input type="search" value={searchPattern} onChange={(e) => setSearchPattern(e.target.value)} placeholder="Kumas kodu / adi" className="w-full rounded-lg border border-black/10 bg-white px-10 py-2 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-coffee-primary" />
              </label>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
                <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-coffee-primary" />
                <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-coffee-primary" />
              </div>
              <div className="space-y-2">
                {filteredPatterns.map((pattern) => (
                  <button key={pattern.id} type="button" onClick={() => setSelectedPatternId(pattern.id)} className={cn("w-full rounded-xl border p-3 text-left transition", pattern.id === selectedPatternId ? "border-coffee-primary bg-coffee-primary/10" : "border-black/10 bg-white hover:border-coffee-primary/40")}>
                    <div className="flex gap-3">
                      <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-black/10 bg-coffee-surface">
                        {getPatternImage(pattern) ? <img src={getPatternImage(pattern)} alt={pattern.fabricName} className="h-14 w-14 object-cover" loading="lazy" /> : <span className="text-xs font-semibold text-neutral-500">Foto</span>}
                      </div>
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-neutral-900">{pattern.fabricCode} - {pattern.fabricName}</div>
                        <div className="mt-1 line-clamp-2 text-xs text-neutral-600">{shortNote(pattern.note)}</div>
                      </div>
                    </div>
                  </button>
                ))}
                {filteredPatterns.length === 0 ? <div className="rounded-xl border border-dashed border-black/10 bg-coffee-surface px-3 py-10 text-center text-sm text-neutral-500">Filtreye uygun desen yok.</div> : null}
              </div>
            </div>
          </aside>

          <section className="min-h-0 overflow-auto rounded-2xl border border-black/5 bg-white/80 p-4 shadow-[0_10px_30px_rgba(0,0,0,0.08)]">
            {!selectedPattern ? (
              <div className="flex h-full min-h-[260px] items-center justify-center rounded-xl border border-dashed border-black/10 bg-coffee-surface text-sm text-neutral-500">Sol panelden desen seciniz.</div>
            ) : (
              <div className="space-y-4">
                <div className="rounded-xl border border-black/10 bg-white p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="text-xs uppercase tracking-wide text-neutral-500">Secili Desen</div>
                      <h2 className="text-xl font-semibold text-neutral-900">{selectedPattern.fabricCode} - {selectedPattern.fabricName}</h2>
                      <p className="mt-2 text-sm text-neutral-600">{shortNote(selectedPattern.note)}</p>
                    </div>
                    <button type="button" onClick={openAddModal} className="inline-flex items-center gap-2 rounded-lg bg-coffee-primary px-3 py-2 text-sm font-semibold text-white transition hover:brightness-95"><Plus className="h-4 w-4" />Top Girisi</button>
                  </div>
                </div>

                <div className="rounded-xl border border-black/10 bg-white p-4">
                  <h3 className="text-sm font-semibold text-neutral-900">Renk Ozeti</h3>
                  <div className="mt-3 overflow-auto rounded-lg border border-black/10">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-neutral-50 text-neutral-600"><tr><th className="px-3 py-2 font-semibold">Renk</th><th className="px-3 py-2 font-semibold">Toplam</th><th className="px-3 py-2 font-semibold">Rezerve</th><th className="px-3 py-2 font-semibold">Kullanilabilir</th></tr></thead>
                      <tbody className="text-neutral-800">
                        {colorSummary.map((row) => <tr key={row.color} className="border-t border-black/5"><td className="px-3 py-2 font-medium">{row.color}</td><td className="px-3 py-2">{fmt(row.totalMeters)} m / {row.totalRolls} top</td><td className="px-3 py-2">{fmt(row.reservedMeters)} m / {row.reservedRolls} top</td><td className="px-3 py-2">{fmt(row.availableMeters)} m / {row.availableRolls} top</td></tr>)}
                        {colorSummary.length === 0 ? <tr><td colSpan={4} className="px-3 py-8 text-center text-sm text-neutral-500">Bu desen icin stok kaydi yok.</td></tr> : null}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="rounded-xl border border-black/10 bg-white p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <h3 className="text-sm font-semibold text-neutral-900">Top Listesi</h3>
                    <div className="flex flex-wrap items-center gap-2">
                      <input type="search" value={rollSearch} onChange={(e) => setRollSearch(e.target.value)} placeholder="RollNo / renk ara" className="rounded-lg border border-black/10 bg-white px-3 py-1.5 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-coffee-primary" />
                      <select value={rollStatus} onChange={(e) => setRollStatus(e.target.value as FabricRollStatus | "")} className="rounded-lg border border-black/10 bg-white px-3 py-1.5 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-coffee-primary"><option value="">Tum Durumlar</option><option value="IN_STOCK">Stokta</option><option value="RESERVED">Rezerve</option><option value="SHIPPED">Sevk</option><option value="RETURNED">Iade</option><option value="SCRAP">Hurda</option></select>
                    </div>
                  </div>
                  <div className="mt-3 overflow-auto rounded-lg border border-black/10">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-neutral-50 text-neutral-600"><tr><th className="px-3 py-2 font-semibold">Roll No</th><th className="px-3 py-2 font-semibold">Renk</th><th className="px-3 py-2 font-semibold">Metre</th><th className="px-3 py-2 font-semibold">Durum</th><th className="px-3 py-2 font-semibold">Giris</th><th className="px-3 py-2 font-semibold">Rezerve / Kime</th><th className="px-3 py-2 font-semibold">Islem</th></tr></thead>
                      <tbody className="text-neutral-800">
                        {visibleRolls.map((roll) => {
                          const partyLabel =
                            roll.status === "RESERVED"
                              ? (roll.reservedFor ?? "-")
                              : roll.status === "SHIPPED"
                                ? (roll.counterparty ?? "-")
                                : "-";
                          return (
                            <tr key={roll.id} className="border-t border-black/5">
                              <td className="px-3 py-2">{roll.rollNo ?? "-"}</td>
                              <td className="px-3 py-2">{rollColor(roll, selectedPattern)}</td>
                              <td className="px-3 py-2 font-medium">{fmt(roll.meters)} m</td>
                              <td className="px-3 py-2"><span className={cn("inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold", statusClass[roll.status])}>{statusLabel[roll.status]}</span></td>
                              <td className="px-3 py-2">{new Date(roll.inAt).toLocaleDateString("tr-TR")}</td>
                              <td className="px-3 py-2">{partyLabel}</td>
                              <td className="px-3 py-2">
                                <div className="flex flex-wrap gap-2">
                                  {roll.status === "IN_STOCK" ? <button type="button" onClick={() => { setReserveRollId(roll.id); setReserveFor(""); setReserveDate(todayInput()); setReserveError(""); }} className="rounded-lg border border-amber-500/40 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700 transition hover:bg-amber-100">Rezerve Et</button> : null}
                                  {roll.status === "RESERVED" ? <button type="button" onClick={() => { const updated = depoLocalRepo.unreserveRoll(roll.id); if (updated) refreshData(updated.patternId); }} className="rounded-lg border border-violet-500/40 bg-violet-50 px-2.5 py-1 text-xs font-semibold text-violet-700 transition hover:bg-violet-100">Rezerveyi Kaldir</button> : null}
                                  {roll.status === "IN_STOCK" || roll.status === "RESERVED" ? <button type="button" onClick={() => { setShipRollId(roll.id); setShipCounterparty(""); setShipDate(todayInput()); setShipError(""); }} className="rounded-lg border border-sky-500/40 bg-sky-50 px-2.5 py-1 text-xs font-semibold text-sky-700 transition hover:bg-sky-100">Sevk Et</button> : null}
                                  {roll.status === "SHIPPED" ? <button type="button" onClick={() => { const accepted = window.confirm("Bu top iade olarak isaretlenecek. Devam?"); if (!accepted) return; const updated = depoLocalRepo.returnRoll(roll.id, new Date().toISOString()); if (updated) refreshData(updated.patternId); }} className="rounded-lg border border-violet-500/40 bg-violet-50 px-2.5 py-1 text-xs font-semibold text-violet-700 transition hover:bg-violet-100">Iade</button> : null}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                        {visibleRolls.length === 0 ? <tr><td colSpan={7} className="px-3 py-8 text-center text-sm text-neutral-500">Filtreye uygun top kaydi yok.</td></tr> : null}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </section>
        </div>
      </div>

      {addOpen && selectedPattern ? (
        <Modal title="Top Girisi" onClose={() => setAddOpen(false)}>
          <p className="text-sm text-neutral-600">{selectedPattern.fabricCode} - {selectedPattern.fabricName}</p>
          <div className="mt-4 space-y-3">
            <select value={addVariantId} onChange={(e) => setAddVariantId(e.target.value)} className="w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-coffee-primary">{selectedPattern.variants.map((variant) => <option key={variant.id} value={variant.id}>{variantName(variant)}</option>)}<option value="__other">Diger (serbest renk)</option></select>
            {addVariantId === "__other" ? <input type="text" value={addColorName} onChange={(e) => setAddColorName(e.target.value)} placeholder="Renk adi" className="w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-coffee-primary" /> : null}
            <div className="grid grid-cols-2 gap-3">
              <input type="number" min="0" step="0.01" value={addMeters} onChange={(e) => setAddMeters(e.target.value)} placeholder="Metre" className="w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-coffee-primary" />
              <input type="text" value={addRollNo} onChange={(e) => setAddRollNo(e.target.value)} placeholder="Roll No (ops)" className="w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-coffee-primary" />
            </div>
            <input type="date" value={addDate} onChange={(e) => setAddDate(e.target.value)} className="w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-coffee-primary" />
            <input type="text" value={addNote} onChange={(e) => setAddNote(e.target.value)} placeholder="Not (ops)" className="w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-coffee-primary" />
          </div>
          {addError ? <p className="mt-3 text-sm text-rose-600">{addError}</p> : null}
          <div className="mt-4 flex justify-end gap-2">
            <button type="button" onClick={() => setAddOpen(false)} className="rounded-lg px-3 py-2 text-sm text-neutral-600 transition hover:bg-neutral-100">Vazgec</button>
            <button type="button" onClick={handleAddRoll} className="rounded-lg bg-coffee-primary px-4 py-2 text-sm font-semibold text-white transition hover:brightness-95">Kaydet</button>
          </div>
        </Modal>
      ) : null}

      {reserveRollId ? (
        <Modal title="Rezerve Et" onClose={() => setReserveRollId(null)}>
          <div className="space-y-3">
            <input type="text" value={reserveFor} onChange={(e) => setReserveFor(e.target.value)} placeholder="Rezerve kime" className="w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-coffee-primary" />
            <input type="date" value={reserveDate} onChange={(e) => setReserveDate(e.target.value)} className="w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-coffee-primary" />
          </div>
          {reserveError ? <p className="mt-3 text-sm text-rose-600">{reserveError}</p> : null}
          <div className="mt-4 flex justify-end gap-2">
            <button type="button" onClick={() => setReserveRollId(null)} className="rounded-lg px-3 py-2 text-sm text-neutral-600 transition hover:bg-neutral-100">Vazgec</button>
            <button type="button" onClick={handleReserve} className="rounded-lg bg-coffee-primary px-4 py-2 text-sm font-semibold text-white transition hover:brightness-95">Kaydet</button>
          </div>
        </Modal>
      ) : null}

      {shipRollId ? (
        <Modal title="Sevk Et" onClose={() => setShipRollId(null)}>
          <div className="space-y-3">
            <input type="text" value={shipCounterparty} onChange={(e) => setShipCounterparty(e.target.value)} placeholder="Musteri / karsi taraf" className="w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-coffee-primary" />
            <input type="date" value={shipDate} onChange={(e) => setShipDate(e.target.value)} className="w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-coffee-primary" />
          </div>
          {shipError ? <p className="mt-3 text-sm text-rose-600">{shipError}</p> : null}
          <div className="mt-4 flex justify-end gap-2">
            <button type="button" onClick={() => setShipRollId(null)} className="rounded-lg px-3 py-2 text-sm text-neutral-600 transition hover:bg-neutral-100">Vazgec</button>
            <button type="button" onClick={handleShip} className="rounded-lg bg-coffee-primary px-4 py-2 text-sm font-semibold text-white transition hover:brightness-95">Kaydet</button>
          </div>
        </Modal>
      ) : null}
    </Layout>
  );
}

type SummaryCardProps = {
  title: string;
  meters: number;
  rolls: number;
  tone: "neutral" | "amber" | "emerald";
};

function SummaryCard({ title, meters, rolls, tone }: SummaryCardProps) {
  const toneClass =
    tone === "amber"
      ? "border-amber-500/30 bg-amber-50"
      : tone === "emerald"
        ? "border-emerald-500/30 bg-emerald-50"
        : "border-black/10 bg-white";
  return (
    <div className={cn("rounded-xl border p-4 shadow-[0_8px_20px_rgba(0,0,0,0.05)]", toneClass)}>
      <div className="text-xs uppercase tracking-wide text-neutral-500">{title}</div>
      <div className="mt-2 text-lg font-semibold text-neutral-900">{fmt(meters)} m</div>
      <div className="text-sm text-neutral-600">{rolls} top</div>
    </div>
  );
}

type ModalProps = {
  title: string;
  children: ReactNode;
  onClose: () => void;
};

function Modal({ title, children, onClose }: ModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl border border-black/10 bg-white p-5 shadow-2xl" onClick={(event) => event.stopPropagation()}>
        <h3 className="text-lg font-semibold text-neutral-900">{title}</h3>
        <div className="mt-2">{children}</div>
      </div>
    </div>
  );
}
