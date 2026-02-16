"use client";

import Link from "next/link";
import { Fragment, type ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import { ExternalLink, Plus, Search } from "lucide-react";
import Layout from "@/components/Layout";
import { cn } from "@/lib/cn";
import type { FabricRoll, FabricRollStatus } from "@/lib/domain/depo";
import type { Customer } from "@/lib/domain/customer";
import type { DepoTransaction, DepoTransactionLine, DepoTransactionType } from "@/lib/domain/depoTransaction";
import type { Pattern, Variant } from "@/lib/domain/pattern";
import { customersLocalRepo, normalizeCustomerName } from "@/lib/repos/customersLocalRepo";
import { depoLocalRepo } from "@/lib/repos/depoLocalRepo";
import { depoTransactionsLocalRepo } from "@/lib/repos/depoTransactionsLocalRepo";
import { patternsLocalRepo } from "@/lib/repos/patternsLocalRepo";

type PatternMeta = Pattern & Partial<{ __deleted?: boolean }>;
type DepoTab = "stock" | "tx";
type BulkActionType = "SHIPMENT" | "RESERVATION";
type ColorSummary = {
  color: string;
  totalMeters: number;
  totalRolls: number;
  reservedMeters: number;
  reservedRolls: number;
  availableMeters: number;
  availableRolls: number;
};
type RollGroup = {
  key: string;
  patternId: string;
  patternNoSnapshot: string;
  patternNameSnapshot: string;
  colorName: string;
  meters: number;
  rolls: FabricRoll[];
  inStockRolls: FabricRoll[];
  reservedRolls: FabricRoll[];
  shippedRolls: FabricRoll[];
  availableCount: number;
  reservedCount: number;
  totalCount: number;
  totalMeters: number;
  availableMeters: number;
  reservedMeters: number;
};

type SelectedLineDraft = {
  rowKey: string;
  patternId: string;
  patternNoSnapshot: string;
  patternNameSnapshot: string;
  color: string;
  metrePerTop: number;
  topCount: number;
  totalMetres: number;
  rollIds: string[];
};

type HistoryRow = {
  transaction: DepoTransaction;
  lines: DepoTransactionLine[];
  totals: { totalTops: number; totalMetres: number; patternCount: number };
};

const statusLabel: Record<FabricRollStatus, string> = {
  IN_STOCK: "Stokta",
  RESERVED: "Rezerve",
  SHIPPED: "Sevk",
  RETURNED: "Iade",
  VOIDED: "İptal (Yanlış giriş)",
  SCRAP: "Hurda",
};

const statusClass: Record<FabricRollStatus, string> = {
  IN_STOCK: "border-emerald-500/30 bg-emerald-50 text-emerald-700",
  RESERVED: "border-amber-500/30 bg-amber-50 text-amber-700",
  SHIPPED: "border-sky-500/30 bg-sky-50 text-sky-700",
  RETURNED: "border-violet-500/30 bg-violet-50 text-violet-700",
  VOIDED: "border-slate-400/40 bg-slate-100 text-slate-700",
  SCRAP: "border-rose-500/30 bg-rose-50 text-rose-700",
};
const statusSortPriority: Record<FabricRollStatus, number> = {
  IN_STOCK: 0,
  RESERVED: 1,
  RETURNED: 2,
  VOIDED: 3,
  SCRAP: 4,
  SHIPPED: 5,
};

const transactionTypeLabel: Record<DepoTransactionType, string> = {
  SHIPMENT: "Sevk",
  RESERVATION: "Rezerv",
  REVERSAL: "Geri Alma",
  ADJUSTMENT: "Duzeltme",
};

const todayInput = () => new Date().toISOString().slice(0, 10);
const fmt = (n: number) => n.toLocaleString("tr-TR", { maximumFractionDigits: 2 });
const normalizeSearchToken = (value: string) =>
  value.trim().toLocaleLowerCase("tr-TR").replace(/\s+/g, " ");
const toColorKey = (value: string) => normalizeSearchToken(value) || "renk-yok";
const buildRowKey = (patternId: string, color: string, metrePerTop: number) =>
  `${patternId}|${toColorKey(color)}|${metrePerTop}`;

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

const toPositiveInt = (value: string, label: string) => {
  const parsed = Number(value.trim());
  if (!Number.isFinite(parsed) || !Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${label} 1 veya daha buyuk tam sayi olmali`);
  }
  return parsed;
};

const toTimestamp = (value: string) => {
  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
};

const formatDateTime = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("tr-TR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
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
  return Array.from(map.values())
    .filter((row) => row.totalRolls > 0 || row.availableRolls > 0 || row.reservedRolls > 0)
    .sort((a, b) => a.color.localeCompare(b.color, "tr-TR"));
};

const calculateTotalsFromLines = (lines: DepoTransactionLine[]) => {
  const patternIds = new Set<string>();
  let totalTops = 0;
  let totalMetres = 0;

  lines.forEach((line) => {
    patternIds.add(line.patternId);
    totalTops += line.topCount;
    totalMetres += line.totalMetres;
  });

  return {
    totalTops,
    totalMetres,
    patternCount: patternIds.size,
  };
};

export default function DepoPage() {
  const [activeTab, setActiveTab] = useState<DepoTab>("stock");

  const [patterns, setPatterns] = useState<Pattern[]>([]);
  const [rolls, setRolls] = useState<FabricRoll[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [transactions, setTransactions] = useState<DepoTransaction[]>([]);
  const [transactionLines, setTransactionLines] = useState<DepoTransactionLine[]>([]);
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
  const [addQty, setAddQty] = useState("1");
  const [addRollNo, setAddRollNo] = useState("");
  const [addDate, setAddDate] = useState(todayInput());
  const [addNote, setAddNote] = useState("");
  const [addError, setAddError] = useState("");

  const [selectedByRowKey, setSelectedByRowKey] = useState<Record<string, number>>({});
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(() => new Set());

  const [bulkActionType, setBulkActionType] = useState<BulkActionType | null>(null);
  const [bulkCustomerInput, setBulkCustomerInput] = useState("");
  const [bulkCustomerId, setBulkCustomerId] = useState<string | null>(null);
  const [bulkNote, setBulkNote] = useState("");
  const [bulkError, setBulkError] = useState("");
  const [bulkWarning, setBulkWarning] = useState("");

  const [historyCustomerQuery, setHistoryCustomerQuery] = useState("");
  const [historyFeedback, setHistoryFeedback] = useState("");
  const [detailTransactionId, setDetailTransactionId] = useState<string | null>(null);

  const [editRollId, setEditRollId] = useState<string | null>(null);
  const [editMeters, setEditMeters] = useState("");
  const [editRollNo, setEditRollNo] = useState("");
  const [editColorName, setEditColorName] = useState("");
  const [editNote, setEditNote] = useState("");
  const [editError, setEditError] = useState("");

  const [voidRollId, setVoidRollId] = useState<string | null>(null);
  const [voidReason, setVoidReason] = useState("");
  const [voidError, setVoidError] = useState("");

  const refreshData = (preferredPatternId?: string | null) => {
    const nextPatterns = sortPatterns(patternsLocalRepo.list().filter(isPatternVisible));
    const nextRolls = depoLocalRepo.listRolls();
    const nextCustomers = customersLocalRepo.list();
    const nextTransactions = depoTransactionsLocalRepo.listTransactions();
    const nextTransactionLines = depoTransactionsLocalRepo.listLines();
    setPatterns(nextPatterns);
    setRolls(nextRolls);
    setCustomers(nextCustomers);
    setTransactions(nextTransactions);
    setTransactionLines(nextTransactionLines);
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
    const normalized = normalizeSearchToken(searchPattern);
    const hasDateFilter = !!dateFrom || !!dateTo;
    const patternIds = new Set(rollsInRange.map((roll) => roll.patternId));
    return patterns.filter((pattern) => {
      if (hasDateFilter && !patternIds.has(pattern.id)) return false;
      if (!normalized) return true;
      return (
        normalizeSearchToken(pattern.fabricCode).includes(normalized) ||
        normalizeSearchToken(pattern.fabricName).includes(normalized)
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
    return rollsInRange.filter(
      (roll) =>
        roll.patternId === selectedPattern.id &&
        roll.status !== "VOIDED" &&
        (roll.status === "IN_STOCK" || roll.status === "RESERVED")
    );
  }, [rollsInRange, selectedPattern]);

  const groupRolls = useCallback((sourceRolls: FabricRoll[]) => {
    if (!selectedPattern) return [] as RollGroup[];

    const groups = new Map<string, RollGroup>();

    sourceRolls.forEach((roll) => {
      const colorName = rollColor(roll, selectedPattern);
      const key = buildRowKey(selectedPattern.id, colorName, roll.meters);

      if (!groups.has(key)) {
        groups.set(key, {
          key,
          patternId: selectedPattern.id,
          patternNoSnapshot: selectedPattern.fabricCode,
          patternNameSnapshot: selectedPattern.fabricName,
          colorName,
          meters: roll.meters,
          rolls: [],
          inStockRolls: [],
          reservedRolls: [],
          shippedRolls: [],
          availableCount: 0,
          reservedCount: 0,
          totalCount: 0,
          totalMeters: 0,
          availableMeters: 0,
          reservedMeters: 0,
        });
      }

      groups.get(key)!.rolls.push(roll);
    });

    return Array.from(groups.values())
      .map((group) => {
        const sortedRolls = [...group.rolls].sort((a, b) => {
          const byStatus = statusSortPriority[a.status] - statusSortPriority[b.status];
          if (byStatus !== 0) return byStatus;
          return toTimestamp(b.inAt) - toTimestamp(a.inAt);
        });
        const inStockRolls = sortedRolls
          .filter((roll) => roll.status === "IN_STOCK")
          .sort((a, b) => toTimestamp(a.inAt) - toTimestamp(b.inAt));
        const reservedRolls = sortedRolls.filter((roll) => roll.status === "RESERVED");
        const shippedRolls = sortedRolls.filter((roll) => roll.status === "SHIPPED");
        const totalCount = sortedRolls.length;
        const availableCount = inStockRolls.length;
        const reservedCount = reservedRolls.length;
        return {
          ...group,
          rolls: sortedRolls,
          inStockRolls,
          reservedRolls,
          shippedRolls,
          totalCount,
          availableCount,
          reservedCount,
          totalMeters: totalCount * group.meters,
          availableMeters: availableCount * group.meters,
          reservedMeters: reservedCount * group.meters,
        };
      })
      .filter((group) => {
        const activeCount =
          group.inStockRolls.length + group.reservedRolls.length + group.shippedRolls.length;
        return group.totalCount > 0 && activeCount > 0;
      })
      .sort((a, b) => {
        const byColor = a.colorName.localeCompare(b.colorName, "tr-TR");
        if (byColor !== 0) return byColor;
        return a.meters - b.meters;
      });
  }, [selectedPattern]);

  const visibleRolls = useMemo(() => {
    const normalized = normalizeSearchToken(rollSearch);
    return selectedPatternRolls
      .filter((roll) => {
        if (rollStatus && roll.status !== rollStatus) return false;
        if (!normalized) return true;
        const no = normalizeSearchToken(roll.rollNo ?? "");
        const color = selectedPattern ? normalizeSearchToken(rollColor(roll, selectedPattern)) : "";
        return no.includes(normalized) || color.includes(normalized);
      })
      .sort((a, b) => {
        const byStatus = statusSortPriority[a.status] - statusSortPriority[b.status];
        if (byStatus !== 0) return byStatus;
        return toTimestamp(b.inAt) - toTimestamp(a.inAt);
      });
  }, [selectedPatternRolls, selectedPattern, rollSearch, rollStatus]);
  const allGroups = useMemo(() => groupRolls(selectedPatternRolls), [selectedPatternRolls, groupRolls]);
  const groupedRolls = useMemo(() => groupRolls(visibleRolls), [visibleRolls, groupRolls]);
  const renderedGroups = useMemo(
    () => groupedRolls.filter((group) => group.totalCount > 0),
    [groupedRolls]
  );
  const allGroupsByKey = useMemo(() => {
    const map = new Map<string, RollGroup>();
    allGroups.forEach((group) => {
      map.set(group.key, group);
    });
    return map;
  }, [allGroups]);

  const selectedCount = useMemo(
    () => Object.values(selectedByRowKey).reduce((total, value) => total + (value > 0 ? value : 0), 0),
    [selectedByRowKey]
  );
  const selectedMeters = useMemo(
    () =>
      Object.entries(selectedByRowKey).reduce((total, [rowKey, value]) => {
        if (value <= 0) return total;
        const group = allGroupsByKey.get(rowKey);
        if (!group) return total;
        return total + value * group.meters;
      }, 0),
    [selectedByRowKey, allGroupsByKey]
  );

  const selectedLineDrafts = useMemo(() => {
    const drafts: SelectedLineDraft[] = [];
    Object.entries(selectedByRowKey).forEach(([rowKey, value]) => {
      if (value <= 0) return;
      const group = allGroupsByKey.get(rowKey);
      if (!group) return;
      const topCount = Math.min(value, group.availableCount);
      if (topCount <= 0) return;
      drafts.push({
        rowKey,
        patternId: group.patternId,
        patternNoSnapshot: group.patternNoSnapshot,
        patternNameSnapshot: group.patternNameSnapshot,
        color: group.colorName,
        metrePerTop: group.meters,
        topCount,
        totalMetres: topCount * group.meters,
        rollIds: group.inStockRolls.slice(0, topCount).map((roll) => roll.id),
      });
    });
    return drafts;
  }, [selectedByRowKey, allGroupsByKey]);

  useEffect(() => {
    setSelectedByRowKey((current) => {
      const next: Record<string, number> = {};
      Object.entries(current).forEach(([rowKey, value]) => {
        const group = allGroupsByKey.get(rowKey);
        if (!group) return;
        const clamped = Math.max(0, Math.min(group.availableCount, value));
        if (clamped > 0) next[rowKey] = clamped;
      });
      const sameLength = Object.keys(next).length === Object.keys(current).length;
      const isSame =
        sameLength &&
        Object.entries(next).every(([key, value]) => (current[key] ?? 0) === value);
      return isSame ? current : next;
    });
  }, [allGroupsByKey]);

  useEffect(() => {
    const groupKeys = new Set(renderedGroups.map((group) => group.key));
    setExpandedGroups((current) => {
      if (current.size === 0) return current;
      let changed = false;
      const next = new Set<string>();
      current.forEach((key) => {
        if (groupKeys.has(key)) {
          next.add(key);
          return;
        }
        changed = true;
      });
      return changed ? next : current;
    });
  }, [renderedGroups]);

  useEffect(() => {
    setSelectedByRowKey({});
    setExpandedGroups(new Set());
  }, [selectedPatternId]);

  const colorSummary = useMemo(() => (selectedPattern ? buildColorSummary(selectedPatternRolls, selectedPattern) : []), [selectedPatternRolls, selectedPattern]);

  const totalRolls = rollsInRange.filter((roll) => roll.status === "IN_STOCK" || roll.status === "RESERVED");
  const reservedRolls = rollsInRange.filter((roll) => roll.status === "RESERVED");
  const availableRolls = rollsInRange.filter((roll) => roll.status === "IN_STOCK");

  const openAddModal = () => {
    if (!selectedPattern) return;
    setAddVariantId(selectedPattern.variants[0]?.id ?? "__other");
    setAddColorName("");
    setAddMeters("");
    setAddQty("1");
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
      const qty = toPositiveInt(addQty, "Adet");
      const inAt = toIsoDate(addDate, "Giris tarihi");
      const variant = addVariantId !== "__other" ? selectedPattern.variants.find((item) => item.id === addVariantId) : undefined;
      const colorName = addVariantId === "__other" ? addColorName.trim() : variant?.colorName ?? variant?.name ?? "";
      const baseRollNo = addRollNo.trim();
      if (!colorName && !variant) throw new Error("Renk seciniz.");

      let addedCount = 0;
      for (let index = 0; index < qty; index += 1) {
        const rollNo =
          !baseRollNo
            ? undefined
            : index === 0
              ? baseRollNo
              : `${baseRollNo}-${index + 1}`;

        try {
          depoLocalRepo.addRoll({
            patternId: selectedPattern.id,
            variantId: variant?.id,
            colorName: colorName || undefined,
            meters,
            rollNo,
            inAt,
            note: addNote.trim() || undefined,
          });
          addedCount += 1;
        } catch (error) {
          const reason = error instanceof Error ? error.message : "Bilinmeyen hata";
          if (addedCount === 0) {
            throw error;
          }
          setAddError(`${addedCount}/${qty} top eklendi. Kalani eklenemedi: ${reason}`);
          refreshData(selectedPattern.id);
          return;
        }
      }
      setAddOpen(false);
      refreshData(selectedPattern.id);
    } catch (error) {
      setAddError(error instanceof Error ? error.message : "Top girisi kaydedilemedi");
    }
  };

  const setRowSelectionCount = (groupKey: string, nextValue: number, maxCount: number) => {
    const clamped = Math.max(0, Math.min(maxCount, nextValue));
    setSelectedByRowKey((current) => {
      if (clamped <= 0) {
        if (current[groupKey] === undefined) return current;
        const next = { ...current };
        delete next[groupKey];
        return next;
      }
      if (current[groupKey] === clamped) return current;
      return { ...current, [groupKey]: clamped };
    });
  };

  const toggleGroupDetail = (groupKey: string) => {
    setExpandedGroups((current) => {
      const next = new Set(current);
      if (next.has(groupKey)) {
        next.delete(groupKey);
      } else {
        next.add(groupKey);
      }
      return next;
    });
  };

  const openBulkModal = (type: BulkActionType) => {
    if (selectedCount <= 0) return;
    setBulkActionType(type);
    setBulkCustomerInput("");
    setBulkCustomerId(null);
    setBulkNote("");
    setBulkError("");
  };

  const closeBulkModal = () => {
    setBulkActionType(null);
    setBulkError("");
  };

  const normalizedBulkCustomer = normalizeCustomerName(bulkCustomerInput);
  const customerSuggestions = useMemo(() => {
    if (!normalizedBulkCustomer) return customers.slice(0, 8);
    return customers
      .filter((customer) => customer.nameNormalized.includes(normalizedBulkCustomer))
      .slice(0, 8);
  }, [customers, normalizedBulkCustomer]);

  const exactCustomerMatch = useMemo(() => {
    if (!normalizedBulkCustomer) return undefined;
    return customers.find((customer) => customer.nameNormalized === normalizedBulkCustomer);
  }, [customers, normalizedBulkCustomer]);

  const handleBulkActionConfirm = () => {
    if (!bulkActionType) return;
    if (selectedLineDrafts.length === 0) {
      setBulkError("Secili top bulunamadi.");
      return;
    }

    try {
      const customerInput = bulkCustomerInput.trim();
      if (!customerInput) throw new Error("Musteri secimi zorunlu.");

      let customer = bulkCustomerId ? customersLocalRepo.get(bulkCustomerId) : undefined;
      if (!customer && exactCustomerMatch) customer = exactCustomerMatch;
      if (!customer) customer = customersLocalRepo.ensureByName(customerInput);

      const createdAt = new Date().toISOString();
      const lineInputs: Array<Omit<DepoTransactionLine, "id" | "transactionId">> = [];
      let failedRollCount = 0;

      selectedLineDrafts.forEach((lineDraft) => {
        const successRollIds: string[] = [];

        lineDraft.rollIds.forEach((rollId) => {
          const updated =
            bulkActionType === "SHIPMENT"
              ? depoLocalRepo.shipRoll(rollId, customer!.nameOriginal, createdAt)
              : depoLocalRepo.reserveRoll(rollId, customer!.nameOriginal, createdAt);

          if (updated) successRollIds.push(rollId);
          else failedRollCount += 1;
        });

        if (successRollIds.length > 0) {
          lineInputs.push({
            patternId: lineDraft.patternId,
            patternNoSnapshot: lineDraft.patternNoSnapshot,
            patternNameSnapshot: lineDraft.patternNameSnapshot,
            color: lineDraft.color,
            metrePerTop: lineDraft.metrePerTop,
            topCount: successRollIds.length,
            totalMetres: successRollIds.length * lineDraft.metrePerTop,
            rollIds: successRollIds,
          });
        }
      });

      if (lineInputs.length === 0) {
        throw new Error("Islem uygulanamadi. Secili toplar guncellenemedi.");
      }

      depoTransactionsLocalRepo.createTransaction({
        type: bulkActionType,
        createdAt,
        customerId: customer.id,
        customerNameSnapshot: customer.nameOriginal,
        note: bulkNote.trim() || undefined,
        lines: lineInputs,
      });

      if (failedRollCount > 0) setBulkWarning(`${failedRollCount} top isleme alinamadi.`);
      else setBulkWarning("");

      setSelectedByRowKey({});
      closeBulkModal();
      refreshData(selectedPattern?.id ?? null);
    } catch (error) {
      setBulkError(error instanceof Error ? error.message : "Toplu islem basarisiz");
    }
  };

  const historyRows = useMemo<HistoryRow[]>(() => {
    const normalizedQuery = normalizeSearchToken(historyCustomerQuery);
    const baseTransactions = transactions.filter(
      (transaction) => transaction.type === "SHIPMENT" || transaction.type === "RESERVATION"
    );

    return baseTransactions
      .filter((transaction) => {
        if (!normalizedQuery) return true;
        return normalizeSearchToken(transaction.customerNameSnapshot ?? "").includes(normalizedQuery);
      })
      .map((transaction) => {
        const lines = transactionLines.filter((line) => line.transactionId === transaction.id);
        return {
          transaction,
          lines,
          totals: transaction.totals ?? calculateTotalsFromLines(lines),
        };
      });
  }, [transactions, transactionLines, historyCustomerQuery]);

  const detailRow = useMemo(
    () => historyRows.find((row) => row.transaction.id === detailTransactionId) ?? null,
    [historyRows, detailTransactionId]
  );

  const detailLineGroups = useMemo(() => {
    if (!detailRow) return [];
    const groups = new Map<
      string,
      {
        key: string;
        patternNoSnapshot: string;
        patternNameSnapshot: string;
        lines: DepoTransactionLine[];
        totalTop: number;
        totalMetre: number;
      }
    >();

    detailRow.lines.forEach((line) => {
      const key = `${line.patternId}|${line.patternNoSnapshot}`;
      if (!groups.has(key)) {
        groups.set(key, {
          key,
          patternNoSnapshot: line.patternNoSnapshot,
          patternNameSnapshot: line.patternNameSnapshot,
          lines: [],
          totalTop: 0,
          totalMetre: 0,
        });
      }
      const group = groups.get(key)!;
      group.lines.push(line);
      group.totalTop += line.topCount;
      group.totalMetre += line.totalMetres;
    });

    return Array.from(groups.values()).sort((a, b) =>
      a.patternNoSnapshot.localeCompare(b.patternNoSnapshot, "tr-TR")
    );
  }, [detailRow]);

  const handleReverseTransaction = () => {
    if (!detailRow) return;
    const target = detailRow.transaction;
    if (target.status === "REVERSED") return;

    if (!window.confirm(`${transactionTypeLabel[target.type]} islemini geri almak istiyor musunuz?`)) return;

    try {
      const createdAt = new Date().toISOString();
      const reversalLines: Array<Omit<DepoTransactionLine, "id" | "transactionId">> = [];
      let failedCount = 0;

      detailRow.lines.forEach((line) => {
        const candidateRollIds = [...(line.rollIds ?? [])];
        const successRollIds: string[] = [];

        candidateRollIds.forEach((rollId) => {
          const updated =
            target.type === "SHIPMENT"
              ? depoLocalRepo.returnRoll(rollId, createdAt)
              : depoLocalRepo.unreserveRoll(rollId);

          if (updated) successRollIds.push(rollId);
          else failedCount += 1;
        });

        if (successRollIds.length > 0) {
          reversalLines.push({
            patternId: line.patternId,
            patternNoSnapshot: line.patternNoSnapshot,
            patternNameSnapshot: line.patternNameSnapshot,
            color: line.color,
            metrePerTop: line.metrePerTop,
            topCount: successRollIds.length,
            totalMetres: successRollIds.length * line.metrePerTop,
            rollIds: successRollIds,
          });
        }
      });

      if (reversalLines.length === 0) throw new Error("Geri alinabilecek satir bulunamadi.");

      const reversalTransaction = depoTransactionsLocalRepo.createTransaction({
        type: "REVERSAL",
        createdAt,
        customerId: target.customerId,
        customerNameSnapshot: target.customerNameSnapshot,
        note: `Geri alma: ${target.id}`,
        targetTransactionId: target.id,
        lines: reversalLines,
      });

      depoTransactionsLocalRepo.markTransactionReversed(target.id, reversalTransaction.id, createdAt);
      setHistoryFeedback(failedCount > 0 ? `${failedCount} top geri alinamadi.` : "Islem geri alindi.");
      refreshData(selectedPattern?.id ?? null);
    } catch (error) {
      setHistoryFeedback(error instanceof Error ? error.message : "Geri alma basarisiz");
    }
  };

  const openEditRollModal = (roll: FabricRoll) => {
    const pattern = patterns.find((item) => item.id === roll.patternId);
    const colorName = pattern ? rollColor(roll, pattern) : roll.colorName?.trim() || "";
    setEditRollId(roll.id);
    setEditMeters(String(roll.meters));
    setEditRollNo(roll.rollNo ?? "");
    setEditColorName(colorName);
    setEditNote(roll.note ?? "");
    setEditError("");
  };

  const closeEditRollModal = () => {
    setEditRollId(null);
    setEditError("");
  };

  const editingRoll = useMemo(
    () => (editRollId ? rolls.find((roll) => roll.id === editRollId) ?? null : null),
    [editRollId, rolls]
  );

  const handleSaveRollEdit = () => {
    if (!editingRoll) return;
    try {
      const nextMeters = toPositiveNumber(editMeters, "Metre");
      const nextColorName = editColorName.trim();
      if (!nextColorName) throw new Error("Renk gerekli.");

      const updated = depoLocalRepo.editRoll(editingRoll.id, {
        meters: nextMeters,
        rollNo: editRollNo.trim() || undefined,
        colorName: nextColorName,
        note: editNote.trim() || undefined,
      });
      if (!updated) throw new Error("Top duzeltilemedi.");

      const pattern = patterns.find((item) => item.id === updated.patternId);
      depoTransactionsLocalRepo.createTransaction({
        type: "ADJUSTMENT",
        createdAt: new Date().toISOString(),
        note: `Top duzeltme: ${fmt(editingRoll.meters)} -> ${fmt(nextMeters)} m`,
        lines: [
          {
            patternId: updated.patternId,
            patternNoSnapshot: pattern?.fabricCode ?? updated.patternId,
            patternNameSnapshot: pattern?.fabricName ?? "Silinmis Desen",
            color: nextColorName,
            metrePerTop: updated.meters,
            topCount: 1,
            totalMetres: updated.meters,
            rollIds: [updated.id],
          },
        ],
      });

      closeEditRollModal();
      refreshData(selectedPattern?.id ?? null);
    } catch (error) {
      setEditError(error instanceof Error ? error.message : "Top duzeltme basarisiz");
    }
  };

  const openVoidRollModal = (rollId: string) => {
    setVoidRollId(rollId);
    setVoidReason("");
    setVoidError("");
  };

  const closeVoidRollModal = () => {
    setVoidRollId(null);
    setVoidReason("");
    setVoidError("");
  };

  const voidingRoll = useMemo(
    () => (voidRollId ? rolls.find((roll) => roll.id === voidRollId) ?? null : null),
    [voidRollId, rolls]
  );

  const handleVoidRoll = () => {
    if (!voidingRoll) return;

    try {
      const createdAt = new Date().toISOString();
      const reason = voidReason.trim() || "Manuel kaldirma";
      const updated = depoLocalRepo.voidRoll(voidingRoll.id, createdAt, reason);
      if (!updated) {
        throw new Error("Sadece stokta olan top kaldirilabilir.");
      }

      const pattern = patterns.find((item) => item.id === voidingRoll.patternId);
      const color = pattern ? rollColor(voidingRoll, pattern) : voidingRoll.colorName?.trim() || "Renk yok";
      depoTransactionsLocalRepo.createTransaction({
        type: "ADJUSTMENT",
        createdAt,
        note: `VOID: ${reason}`,
        lines: [
          {
            patternId: voidingRoll.patternId,
            patternNoSnapshot: pattern?.fabricCode ?? voidingRoll.patternId,
            patternNameSnapshot: pattern?.fabricName ?? "Silinmis Desen",
            color,
            metrePerTop: voidingRoll.meters,
            topCount: 1,
            totalMetres: voidingRoll.meters,
            rollIds: [voidingRoll.id],
          },
        ],
      });

      setHistoryFeedback("Top girisi void (kaldirildi) olarak isaretlendi.");
      closeVoidRollModal();
      refreshData(selectedPattern?.id ?? null);
    } catch (error) {
      setVoidError(error instanceof Error ? error.message : "Top kaldirma islemi basarisiz");
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
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-black/10 bg-white p-2">
          <button
            type="button"
            onClick={() => setActiveTab("stock")}
            className={cn(
              "rounded-lg px-3 py-1.5 text-sm font-semibold transition",
              activeTab === "stock"
                ? "bg-coffee-primary/10 text-coffee-primary"
                : "text-neutral-700 hover:bg-neutral-100"
            )}
          >
            Stok
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("tx")}
            className={cn(
              "rounded-lg px-3 py-1.5 text-sm font-semibold transition",
              activeTab === "tx"
                ? "bg-coffee-primary/10 text-coffee-primary"
                : "text-neutral-700 hover:bg-neutral-100"
            )}
          >
            Sevk/Rezerv
          </button>
        </div>

        {activeTab === "stock" ? (
        <div className="grid min-h-0 h-[calc(100vh-320px)] gap-4 lg:grid-cols-[340px,1fr]">
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
                      <select value={rollStatus} onChange={(e) => setRollStatus(e.target.value as FabricRollStatus | "")} className="rounded-lg border border-black/10 bg-white px-3 py-1.5 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-coffee-primary"><option value="">Tum Durumlar</option><option value="IN_STOCK">Stokta</option><option value="RESERVED">Rezerve</option></select>
                    </div>
                  </div>
                  {selectedCount > 0 ? (
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-sky-500/30 bg-sky-50 px-3 py-2 text-sm text-sky-900">
                      <span className="font-semibold">
                        Secili: {selectedCount} top / {fmt(selectedMeters)} m
                      </span>
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => openBulkModal("SHIPMENT")}
                          className="rounded-lg border border-sky-500/40 bg-white px-2.5 py-1 text-xs font-semibold text-sky-700 transition hover:bg-sky-100"
                        >
                          Toplu Sevk Et
                        </button>
                        <button
                          type="button"
                          onClick={() => openBulkModal("RESERVATION")}
                          className="rounded-lg border border-amber-500/40 bg-white px-2.5 py-1 text-xs font-semibold text-amber-700 transition hover:bg-amber-100"
                        >
                          Toplu Rezerv Yap
                        </button>
                        <button
                          type="button"
                          onClick={() => setSelectedByRowKey({})}
                          className="rounded-lg border border-black/10 bg-white px-2.5 py-1 text-xs font-semibold text-neutral-700 transition hover:bg-neutral-100"
                        >
                          Secimi Temizle
                        </button>
                      </div>
                    </div>
                  ) : null}
                  {bulkWarning ? <p className="mt-2 text-xs font-medium text-rose-700">{bulkWarning}</p> : null}
                  <div className="mt-3 overflow-auto rounded-lg border border-black/10">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-neutral-50 text-neutral-600"><tr><th className="px-3 py-2 font-semibold">Renk</th><th className="px-3 py-2 font-semibold">Metre</th><th className="px-3 py-2 font-semibold">Toplam Top</th><th className="px-3 py-2 font-semibold">Kullanilabilir Top</th><th className="px-3 py-2 font-semibold">Rezerve</th><th className="px-3 py-2 font-semibold">Secilecek</th><th className="px-3 py-2 font-semibold">Islem</th></tr></thead>
                      <tbody className="text-neutral-800">
                        {renderedGroups.map((group) => {
                          const selectedForGroup = selectedByRowKey[group.key] ?? 0;
                          return (
                            <Fragment key={group.key}>
                              <tr className="border-t border-black/5">
                                <td className="px-3 py-2 font-medium">{group.colorName}</td>
                                <td className="px-3 py-2">{fmt(group.meters)} m</td>
                                <td className="px-3 py-2">{group.totalCount} top ({fmt(group.totalMeters)} m)</td>
                                <td className="px-3 py-2">{group.availableCount} top ({fmt(group.availableMeters)} m)</td>
                                <td className="px-3 py-2">{group.reservedCount} top ({fmt(group.reservedMeters)} m)</td>
                                <td className="px-3 py-2">
                                  <div className="inline-flex items-center gap-2 rounded-lg border border-black/10 px-2 py-1">
                                    <button
                                      type="button"
                                      onClick={() => setRowSelectionCount(group.key, selectedForGroup - 1, group.availableCount)}
                                      disabled={selectedForGroup <= 0}
                                      className="h-6 w-6 rounded border border-black/10 text-sm font-semibold text-neutral-700 disabled:cursor-not-allowed disabled:opacity-40"
                                    >
                                      -
                                    </button>
                                    <span className="min-w-8 text-center text-sm font-semibold text-neutral-800">{selectedForGroup}</span>
                                    <button
                                      type="button"
                                      onClick={() => setRowSelectionCount(group.key, selectedForGroup + 1, group.availableCount)}
                                      disabled={selectedForGroup >= group.availableCount}
                                      className="h-6 w-6 rounded border border-black/10 text-sm font-semibold text-neutral-700 disabled:cursor-not-allowed disabled:opacity-40"
                                    >
                                      +
                                    </button>
                                  </div>
                                </td>
                                <td className="px-3 py-2">
                                  <button
                                    type="button"
                                    onClick={() => toggleGroupDetail(group.key)}
                                    className="text-xs font-semibold text-neutral-600 underline-offset-2 hover:underline"
                                  >
                                    {expandedGroups.has(group.key) ? "Detayi Gizle" : "Detay"}
                                  </button>
                                </td>
                              </tr>
                              {expandedGroups.has(group.key) ? (
                                <tr className="border-t border-black/5 bg-neutral-50/70">
                                  <td colSpan={7} className="px-3 py-2">
                                    <div className="overflow-auto rounded-lg border border-black/10 bg-white">
                                      <table className="w-full text-left text-xs">
                                        <thead className="bg-neutral-50 text-neutral-600">
                                          <tr>
                                            <th className="px-2 py-1.5 font-semibold">Roll No</th>
                                            <th className="px-2 py-1.5 font-semibold">Durum</th>
                                            <th className="px-2 py-1.5 font-semibold">Giris</th>
                                            <th className="px-2 py-1.5 font-semibold">Musteri</th>
                                            <th className="px-2 py-1.5 font-semibold">Not</th>
                                            <th className="px-2 py-1.5 font-semibold">Aksiyon</th>
                                          </tr>
                                        </thead>
                                        <tbody className="text-neutral-700">
                                          {group.rolls.map((roll) => {
                                            const canAdjust = roll.status === "IN_STOCK" || roll.status === "RESERVED";
                                            const canVoid = roll.status === "IN_STOCK";
                                            return (
                                              <tr key={roll.id} className="border-t border-black/5">
                                                <td className="px-2 py-1.5">{roll.rollNo ?? roll.id.slice(0, 8)}</td>
                                                <td className="px-2 py-1.5">
                                                  <span className={cn("inline-flex rounded-full border px-1.5 py-0.5 text-[10px] font-semibold", statusClass[roll.status])}>
                                                    {statusLabel[roll.status]}
                                                  </span>
                                                </td>
                                                <td className="px-2 py-1.5">{formatDateTime(roll.inAt)}</td>
                                                <td className="px-2 py-1.5">{roll.reservedFor ?? roll.counterparty ?? "-"}</td>
                                                <td className="px-2 py-1.5">{shortNote(roll.note)}</td>
                                                <td className="px-2 py-1.5">
                                                  {canAdjust ? (
                                                    <div className="flex flex-wrap items-center gap-2">
                                                      <button
                                                        type="button"
                                                        onClick={() => openEditRollModal(roll)}
                                                        className="rounded border border-black/10 bg-white px-2 py-1 text-[11px] font-semibold text-neutral-700 transition hover:bg-neutral-100"
                                                      >
                                                        Duzelt
                                                      </button>
                                                      {canVoid ? (
                                                        <button
                                                          type="button"
                                                          onClick={() => openVoidRollModal(roll.id)}
                                                          className="rounded border border-rose-500/40 bg-rose-50 px-2 py-1 text-[11px] font-semibold text-rose-700 transition hover:bg-rose-100"
                                                        >
                                                          Kaldir
                                                        </button>
                                                      ) : null}
                                                    </div>
                                                  ) : <span className="text-[11px] text-neutral-400">-</span>}
                                                </td>
                                              </tr>
                                            );
                                          })}
                                        </tbody>
                                      </table>
                                    </div>
                                  </td>
                                </tr>
                              ) : null}
                            </Fragment>
                          );
                        })}
                        {renderedGroups.length === 0 ? (
                          <tr>
                            <td colSpan={7} className="px-3 py-8 text-center text-sm text-neutral-500">Filtreye uygun grup kaydi yok.</td>
                          </tr>
                        ) : null}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </section>
        </div>
        ) : (
          <section className="min-h-0 h-[calc(100vh-320px)] overflow-auto rounded-2xl border border-black/5 bg-white/80 p-4 shadow-[0_10px_30px_rgba(0,0,0,0.08)]">
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-lg font-semibold text-neutral-900">Sevk / Rezerv Gecmisi</h2>
                <input
                  type="search"
                  value={historyCustomerQuery}
                  onChange={(event) => setHistoryCustomerQuery(event.target.value)}
                  placeholder="Musteri ara"
                  className="w-full max-w-sm rounded-lg border border-black/10 bg-white px-3 py-2 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-coffee-primary"
                />
              </div>
              {historyFeedback ? (
                <p className="rounded-lg border border-black/10 bg-white px-3 py-2 text-xs font-medium text-neutral-700">
                  {historyFeedback}
                </p>
              ) : null}
              <div className="overflow-auto rounded-lg border border-black/10">
                <table className="w-full text-left text-sm">
                  <thead className="bg-neutral-50 text-neutral-600">
                    <tr>
                      <th className="px-3 py-2 font-semibold">Tarih</th>
                      <th className="px-3 py-2 font-semibold">Tip</th>
                      <th className="px-3 py-2 font-semibold">Musteri</th>
                      <th className="px-3 py-2 font-semibold">Desen</th>
                      <th className="px-3 py-2 font-semibold">Toplam Top</th>
                      <th className="px-3 py-2 font-semibold">Toplam Metre</th>
                      <th className="px-3 py-2 font-semibold">Aksiyon</th>
                    </tr>
                  </thead>
                  <tbody className="text-neutral-800">
                    {historyRows.map((row) => (
                      <tr
                        key={row.transaction.id}
                        className={cn(
                          "border-t border-black/5",
                          row.transaction.status === "REVERSED" ? "opacity-60" : ""
                        )}
                      >
                        <td className="px-3 py-2">{formatDateTime(row.transaction.createdAt)}</td>
                        <td className="px-3 py-2">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span>{transactionTypeLabel[row.transaction.type]}</span>
                            {row.transaction.status === "REVERSED" ? (
                              <span className="rounded-full border border-rose-500/30 bg-rose-50 px-2 py-0.5 text-[11px] font-semibold text-rose-700">
                                Iptal Edildi
                              </span>
                            ) : null}
                          </div>
                        </td>
                        <td className="px-3 py-2">{row.transaction.customerNameSnapshot ?? "-"}</td>
                        <td className="px-3 py-2">{row.totals.patternCount}</td>
                        <td className="px-3 py-2">{row.totals.totalTops}</td>
                        <td className="px-3 py-2">{fmt(row.totals.totalMetres)} m</td>
                        <td className="px-3 py-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <button
                              type="button"
                              onClick={() => setDetailTransactionId(row.transaction.id)}
                              className="rounded border border-black/10 bg-white px-2.5 py-1 text-xs font-semibold text-neutral-700 transition hover:bg-neutral-100"
                            >
                              Detay
                            </button>
                            <Link
                              href={`/depo/islem/${row.transaction.id}/print`}
                              target="_blank"
                              className="inline-flex items-center gap-1 rounded border border-sky-500/30 bg-sky-50 px-2.5 py-1 text-xs font-semibold text-sky-700 transition hover:bg-sky-100"
                            >
                              Yazdir
                              <ExternalLink className="h-3.5 w-3.5" />
                            </Link>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {historyRows.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-3 py-8 text-center text-sm text-neutral-500">
                          Filtreye uygun islem kaydi yok.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        )}
      </div>
      {addOpen && selectedPattern ? (
        <Modal title="Top Girisi" onClose={() => setAddOpen(false)}>
          <p className="text-sm text-neutral-600">{selectedPattern.fabricCode} - {selectedPattern.fabricName}</p>
          <div className="mt-4 space-y-3">
            <select value={addVariantId} onChange={(e) => setAddVariantId(e.target.value)} className="w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-coffee-primary">{selectedPattern.variants.map((variant) => <option key={variant.id} value={variant.id}>{variantName(variant)}</option>)}<option value="__other">Diger (serbest renk)</option></select>
            {addVariantId === "__other" ? <input type="text" value={addColorName} onChange={(e) => setAddColorName(e.target.value)} placeholder="Renk adi" className="w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-coffee-primary" /> : null}
            <div className="grid gap-3 sm:grid-cols-3">
              <input type="number" min="0" step="0.01" value={addMeters} onChange={(e) => setAddMeters(e.target.value)} placeholder="Metre" className="w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-coffee-primary" />
              <input type="number" min="1" step="1" value={addQty} onChange={(e) => setAddQty(e.target.value)} placeholder="Adet (Top)" className="w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-coffee-primary" />
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

      {bulkActionType ? (
        <Modal
          title={bulkActionType === "SHIPMENT" ? "Toplu Sevk Et" : "Toplu Rezerv Yap"}
          onClose={closeBulkModal}
          size="lg"
        >
          <div className="space-y-3">
            <p className="text-sm text-neutral-600">Secili: {selectedCount} top / {fmt(selectedMeters)} m</p>
            <div className="max-h-32 overflow-auto rounded-lg border border-black/10 bg-neutral-50 px-3 py-2">
              <div className="space-y-1 text-xs text-neutral-700">
                {selectedLineDrafts.map((line) => (
                  <div key={line.rowKey}>
                    {line.patternNoSnapshot} / {line.color} / {fmt(line.metrePerTop)} m - {line.topCount} top
                  </div>
                ))}
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-neutral-600">Musteri Sec / Yaz</label>
              <input
                type="text"
                value={bulkCustomerInput}
                onChange={(event) => {
                  setBulkCustomerInput(event.target.value);
                  setBulkCustomerId(null);
                }}
                placeholder="Musteri adi"
                className="w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-coffee-primary"
              />
              <div className="mt-2 max-h-36 overflow-auto rounded-lg border border-black/10 bg-white">
                {customerSuggestions.map((customer) => (
                  <button
                    key={customer.id}
                    type="button"
                    onClick={() => {
                      setBulkCustomerId(customer.id);
                      setBulkCustomerInput(customer.nameOriginal);
                    }}
                    className={cn(
                      "block w-full border-t border-black/5 px-3 py-2 text-left text-xs text-neutral-700 first:border-t-0 hover:bg-neutral-50",
                      bulkCustomerId === customer.id ? "bg-coffee-primary/10 text-coffee-primary" : ""
                    )}
                  >
                    {customer.nameOriginal}
                  </button>
                ))}
                {bulkCustomerInput.trim() && !exactCustomerMatch ? (
                  <button
                    type="button"
                    onClick={() => {
                      setBulkCustomerId(null);
                      setBulkCustomerInput(bulkCustomerInput.trim());
                    }}
                    className="block w-full border-t border-black/5 px-3 py-2 text-left text-xs font-semibold text-emerald-700 hover:bg-emerald-50"
                  >
                    Yeni musteri olarak ekle: <span className="font-mono">{bulkCustomerInput.trim()}</span>
                  </button>
                ) : null}
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-neutral-600">Not (opsiyonel)</label>
              <textarea
                value={bulkNote}
                onChange={(event) => setBulkNote(event.target.value)}
                rows={3}
                placeholder="Islem notu"
                className="w-full resize-none rounded-lg border border-black/10 bg-white px-3 py-2 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-coffee-primary"
              />
            </div>
          </div>
          {bulkError ? <p className="mt-3 text-sm text-rose-600">{bulkError}</p> : null}
          <div className="mt-4 flex justify-end gap-2">
            <button type="button" onClick={closeBulkModal} className="rounded-lg px-3 py-2 text-sm text-neutral-600 transition hover:bg-neutral-100">Iptal</button>
            <button type="button" onClick={handleBulkActionConfirm} className="rounded-lg bg-coffee-primary px-4 py-2 text-sm font-semibold text-white transition hover:brightness-95">Onayla</button>
          </div>
        </Modal>
      ) : null}

      {detailRow ? (
        <Modal title={`${transactionTypeLabel[detailRow.transaction.type]} Detayi`} onClose={() => setDetailTransactionId(null)} size="xl">
          <div className="space-y-3 text-sm">
            <div className="rounded-lg border border-black/10 bg-neutral-50 px-3 py-2 text-neutral-700">
              <div>Tarih: {formatDateTime(detailRow.transaction.createdAt)}</div>
              <div>Musteri: {detailRow.transaction.customerNameSnapshot ?? "-"}</div>
              <div>Durum: {detailRow.transaction.status === "REVERSED" ? "Iptal Edildi" : "Aktif"}</div>
            </div>
            <div className="space-y-2">
              {detailLineGroups.map((group) => (
                <div key={group.key} className="rounded-lg border border-black/10 bg-white p-3">
                  <h4 className="text-sm font-semibold text-neutral-900">{group.patternNoSnapshot} - {group.patternNameSnapshot}</h4>
                  <div className="mt-2 space-y-1 text-xs text-neutral-700">
                    {group.lines.map((line) => (
                      <div key={line.id}>{line.color}: {line.topCount} top / {fmt(line.totalMetres)} m</div>
                    ))}
                  </div>
                  <div className="mt-2 text-xs font-semibold text-neutral-800">Alt Toplam: {group.totalTop} top / {fmt(group.totalMetre)} m</div>
                </div>
              ))}
            </div>
            <div className="rounded-lg border border-black/10 bg-neutral-50 px-3 py-2 text-sm font-semibold text-neutral-800">
              Genel Toplam: {detailRow.totals.totalTops} top / {fmt(detailRow.totals.totalMetres)} m
            </div>
          </div>
          <div className="mt-4 flex flex-wrap justify-end gap-2">
            <Link
              href={`/depo/islem/${detailRow.transaction.id}/print`}
              target="_blank"
              className="inline-flex items-center gap-1 rounded-lg border border-sky-500/30 bg-sky-50 px-3 py-2 text-sm font-semibold text-sky-700 transition hover:bg-sky-100"
            >
              Yazdir
              <ExternalLink className="h-4 w-4" />
            </Link>
            {detailRow.transaction.status !== "REVERSED" ? (
              <button type="button" onClick={handleReverseTransaction} className="rounded-lg border border-rose-500/40 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-100">Iptal Et / Geri Al</button>
            ) : null}
            <button type="button" onClick={() => setDetailTransactionId(null)} className="rounded-lg border border-black/10 bg-white px-3 py-2 text-sm font-semibold text-neutral-700 transition hover:bg-neutral-100">Kapat</button>
          </div>
        </Modal>
      ) : null}

      {voidingRoll ? (
        <Modal title="Top Kaldir" onClose={closeVoidRollModal}>
          <div className="space-y-3">
            <p className="text-sm text-neutral-700">
              {voidingRoll.rollNo ?? voidingRoll.id.slice(0, 8)} / {fmt(voidingRoll.meters)} m
            </p>
            <input
              type="text"
              value={voidReason}
              onChange={(event) => setVoidReason(event.target.value)}
              placeholder="Sebep (opsiyonel)"
              className="w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-coffee-primary"
            />
          </div>
          {voidError ? <p className="mt-3 text-sm text-rose-600">{voidError}</p> : null}
          <div className="mt-4 flex justify-end gap-2">
            <button type="button" onClick={closeVoidRollModal} className="rounded-lg px-3 py-2 text-sm text-neutral-600 transition hover:bg-neutral-100">Vazgec</button>
            <button type="button" onClick={handleVoidRoll} className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white transition hover:brightness-95">Onayla</button>
          </div>
        </Modal>
      ) : null}

      {editingRoll ? (
        <Modal title="Top Duzelt" onClose={closeEditRollModal}>
          <div className="space-y-3">
            <input type="text" value={editColorName} onChange={(event) => setEditColorName(event.target.value)} placeholder="Renk" className="w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-coffee-primary" />
            <input type="number" min="0" step="0.01" value={editMeters} onChange={(event) => setEditMeters(event.target.value)} placeholder="Metre" className="w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-coffee-primary" />
            <input type="text" value={editRollNo} onChange={(event) => setEditRollNo(event.target.value)} placeholder="Roll No" className="w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-coffee-primary" />
            <input type="text" value={editNote} onChange={(event) => setEditNote(event.target.value)} placeholder="Not" className="w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-coffee-primary" />
          </div>
          {editError ? <p className="mt-3 text-sm text-rose-600">{editError}</p> : null}
          <div className="mt-4 flex justify-end gap-2">
            <button type="button" onClick={closeEditRollModal} className="rounded-lg px-3 py-2 text-sm text-neutral-600 transition hover:bg-neutral-100">Vazgec</button>
            <button type="button" onClick={handleSaveRollEdit} className="rounded-lg bg-coffee-primary px-4 py-2 text-sm font-semibold text-white transition hover:brightness-95">Kaydet</button>
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
  size?: "md" | "lg" | "xl";
};

function Modal({ title, children, onClose, size = "md" }: ModalProps) {
  const widthClass =
    size === "xl" ? "max-w-3xl" : size === "lg" ? "max-w-xl" : "max-w-md";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className={cn("w-full rounded-2xl border border-black/10 bg-white p-5 shadow-2xl", widthClass)} onClick={(event) => event.stopPropagation()}>
        <h3 className="text-lg font-semibold text-neutral-900">{title}</h3>
        <div className="mt-2">{children}</div>
      </div>
    </div>
  );
}
