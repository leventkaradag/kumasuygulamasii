"use client";

import Image from "next/image";
import Link from "next/link";
import {
  Fragment,
  type KeyboardEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { ExternalLink, Plus, Search } from "lucide-react";
import { useAuthProfile } from "@/components/AuthProfileProvider";
import Layout from "@/components/Layout";
import { cn } from "@/lib/cn";
import type { FabricRoll, FabricRollStatus } from "@/lib/domain/depo";
import type { Customer } from "@/lib/domain/customer";
import type { DepoTransaction, DepoTransactionLine, DepoTransactionType } from "@/lib/domain/depoTransaction";
import type { Pattern, Variant } from "@/lib/domain/pattern";
import type { WeavingPlan, WeavingProgressEntry } from "@/lib/domain/weaving";
import { downloadDepoDailyEntryReportXlsx } from "@/lib/export/depoDailyEntryExcel";
import { buildPatternNoteHistory, type PatternNoteEntry } from "@/lib/patternNoteHistory";
import { customersLocalRepo, normalizeCustomerName } from "@/lib/repos/customersLocalRepo";
import { depoSupabaseRepo } from "@/lib/repos/depoSupabaseRepo";
import { depoTransactionsSupabaseRepo } from "@/lib/repos/depoTransactionsSupabaseRepo";
import { patternsSupabaseRepo } from "@/lib/repos/patternsSupabaseRepo";
import { weavingLocalRepo } from "@/lib/repos/weavingLocalRepo";
import { buildDepoDailyEntryReport } from "@/lib/summary/depoDailyEntryReport";
import { useModalFocusTrap } from "@/lib/useModalFocusTrap";

type PatternMeta = Pattern & Partial<{ __deleted?: boolean }>;
type DepoTab = "stock" | "tx" | "notes";
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
  variantId?: string | null;
  patternNoSnapshot: string;
  patternNameSnapshot: string;
  color: string;
  metrePerTop: number;
  topCount: number;
  totalMetres: number;
  rollIds: string[];
};

type BasketItem = {
  key: string;
  patternId: string;
  variantId?: string | null;
  rollIds: string[];
  patternNoSnapshot: string;
  patternNameSnapshot: string;
  color: string;
  metrePerTop: number;
  topCount: number;
  totalMetres: number;
};

type RollInputRow = {
  id: string;
  meters: string;
  quantity: string;
};

type ParsedRollInputRow = {
  meters: number;
  quantity: number;
};

type TransactionLineInput = Omit<DepoTransactionLine, "id" | "transactionId">;

type OperationSummaryPatternRow = {
  key: string;
  patternId: string;
  patternNoSnapshot: string;
  patternNameSnapshot: string;
  totalTops: number;
  totalMetres: number;
};

type OperationSummary = {
  title: string;
  description: string;
  createdAt: string;
  customerName?: string;
  patterns: OperationSummaryPatternRow[];
  totalTops: number;
  totalMetres: number;
};

type PendingAddEntry = {
  id: string;
  patternId: string;
  patternNoSnapshot: string;
  patternNameSnapshot: string;
  variantId?: string;
  colorName: string;
  meters: number;
  quantity: number;
  totalMetres: number;
  createdAt: string;
  note?: string;
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
  ENTRY: "Depo Giris",
  SHIPMENT: "Sevk",
  RESERVATION: "Rezerv",
  RETURN: "Iade",
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

const formatShortRef = (value: string) => value.slice(0, 8).toUpperCase();

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

const formatPatternNoteTitle = (entry: PatternNoteEntry) => {
  if (entry.sourceType !== "DEPO") return entry.operationLabel;
  const isBulk = (entry.lineCount ?? 0) > 1 || (entry.topCount ?? 0) > 1;
  if (!isBulk) return entry.operationLabel;

  if (entry.operationLabel === "Top Girisi") return "Toplu Top Girisi";
  if (entry.operationLabel === "Sevk") return "Toplu Sevk";
  if (entry.operationLabel === "Rezerv") return "Toplu Rezerv";
  return entry.operationLabel;
};

const formatPatternNoteActionSummary = (entry: PatternNoteEntry) => {
  if (
    entry.sourceType === "DEPO" &&
    typeof entry.topCount === "number" &&
    Number.isFinite(entry.topCount) &&
    entry.topCount > 0
  ) {
    if (entry.operationLabel === "Sevk") return `${entry.topCount} top gonderildi`;
    if (entry.operationLabel === "Rezerv") return `${entry.topCount} top rezerve edildi`;
    if (entry.operationLabel === "Top Girisi") return `${entry.topCount} top girildi`;
  }

  if (
    typeof entry.metersPerUnit === "number" &&
    Number.isFinite(entry.metersPerUnit) &&
    typeof entry.unitCount === "number" &&
    Number.isFinite(entry.unitCount)
  ) {
    const totalMeters = entry.meters ?? entry.metersPerUnit * entry.unitCount;
    return entry.unitCount > 1
      ? `${fmt(entry.metersPerUnit)} m x ${entry.unitCount} adet = ${fmt(totalMeters)} m`
      : `${fmt(totalMeters)} m ilerleme kaydedildi`;
  }

  if (typeof entry.meters === "number" && Number.isFinite(entry.meters)) {
    return `${fmt(entry.meters)} m ilerleme kaydedildi`;
  }

  return null;
};

const formatPatternNoteVariant = (entry: PatternNoteEntry) => {
  const scopeSummary = entry.scopeSummary?.trim();
  if (scopeSummary) return scopeSummary;
  const parts = [entry.variantCode?.trim(), entry.colorName?.trim()].filter(Boolean);
  return parts.length > 0 ? parts.join(" / ") : null;
};

const formatPatternNoteTopCount = (entry: PatternNoteEntry) =>
  typeof entry.topCount === "number" && Number.isFinite(entry.topCount) && entry.topCount > 0
    ? `${entry.topCount} top`
    : null;

const formatPatternNoteMeters = (entry: PatternNoteEntry) =>
  typeof entry.meters === "number" && Number.isFinite(entry.meters)
    ? `Toplam ${fmt(entry.meters)} m`
    : null;

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

const createLocalId = () => {
  const randomUUID = globalThis.crypto?.randomUUID;
  if (typeof randomUUID === "function") {
    return randomUUID.call(globalThis.crypto);
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const createRollInputRow = (): RollInputRow => ({
  id: createLocalId(),
  meters: "",
  quantity: "1",
});

const hasPositiveMetersDraftValue = (value: string) => {
  const parsed = Number(value.trim().replace(",", "."));
  return Number.isFinite(parsed) && parsed > 0;
};

const parseRollInputRows = (rows: RollInputRow[], labelPrefix: string): ParsedRollInputRow[] => {
  const parsedRows = rows.flatMap((row, index) => {
    const hasMeters = row.meters.trim() !== "";
    const hasQuantity = row.quantity.trim() !== "";

    if (!hasMeters && !hasQuantity) return [];
    if (!hasMeters) {
      throw new Error(`${labelPrefix} ${index + 1} icin metre giriniz.`);
    }
    if (!hasQuantity) {
      throw new Error(`${labelPrefix} ${index + 1} icin adet giriniz.`);
    }

    return [
      {
        meters: toPositiveNumber(row.meters, `${labelPrefix} ${index + 1} metre`),
        quantity: toPositiveInt(row.quantity, `${labelPrefix} ${index + 1} adet`),
      },
    ];
  });

  if (parsedRows.length === 0) {
    throw new Error(`En az bir ${labelPrefix.toLocaleLowerCase("tr-TR")} satiri giriniz.`);
  }

  return parsedRows;
};

const buildTransactionLineInputsFromRolls = (
  sourceRolls: FabricRoll[],
  patternsById: Map<string, Pattern>
): TransactionLineInput[] => {
  const groups = new Map<string, TransactionLineInput>();

  sourceRolls.forEach((roll) => {
    const pattern = patternsById.get(roll.patternId);
    const color = pattern ? rollColor(roll, pattern) : roll.colorName?.trim() || "Renk yok";
    const key = `${roll.patternId}|${toColorKey(color)}|${roll.meters}`;
    const current = groups.get(key);

    if (current) {
      current.topCount += 1;
      current.totalMetres += roll.meters;
      current.rollIds = [...(current.rollIds ?? []), roll.id];
      return;
    }

    groups.set(key, {
      patternId: roll.patternId,
      patternNoSnapshot: pattern?.fabricCode ?? roll.patternId,
      patternNameSnapshot: pattern?.fabricName ?? "Silinmis Desen",
      color,
      metrePerTop: roll.meters,
      topCount: 1,
      totalMetres: roll.meters,
      rollIds: [roll.id],
    });
  });

  return Array.from(groups.values()).sort((left, right) => {
    const byPattern = left.patternNoSnapshot.localeCompare(right.patternNoSnapshot, "tr-TR");
    if (byPattern !== 0) return byPattern;
    const byColor = left.color.localeCompare(right.color, "tr-TR");
    if (byColor !== 0) return byColor;
    return left.metrePerTop - right.metrePerTop;
  });
};

const buildOperationSummary = (
  title: string,
  description: string,
  createdAt: string,
  lines: TransactionLineInput[],
  customerName?: string
): OperationSummary => {
  const patternGroups = new Map<string, OperationSummaryPatternRow>();

  lines.forEach((line) => {
    const key = `${line.patternId}|${line.patternNoSnapshot}`;
    const current = patternGroups.get(key);
    if (current) {
      current.totalTops += line.topCount;
      current.totalMetres += line.totalMetres;
      return;
    }

    patternGroups.set(key, {
      key,
      patternId: line.patternId,
      patternNoSnapshot: line.patternNoSnapshot,
      patternNameSnapshot: line.patternNameSnapshot,
      totalTops: line.topCount,
      totalMetres: line.totalMetres,
    });
  });

  const patterns = Array.from(patternGroups.values()).sort((left, right) =>
    left.patternNoSnapshot.localeCompare(right.patternNoSnapshot, "tr-TR")
  );

  return {
    title,
    description,
    createdAt,
    customerName: customerName?.trim() || undefined,
    patterns,
    totalTops: patterns.reduce((total, pattern) => total + pattern.totalTops, 0),
    totalMetres: patterns.reduce((total, pattern) => total + pattern.totalMetres, 0),
  };
};

export default function DepoPage() {
  const { permissions } = useAuthProfile();
  const [activeTab, setActiveTab] = useState<DepoTab>("stock");

  const [patterns, setPatterns] = useState<Pattern[]>([]);
  const [rolls, setRolls] = useState<FabricRoll[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [transactions, setTransactions] = useState<DepoTransaction[]>([]);
  const [transactionLines, setTransactionLines] = useState<DepoTransactionLine[]>([]);
  const [weavingPlans, setWeavingPlans] = useState<WeavingPlan[]>([]);
  const [weavingProgressEntries, setWeavingProgressEntries] = useState<WeavingProgressEntry[]>([]);
  const [selectedPatternId, setSelectedPatternId] = useState<string | null>(null);
  const [searchPattern, setSearchPattern] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [rollSearch, setRollSearch] = useState("");
  const [rollStatus, setRollStatus] = useState<FabricRollStatus | "">("");

  const [isLoadingRolls, setIsLoadingRolls] = useState(true);
  const [rollsError, setRollsError] = useState<string | null>(null);
  const [isLoadingTx, setIsLoadingTx] = useState(true);
  const [txError, setTxError] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [addVariantId, setAddVariantId] = useState("__other");
  const [addColorName, setAddColorName] = useState("");
  const [addRows, setAddRows] = useState<RollInputRow[]>(() => [createRollInputRow()]);
  const [addDate, setAddDate] = useState(todayInput());
  const [addNote, setAddNote] = useState("");
  const [addError, setAddError] = useState("");
  const [pendingAddEntries, setPendingAddEntries] = useState<PendingAddEntry[]>([]);
  const addMeterInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const [returnOpen, setReturnOpen] = useState(false);
  const [returnPatternId, setReturnPatternId] = useState("");
  const [returnVariantId, setReturnVariantId] = useState("__other");
  const [returnColorName, setReturnColorName] = useState("");
  const [returnRows, setReturnRows] = useState<RollInputRow[]>(() => [createRollInputRow()]);
  const [returnCustomerInput, setReturnCustomerInput] = useState("");
  const [returnCustomerId, setReturnCustomerId] = useState<string | null>(null);
  const [returnDate, setReturnDate] = useState(todayInput());
  const [returnNote, setReturnNote] = useState("");
  const [returnError, setReturnError] = useState("");

  const [operationSummary, setOperationSummary] = useState<OperationSummary | null>(null);
  const [dailyEntryReportDate, setDailyEntryReportDate] = useState(todayInput());
  const [dailyEntryReportFeedback, setDailyEntryReportFeedback] = useState("");

  const [selectedByRowKey, setSelectedByRowKey] = useState<Record<string, number>>({});
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(() => new Set());
  const [basketItems, setBasketItems] = useState<BasketItem[]>([]);

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
  const canManageWarehouse = permissions.warehouse.operate;
  const canCreateShipment = permissions.dispatch.create;
  const canCreateReservation = permissions.reservation.create;
  const canUseBasket = canCreateShipment || canCreateReservation;
  const canReverseTransactions =
    permissions.dispatch.edit ||
    permissions.dispatch.delete ||
    permissions.reservation.edit ||
    permissions.reservation.delete;

  // Async: transactions + customers + weaving — Supabase transactions, rest local
  const refreshSyncData = async () => {
    setIsLoadingTx(true);
    setTxError(null);
    try {
      const [fetchedTx, fetchedLines] = await Promise.all([
        depoTransactionsSupabaseRepo.listTransactions(),
        depoTransactionsSupabaseRepo.listLines(),
      ]);
      setTransactions(fetchedTx);
      setTransactionLines(fetchedLines);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Islem gecmisi yuklenemedi.";
      setTxError(msg);
    } finally {
      setIsLoadingTx(false);
    }
    setCustomers(customersLocalRepo.list());
    setWeavingPlans(weavingLocalRepo.listPlans());
    setWeavingProgressEntries(weavingLocalRepo.listProgress());
  };

  // Async: patterns + rolls + transactions from Supabase
  const refreshData = (preferredPatternId?: string | null) => {
    setIsLoadingRolls(true);
    setRollsError(null);

    Promise.all([
      patternsSupabaseRepo.list(),
      depoSupabaseRepo.listRolls(),
      refreshSyncData(),
    ]).then(([fetchedPatterns, fetchedRolls]) => {
      const nextPatterns = sortPatterns(fetchedPatterns.filter(isPatternVisible));
      setPatterns(nextPatterns);
      setRolls(fetchedRolls);
      setIsLoadingRolls(false);
      setSelectedPatternId((currentId) => {
        if (preferredPatternId && nextPatterns.some((p) => p.id === preferredPatternId)) return preferredPatternId;
        if (currentId && nextPatterns.some((p) => p.id === currentId)) return currentId;
        return nextPatterns[0]?.id ?? null;
      });
    }).catch((err: unknown) => {
      const msg = err instanceof Error ? err.message : "Veriler yueklenemedi.";
      setRollsError(msg);
      setIsLoadingRolls(false);
    });
  };

  useEffect(() => {
    refreshData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
    const hasDateFilter = activeTab === "stock" && (!!dateFrom || !!dateTo);
    const patternIds = new Set(rollsInRange.map((roll) => roll.patternId));
    return patterns.filter((pattern) => {
      if (hasDateFilter && !patternIds.has(pattern.id)) return false;
      if (!normalized) return true;
      return (
        normalizeSearchToken(pattern.fabricCode).includes(normalized) ||
        normalizeSearchToken(pattern.fabricName).includes(normalized)
      );
    });
  }, [patterns, rollsInRange, searchPattern, dateFrom, dateTo, activeTab]);

  useEffect(() => {
    if (selectedPatternId && filteredPatterns.some((item) => item.id === selectedPatternId)) return;
    setSelectedPatternId(filteredPatterns[0]?.id ?? null);
  }, [filteredPatterns, selectedPatternId]);

  const patternsById = useMemo(() => new Map(patterns.map((pattern) => [pattern.id, pattern])), [patterns]);
  const selectedPattern = filteredPatterns.find((item) => item.id === selectedPatternId) ?? null;
  const selectedPatternNotes = useMemo(() => {
    if (!selectedPattern) return [];
    return buildPatternNoteHistory({
      patternId: selectedPattern.id,
      transactions,
      transactionLines,
      weavingPlans,
      weavingProgressEntries,
      patterns,
    });
  }, [
    selectedPattern,
    transactions,
    transactionLines,
    weavingPlans,
    weavingProgressEntries,
    patterns,
  ]);

  const selectedPatternRolls = useMemo(() => {
    if (!selectedPattern) return [];
    return rollsInRange.filter(
      (roll) =>
        roll.patternId === selectedPattern.id &&
        roll.status !== "VOIDED" &&
        (roll.status === "IN_STOCK" || roll.status === "RESERVED")
    );
  }, [rollsInRange, selectedPattern]);

  const selectedPatternActiveRolls = useMemo(() => {
    if (!selectedPattern) return [];
    return rolls.filter(
      (roll) =>
        roll.patternId === selectedPattern.id &&
        roll.status !== "VOIDED" &&
        (roll.status === "IN_STOCK" || roll.status === "RESERVED")
    );
  }, [rolls, selectedPattern]);

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

  const selectedPatternTotalMeters = useMemo(
    () => selectedPatternActiveRolls.reduce((total, roll) => total + roll.meters, 0),
    [selectedPatternActiveRolls]
  );
  const selectedPatternTotalRolls = selectedPatternActiveRolls.length;

  const returnSelectedPattern = useMemo(
    () => patterns.find((pattern) => pattern.id === returnPatternId) ?? null,
    [patterns, returnPatternId]
  );

  const selectedRollSet = useMemo(
    () => new Set(basketItems.flatMap((item) => item.rollIds)),
    [basketItems]
  );

  const selectableCountByRowKey = useMemo(() => {
    const map = new Map<string, number>();
    allGroups.forEach((group) => {
      const selectableCount = group.inStockRolls.filter(
        (roll) => !selectedRollSet.has(roll.id)
      ).length;
      map.set(group.key, selectableCount);
    });
    return map;
  }, [allGroups, selectedRollSet]);

  const selectedLineDrafts = useMemo(() => {
    const drafts: SelectedLineDraft[] = [];
    Object.entries(selectedByRowKey).forEach(([rowKey, value]) => {
      if (value <= 0) return;
      const group = allGroupsByKey.get(rowKey);
      if (!group) return;
      const selectableRolls = group.inStockRolls.filter(
        (roll) => !selectedRollSet.has(roll.id)
      );
      const topCount = Math.min(value, selectableRolls.length);
      if (topCount <= 0) return;
      const candidateRolls = selectableRolls.slice(0, topCount);
      const variantIdSet = new Set(
        candidateRolls
          .map((roll) => roll.variantId)
          .filter((variantId): variantId is string => Boolean(variantId))
      );
      const variantId = variantIdSet.size === 1 ? Array.from(variantIdSet)[0] : null;
      drafts.push({
        rowKey,
        patternId: group.patternId,
        variantId,
        patternNoSnapshot: group.patternNoSnapshot,
        patternNameSnapshot: group.patternNameSnapshot,
        color: group.colorName,
        metrePerTop: group.meters,
        topCount,
        totalMetres: topCount * group.meters,
        rollIds: candidateRolls.map((roll) => roll.id),
      });
    });
    return drafts;
  }, [selectedByRowKey, allGroupsByKey, selectedRollSet]);

  const selectedCount = useMemo(
    () => selectedLineDrafts.reduce((total, draft) => total + draft.topCount, 0),
    [selectedLineDrafts]
  );
  const selectedMeters = useMemo(
    () => selectedLineDrafts.reduce((total, draft) => total + draft.totalMetres, 0),
    [selectedLineDrafts]
  );

  const basketSummary = useMemo(() => {
    const patternSet = new Set<string>();
    let totalTops = 0;
    let totalMetres = 0;

    basketItems.forEach((item) => {
      patternSet.add(item.patternId);
      totalTops += item.topCount;
      totalMetres += item.totalMetres;
    });

    return {
      patternCount: patternSet.size,
      totalTops,
      totalMetres,
    };
  }, [basketItems]);

  useEffect(() => {
    setSelectedByRowKey((current) => {
      const next: Record<string, number> = {};
      Object.entries(current).forEach(([rowKey, value]) => {
        const selectableCount = selectableCountByRowKey.get(rowKey);
        if (selectableCount === undefined) return;
        const clamped = Math.max(0, Math.min(selectableCount, value));
        if (clamped > 0) next[rowKey] = clamped;
      });
      const sameLength = Object.keys(next).length === Object.keys(current).length;
      const isSame =
        sameLength &&
        Object.entries(next).every(([key, value]) => (current[key] ?? 0) === value);
      return isSame ? current : next;
    });
  }, [selectableCountByRowKey]);

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

  const updateAddRow = (rowId: string, field: keyof Omit<RollInputRow, "id">, value: string) => {
    setAddRows((current) =>
      current.map((row) => (row.id === rowId ? { ...row, [field]: value } : row))
    );
  };

  const openAddModal = () => {
    if (!canManageWarehouse) return;
    if (!selectedPattern) return;
    setAddVariantId(selectedPattern.variants[0]?.id ?? "__other");
    setAddColorName("");
    setAddRows([createRollInputRow()]);
    setAddDate(todayInput());
    setAddNote("");
    setPendingAddEntries([]);
    setAddError("");
    setAddOpen(true);
  };

  const focusAddMeterInput = (rowId: string) => {
    requestAnimationFrame(() => {
      const input = addMeterInputRefs.current[rowId];
      input?.focus();
      input?.select();
    });
  };

  const firstAddRowId = addRows[0]?.id;
  const pendingAddTotals = useMemo(
    () =>
      pendingAddEntries.reduce(
        (totals, entry) => ({
          totalTops: totals.totalTops + entry.quantity,
          totalMetres: totals.totalMetres + entry.totalMetres,
        }),
        { totalTops: 0, totalMetres: 0 }
      ),
    [pendingAddEntries]
  );

  useEffect(() => {
    if (!addOpen) return;
    if (!firstAddRowId) return;
    focusAddMeterInput(firstAddRowId);
  }, [addOpen, firstAddRowId]);

  const resolveAddColorContext = () => {
    if (!selectedPattern) throw new Error("Desen secimi bulunamadi.");
    const variant =
      addVariantId !== "__other"
        ? selectedPattern.variants.find((item) => item.id === addVariantId)
        : undefined;
    const colorName =
      addVariantId === "__other" ? addColorName.trim() : variant?.colorName ?? variant?.name ?? "";

    if (!colorName && !variant) {
      throw new Error("Renk seciniz.");
    }

    return {
      variant,
      colorName,
    };
  };

  const buildPendingAddEntriesFromParsedRows = (
    parsedRows: ParsedRollInputRow[],
    note?: string
  ): PendingAddEntry[] => {
    if (!selectedPattern) throw new Error("Desen secimi bulunamadi.");

    const inAt = toIsoDate(addDate, "Giris tarihi");
    const { variant, colorName } = resolveAddColorContext();

    return parsedRows.map((row) => ({
      id: createLocalId(),
      patternId: selectedPattern.id,
      patternNoSnapshot: selectedPattern.fabricCode,
      patternNameSnapshot: selectedPattern.fabricName,
      variantId: variant?.id,
      colorName,
      meters: row.meters,
      quantity: row.quantity,
      totalMetres: row.meters * row.quantity,
      createdAt: inAt,
      note,
    }));
  };

  const persistPendingAddEntries = async (entries: PendingAddEntry[]) => {
    if (entries.length === 0) {
      throw new Error("En az bir top girisi ekleyiniz.");
    }

    const groupedAddedRolls = new Map<
      string,
      {
        createdAt: string;
        note?: string;
        rolls: FabricRoll[];
      }
    >();

    // Add rolls to Supabase in parallel per entry
    for (const entry of entries) {
      const groupKey = JSON.stringify([entry.createdAt, entry.note ?? ""]);
      if (!groupedAddedRolls.has(groupKey)) {
        groupedAddedRolls.set(groupKey, {
          createdAt: entry.createdAt,
          note: entry.note,
          rolls: [],
        });
      }
      const group = groupedAddedRolls.get(groupKey)!;
      const addPromises = Array.from({ length: entry.quantity }, () =>
        depoSupabaseRepo.addRoll({
          patternId: entry.patternId,
          variantId: entry.variantId,
          colorName: entry.colorName || undefined,
          meters: entry.meters,
          inAt: entry.createdAt,
          note: entry.note,
        })
      );
      const addedRolls = await Promise.all(addPromises);
      group.rolls.push(...addedRolls);
    }

    const combinedSummaryLines: TransactionLineInput[] = [];
    for (const group of groupedAddedRolls.values()) {
      const summaryLines = buildTransactionLineInputsFromRolls(group.rolls, patternsById);
      await depoTransactionsSupabaseRepo.createTransaction({
        type: "ENTRY",
        createdAt: group.createdAt,
        note: group.note,
        lines: summaryLines,
      });
      combinedSummaryLines.push(...summaryLines);
    }

    const summaryCreatedAt =
      entries[0]?.createdAt ??
      new Date().toISOString();

    refreshData(selectedPattern?.id ?? null);
    return {
      createdAt: summaryCreatedAt,
      summaryLines: combinedSummaryLines,
    };
  };

  const handleAddRoll = async () => {
    if (!canManageWarehouse) return;
    if (!selectedPattern) return;
    try {
      const note = addNote.trim() || undefined;
      const addRowsToPersist = addRows.filter((row) => hasPositiveMetersDraftValue(row.meters));
      const currentRowEntries = addRowsToPersist.length > 0
        ? buildPendingAddEntriesFromParsedRows(parseRollInputRows(addRowsToPersist, "Top"), note)
        : [];
      const entriesToPersist = [...pendingAddEntries, ...currentRowEntries];
      const { createdAt, summaryLines } = await persistPendingAddEntries(entriesToPersist);

      setOperationSummary(
        buildOperationSummary(
          "Giris Ozeti",
          "Depo girisi basariyla kaydedildi.",
          createdAt,
          summaryLines
        )
      );
      setPendingAddEntries([]);
      setAddOpen(false);
    } catch (error) {
      setAddError(error instanceof Error ? error.message : "Top girisi kaydedilemedi");
    }
  };

  const handleQuickAddRow = (rowId: string) => {
    if (!canManageWarehouse) return;
    if (!selectedPattern) return;

    try {
      const targetRow = addRows.find((row) => row.id === rowId);
      if (!targetRow) return;

      const parsedRow = parseRollInputRows([targetRow], "Top");
      const note = addNote.trim() || undefined;
      const nextEntries = buildPendingAddEntriesFromParsedRows(parsedRow, note);

      setPendingAddEntries((current) => [...nextEntries, ...current]);
      setAddRows((current) =>
        current.map((row) =>
          row.id === rowId
            ? {
                ...row,
                meters: "",
              }
            : row
        )
      );
      setAddNote("");
      setAddError("");
      focusAddMeterInput(rowId);
    } catch (error) {
      setAddError(error instanceof Error ? error.message : "Top girisi kaydedilemedi");
    }
  };

  const handleAddRowMetersKeyDown = (
    event: KeyboardEvent<HTMLInputElement>,
    rowId: string
  ) => {
    if (event.key !== "Enter" || event.nativeEvent.isComposing) return;
    event.preventDefault();
    handleQuickAddRow(rowId);
  };

  const handleDeletePendingAddEntry = (entryId: string) => {
    if (!canManageWarehouse) return;
    setPendingAddEntries((current) => current.filter((entry) => entry.id !== entryId));
    setAddError("");
    if (firstAddRowId) {
      focusAddMeterInput(firstAddRowId);
    }
  };

  const updateReturnRow = (rowId: string, field: keyof Omit<RollInputRow, "id">, value: string) => {
    setReturnRows((current) =>
      current.map((row) => (row.id === rowId ? { ...row, [field]: value } : row))
    );
  };

  const appendReturnRow = () => {
    setReturnRows((current) => [...current, createRollInputRow()]);
  };

  const removeReturnRow = (rowId: string) => {
    setReturnRows((current) =>
      current.length === 1 ? current : current.filter((row) => row.id !== rowId)
    );
  };

  const openReturnModal = () => {
    if (!canManageWarehouse) return;
    const pattern = selectedPattern ?? patterns[0];
    if (!pattern) return;
    setReturnPatternId(pattern.id);
    setReturnVariantId(pattern.variants[0]?.id ?? "__other");
    setReturnColorName("");
    setReturnRows([createRollInputRow()]);
    setReturnCustomerInput("");
    setReturnCustomerId(null);
    setReturnDate(todayInput());
    setReturnNote("");
    setReturnError("");
    setReturnOpen(true);
  };

  const closeReturnModal = () => {
    setReturnOpen(false);
    setReturnError("");
  };

  const handleReturnPatternChange = (patternId: string) => {
    const nextPattern = patternsById.get(patternId);
    setReturnPatternId(patternId);
    setReturnVariantId(nextPattern?.variants[0]?.id ?? "__other");
    setReturnColorName("");
  };

  const normalizedReturnCustomer = normalizeCustomerName(returnCustomerInput);
  const returnCustomerSuggestions = useMemo(() => {
    if (!normalizedReturnCustomer) return customers.slice(0, 8);
    return customers
      .filter((customer) => customer.nameNormalized.includes(normalizedReturnCustomer))
      .slice(0, 8);
  }, [customers, normalizedReturnCustomer]);

  const returnExactCustomerMatch = useMemo(() => {
    if (!normalizedReturnCustomer) return undefined;
    return customers.find((customer) => customer.nameNormalized === normalizedReturnCustomer);
  }, [customers, normalizedReturnCustomer]);

  const handleDownloadDailyEntryReport = () => {
    try {
      const report = buildDepoDailyEntryReport({
        reportDate: dailyEntryReportDate,
        transactions,
        transactionLines,
        patterns,
      });
      const fileName = downloadDepoDailyEntryReportXlsx(report);
      setDailyEntryReportFeedback(
        report.totalTops > 0
          ? `${fileName} indirildi. ${report.totalTops} top / ${fmt(report.totalMetres)} m dahil edildi.`
          : `${fileName} indirildi. Secilen tarih icin giris bulunamadi.`
      );
    } catch (error) {
      setDailyEntryReportFeedback(
        error instanceof Error ? error.message : "Giris cizelgesi indirilemedi."
      );
    }
  };

  const handleAddReturn = async () => {
    if (!canManageWarehouse) return;
    if (!returnSelectedPattern) return;

    try {
      const customerInput = returnCustomerInput.trim();
      if (!customerInput) throw new Error("Musteri secimi zorunlu.");

      let customer = returnCustomerId ? customersLocalRepo.get(returnCustomerId) : undefined;
      if (!customer && returnExactCustomerMatch) customer = returnExactCustomerMatch;
      if (!customer) customer = customersLocalRepo.ensureByName(customerInput);

      const inAt = toIsoDate(returnDate, "Iade tarihi");
      const parsedRows = parseRollInputRows(returnRows, "Iade topu");
      const variant =
        returnVariantId !== "__other"
          ? returnSelectedPattern.variants.find((item) => item.id === returnVariantId)
          : undefined;
      const colorName =
        returnVariantId === "__other"
          ? returnColorName.trim()
          : variant?.colorName ?? variant?.name ?? "";
      if (!colorName && !variant) throw new Error("Renk seciniz.");

      const addedRolls = (await Promise.all(
        parsedRows.flatMap((row) =>
          Array.from({ length: row.quantity }, () =>
            depoSupabaseRepo.addRoll({
              patternId: returnSelectedPattern.id,
              variantId: variant?.id,
              colorName: colorName || undefined,
              meters: row.meters,
              inAt,
              counterparty: customer.nameOriginal,
              note: returnNote.trim() || undefined,
            })
          )
        )
      ));
      const lineInputs = buildTransactionLineInputsFromRolls(addedRolls, patternsById);

      await depoTransactionsSupabaseRepo.createTransaction({
        type: "RETURN",
        createdAt: inAt,
        customerId: customer.id,
        customerNameSnapshot: customer.nameOriginal,
        note: returnNote.trim() || undefined,
        lines: lineInputs,
      });

      setOperationSummary(
        buildOperationSummary(
          "Iade Ozeti",
          "Musteri iadesi depoya stok olarak islendi.",
          inAt,
          lineInputs,
          customer.nameOriginal
        )
      );
      setReturnOpen(false);
      refreshData(returnSelectedPattern.id);
    } catch (error) {
      setReturnError(error instanceof Error ? error.message : "Iade kaydi kaydedilemedi");
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

  const handleAddSelectionToBasket = () => {
    if (!canUseBasket) return;
    if (selectedLineDrafts.length === 0) {
      setBulkWarning("Sepete eklenecek uygun top bulunamadi.");
      return;
    }

    setBasketItems((current) => {
      const map = new Map<string, BasketItem>();
      current.forEach((item) => {
        map.set(item.key, { ...item, rollIds: [...item.rollIds] });
      });

      selectedLineDrafts.forEach((line) => {
        const existing = map.get(line.rowKey);
        if (!existing) {
          map.set(line.rowKey, {
            key: line.rowKey,
            patternId: line.patternId,
            variantId: line.variantId ?? null,
            rollIds: [...line.rollIds],
            patternNoSnapshot: line.patternNoSnapshot,
            patternNameSnapshot: line.patternNameSnapshot,
            color: line.color,
            metrePerTop: line.metrePerTop,
            topCount: line.topCount,
            totalMetres: line.totalMetres,
          });
          return;
        }

        const mergedRollIds = Array.from(
          new Set([...existing.rollIds, ...line.rollIds])
        );
        const topCount = mergedRollIds.length;
        map.set(line.rowKey, {
          ...existing,
          variantId: existing.variantId ?? line.variantId ?? null,
          rollIds: mergedRollIds,
          topCount,
          totalMetres: topCount * existing.metrePerTop,
        });
      });

      return Array.from(map.values());
    });

    setSelectedByRowKey({});
    setBulkWarning("");
  };

  const handleRemoveBasketItem = (itemKey: string) => {
    setBasketItems((current) => current.filter((item) => item.key !== itemKey));
  };

  const handleClearBasket = () => {
    setBasketItems([]);
  };

  const openBulkModal = (type: BulkActionType) => {
    if ((type === "SHIPMENT" && !canCreateShipment) || (type === "RESERVATION" && !canCreateReservation)) {
      return;
    }
    if (basketSummary.totalTops <= 0) return;
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

  const handleBulkActionConfirm = async () => {
    if (!bulkActionType) return;
    if ((bulkActionType === "SHIPMENT" && !canCreateShipment) || (bulkActionType === "RESERVATION" && !canCreateReservation)) {
      return;
    }
    if (basketItems.length === 0) {
      setBulkError("Sevk sepeti bos.");
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
      const failedItemLabels: string[] = [];

      for (const lineDraft of basketItems) {
        const successRollIds: string[] = [];

        const rollResults = await Promise.all(
          lineDraft.rollIds.map((rollId) =>
            bulkActionType === "SHIPMENT"
              ? depoSupabaseRepo.shipRoll(rollId, customer!.nameOriginal, createdAt)
              : depoSupabaseRepo.reserveRoll(rollId, customer!.nameOriginal, createdAt)
          )
        );

        rollResults.forEach((updated, idx) => {
          if (updated) successRollIds.push(lineDraft.rollIds[idx]);
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
        } else {
          failedItemLabels.push(
            `${lineDraft.patternNoSnapshot} - ${lineDraft.patternNameSnapshot}`
          );
        }
      }

      if (lineInputs.length === 0) {
        const failedInfo =
          failedItemLabels.length > 0
            ? ` Basarisiz kalem(ler): ${Array.from(new Set(failedItemLabels)).join(", ")}.`
            : "";
        throw new Error(
          `Islem uygulanamadi. Secili toplar guncellenemedi.${failedInfo} Yenileyip tekrar deneyin.`
        );
      }

      await depoTransactionsSupabaseRepo.createTransaction({
        type: bulkActionType,
        createdAt,
        customerId: customer.id,
        customerNameSnapshot: customer.nameOriginal,
        note: bulkNote.trim() || undefined,
        lines: lineInputs,
      });

      if (failedRollCount > 0) {
        const failedInfo =
          failedItemLabels.length > 0
            ? ` Kalem: ${Array.from(new Set(failedItemLabels)).join(", ")}.`
            : "";
        setBulkWarning(`${failedRollCount} top isleme alinamadi.${failedInfo} Yenileyip tekrar deneyin.`);
      }
      else setBulkWarning("");

      setBasketItems([]);
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
      (transaction) =>
        transaction.type === "ENTRY" ||
        transaction.type === "SHIPMENT" ||
        transaction.type === "RESERVATION" ||
        transaction.type === "RETURN"
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

  const detailColorSummary = useMemo(() => {
    if (!detailRow) return null;
    const uniqueColors = Array.from(
      new Set(detailRow.lines.map((line) => line.color.trim()).filter(Boolean))
    );
    if (uniqueColors.length === 0) return null;
    if (uniqueColors.length <= 3) return uniqueColors.join(", ");
    return `${uniqueColors[0]}, ${uniqueColors[1]}, ${uniqueColors[2]} +${uniqueColors.length - 3} renk`;
  }, [detailRow]);

  const handleReverseTransaction = async () => {
    if (!canReverseTransactions) return;
    if (!detailRow) return;
    const target = detailRow.transaction;
    if (target.status === "REVERSED") return;

    if (!window.confirm(`${transactionTypeLabel[target.type]} islemini geri almak istiyor musunuz?`)) return;

    try {
      const createdAt = new Date().toISOString();
      const reversalLines: Array<Omit<DepoTransactionLine, "id" | "transactionId">> = [];
      let failedCount = 0;

      for (const line of detailRow.lines) {
        const candidateRollIds = [...(line.rollIds ?? [])];
        const successRollIds: string[] = [];

        const rollResults = await Promise.all(
          candidateRollIds.map((rollId) =>
            target.type === "SHIPMENT"
              ? depoSupabaseRepo.returnRoll(rollId, createdAt)
              : depoSupabaseRepo.unreserveRoll(rollId)
          )
        );

        rollResults.forEach((updated, idx) => {
          if (updated) successRollIds.push(candidateRollIds[idx]);
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
      }

      if (reversalLines.length === 0) throw new Error("Geri alinabilecek satir bulunamadi.");

      const reversalTransaction = await depoTransactionsSupabaseRepo.createTransaction({
        type: "REVERSAL",
        createdAt,
        customerId: target.customerId,
        customerNameSnapshot: target.customerNameSnapshot,
        note: `Geri alma: ${target.id}`,
        targetTransactionId: target.id,
        lines: reversalLines,
      });

      await depoTransactionsSupabaseRepo.markTransactionReversed(target.id, reversalTransaction.id, createdAt);
      setHistoryFeedback(failedCount > 0 ? `${failedCount} top geri alinamadi.` : "Islem geri alindi.");
      refreshData(selectedPattern?.id ?? null);
    } catch (error) {
      setHistoryFeedback(error instanceof Error ? error.message : "Geri alma basarisiz");
    }
  };

  const openEditRollModal = (roll: FabricRoll) => {
    if (!canManageWarehouse) return;
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

  const handleSaveRollEdit = async () => {
    if (!canManageWarehouse) return;
    if (!editingRoll) return;
    try {
      const nextMeters = toPositiveNumber(editMeters, "Metre");
      const nextColorName = editColorName.trim();
      if (!nextColorName) throw new Error("Renk gerekli.");

      const updated = await depoSupabaseRepo.editRoll(editingRoll.id, {
        meters: nextMeters,
        rollNo: editRollNo.trim() || undefined,
        colorName: nextColorName,
        note: editNote.trim() || undefined,
      });
      if (!updated) throw new Error("Top duzeltilemedi.");

      const pattern = patterns.find((item) => item.id === updated.patternId);
      await depoTransactionsSupabaseRepo.createTransaction({
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
    if (!canManageWarehouse) return;
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

  const handleVoidRoll = async () => {
    if (!canManageWarehouse) return;
    if (!voidingRoll) return;

    try {
      const createdAt = new Date().toISOString();
      const reason = voidReason.trim() || "Manuel kaldirma";
      const updated = await depoSupabaseRepo.voidRoll(voidingRoll.id, createdAt, reason);
      if (!updated) {
        throw new Error("Sadece stokta olan top kaldirilabilir.");
      }

      const pattern = patterns.find((item) => item.id === voidingRoll.patternId);
      const color = pattern ? rollColor(voidingRoll, pattern) : voidingRoll.colorName?.trim() || "Renk yok";
      await depoTransactionsSupabaseRepo.createTransaction({
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
        {rollsError && (
          <div className="rounded-xl border border-red-500/30 bg-red-50 p-4 text-sm text-red-800">
            <p className="font-semibold text-red-900">Veriler Yüklenirken Hata Oluştu</p>
            <p className="mt-1">{rollsError}</p>
            <button
              onClick={() => refreshData(selectedPatternId)}
              className="mt-3 rounded bg-white px-3 py-1.5 text-xs font-semibold text-red-700 shadow-sm ring-1 ring-inset ring-red-500/20 hover:bg-neutral-50"
            >
              Tekrar Dene
            </button>
          </div>
        )}
        {txError && (
          <div className="rounded-xl border border-amber-500/30 bg-amber-50 p-4 text-sm text-amber-800">
            <p className="font-semibold text-amber-900">İşlem Geçmişi Yüklenemedi</p>
            <p className="mt-1">{txError}</p>
            <button
              onClick={() => refreshSyncData()}
              className="mt-3 rounded bg-white px-3 py-1.5 text-xs font-semibold text-amber-700 shadow-sm ring-1 ring-inset ring-amber-500/20 hover:bg-neutral-50"
            >
              Tekrar Dene
            </button>
          </div>
        )}
        <div className="grid gap-3 md:grid-cols-3">
          <SummaryCard title="Toplam" meters={totalRolls.reduce((t, r) => t + r.meters, 0)} rolls={totalRolls.length} tone="neutral" />
          <SummaryCard title="Rezerve" meters={reservedRolls.reduce((t, r) => t + r.meters, 0)} rolls={reservedRolls.length} tone="amber" />
          <SummaryCard title="Kullanilabilir" meters={availableRolls.reduce((t, r) => t + r.meters, 0)} rolls={availableRolls.length} tone="emerald" />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-black/10 bg-white p-3">
          <div>
            <div className="text-sm font-semibold text-neutral-900">Giris Cizelgesi</div>
            <p className="text-xs text-neutral-600">Secilen tarihteki depo girislerini anlik Excel olarak indir.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="date"
              value={dailyEntryReportDate}
              onChange={(event) => setDailyEntryReportDate(event.target.value)}
              className="rounded-lg border border-black/10 bg-white px-3 py-2 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-coffee-primary"
            />
            <button
              type="button"
              onClick={handleDownloadDailyEntryReport}
              className="rounded-lg border border-emerald-500/30 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-100"
            >
              Excel Indir
            </button>
          </div>
        </div>
        {dailyEntryReportFeedback ? (
          <p className="rounded-lg border border-black/10 bg-white px-3 py-2 text-xs font-medium text-neutral-700">
            {dailyEntryReportFeedback}
          </p>
        ) : null}
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
            Hareket
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("notes")}
            className={cn(
              "rounded-lg px-3 py-1.5 text-sm font-semibold transition",
              activeTab === "notes"
                ? "bg-coffee-primary/10 text-coffee-primary"
                : "text-neutral-700 hover:bg-neutral-100"
            )}
          >
            Notlar
          </button>
        </div>

        {activeTab !== "tx" ? (
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
                        {getPatternImage(pattern) ? (
                          <Image
                            src={getPatternImage(pattern)!}
                            alt={pattern.fabricName}
                            width={56}
                            height={56}
                            unoptimized
                            className="h-14 w-14 object-cover"
                          />
                        ) : (
                          <span className="text-xs font-semibold text-neutral-500">Foto</span>
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-neutral-900">{pattern.fabricCode} - {pattern.fabricName}</div>
                        <div className="mt-1 line-clamp-2 text-xs text-neutral-600">{shortNote(pattern.note)}</div>
                      </div>
                    </div>
                  </button>
                ))}
                {isLoadingRolls ? (
                  <div className="rounded-xl border border-dashed border-black/10 bg-coffee-surface px-3 py-10 text-center text-sm font-semibold text-coffee-primary/70 animate-pulse">
                    Yükleniyor...
                  </div>
                ) : filteredPatterns.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-black/10 bg-coffee-surface px-3 py-10 text-center text-sm text-neutral-500">
                    Filtreye uygun desen yok.
                  </div>
                ) : null}
              </div>
            </div>
          </aside>

          <section className="min-h-0 overflow-auto rounded-2xl border border-black/5 bg-white/80 p-4 shadow-[0_10px_30px_rgba(0,0,0,0.08)]">
            {!selectedPattern ? (
              <div className="flex h-full min-h-[260px] items-center justify-center rounded-xl border border-dashed border-black/10 bg-coffee-surface text-sm text-neutral-500">Sol panelden desen seciniz.</div>
            ) : (
              activeTab === "stock" ? (
              <div className="space-y-4">
                <div className="rounded-xl border border-black/10 bg-white p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="text-xs uppercase tracking-wide text-neutral-500">Secili Desen</div>
                      <h2 className="text-xl font-semibold text-neutral-900">{selectedPattern.fabricCode} - {selectedPattern.fabricName}</h2>
                      <p className="mt-2 text-sm text-neutral-600">{shortNote(selectedPattern.note)}</p>
                    </div>
                    <div className="flex flex-wrap items-start justify-end gap-3">
                      <div className="rounded-xl border border-black/10 bg-neutral-50 px-4 py-3 text-right">
                        <div className="text-xs uppercase tracking-wide text-neutral-500">Toplam Metre</div>
                        <div className="mt-1 text-2xl font-semibold text-neutral-900">{fmt(selectedPatternTotalMeters)} m</div>
                        <div className="text-xs text-neutral-600">{selectedPatternTotalRolls} aktif top</div>
                      </div>
                      {canManageWarehouse ? (
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={openReturnModal}
                            className="inline-flex items-center gap-2 rounded-lg border border-violet-500/30 bg-violet-50 px-3 py-2 text-sm font-semibold text-violet-700 transition hover:bg-violet-100"
                          >
                            <Plus className="h-4 w-4" />
                            Iade Ekle
                          </button>
                          <button type="button" onClick={openAddModal} className="inline-flex items-center gap-2 rounded-lg bg-coffee-primary px-3 py-2 text-sm font-semibold text-white transition hover:brightness-95"><Plus className="h-4 w-4" />Top Girisi</button>
                        </div>
                      ) : null}
                    </div>
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
                  {canUseBasket ? (
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-black/10 bg-neutral-50 px-3 py-2 text-sm text-neutral-800">
                      <span className="font-semibold">
                        Anlik Secim: {selectedCount} top / {fmt(selectedMeters)} m
                      </span>
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={handleAddSelectionToBasket}
                          disabled={selectedCount <= 0}
                          className="rounded-lg border border-sky-500/40 bg-white px-2.5 py-1 text-xs font-semibold text-sky-700 transition hover:bg-sky-100 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          Kalem Ekle (Desen Ekle)
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

                  {canUseBasket ? (
                  <div className="mt-3 rounded-lg border border-sky-500/30 bg-sky-50 px-3 py-3">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <span className="text-sm font-semibold text-sky-900">
                        Sevk Sepeti • Secili Desen: {basketSummary.patternCount} • Secili Top: {basketSummary.totalTops} • Toplam Metre: {fmt(basketSummary.totalMetres)}
                      </span>
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => openBulkModal("SHIPMENT")}
                          disabled={basketSummary.totalTops <= 0}
                          className="rounded-lg border border-sky-500/40 bg-white px-2.5 py-1 text-xs font-semibold text-sky-700 transition hover:bg-sky-100 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          Toplu Sevk Et
                        </button>
                        <button
                          type="button"
                          onClick={() => openBulkModal("RESERVATION")}
                          disabled={basketSummary.totalTops <= 0}
                          className="rounded-lg border border-amber-500/40 bg-white px-2.5 py-1 text-xs font-semibold text-amber-700 transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          Toplu Rezerv Yap
                        </button>
                        <button
                          type="button"
                          onClick={handleClearBasket}
                          disabled={basketSummary.totalTops <= 0}
                          className="rounded-lg border border-black/10 bg-white px-2.5 py-1 text-xs font-semibold text-neutral-700 transition hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          Sepeti Temizle
                        </button>
                      </div>
                    </div>

                    {basketItems.length > 0 ? (
                      <div className="mt-2 max-h-28 overflow-auto rounded border border-sky-500/20 bg-white/80 p-2 text-xs text-sky-900">
                        {basketItems.map((item) => (
                          <div key={item.key} className="mb-1 flex items-center justify-between gap-2 last:mb-0">
                            <span>
                              {item.patternNoSnapshot} / {item.color} / {fmt(item.metrePerTop)} m - {item.topCount} top
                            </span>
                            <button
                              type="button"
                              onClick={() => handleRemoveBasketItem(item.key)}
                              className="rounded border border-rose-500/30 bg-rose-50 px-1.5 py-0.5 text-[11px] font-semibold text-rose-700 transition hover:bg-rose-100"
                            >
                              Kaldir
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-2 text-xs text-sky-700">Sepet bos.</p>
                    )}
                  </div>
                  ) : null}
                  {bulkWarning ? <p className="mt-2 text-xs font-medium text-rose-700">{bulkWarning}</p> : null}
                  <div className="mt-3 overflow-auto rounded-lg border border-black/10">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-neutral-50 text-neutral-600"><tr><th className="px-3 py-2 font-semibold">Renk</th><th className="px-3 py-2 font-semibold">Metre</th><th className="px-3 py-2 font-semibold">Toplam Top</th><th className="px-3 py-2 font-semibold">Kullanilabilir Top</th><th className="px-3 py-2 font-semibold">Rezerve</th><th className="px-3 py-2 font-semibold">Secilecek</th><th className="px-3 py-2 font-semibold">Islem</th></tr></thead>
                      <tbody className="text-neutral-800">
                        {renderedGroups.map((group) => {
                          const selectedForGroup = selectedByRowKey[group.key] ?? 0;
                          const selectableCount = selectableCountByRowKey.get(group.key) ?? 0;
                          const basketedCount = group.availableCount - selectableCount;
                          return (
                            <Fragment key={group.key}>
                              <tr className="border-t border-black/5">
                                <td className="px-3 py-2 font-medium">{group.colorName}</td>
                                <td className="px-3 py-2">{fmt(group.meters)} m</td>
                                <td className="px-3 py-2">{group.totalCount} top ({fmt(group.totalMeters)} m)</td>
                                <td className="px-3 py-2">
                                  {selectableCount} top ({fmt(selectableCount * group.meters)} m)
                                  {basketedCount > 0 ? <span className="ml-1 text-[11px] text-sky-700">Sepette: {basketedCount}</span> : null}
                                </td>
                                <td className="px-3 py-2">{group.reservedCount} top ({fmt(group.reservedMeters)} m)</td>
                                <td className="px-3 py-2">
                                  <div className="inline-flex items-center gap-2 rounded-lg border border-black/10 px-2 py-1">
                                    <button
                                      type="button"
                                      onClick={() => setRowSelectionCount(group.key, selectedForGroup - 1, selectableCount)}
                                      disabled={!canUseBasket || selectedForGroup <= 0}
                                      className="h-6 w-6 rounded border border-black/10 text-sm font-semibold text-neutral-700 disabled:cursor-not-allowed disabled:opacity-40"
                                    >
                                      -
                                    </button>
                                    <span className="min-w-8 text-center text-sm font-semibold text-neutral-800">{selectedForGroup}</span>
                                    <button
                                      type="button"
                                      onClick={() => setRowSelectionCount(group.key, selectedForGroup + 1, selectableCount)}
                                      disabled={!canUseBasket || selectedForGroup >= selectableCount}
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
                                                  <div className="flex flex-wrap items-center gap-1">
                                                    <span className={cn("inline-flex rounded-full border px-1.5 py-0.5 text-[10px] font-semibold", statusClass[roll.status])}>
                                                      {statusLabel[roll.status]}
                                                    </span>
                                                    {selectedRollSet.has(roll.id) ? (
                                                      <span className="inline-flex rounded-full border border-sky-500/30 bg-sky-50 px-1.5 py-0.5 text-[10px] font-semibold text-sky-700">
                                                        Sepette
                                                      </span>
                                                    ) : null}
                                                  </div>
                                                </td>
                                                <td className="px-2 py-1.5">{formatDateTime(roll.inAt)}</td>
                                                <td className="px-2 py-1.5">{roll.reservedFor ?? roll.counterparty ?? "-"}</td>
                                                <td className="px-2 py-1.5">{shortNote(roll.note)}</td>
                                                <td className="px-2 py-1.5">
                                                  {canManageWarehouse && canAdjust ? (
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
              ) : (
                <div className="space-y-4">
                  <div className="rounded-xl border border-black/10 bg-white p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="text-xs uppercase tracking-wide text-neutral-500">Secili Desen</div>
                        <h2 className="text-xl font-semibold text-neutral-900">{selectedPattern.fabricCode} - {selectedPattern.fabricName}</h2>
                        <p className="mt-2 text-sm text-neutral-600">
                          Depo ve dokuma kaynakli islem notlari ayni desen gecmisinde listelenir.
                        </p>
                      </div>
                      <div className="rounded-xl border border-black/10 bg-neutral-50 px-4 py-3 text-right">
                        <div className="text-xs uppercase tracking-wide text-neutral-500">Not Kaydi</div>
                        <div className="mt-1 text-2xl font-semibold text-neutral-900">{selectedPatternNotes.length}</div>
                        <div className="text-xs text-neutral-600">desen bazli gecmis</div>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-xl border border-black/10 bg-white p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h3 className="text-sm font-semibold text-neutral-900">Desen Not Gecmisi</h3>
                      <span className="rounded-full border border-black/10 bg-neutral-50 px-2.5 py-1 text-xs font-semibold text-neutral-700">
                        {selectedPatternNotes.length} kayit
                      </span>
                    </div>

                    <div className="mt-3 space-y-3">
                      {selectedPatternNotes.map((entry) => {
                        const title = formatPatternNoteTitle(entry);
                        const actionSummary = formatPatternNoteActionSummary(entry);
                        const variantText = formatPatternNoteVariant(entry);
                        const topCountText = formatPatternNoteTopCount(entry);
                        const metersText = formatPatternNoteMeters(entry);

                        return (
                          <div key={entry.id} className="rounded-xl border border-black/10 bg-neutral-50 px-4 py-3">
                            <div className="flex flex-wrap items-start justify-between gap-2">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="inline-flex rounded-full border border-black/10 bg-white px-2.5 py-1 text-xs font-semibold text-neutral-800">
                                  {entry.operationLabel}
                                </span>
                                <span className="text-xs text-neutral-500">{formatDateTime(entry.createdAt)}</span>
                              </div>
                              <span
                                className={cn(
                                  "inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold",
                                  entry.sourceType === "DOKUMA"
                                    ? "border-amber-500/30 bg-amber-50 text-amber-700"
                                    : "border-sky-500/30 bg-sky-50 text-sky-700"
                                )}
                              >
                                {entry.sourceType === "DOKUMA" ? "Dokuma" : "Depo"}
                              </span>
                            </div>

                            <div className="mt-3">
                              <h4 className="text-base font-semibold text-neutral-900">{title}</h4>
                              {actionSummary ? (
                                <p className="mt-1 text-xs font-medium text-neutral-600">{actionSummary}</p>
                              ) : null}
                            </div>

                            <p className="mt-3 text-sm text-neutral-900">{entry.note}</p>

                            {variantText || topCountText || metersText ? (
                              <div className="mt-3 flex flex-wrap gap-2 text-xs text-neutral-600">
                                {variantText ? (
                                  <span className="rounded-full border border-black/10 bg-white px-2.5 py-1">
                                    {entry.sourceType === "DOKUMA"
                                      ? `Renk / Varyant: ${variantText}`
                                      : `Renk Ozeti: ${variantText}`}
                                  </span>
                                ) : null}
                                {topCountText ? (
                                  <span className="rounded-full border border-black/10 bg-white px-2.5 py-1">
                                    {topCountText}
                                  </span>
                                ) : null}
                                {metersText ? (
                                  <span className="rounded-full border border-black/10 bg-white px-2.5 py-1">
                                    {metersText}
                                  </span>
                                ) : null}
                              </div>
                            ) : null}

                            {entry.sourceType === "DEPO" && entry.transactionId ? (
                              <div className="mt-3 flex justify-end">
                                <button
                                  type="button"
                                  onClick={() => setDetailTransactionId(entry.transactionId ?? null)}
                                  className="rounded-lg border border-black/10 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-700 transition hover:bg-neutral-100"
                                >
                                  Detayi Gor
                                </button>
                              </div>
                            ) : null}
                          </div>
                        );
                      })}

                      {selectedPatternNotes.length === 0 ? (
                        <div className="rounded-xl border border-dashed border-black/10 bg-neutral-50 px-4 py-10 text-center text-sm text-neutral-500">
                          Bu desen icin kayitli islem notu bulunmuyor.
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>
              )
            )}
          </section>
        </div>
        ) : (
          <section className="min-h-0 h-[calc(100vh-320px)] overflow-auto rounded-2xl border border-black/5 bg-white/80 p-4 shadow-[0_10px_30px_rgba(0,0,0,0.08)]">
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-lg font-semibold text-neutral-900">Depo Hareket Gecmisi</h2>
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
                      <th className="px-3 py-2 font-semibold">Desen Sayisi</th>
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
        <Modal title="Top Girisi" onClose={() => setAddOpen(false)} size="lg">
          <p className="text-sm text-neutral-600">{selectedPattern.fabricCode} - {selectedPattern.fabricName}</p>
          <div className="mt-4 space-y-3">
            <select value={addVariantId} onChange={(e) => setAddVariantId(e.target.value)} className="w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-coffee-primary">{selectedPattern.variants.map((variant) => <option key={variant.id} value={variant.id}>{variantName(variant)}</option>)}<option value="__other">Diger (serbest renk)</option></select>
            {addVariantId === "__other" ? <input type="text" value={addColorName} onChange={(e) => setAddColorName(e.target.value)} placeholder="Renk adi" className="w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-coffee-primary" /> : null}
            <div className="rounded-xl border border-black/10 bg-neutral-50 p-3">
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-neutral-600">Hizli Top Girisi</div>
                <p className="text-xs text-neutral-500">Metre ve adet girip Enter ile listeye ekleyin. Islemi en son Kaydet ile tamamlayin.</p>
              </div>
              <div className="mt-3 space-y-2">
                {addRows.map((row, index) => (
                  <div key={row.id} className="grid gap-2 sm:grid-cols-[minmax(0,1fr),minmax(0,1fr)]">
                    <input
                      ref={(node) => {
                        addMeterInputRefs.current[row.id] = node;
                      }}
                      type="number"
                      min="0"
                      step="0.01"
                      value={row.meters}
                      onChange={(event) => updateAddRow(row.id, "meters", event.target.value)}
                      onKeyDown={(event) => handleAddRowMetersKeyDown(event, row.id)}
                      placeholder={`Top ${index + 1} metre`}
                      className="w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-coffee-primary"
                    />
                    <input
                      type="number"
                      min="1"
                      step="1"
                      value={row.quantity}
                      onChange={(event) => updateAddRow(row.id, "quantity", event.target.value)}
                      onKeyDown={(event) => handleAddRowMetersKeyDown(event, row.id)}
                      placeholder="Adet"
                      className="w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-coffee-primary"
                    />
                  </div>
                ))}
              </div>
            </div>
            <input type="date" value={addDate} onChange={(e) => setAddDate(e.target.value)} className="w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-coffee-primary" />
            <input type="text" value={addNote} onChange={(e) => setAddNote(e.target.value)} placeholder="Not (ops)" className="w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-coffee-primary" />

            <div className="rounded-xl border border-black/10 bg-white p-3">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <div className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                  Eklenen Toplar
                </div>
                <div className="rounded-full border border-black/10 bg-neutral-50 px-2.5 py-1 text-[11px] font-semibold text-neutral-700">
                  {pendingAddTotals.totalTops} top / {fmt(pendingAddTotals.totalMetres)} m
                </div>
              </div>
              <div className="max-h-[280px] space-y-1 overflow-auto pr-1 text-xs text-neutral-700">
                {pendingAddEntries.map((entry) => (
                  <div key={entry.id} className="flex items-center justify-between gap-2 rounded-lg border border-black/5 bg-neutral-50 px-2.5 py-2">
                    <div>
                      <div className="font-medium text-neutral-900">
                        {entry.colorName} / {fmt(entry.meters)} m
                      </div>
                      <div>
                        {entry.quantity} top
                        {" / "}
                        Toplam {fmt(entry.totalMetres)} m
                        {" / "}
                        {formatDateTime(entry.createdAt)}
                      </div>
                    </div>
                    {canManageWarehouse ? (
                      <button
                        type="button"
                        onClick={() => handleDeletePendingAddEntry(entry.id)}
                        className="rounded border border-rose-500/30 bg-rose-50 px-2 py-1 text-[11px] font-semibold text-rose-700 transition hover:bg-rose-100"
                      >
                        Sil
                      </button>
                    ) : null}
                  </div>
                ))}
                {pendingAddEntries.length === 0 ? <div>Kayit yok.</div> : null}
              </div>
            </div>
          </div>
          {addError ? <p className="mt-3 text-sm text-rose-600">{addError}</p> : null}
          <div className="mt-4 flex justify-end gap-2">
            <button type="button" onClick={() => setAddOpen(false)} className="rounded-lg px-3 py-2 text-sm text-neutral-600 transition hover:bg-neutral-100">Vazgec</button>
            {canManageWarehouse ? <button type="button" onClick={handleAddRoll} className="rounded-lg bg-coffee-primary px-4 py-2 text-sm font-semibold text-white transition hover:brightness-95">Kaydet</button> : null}
          </div>
        </Modal>
      ) : null}

      {returnOpen ? (
        <Modal title="Iade Ekle" onClose={closeReturnModal} size="lg">
          <div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-semibold text-neutral-600">Musteri</label>
                <input
                  type="text"
                  value={returnCustomerInput}
                  onChange={(event) => {
                    setReturnCustomerInput(event.target.value);
                    setReturnCustomerId(null);
                  }}
                  placeholder="Musteri adi"
                  className="w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-coffee-primary"
                />
                <div className="mt-2 max-h-32 overflow-auto rounded-lg border border-black/10 bg-white">
                  {returnCustomerSuggestions.map((customer) => (
                    <button
                      key={customer.id}
                      type="button"
                      onClick={() => {
                        setReturnCustomerId(customer.id);
                        setReturnCustomerInput(customer.nameOriginal);
                      }}
                      className={cn(
                        "block w-full border-t border-black/5 px-3 py-2 text-left text-xs text-neutral-700 first:border-t-0 hover:bg-neutral-50",
                        returnCustomerId === customer.id ? "bg-coffee-primary/10 text-coffee-primary" : ""
                      )}
                    >
                      {customer.nameOriginal}
                    </button>
                  ))}
                  {returnCustomerInput.trim() && !returnExactCustomerMatch ? (
                    <button
                      type="button"
                      onClick={() => {
                        setReturnCustomerId(null);
                        setReturnCustomerInput(returnCustomerInput.trim());
                      }}
                      className="block w-full border-t border-black/5 px-3 py-2 text-left text-xs font-semibold text-emerald-700 hover:bg-emerald-50"
                    >
                      Yeni musteri olarak ekle: <span className="font-mono">{returnCustomerInput.trim()}</span>
                    </button>
                  ) : null}
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-neutral-600">Desen</label>
                <select
                  value={returnPatternId}
                  onChange={(event) => handleReturnPatternChange(event.target.value)}
                  className="w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-coffee-primary"
                >
                  {patterns.map((pattern) => (
                    <option key={pattern.id} value={pattern.id}>
                      {pattern.fabricCode} - {pattern.fabricName}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <select value={returnVariantId} onChange={(event) => setReturnVariantId(event.target.value)} className="w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-coffee-primary">{returnSelectedPattern?.variants.map((variant) => <option key={variant.id} value={variant.id}>{variantName(variant)}</option>)}<option value="__other">Diger (serbest renk)</option></select>
              {returnVariantId === "__other" ? <input type="text" value={returnColorName} onChange={(event) => setReturnColorName(event.target.value)} placeholder="Renk adi" className="w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-coffee-primary" /> : <div className="rounded-lg border border-black/10 bg-neutral-50 px-3 py-2 text-sm text-neutral-500">Secili varyant iade rengi olarak kullanilir.</div>}
            </div>

            <div className="rounded-xl border border-black/10 bg-neutral-50 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wide text-neutral-600">Iade Toplari</div>
                  <p className="text-xs text-neutral-500">Her satir adet kadar ayri top kaydi olusturur.</p>
                </div>
                <button
                  type="button"
                  onClick={appendReturnRow}
                  className="inline-flex items-center gap-1 rounded-lg border border-black/10 bg-white px-2.5 py-1 text-xs font-semibold text-neutral-700 transition hover:bg-neutral-100"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Satir Ekle
                </button>
              </div>
              <div className="mt-3 space-y-2">
                {returnRows.map((row, index) => (
                  <div key={row.id} className="grid gap-2 sm:grid-cols-[minmax(0,1fr),minmax(0,1fr),auto]">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={row.meters}
                      onChange={(event) => updateReturnRow(row.id, "meters", event.target.value)}
                      placeholder={`Iade topu ${index + 1} metre`}
                      className="w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-coffee-primary"
                    />
                    <input
                      type="number"
                      min="1"
                      step="1"
                      value={row.quantity}
                      onChange={(event) => updateReturnRow(row.id, "quantity", event.target.value)}
                      placeholder="Adet"
                      className="w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-coffee-primary"
                    />
                    <button
                      type="button"
                      onClick={() => removeReturnRow(row.id)}
                      disabled={returnRows.length === 1}
                      className="rounded-lg border border-rose-500/30 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Sil
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <input type="date" value={returnDate} onChange={(event) => setReturnDate(event.target.value)} className="w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-coffee-primary" />
              <input type="text" value={returnNote} onChange={(event) => setReturnNote(event.target.value)} placeholder="Iade notu (ops)" className="w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-coffee-primary" />
            </div>
          </div>
          {returnError ? <p className="mt-3 text-sm text-rose-600">{returnError}</p> : null}
          <div className="mt-4 flex justify-end gap-2">
            <button type="button" onClick={closeReturnModal} className="rounded-lg px-3 py-2 text-sm text-neutral-600 transition hover:bg-neutral-100">Vazgec</button>
            {canManageWarehouse ? <button type="button" onClick={handleAddReturn} className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white transition hover:brightness-95">Iadeyi Kaydet</button> : null}
          </div>
        </Modal>
      ) : null}

      {operationSummary ? (
        <Modal title={operationSummary.title} onClose={() => setOperationSummary(null)} size="lg">
          <div className="space-y-4">
            <div className="rounded-xl border border-black/10 bg-neutral-50 px-4 py-3 text-sm text-neutral-700">
              <div className="font-semibold text-neutral-900">{operationSummary.description}</div>
              <div className="mt-1">Tarih: {formatDateTime(operationSummary.createdAt)}</div>
              {operationSummary.customerName ? <div>Musteri: {operationSummary.customerName}</div> : null}
            </div>
            <div className="overflow-auto rounded-lg border border-black/10">
              <table className="w-full text-left text-sm">
                <thead className="bg-neutral-50 text-neutral-600">
                  <tr>
                    <th className="px-3 py-2 font-semibold">Desen</th>
                    <th className="px-3 py-2 font-semibold">Eklenen Top</th>
                    <th className="px-3 py-2 font-semibold">Eklenen Metre</th>
                  </tr>
                </thead>
                <tbody className="text-neutral-800">
                  {operationSummary.patterns.map((pattern) => (
                    <tr key={pattern.key} className="border-t border-black/5">
                      <td className="px-3 py-2">{pattern.patternNoSnapshot} - {pattern.patternNameSnapshot}</td>
                      <td className="px-3 py-2">{pattern.totalTops}</td>
                      <td className="px-3 py-2">{fmt(pattern.totalMetres)} m</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg border border-black/10 bg-white px-4 py-3">
                <div className="text-xs uppercase tracking-wide text-neutral-500">Genel Toplam Top</div>
                <div className="mt-1 text-xl font-semibold text-neutral-900">{operationSummary.totalTops}</div>
              </div>
              <div className="rounded-lg border border-black/10 bg-white px-4 py-3">
                <div className="text-xs uppercase tracking-wide text-neutral-500">Genel Toplam Metre</div>
                <div className="mt-1 text-xl font-semibold text-neutral-900">{fmt(operationSummary.totalMetres)} m</div>
              </div>
            </div>
          </div>
          <div className="mt-4 flex justify-end">
            <button type="button" onClick={() => setOperationSummary(null)} className="rounded-lg bg-coffee-primary px-4 py-2 text-sm font-semibold text-white transition hover:brightness-95">Kapat</button>
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
            <p className="text-sm text-neutral-600">
              Sepet: {basketSummary.patternCount} desen / {basketSummary.totalTops} top / {fmt(basketSummary.totalMetres)} m
            </p>
            <div className="max-h-32 overflow-auto rounded-lg border border-black/10 bg-neutral-50 px-3 py-2">
              <div className="space-y-1 text-xs text-neutral-700">
                {basketItems.map((line) => (
                  <div key={line.key}>
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
            {canUseBasket ? <button type="button" onClick={handleBulkActionConfirm} className="rounded-lg bg-coffee-primary px-4 py-2 text-sm font-semibold text-white transition hover:brightness-95">Onayla</button> : null}
          </div>
        </Modal>
      ) : null}

      {detailRow ? (
        <Modal title={`${transactionTypeLabel[detailRow.transaction.type]} Detayi`} onClose={() => setDetailTransactionId(null)} size="xl">
          <div className="space-y-3 text-sm">
            <div className="grid gap-3 lg:grid-cols-[minmax(0,1.4fr)_minmax(260px,0.6fr)]">
              <div className="rounded-lg border border-black/10 bg-neutral-50 px-3 py-3 text-neutral-700">
                <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                  Islem Ozeti
                </div>
                <div className="grid gap-1">
                  <div>Tip: {transactionTypeLabel[detailRow.transaction.type]}</div>
                  <div>Tarih: {formatDateTime(detailRow.transaction.createdAt)}</div>
                  <div>Islem Ref: <span className="font-mono">{formatShortRef(detailRow.transaction.id)}</span></div>
                  <div>Cari / Hedef: {detailRow.transaction.customerNameSnapshot ?? "-"}</div>
                  <div>Durum: {detailRow.transaction.status === "REVERSED" ? "Iptal Edildi" : "Aktif"}</div>
                  {detailColorSummary ? <div>Renk Ozeti: {detailColorSummary}</div> : null}
                  {detailRow.transaction.note ? <div>Not: {detailRow.transaction.note}</div> : null}
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
                <div className="rounded-lg border border-black/10 bg-white px-4 py-3">
                  <div className="text-xs uppercase tracking-wide text-neutral-500">Toplam Top</div>
                  <div className="mt-1 text-xl font-semibold text-neutral-900">
                    {detailRow.totals.totalTops}
                  </div>
                </div>
                <div className="rounded-lg border border-black/10 bg-white px-4 py-3">
                  <div className="text-xs uppercase tracking-wide text-neutral-500">Toplam Metre</div>
                  <div className="mt-1 text-xl font-semibold text-neutral-900">
                    {fmt(detailRow.totals.totalMetres)} m
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              {detailLineGroups.map((group) => (
                <div key={group.key} className="rounded-lg border border-black/10 bg-white p-3">
                  <h4 className="text-sm font-semibold text-neutral-900">
                    {group.patternNoSnapshot} - {group.patternNameSnapshot}
                  </h4>
                  <div className="mt-2 overflow-auto rounded-lg border border-black/10">
                    <table className="w-full text-left text-xs text-neutral-700">
                      <thead className="bg-neutral-50 text-neutral-600">
                        <tr>
                          <th className="px-2 py-1.5 font-semibold">Renk / Varyant</th>
                          <th className="px-2 py-1.5 font-semibold">Top</th>
                          <th className="px-2 py-1.5 font-semibold">Toplam Metre</th>
                          <th className="px-2 py-1.5 font-semibold">Dagilim</th>
                        </tr>
                      </thead>
                      <tbody>
                        {group.lines.map((line) => (
                          <tr key={line.id} className="border-t border-black/5">
                            <td className="px-2 py-1.5">{line.color}</td>
                            <td className="px-2 py-1.5">{line.topCount}</td>
                            <td className="px-2 py-1.5">{fmt(line.totalMetres)} m</td>
                            <td className="px-2 py-1.5">
                              {line.topCount > 1
                                ? `${line.topCount} x ${fmt(line.metrePerTop)} m`
                                : `${fmt(line.metrePerTop)} m`}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="mt-2 text-xs font-semibold text-neutral-800">
                    Alt Toplam: {group.totalTop} top / {fmt(group.totalMetre)} m
                  </div>
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
            {canReverseTransactions &&
            detailRow.transaction.status !== "REVERSED" &&
            (detailRow.transaction.type === "SHIPMENT" || detailRow.transaction.type === "RESERVATION") ? (
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
            {canManageWarehouse ? <button type="button" onClick={handleVoidRoll} className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white transition hover:brightness-95">Onayla</button> : null}
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
            {canManageWarehouse ? <button type="button" onClick={handleSaveRollEdit} className="rounded-lg bg-coffee-primary px-4 py-2 text-sm font-semibold text-white transition hover:brightness-95">Kaydet</button> : null}
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
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const widthClass =
    size === "xl" ? "max-w-3xl" : size === "lg" ? "max-w-xl" : "max-w-md";

  useModalFocusTrap({ containerRef: dialogRef });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className={cn("w-full rounded-2xl border border-black/10 bg-white p-5 shadow-2xl", widthClass)}
        onClick={(event) => event.stopPropagation()}
      >
        <h3 className="text-lg font-semibold text-neutral-900">{title}</h3>
        <div className="mt-2">{children}</div>
      </div>
    </div>
  );
}
