"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import Image from "next/image";

import { useAuthProfile } from "@/components/AuthProfileProvider";
import Layout from "../components/Layout";
import { cn } from "@/lib/cn";
import type { Dyehouse } from "@/lib/domain/dyehouse";
import type { Pattern } from "@/lib/domain/pattern";
import type {
  WeavingPlan,
  WeavingPlanStatus,
  WeavingPlanVariant,
  WeavingProgressEntry,
  WeavingTransfer,
  WeavingTransferDestination,
} from "@/lib/domain/weaving";
import { dyehouseLocalRepo } from "@/lib/repos/dyehouseLocalRepo";
import { patternsSupabaseRepo } from "@/lib/repos/patternsSupabaseRepo";
import { weavingSupabaseRepo } from "@/lib/repos/weavingSupabaseRepo";
import { useModalFocusTrap } from "@/lib/useModalFocusTrap";
import {
  WORKFLOW_PROGRESS_EPSILON,
  calculateProgressTotalMeters,
  nowDateTimeLocal,
  toIsoFromDateTimeLocal,
  toPositiveIntInput as toPositiveInt,
  toPositiveNumberInput as toPositiveNumber,
} from "@/lib/workflowProgress";

const fmt = (value: number) =>
  value.toLocaleString("tr-TR", { maximumFractionDigits: 2 });

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

const sortPatterns = (patterns: Pattern[]) =>
  [...patterns].sort((a, b) => a.fabricCode.localeCompare(b.fabricCode, "tr-TR"));

const getPatternImage = (pattern: Pattern) =>
  pattern.imageFinal ??
  pattern.finalImageUrl ??
  pattern.imageDigital ??
  pattern.digitalImageUrl ??
  (pattern as Pattern & { image?: string | null }).image ??
  null;

const normalizeImageSrc = (value: string | null | undefined) => {
  if (!value) return null;
  const v = value.trim();
  if (!v) return null;
  if (v.startsWith("data:image/")) return v;
  if (v.startsWith("/") || v.startsWith("./") || v.startsWith("../")) return v;
  if (v.startsWith("http://") || v.startsWith("https://") || v.startsWith("blob:")) return v;
  return `data:image/jpeg;base64,${v}`;
};

const getPatternDigitalImage = (pattern: Pattern | null) => {
  if (!pattern) return null;
  return (
    pattern.imageDigital ??
    pattern.digitalImageUrl ??
    (pattern as Pattern & { image?: string | null }).image ??
    null
  );
};

const getPatternFinalImage = (pattern: Pattern | null) => {
  if (!pattern) return null;
  return (
    pattern.imageFinal ??
    pattern.finalImageUrl ??
    (pattern as Pattern & { image?: string | null }).image ??
    null
  );
};

type PatternWithLegacyFields = Pattern &
  Record<string, unknown> & {
    image?: string | null;
  };

const toDisplayText = (value: unknown): string | null => {
  if (value === null || value === undefined) return null;

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed || trimmed === "-" || trimmed === "--") return null;
    return trimmed;
  }

  if (typeof value === "number") {
    if (!Number.isFinite(value)) return null;
    return fmt(value);
  }

  if (typeof value === "boolean") {
    return value ? "Evet" : "Hayir";
  }

  if (Array.isArray(value)) {
    const items = value
      .map((item) => toDisplayText(item))
      .filter((item): item is string => Boolean(item));
    return items.length > 0 ? items.join(", ") : null;
  }

  return null;
};

const toDisplayMetric = (value: unknown, unit: string): string | null => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return `${fmt(value)} ${unit}`;
  }

  const text = toDisplayText(value);
  if (!text) return null;
  const normalized = text.toLocaleLowerCase("tr-TR");
  if (normalized.includes(unit.toLocaleLowerCase("tr-TR"))) return text;
  return `${text} ${unit}`;
};

const readPatternField = (pattern: Pattern | null, keys: string[]): unknown => {
  if (!pattern) return undefined;
  const source = pattern as PatternWithLegacyFields;

  for (const key of keys) {
    const value = source[key];
    if (value === undefined || value === null) continue;
    if (typeof value === "string" && !value.trim()) continue;
    return value;
  }

  return undefined;
};

type FabricDetailItem = {
  label: string;
  value: string;
};

const getFabricDetailItems = (pattern: Pattern | null): FabricDetailItem[] => {
  if (!pattern) return [];

  const details: Array<{ label: string; value: string | null }> = [
    { label: "Kalite", value: toDisplayText(readPatternField(pattern, ["quality", "kalite"])) },
    { label: "Renk", value: toDisplayText(readPatternField(pattern, ["color", "renk"])) },
    { label: "Orgu", value: toDisplayText(readPatternField(pattern, ["weaveType", "weave", "orgu"])) },
    {
      label: "Kompozisyon",
      value: toDisplayText(readPatternField(pattern, ["composition", "kompozisyon", "icerik"])),
    },
    { label: "Finish", value: toDisplayText(readPatternField(pattern, ["finish"])) },
    { label: "Cozgu", value: toDisplayText(readPatternField(pattern, ["warpCount", "warp", "cozgu"])) },
    { label: "Atki", value: toDisplayText(readPatternField(pattern, ["weftCount", "weft", "atki"])) },
    { label: "Toplam Tel", value: toDisplayText(readPatternField(pattern, ["totalEnds", "totalTel"])) },
    {
      label: "En",
      value: toDisplayMetric(readPatternField(pattern, ["eniCm", "widthCm", "width", "en"]), "cm"),
    },
    {
      label: "Tarak Eni (cm)",
      value: toDisplayMetric(readPatternField(pattern, ["tarakEniCm", "reedWidthCm"]), "cm"),
    },
    { label: "Tarak No", value: toDisplayText(readPatternField(pattern, ["tarakNo"])) },
    { label: "Cozgu Gr", value: toDisplayText(readPatternField(pattern, ["cozguGr"])) },
    { label: "Atki Gr", value: toDisplayText(readPatternField(pattern, ["atkiGr"])) },
    { label: "Mt Tul", value: toDisplayText(readPatternField(pattern, ["mtTul"])) },
    {
      label: "Opsiyonel Not",
      value: toDisplayText(readPatternField(pattern, ["opsiyonelNot", "weavingDetailsNote"])),
    },
    {
      label: "Gramaj",
      value: toDisplayMetric(readPatternField(pattern, ["gramajGm2", "weight", "gramaj"]), "g/m2"),
    },
    { label: "Kg", value: toDisplayMetric(readPatternField(pattern, ["kg"]), "kg") },
    {
      label: "Fire Orani",
      value: toDisplayMetric(readPatternField(pattern, ["fireOrani", "fire", "wasteRate"]), "%"),
    },
    {
      label: "Musteri",
      value: toDisplayText(readPatternField(pattern, ["musteri", "customer", "musteriAdi"])),
    },
    { label: "Depo No", value: toDisplayText(readPatternField(pattern, ["depoNo", "warehouseNo"])) },
    { label: "Parti No", value: toDisplayText(readPatternField(pattern, ["partiNos", "partiNo"])) },
    { label: "Not", value: toDisplayText(readPatternField(pattern, ["note"])) },
  ];

  return details.filter((item): item is FabricDetailItem => Boolean(item.value));
};

const transferDestinationLabel: Record<WeavingTransferDestination, string> = {
  DYEHOUSE: "Boyahane",
  WAREHOUSE: "Depo",
};

const composeCountAndYarn = (count: string, yarn: string) => {
  const countValue = count.trim();
  const yarnValue = yarn.trim();
  if (countValue && yarnValue) return `${countValue}/${yarnValue}`;
  if (countValue) return countValue;
  if (yarnValue) return yarnValue;
  return "";
};

const normalizeCountAndYarn = (count: string, yarn: string): string | null => {
  const value = composeCountAndYarn(count, yarn).trim();
  return value ? value : null;
};

type FabricDraft = {
  color: string;
  weave: string;
  cozguSayi: string;
  cozguIplik: string;
  atkiSayi: string;
  atkiIplik: string;
  toplamTel: string;
  tarakNo: string;
  tarakEniCm: string;
  cozguGr: string;
  atkiGr: string;
  mtTul: string;
  opsiyonelNot: string;
};

const normalizeDraftText = (value: string | null | undefined) => {
  const trimmed = value?.trim() ?? "";
  if (!trimmed || trimmed === "-" || trimmed === "--") return "";
  return trimmed;
};

const splitCountAndYarn = (value: string | null | undefined) => {
  const normalized = normalizeDraftText(value);
  if (!normalized) return { count: "", yarn: "" };

  const [count, ...yarnParts] = normalized.split("/");
  return {
    count: count?.trim() ?? "",
    yarn: yarnParts.join("/").trim(),
  };
};

const normalizeDraftMetric = (value: number | null | undefined) =>
  typeof value === "number" && Number.isFinite(value) ? String(value) : "";

const createFabricDraftFromPattern = (pattern: Pattern | null): FabricDraft => {
  const warp = splitCountAndYarn(pattern?.warpCount);
  const weft = splitCountAndYarn(pattern?.weftCount);

  return {
    color: normalizeDraftText(pattern?.color),
    weave: normalizeDraftText(pattern?.weaveType),
    cozguSayi: warp.count,
    cozguIplik: warp.yarn,
    atkiSayi: weft.count,
    atkiIplik: weft.yarn,
    toplamTel: normalizeDraftText(pattern?.totalEnds),
    tarakNo: normalizeDraftText(pattern?.tarakNo),
    tarakEniCm: normalizeDraftMetric(pattern?.tarakEniCm),
    cozguGr: normalizeDraftMetric(pattern?.cozguGr),
    atkiGr: normalizeDraftMetric(pattern?.atkiGr),
    mtTul: normalizeDraftMetric(pattern?.mtTul),
    opsiyonelNot: normalizeDraftText(pattern?.opsiyonelNot),
  };
};

const isFabricDraftEqual = (left: FabricDraft, right: FabricDraft) =>
  left.color === right.color &&
  left.weave === right.weave &&
  left.cozguSayi === right.cozguSayi &&
  left.cozguIplik === right.cozguIplik &&
  left.atkiSayi === right.atkiSayi &&
  left.atkiIplik === right.atkiIplik &&
  left.toplamTel === right.toplamTel &&
  left.tarakNo === right.tarakNo &&
  left.tarakEniCm === right.tarakEniCm &&
  left.cozguGr === right.cozguGr &&
  left.atkiGr === right.atkiGr &&
  left.mtTul === right.mtTul &&
  left.opsiyonelNot === right.opsiyonelNot;

type PlanTotals = {
  plannedMeters: number;
  wovenMeters: number;
  totalSentMeters: number;
  sentToDyehouse: number;
  sentToWarehouse: number;
  remainingPlanned: number;
  pendingToSend: number;
};

type PlanSortOption =
  | "created_desc"
  | "created_asc"
  | "code_asc"
  | "code_desc"
  | "planned_desc"
  | "woven_desc"
  | "remaining_desc";

type PlanListFilter = "OPEN" | "ALL" | WeavingPlanStatus;

const planSortOptions: Array<{ value: PlanSortOption; label: string }> = [
  { value: "created_desc", label: "Eklenme Tarihi (Yeni -> Eski)" },
  { value: "created_asc", label: "Eklenme Tarihi (Eski -> Yeni)" },
  { value: "code_asc", label: "Desen Kodu (A -> Z)" },
  { value: "code_desc", label: "Desen Kodu (Z -> A)" },
  { value: "planned_desc", label: "Plan (Buyuk -> Kucuk)" },
  { value: "woven_desc", label: "Dokunan (Buyuk -> Kucuk)" },
  { value: "remaining_desc", label: "Kalan (Buyuk -> Kucuk)" },
];

const planStatusLabels: Record<WeavingPlanStatus, string> = {
  ACTIVE: "Aktif",
  COMPLETED: "Tamamlandi",
  CANCELLED: "Iptal / Arsiv",
};

const planListFilterOptions: Array<{ value: PlanListFilter; label: string }> = [
  { value: "OPEN", label: "Aktif Liste" },
  { value: "ACTIVE", label: "Sadece Aktif" },
  { value: "COMPLETED", label: "Tamamlananlar" },
  { value: "CANCELLED", label: "Iptal / Arsiv" },
  { value: "ALL", label: "Tum Planlar" },
];

type WarningConfirmState = {
  title: string;
  summary: string;
  messages: string[];
  confirmLabel: string;
  onConfirm: () => void;
};

const fallbackPlanTotals = (plan: WeavingPlan): PlanTotals => ({
  plannedMeters: hasPlanVariants(plan)
    ? sumPlanVariantPlannedMeters(plan.variants)
    : plan.plannedMeters,
  wovenMeters: 0,
  totalSentMeters: 0,
  sentToDyehouse: 0,
  sentToWarehouse: 0,
  remainingPlanned: hasPlanVariants(plan)
    ? sumPlanVariantPlannedMeters(plan.variants)
    : plan.plannedMeters,
  pendingToSend: 0,
});

const resolvePlanTotals = (plan: WeavingPlan, totalsById: Map<string, PlanTotals>) =>
  totalsById.get(plan.id) ?? fallbackPlanTotals(plan);

const hasPlanVariants = (
  plan: WeavingPlan | null | undefined
): plan is WeavingPlan & { variants: WeavingPlanVariant[] } =>
  Boolean(plan && Array.isArray(plan.variants) && plan.variants.length > 0);

const sumPlanVariantPlannedMeters = (variants: WeavingPlanVariant[]) =>
  variants.reduce((sum, variant) => sum + variant.plannedMeters, 0);

const sumPlanVariantWovenMeters = (variants: WeavingPlanVariant[]) =>
  variants.reduce((sum, variant) => sum + variant.wovenMeters, 0);

const sumPlanVariantShippedMeters = (variants: WeavingPlanVariant[]) =>
  variants.reduce((sum, variant) => sum + variant.shippedMeters, 0);

const EPSILON = WORKFLOW_PROGRESS_EPSILON;

const getVariantDisplayName = (variant: WeavingPlanVariant) =>
  [variant.variantCode?.trim(), variant.colorName.trim()].filter(Boolean).join(" / ");

const getPlanWarningMessages = (plan: WeavingPlan, totals: PlanTotals) => {
  const warnings: string[] = [];

  if (hasPlanVariants(plan)) {
    plan.variants
      .filter((variant) => variant.wovenMeters - variant.plannedMeters > EPSILON)
      .slice(0, 2)
      .forEach((variant) => {
        warnings.push(`${getVariantDisplayName(variant)} plan metresini asti.`);
      });
  }

  if (totals.wovenMeters - totals.plannedMeters > EPSILON) {
    warnings.push("Toplam dokuma, plan metresinin uzerinde gorunuyor.");
  }

  if (totals.totalSentMeters - totals.wovenMeters > EPSILON) {
    warnings.push("Sevk toplami, dokunan metreden fazla gorunuyor.");
  }

  if (
    plan.status === "COMPLETED" &&
    plan.manualCompletedAt &&
    totals.plannedMeters - totals.wovenMeters > EPSILON
  ) {
    warnings.push("Plan tamamlandi olarak isaretli ama eksik dokuma var.");
  }

  return warnings;
};

const getProgressWarningMessages = (
  plan: WeavingPlan,
  totals: PlanTotals,
  variantId: string,
  progressMeters: number
) => {
  const warnings: string[] = [];

  if (hasPlanVariants(plan)) {
    const variant = plan.variants.find((item) => item.id === variantId);
    if (variant && variant.wovenMeters + progressMeters - variant.plannedMeters > EPSILON) {
      warnings.push(`${getVariantDisplayName(variant)} icin giris, varyant planini asiyor.`);
    }
  }

  if (totals.wovenMeters + progressMeters - totals.plannedMeters > EPSILON) {
    warnings.push("Bu giris toplam plan metresini asiyor.");
  }

  return warnings;
};

const getCompletionWarningMessages = (plan: WeavingPlan, totals: PlanTotals) => {
  const warnings = getPlanWarningMessages(plan, totals);

  if (totals.plannedMeters - totals.wovenMeters > EPSILON) {
    warnings.unshift("Plan eksik dokunmus durumda; yine de tamamlandi olarak isaretlenecek.");
  }

  return Array.from(new Set(warnings));
};

type PatternSelectorTab = "SELECT" | "NEW";

type NewPatternForm = {
  code: string;
  name: string;
  weaveType: string;
  color: string;
  warpCountValue: string;
  warpYarnValue: string;
  weftCountValue: string;
  weftYarnValue: string;
  tarakEniCm: string;
  totalEnds: string;
  imageDigital: string | null;
  imageFinal: string | null;
  digitalPreviewUrl: string | null;
  finalPreviewUrl: string | null;
};

const createEmptyNewPatternForm = (): NewPatternForm => ({
  code: "",
  name: "",
  weaveType: "",
  color: "",
  warpCountValue: "",
  warpYarnValue: "",
  weftCountValue: "",
  weftYarnValue: "",
  tarakEniCm: "",
  totalEnds: "",
  imageDigital: null,
  imageFinal: null,
  digitalPreviewUrl: null,
  finalPreviewUrl: null,
});

export default function Dokuma() {
  const { permissions } = useAuthProfile();
  const [plans, setPlans] = useState<WeavingPlan[]>([]);
  const [progressEntries, setProgressEntries] = useState<WeavingProgressEntry[]>([]);
  const [transferEntries, setTransferEntries] = useState<WeavingTransfer[]>([]);
  const [patterns, setPatterns] = useState<Pattern[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dyehouses, setDyehouses] = useState<Dyehouse[]>(() => dyehouseLocalRepo.list());

  const [planModalOpen, setPlanModalOpen] = useState(false);
  const [planModalStep, setPlanModalStep] = useState<"form" | "select">("form");
  const [selectedPatternId, setSelectedPatternId] = useState("");
  const [plannedMetersInput, setPlannedMetersInput] = useState("");
  const [tarakEniInput, setTarakEniInput] = useState("");
  const [planNote, setPlanNote] = useState("");
  const [planError, setPlanError] = useState("");

  const [patternSelectorTab, setPatternSelectorTab] = useState<PatternSelectorTab>("SELECT");
  const [patternSearch, setPatternSearch] = useState("");
  const [newPatternForm, setNewPatternForm] = useState<NewPatternForm>(() =>
    createEmptyNewPatternForm()
  );
  const [patternSelectorError, setPatternSelectorError] = useState("");
  const [patternSelectorSuccess, setPatternSelectorSuccess] = useState("");

  const [progressPlanId, setProgressPlanId] = useState<string | null>(null);
  const [progressVariantId, setProgressVariantId] = useState("");
  const [progressDateTime, setProgressDateTime] = useState(nowDateTimeLocal());
  const [progressMetersInput, setProgressMetersInput] = useState("");
  const [progressUnitCountInput, setProgressUnitCountInput] = useState("1");
  const [progressNote, setProgressNote] = useState("");
  const [progressError, setProgressError] = useState("");
  const progressMetersInputRef = useRef<HTMLInputElement | null>(null);

  const [transferPlanId, setTransferPlanId] = useState<string | null>(null);
  const [transferDateTime, setTransferDateTime] = useState(nowDateTimeLocal());
  const [transferMetersInput, setTransferMetersInput] = useState("");
  const [transferVariantMetersById, setTransferVariantMetersById] = useState<Record<string, string>>({});
  const [transferDestination, setTransferDestination] =
    useState<WeavingTransferDestination>("WAREHOUSE");
  const [transferDyehouseId, setTransferDyehouseId] = useState("");
  const [newDyehouseName, setNewDyehouseName] = useState("");
  const [transferNote, setTransferNote] = useState("");
  const [transferError, setTransferError] = useState("");
  const [detailPlanId, setDetailPlanId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<PlanListFilter>("OPEN");
  const [sortKey, setSortKey] = useState<PlanSortOption>("created_desc");
  const [warningConfirm, setWarningConfirm] = useState<WarningConfirmState | null>(null);
  const planModalRef = useRef<HTMLDivElement | null>(null);
  const canCreatePlans = permissions.weaving.create;
  const canEditWeaving = permissions.weaving.edit;
  const canAdvanceWeaving = permissions.weaving.advance;
  const canCreatePatterns = permissions.patterns.create;
  const canManageDispatch = permissions.dispatch.create;
  const canEditDispatch = permissions.dispatch.edit || permissions.dispatch.delete;

  useModalFocusTrap({ enabled: planModalOpen, containerRef: planModalRef });

    const refreshData = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const [fetchedPlans, fetchedProgress, fetchedPatterns, activeTransfers] = await Promise.all([
        weavingSupabaseRepo.listAllPlans(),
        weavingSupabaseRepo.listProgressInRange(),
        patternsSupabaseRepo.list(),
        weavingSupabaseRepo.listAllTransfers()
      ]);

      // Recalculate variant metrics dynamically (Hybrid: Supabase + Local Transfers)
      const mappedPlans = fetchedPlans.map(plan => {
        if (!hasPlanVariants(plan)) return plan;
        const mappedVariants = plan.variants.map(v => {
          const woven = fetchedProgress.filter(p => p.planId === plan.id && p.variantId === v.id).reduce((sum, p) => sum + p.meters, 0);
          const shipped = activeTransfers.filter(t => t.planId === plan.id).reduce((sum, t) => sum + (t.variantLines?.find(vl => vl.variantId === v.id)?.meters || 0), 0);
          return { ...v, wovenMeters: Math.max(0, woven), shippedMeters: Math.max(0, shipped), status: woven >= v.plannedMeters ? "DONE" : "ACTIVE" };
        });
        return {
          ...plan,
          variants: mappedVariants as unknown as WeavingPlanVariant[],
          plannedMeters: mappedVariants.reduce((sum, v) => sum + v.plannedMeters, 0)
        } as WeavingPlan;
      });

      setPlans(mappedPlans);
      setProgressEntries(fetchedProgress);
      setTransferEntries(activeTransfers);
      setPatterns(sortPatterns(fetchedPatterns.filter((pattern) => pattern.archived !== true)));
      setDyehouses(dyehouseLocalRepo.list());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sistem verileri yüklenemedi.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    refreshData();
  }, []);

  const planTotalsById = useMemo(() => {
    const progressByPlan = new Map<string, number>();
    const sentByPlan = new Map<string, number>();
    const sentDyehouseByPlan = new Map<string, number>();
    const sentWarehouseByPlan = new Map<string, number>();

    progressEntries.forEach((entry) => {
      progressByPlan.set(entry.planId, (progressByPlan.get(entry.planId) ?? 0) + entry.meters);
    });

    transferEntries.forEach((entry) => {
      sentByPlan.set(entry.planId, (sentByPlan.get(entry.planId) ?? 0) + entry.meters);
      if (entry.destination === "DYEHOUSE") {
        sentDyehouseByPlan.set(
          entry.planId,
          (sentDyehouseByPlan.get(entry.planId) ?? 0) + entry.meters
        );
      } else {
        sentWarehouseByPlan.set(
          entry.planId,
          (sentWarehouseByPlan.get(entry.planId) ?? 0) + entry.meters
        );
      }
    });

    const totals = new Map<string, PlanTotals>();
    plans.forEach((plan) => {
      const plannedMeters = hasPlanVariants(plan)
        ? sumPlanVariantPlannedMeters(plan.variants)
        : plan.plannedMeters;
      const wovenMeters = hasPlanVariants(plan)
        ? sumPlanVariantWovenMeters(plan.variants)
        : progressByPlan.get(plan.id) ?? 0;
      const totalSentMeters = hasPlanVariants(plan)
        ? sumPlanVariantShippedMeters(plan.variants)
        : sentByPlan.get(plan.id) ?? 0;
      totals.set(plan.id, {
        plannedMeters,
        wovenMeters,
        totalSentMeters,
        sentToDyehouse: sentDyehouseByPlan.get(plan.id) ?? 0,
        sentToWarehouse: sentWarehouseByPlan.get(plan.id) ?? 0,
        remainingPlanned: plannedMeters - wovenMeters,
        pendingToSend: wovenMeters - totalSentMeters,
      });
    });

    return totals;
  }, [plans, progressEntries, transferEntries]);

  const activeSummary = useMemo(() => {
    const activePlans = plans.filter((plan) => plan.status === "ACTIVE");
    const totalPlanned = activePlans.reduce(
      (sum, plan) => sum + (planTotalsById.get(plan.id)?.plannedMeters ?? plan.plannedMeters),
      0
    );
    const totalWoven = activePlans.reduce(
      (sum, plan) => sum + (planTotalsById.get(plan.id)?.wovenMeters ?? 0),
      0
    );
    const totalSent = activePlans.reduce(
      (sum, plan) => sum + (planTotalsById.get(plan.id)?.totalSentMeters ?? 0),
      0
    );

    return {
      activePlanCount: activePlans.length,
      totalPlanned,
      totalWoven,
      totalSent,
    };
  }, [plans, planTotalsById]);

  const filteredAndSortedPlans = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("tr-TR");

    const byStatus =
      statusFilter === "ALL"
        ? plans
        : statusFilter === "OPEN"
          ? plans.filter((plan) => plan.status !== "CANCELLED")
          : plans.filter((plan) => plan.status === statusFilter);

    const byQuery =
      normalizedQuery.length === 0
        ? byStatus
        : byStatus.filter((plan) => {
            const patternMeta =
              patterns.find((pattern) => pattern.id === plan.patternId) ?? null;
            const code = (
              plan.patternNoSnapshot ||
              patternMeta?.fabricCode ||
              ""
            ).toLocaleLowerCase("tr-TR");
            const name = (
              plan.patternNameSnapshot ||
              patternMeta?.fabricName ||
              ""
            ).toLocaleLowerCase("tr-TR");
            return code.includes(normalizedQuery) || name.includes(normalizedQuery);
          });

    const getCreatedAtMs = (plan: WeavingPlan) => {
      const parsed = new Date(plan.createdAt).getTime();
      return Number.isFinite(parsed) ? parsed : 0;
    };

    return [...byQuery].sort((a, b) => {
      const totalsA = resolvePlanTotals(a, planTotalsById);
      const totalsB = resolvePlanTotals(b, planTotalsById);

      if (sortKey === "created_desc") {
        return getCreatedAtMs(b) - getCreatedAtMs(a);
      }
      if (sortKey === "created_asc") {
        return getCreatedAtMs(a) - getCreatedAtMs(b);
      }
      if (sortKey === "code_asc") {
        return a.patternNoSnapshot.localeCompare(b.patternNoSnapshot, "tr-TR");
      }
      if (sortKey === "code_desc") {
        return b.patternNoSnapshot.localeCompare(a.patternNoSnapshot, "tr-TR");
      }
      if (sortKey === "planned_desc") {
        return totalsB.plannedMeters - totalsA.plannedMeters;
      }
      if (sortKey === "woven_desc") {
        return totalsB.wovenMeters - totalsA.wovenMeters;
      }
      return totalsB.remainingPlanned - totalsA.remainingPlanned;
    });
  }, [plans, patterns, query, statusFilter, sortKey, planTotalsById]);

  const selectedPattern = useMemo(
    () => patterns.find((pattern) => pattern.id === selectedPatternId) ?? null,
    [patterns, selectedPatternId]
  );

  const selectedProgressPlan = useMemo(
    () => plans.find((plan) => plan.id === progressPlanId) ?? null,
    [plans, progressPlanId]
  );

  const selectedProgressVariants = useMemo(
    () => (hasPlanVariants(selectedProgressPlan) ? selectedProgressPlan.variants : []),
    [selectedProgressPlan]
  );

  const selectedProgressTotals = useMemo(() => {
    if (!selectedProgressPlan) return null;
    return resolvePlanTotals(selectedProgressPlan, planTotalsById);
  }, [selectedProgressPlan, planTotalsById]);

  const progressCalculatedTotal = useMemo(() => {
    return calculateProgressTotalMeters(progressMetersInput, progressUnitCountInput);
  }, [progressMetersInput, progressUnitCountInput]);

  const progressWarnings = useMemo(() => {
    if (!selectedProgressPlan || !selectedProgressTotals || progressCalculatedTotal <= 0) {
      return [];
    }

    return getProgressWarningMessages(
      selectedProgressPlan,
      selectedProgressTotals,
      progressVariantId,
      progressCalculatedTotal
    );
  }, [
    selectedProgressPlan,
    selectedProgressTotals,
    progressCalculatedTotal,
    progressVariantId,
  ]);

  const selectedTransferPlan = useMemo(
    () => plans.find((plan) => plan.id === transferPlanId) ?? null,
    [plans, transferPlanId]
  );

  const selectedTransferVariants = useMemo(
    () => (hasPlanVariants(selectedTransferPlan) ? selectedTransferPlan.variants : []),
    [selectedTransferPlan]
  );

  const selectedTransferDyehouse = useMemo(
    () => dyehouses.find((item) => item.id === transferDyehouseId) ?? null,
    [dyehouses, transferDyehouseId]
  );

  const detailPlan = useMemo(
    () => (detailPlanId ? plans.find((plan) => plan.id === detailPlanId) ?? null : null),
    [detailPlanId, plans]
  );

  const detailPattern = useMemo(() => {
    if (!detailPlan) return null;
    return (
      patterns.find((pattern) => pattern.id === detailPlan.patternId) ?? null
    );
  }, [detailPlan, patterns]);

  const detailPlanTotals = useMemo(() => {
    if (!detailPlan) return null;
    return (
      planTotalsById.get(detailPlan.id) ??
      ({
        plannedMeters: hasPlanVariants(detailPlan)
          ? sumPlanVariantPlannedMeters(detailPlan.variants)
          : detailPlan.plannedMeters,
        wovenMeters: 0,
        totalSentMeters: 0,
        sentToDyehouse: 0,
        sentToWarehouse: 0,
        remainingPlanned: hasPlanVariants(detailPlan)
          ? sumPlanVariantPlannedMeters(detailPlan.variants)
          : detailPlan.plannedMeters,
        pendingToSend: 0,
      } satisfies PlanTotals)
    );
  }, [detailPlan, planTotalsById]);

  const filteredPatternsForSelector = useMemo(() => {
    const normalized = patternSearch.trim().toLocaleLowerCase("tr-TR");
    return patterns.filter((pattern) => {
      if (!normalized) return true;
      return (
        pattern.fabricCode.toLocaleLowerCase("tr-TR").includes(normalized) ||
        pattern.fabricName.toLocaleLowerCase("tr-TR").includes(normalized)
      );
    });
  }, [patterns, patternSearch]);

  const recentProgressForModal = useMemo(
    () =>
      progressPlanId
        ? progressEntries.filter((entry) => entry.planId === progressPlanId).slice(0, 5)
        : [],
    [progressEntries, progressPlanId]
  );

  const recentTransfersForModal = useMemo(
    () =>
      transferPlanId
        ? transferEntries.filter((entry) => entry.planId === transferPlanId).slice(0, 5)
        : [],
    [transferEntries, transferPlanId]
  );

  const transferVariantRows = useMemo(
    () =>
      selectedTransferVariants.map((variant) => {
        const availableToShip = Math.max(0, variant.wovenMeters - variant.shippedMeters);
        const inputRaw = transferVariantMetersById[variant.id] ?? "";
        const inputMeters = Number(inputRaw.trim().replace(",", "."));
        return {
          variant,
          availableToShip,
          inputRaw,
          inputMeters: Number.isFinite(inputMeters) ? inputMeters : 0,
        };
      }),
    [selectedTransferVariants, transferVariantMetersById]
  );

  const transferVariantMetersTotal = useMemo(
    () =>
      transferVariantRows.reduce((sum, row) => {
        if (!Number.isFinite(row.inputMeters) || row.inputMeters <= 0) return sum;
        return sum + row.inputMeters;
      }, 0),
    [transferVariantRows]
  );

  const transferWarning = useMemo(() => {
    if (!selectedTransferPlan) return "";
    const totals = planTotalsById.get(selectedTransferPlan.id);
    if (!totals) return "";

    if (selectedTransferVariants.length > 0) {
      for (const row of transferVariantRows) {
        if (row.inputRaw.trim() === "") continue;
        if (!Number.isFinite(row.inputMeters) || row.inputMeters < 0) {
          return "Varyant sevk metreleri gecersiz.";
        }
        if (row.inputMeters > row.availableToShip) {
          return `${row.variant.colorName} icin sevk, sevk edilebilir metreden fazla olamaz.`;
        }
      }
      if (
        transferVariantMetersTotal > 0 &&
        totals.totalSentMeters + transferVariantMetersTotal > totals.wovenMeters
      ) {
        return "Bu sevk sonrasi toplam sevk, dokunan metreden fazla gorunuyor olabilir.";
      }
      return "";
    }

    const parsedMeters = Number(transferMetersInput.trim().replace(",", "."));
    if (!Number.isFinite(parsedMeters) || parsedMeters <= 0) return "";
    if (totals.totalSentMeters + parsedMeters > totals.wovenMeters) {
      return "Bu sevk sonrasi toplam sevk, dokunan metreden fazla gorunuyor olabilir.";
    }
    return "";
  }, [
    selectedTransferPlan,
    selectedTransferVariants,
    transferVariantRows,
    transferVariantMetersTotal,
    transferMetersInput,
    planTotalsById,
  ]);

  useEffect(() => {
    return () => {
      if (newPatternForm.digitalPreviewUrl) {
        URL.revokeObjectURL(newPatternForm.digitalPreviewUrl);
      }
      if (newPatternForm.finalPreviewUrl) {
        URL.revokeObjectURL(newPatternForm.finalPreviewUrl);
      }
    };
  }, [newPatternForm.digitalPreviewUrl, newPatternForm.finalPreviewUrl]);

  const focusProgressMetersInput = () => {
    const input = progressMetersInputRef.current;
    if (!input) return;
    requestAnimationFrame(() => {
      input.focus();
      input.select();
    });
  };

  useEffect(() => {
    if (!selectedProgressPlan) return;
    const frame = requestAnimationFrame(() => {
      progressMetersInputRef.current?.focus();
      progressMetersInputRef.current?.select();
    });
    return () => cancelAnimationFrame(frame);
  }, [selectedProgressPlan]);

  const resetNewPatternForm = () => {
    setNewPatternForm((prev) => {
      if (prev.digitalPreviewUrl) URL.revokeObjectURL(prev.digitalPreviewUrl);
      if (prev.finalPreviewUrl) URL.revokeObjectURL(prev.finalPreviewUrl);
      return createEmptyNewPatternForm();
    });
  };

  const openPlanModal = () => {
    if (!canCreatePlans) return;
    setPlanModalOpen(true);
    setPlanModalStep("form");
    setSelectedPatternId((current) => {
      if (current && patterns.some((pattern) => pattern.id === current)) return current;
      return patterns[0]?.id ?? "";
    });
    setPlannedMetersInput("");
    setTarakEniInput("");
    setPlanNote("");
    setPlanError("");
    setPatternSelectorError("");
    setPatternSelectorSuccess("");
    setPatternSelectorTab("SELECT");
    setPatternSearch("");
    resetNewPatternForm();
  };

  const closePlanModal = () => {
    setPlanModalOpen(false);
    setPlanModalStep("form");
    setPlanError("");
    setTarakEniInput("");
    setPatternSelectorError("");
    setPatternSelectorSuccess("");
    setPatternSearch("");
    setPatternSelectorTab("SELECT");
    resetNewPatternForm();
  };

  const openPatternSelector = () => {
    setPlanModalStep("select");
    setPatternSelectorTab("SELECT");
    setPatternSearch("");
    setPatternSelectorError("");
    setPatternSelectorSuccess("");
  };

  const closePatternSelector = () => {
    setPlanModalStep("form");
    setPatternSelectorError("");
    setPatternSelectorSuccess("");
  };

  const handleDigitalFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    if (!file) {
      return;
    }

    const previewUrl = URL.createObjectURL(file);
    setNewPatternForm((prev) => {
      if (prev.digitalPreviewUrl) URL.revokeObjectURL(prev.digitalPreviewUrl);
      return {
        ...prev,
        digitalPreviewUrl: previewUrl,
      };
    });

    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = reader.result;
      if (typeof dataUrl !== "string") {
        setPatternSelectorError("Gorsel okunamadi.");
        return;
      }
      setNewPatternForm((prev) => ({
        ...prev,
        imageDigital: dataUrl,
      }));
      setPatternSelectorError("");
    };
    reader.onerror = () => {
      setPatternSelectorError("Gorsel okunamadi.");
    };
    reader.readAsDataURL(file);
    event.currentTarget.value = "";
  };

  const handleFinalFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    if (!file) {
      return;
    }

    const previewUrl = URL.createObjectURL(file);
    setNewPatternForm((prev) => {
      if (prev.finalPreviewUrl) URL.revokeObjectURL(prev.finalPreviewUrl);
      return {
        ...prev,
        finalPreviewUrl: previewUrl,
      };
    });

    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = reader.result;
      if (typeof dataUrl !== "string") {
        setPatternSelectorError("Gorsel okunamadi.");
        return;
      }
      setNewPatternForm((prev) => ({
        ...prev,
        imageFinal: dataUrl,
      }));
      setPatternSelectorError("");
    };
    reader.onerror = () => {
      setPatternSelectorError("Gorsel okunamadi.");
    };
    reader.readAsDataURL(file);
    event.currentTarget.value = "";
  };

  const handleCreatePatternFromSelector = async () => {
    if (!canCreatePatterns) return;
    try {
      const normalizedCode = newPatternForm.code.trim();
      if (!normalizedCode) throw new Error("Kumas kodu zorunlu.");
      const normalizedTarakEniInput = newPatternForm.tarakEniCm.trim().replace(",", ".");
      let tarakEniCm: number | null = null;
      if (normalizedTarakEniInput !== "") {
        const parsedTarakEniCm = Number(normalizedTarakEniInput);
        if (!Number.isFinite(parsedTarakEniCm) || parsedTarakEniCm < 0) {
          throw new Error("Tarak Eni (cm) gecersiz.");
        }
        tarakEniCm = parsedTarakEniCm;
      }

      const created = await patternsSupabaseRepo.upsertPatternFromForm({
        fabricCode: normalizedCode,
        fabricName: newPatternForm.name.trim() || normalizedCode,
        weaveType: newPatternForm.weaveType.trim() || "-",
        warpCount:
          composeCountAndYarn(newPatternForm.warpCountValue, newPatternForm.warpYarnValue) || "-",
        weftCount:
          composeCountAndYarn(newPatternForm.weftCountValue, newPatternForm.weftYarnValue) || "-",
        tarakEniCm,
        totalEnds: newPatternForm.totalEnds.trim() || "-",
        color: newPatternForm.color.trim() || undefined,
        imageDigital: newPatternForm.imageDigital,
        imageFinal: newPatternForm.imageFinal,
      });
      refreshData();
      setSelectedPatternId(created.id);
      setPlanModalStep("form");
      setPatternSelectorError("");
      setPatternSelectorSuccess("Desen oluşturuldu ve seçildi.");
      resetNewPatternForm();
    } catch (error) {
      setPatternSelectorSuccess("");
      setPatternSelectorError(
        error instanceof Error ? error.message : "Yeni desen kaydedilemedi."
      );
    }
  };

  const handleCreatePlan = async () => {
    if (!canCreatePlans) return;
    try {
      if (!selectedPattern) throw new Error("Desen secimi zorunlu.");
      const plannedMeters = toPositiveNumber(plannedMetersInput, "Plan metre");
      const hamKumasEniCm = tarakEniInput.trim()
        ? toPositiveNumber(tarakEniInput, "Ham Kumas Eni")
        : null;

      await weavingSupabaseRepo.createPlan({
        patternId: selectedPattern.id,
        patternNoSnapshot: selectedPattern.fabricCode,
        patternNameSnapshot: selectedPattern.fabricName,
        plannedMeters,
        hamKumasEniCm,
        note: planNote.trim() || undefined,
      });

      closePlanModal();
      refreshData();
    } catch (error) {
      setPlanError(error instanceof Error ? error.message : "Plan olusturulamadi.");
    }
  };

  const openProgressModal = (planId: string) => {
    const plan = plans.find((item) => item.id === planId) ?? null;
    setProgressPlanId(planId);
    setProgressVariantId(
      hasPlanVariants(plan)
        ? plan.variants[0]?.id ?? ""
        : ""
    );
    setProgressDateTime(nowDateTimeLocal());
    setProgressMetersInput("");
    setProgressUnitCountInput("1");
    setProgressNote("");
    setProgressError("");
  };

  const closeProgressModal = () => {
    setProgressPlanId(null);
    setProgressVariantId("");
    setProgressDateTime(nowDateTimeLocal());
    setProgressMetersInput("");
    setProgressUnitCountInput("1");
    setProgressNote("");
    setProgressError("");
  };

  const handleAddProgress = async () => {
    if (!canEditWeaving) return;
    if (!progressPlanId) return;

    try {
      const selectedPlan = plans.find((plan) => plan.id === progressPlanId) ?? null;
      if (!selectedPlan) throw new Error("Plan bulunamadi.");
      const metersPerUnit = toPositiveNumber(progressMetersInput, "Metre");
      const unitCount = toPositiveInt(progressUnitCountInput, "Adet");
      const totalMeters = metersPerUnit * unitCount;
      const createdAt = toIsoFromDateTimeLocal(progressDateTime, "Tarih/Saat");

      if (hasPlanVariants(selectedPlan) && !progressVariantId) {
        throw new Error("Varyant secimi gerekli.");
      }

      await weavingSupabaseRepo.addProgress({
        planId: progressPlanId,
        variantId: hasPlanVariants(selectedPlan) ? progressVariantId : undefined,
        createdAt,
        meters: totalMeters,
        metersPerUnit,
        unitCount,
        note: progressNote.trim() || undefined,
      });

      setProgressMetersInput("");
      setProgressNote("");
      setProgressError("");
      refreshData();
      focusProgressMetersInput();
    } catch (error) {
      setProgressError(error instanceof Error ? error.message : "Ilerleme kaydedilemedi.");
    }
  };

  const handleDeleteProgress = async (id: string) => {
    if (!canEditWeaving) return;
    await weavingSupabaseRepo.deleteProgress(id);
    setProgressError("");
    refreshData();
    focusProgressMetersInput();
  };

  const handleProgressMetersKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== "Enter" || event.nativeEvent.isComposing) return;
    event.preventDefault();
    handleAddProgress();
  };

  const openTransferModal = (planId: string) => {
    const plan = plans.find((item) => item.id === planId) ?? null;
    const initialVariantMeters = hasPlanVariants(plan)
      ? Object.fromEntries(plan.variants.map((variant) => [variant.id, ""]))
      : {};
    setTransferPlanId(planId);
    setTransferDateTime(nowDateTimeLocal());
    setTransferMetersInput("");
    setTransferVariantMetersById(initialVariantMeters);
    setTransferDestination(dyehouses.length > 0 ? "DYEHOUSE" : "WAREHOUSE");
    setTransferDyehouseId(dyehouses[0]?.id ?? "");
    setNewDyehouseName("");
    setTransferNote("");
    setTransferError("");
  };

  const closeTransferModal = () => {
    setTransferPlanId(null);
    setTransferVariantMetersById({});
    setTransferError("");
  };

  const handleAddDyehouse = () => {
    if (!canManageDispatch) return;
    try {
      const added = dyehouseLocalRepo.addByName(newDyehouseName);
      const next = dyehouseLocalRepo.list();
      setDyehouses(next);
      setTransferDestination("DYEHOUSE");
      setTransferDyehouseId(added.id);
      setNewDyehouseName("");
      setTransferError("");
    } catch (error) {
      setTransferError(error instanceof Error ? error.message : "Boyahane eklenemedi.");
    }
  };

  const handleDeleteDyehouse = () => {
    if (!canEditDispatch) return;
    if (!transferDyehouseId) return;
    const target = dyehouses.find((item) => item.id === transferDyehouseId);
    const label = target?.name ?? "secili boyahane";
    if (!window.confirm(`${label} kaydi silinsin mi?`)) return;

    dyehouseLocalRepo.delete(transferDyehouseId);
    const next = dyehouseLocalRepo.list();
    setDyehouses(next);
    if (next.length === 0) {
      setTransferDestination("WAREHOUSE");
      setTransferDyehouseId("");
    } else {
      setTransferDyehouseId(next[0].id);
    }
  };

  const handleAddTransfer = () => {
    if (!canManageDispatch) return;
    if (!transferPlanId) return;

    try {
      const selectedPlan = plans.find((plan) => plan.id === transferPlanId) ?? null;
      if (!selectedPlan) throw new Error("Plan bulunamadi.");
      const createdAt = toIsoFromDateTimeLocal(transferDateTime, "Tarih/Saat");

      let meters = 0;
      let variantLines:
        | Array<{
            variantId: string;
            colorNameSnapshot: string;
            variantCodeSnapshot?: string;
            meters: number;
          }>
        | undefined;

      if (hasPlanVariants(selectedPlan)) {
        const lines = transferVariantRows
          .map((row) => {
            if (row.inputRaw.trim() === "") return null;
            if (!Number.isFinite(row.inputMeters) || row.inputMeters < 0) {
              throw new Error("Varyant sevk metreleri gecersiz.");
            }
            if (row.inputMeters <= 0) return null;
            if (row.inputMeters > row.availableToShip) {
              throw new Error(`${row.variant.colorName} icin sevk metresi uygun degil.`);
            }
            return {
              variantId: row.variant.id,
              colorNameSnapshot: row.variant.colorName,
              variantCodeSnapshot: row.variant.variantCode,
              meters: row.inputMeters,
            };
          })
          .filter((line): line is NonNullable<typeof line> => line !== null);

        if (lines.length === 0) {
          throw new Error("Varyantli planda en az bir sevk satiri girilmelidir.");
        }

        meters = lines.reduce((sum, line) => sum + line.meters, 0);
        variantLines = lines;
      } else {
        meters = toPositiveNumber(transferMetersInput, "Metre");
      }

      let dyehouseId: string | null = null;
      let dyehouseNameSnapshot: string | null = null;

      if (transferDestination === "DYEHOUSE") {
        const dyehouse = dyehouses.find((item) => item.id === transferDyehouseId);
        if (!dyehouse) throw new Error("Boyahane secimi gerekli.");
        dyehouseId = dyehouse.id;
        dyehouseNameSnapshot = dyehouse.name;
      }
      const persistTransfer = async () => {
        try {
          setIsLoading(true);
          await weavingSupabaseRepo.addTransfer({
            planId: transferPlanId!,
            meters,
            variantLines,
            createdAt,
            destination: transferDestination,
            dyehouseId,
            dyehouseNameSnapshot,
            note: transferNote.trim() || undefined,
          });
          setTransferMetersInput("");
          setTransferVariantMetersById(
            hasPlanVariants(selectedPlan)
              ? Object.fromEntries(selectedPlan.variants.map((variant) => [variant.id, ""]))
              : {}
          );
          setTransferDateTime(nowDateTimeLocal());
          setTransferNote("");
          setTransferError("");
          await refreshData();
        } catch (error) {
          setTransferError(error instanceof Error ? error.message : "Sevk kaydedilemedi.");
        } finally {
          setIsLoading(false);
        }
      };

      if (transferWarning.trim()) {
        setWarningConfirm({
          title: "Sevk Uyarisi",
          summary: "Sevk kaydi dokuma rakamlariyla tam uyusmuyor olabilir.",
          messages: [transferWarning],
          confirmLabel: "Devam Et",
          onConfirm: persistTransfer,
        });
        return;
      }

      persistTransfer();
    } catch (error) {
      setTransferError(error instanceof Error ? error.message : "Sevk kaydedilemedi.");
    }
  };
  const handleDeleteTransfer = async (id: string) => {
    if (!canEditDispatch) return;
    try {
      setIsLoading(true);
      await weavingSupabaseRepo.deleteTransfer(id);
      await refreshData();
    } catch (err) {
      alert("Sevk silinemedi: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleManualCompleted = async (plan: WeavingPlan) => {
    if (!canAdvanceWeaving) return;
    const completed = !(plan.status === "COMPLETED" && plan.manualCompletedAt);
    const persistCompletion = async () => {
      if (completed) {
        await weavingSupabaseRepo.markCompleted(plan.id);
      } else {
        await weavingSupabaseRepo.restorePlan(plan.id);
      }
      refreshData();
    };

    if (!completed) {
      persistCompletion();
      return;
    }

    const warnings = getCompletionWarningMessages(plan, resolvePlanTotals(plan, planTotalsById));
    if (warnings.length > 0) {
      setWarningConfirm({
        title: "Tamamlama Uyarisi",
        summary: "Plan kapanisi ile mevcut dokuma rakamlari arasinda fark var.",
        messages: warnings,
        confirmLabel: "Devam Et",
        onConfirm: persistCompletion,
      });
      return;
    }

    persistCompletion();
  };

  const handleCancelPlan = async (plan: WeavingPlan) => {
    if (!canAdvanceWeaving) return;
    if (!window.confirm(`${plan.patternNoSnapshot} planini iptal etmek istiyor musunuz?`)) return;
    await weavingSupabaseRepo.updatePlanStatus(plan.id, "CANCELLED");
    refreshData();
  };

  const closeWarningConfirm = () => {
    setWarningConfirm(null);
  };

  const confirmWarningAction = async () => {
    const action = warningConfirm?.onConfirm;
    setWarningConfirm(null);
    await action?.();
  };

  return (
    <Layout title="Dokuma">
      <div className="flex h-full min-h-0 flex-col gap-4">
        {isLoading && (
          <div className="flex w-full items-center justify-center p-4 text-sm font-semibold text-neutral-500">
            Yükleniyor...
          </div>
        )}
        {error && (
          <div className="flex w-full flex-col items-center justify-center gap-2 rounded-xl bg-rose-50 p-4 text-sm text-rose-500">
            <span className="font-semibold">Hata Oluştu</span>
            <span>{error}</span>
          </div>
        )}
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <SummaryCard title="Aktif Plan" value={`${activeSummary.activePlanCount}`} />
          <SummaryCard title="Toplam Plan (m)" value={fmt(activeSummary.totalPlanned)} />
          <SummaryCard title="Toplam Dokunan (m)" value={fmt(activeSummary.totalWoven)} />
          <SummaryCard title="Boyahane/Depo Sevk (m)" value={fmt(activeSummary.totalSent)} />
        </div>

        <section className="rounded-xl border border-black/10 bg-white p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-semibold text-neutral-900">Dokuma Planlari</h2>
            {canCreatePlans ? (
              <button
                type="button"
                onClick={openPlanModal}
                className="rounded-lg bg-coffee-primary px-3 py-2 text-sm font-semibold text-white transition hover:brightness-95"
              >
                Dokuma Plani Olustur
              </button>
            ) : null}
          </div>

          <div className="mt-3 grid gap-2 rounded-lg border border-black/10 bg-neutral-50 p-2 lg:grid-cols-[minmax(0,1fr)_170px_280px_auto]">
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Desen ara (kod/ad)..."
              className="w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-coffee-primary"
            />

            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as PlanListFilter)}
              className="w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-coffee-primary"
            >
              {planListFilterOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>

            <select
              value={sortKey}
              onChange={(event) => setSortKey(event.target.value as PlanSortOption)}
              className="w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-coffee-primary"
            >
              {planSortOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={() => {
                setQuery("");
                setStatusFilter("OPEN");
                setSortKey("created_desc");
              }}
              className="rounded-lg border border-black/10 bg-white px-3 py-2 text-sm font-semibold text-neutral-700 transition hover:bg-neutral-100"
            >
              Sifirla
            </button>
          </div>

          <div className="mt-2 text-xs text-neutral-500">{filteredAndSortedPlans.length} plan</div>

          <div className="mt-2 max-h-[520px] overflow-auto rounded-lg border border-black/10">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 z-10 bg-neutral-50 text-neutral-600">
                <tr>
                  <th className="px-3 py-2 font-semibold">Desen</th>
                  <th className="px-3 py-2 font-semibold">Plan (m)</th>
                  <th className="px-3 py-2 font-semibold">Dokunan (m)</th>
                  <th className="px-3 py-2 font-semibold">Boyahane / Depo Sevk (m)</th>
                  <th className="px-3 py-2 font-semibold">Dokumada Bekleyen (m)</th>
                  <th className="px-3 py-2 font-semibold">Kalan (m)</th>
                  <th className="px-3 py-2 font-semibold">Durum</th>
                  <th className="px-3 py-2 font-semibold">Aksiyonlar</th>
                </tr>
              </thead>
              <tbody className="text-neutral-800">
                {filteredAndSortedPlans.map((plan) => {
                  const totals = resolvePlanTotals(plan, planTotalsById);
                  const isCancelled = plan.status === "CANCELLED";
                  const isManualCompleted =
                    plan.status === "COMPLETED" && Boolean(plan.manualCompletedAt);
                  const planWarnings = getPlanWarningMessages(plan, totals);

                  return (
                    <tr key={plan.id} className="border-t border-black/5 align-top">
                      <td className="px-3 py-2">
                        <div className="font-semibold">
                          {plan.patternNoSnapshot} - {plan.patternNameSnapshot}
                        </div>
                        <div className="text-xs text-neutral-500">
                          Olusturma: {formatDateTime(plan.createdAt)}
                        </div>
                        {plan.note ? (
                          <div className="mt-1 text-xs text-neutral-500">Not: {plan.note}</div>
                        ) : null}
                        {planWarnings.length > 0 ? (
                          <div className="mt-2 rounded-lg border border-rose-500/30 bg-rose-50 px-2.5 py-2 text-xs text-rose-800">
                            <div className="flex items-start gap-2">
                              <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-rose-100 font-semibold text-rose-700">
                                !
                              </span>
                              <div>
                                <div>{planWarnings[0]}</div>
                                {planWarnings.length > 1 ? (
                                  <div className="mt-1 text-[11px] text-rose-700">
                                    +{planWarnings.length - 1} ek uyari
                                  </div>
                                ) : null}
                              </div>
                            </div>
                          </div>
                        ) : null}
                      </td>
                      <td className="px-3 py-2">{fmt(totals.plannedMeters)}</td>
                      <td className="px-3 py-2">{fmt(totals.wovenMeters)}</td>
                      <td className="px-3 py-2">
                        <div>{fmt(totals.totalSentMeters)}</div>
                        <div className="text-[11px] text-neutral-500">
                          Boyahane: {fmt(totals.sentToDyehouse)} / Depo: {fmt(totals.sentToWarehouse)}
                        </div>
                      </td>
                      <td
                        className={cn(
                          "px-3 py-2",
                          totals.pendingToSend < 0 ? "font-semibold text-rose-700" : ""
                        )}
                      >
                        {fmt(totals.pendingToSend)}
                      </td>
                      <td
                        className={cn(
                          "px-3 py-2",
                          totals.remainingPlanned < 0 ? "font-semibold text-rose-700" : ""
                        )}
                      >
                        {fmt(totals.remainingPlanned)}
                      </td>
                      <td className="px-3 py-2">
                        <span
                          className={cn(
                            "inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold",
                            plan.status === "ACTIVE"
                              ? "border-emerald-500/30 bg-emerald-50 text-emerald-700"
                              : plan.status === "COMPLETED"
                                ? "border-sky-500/30 bg-sky-50 text-sky-700"
                                : "border-rose-500/30 bg-rose-50 text-rose-700"
                          )}
                        >
                          {planStatusLabels[plan.status]}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setDetailPlanId(plan.id)}
                            className="rounded border border-black/10 bg-neutral-50 px-2.5 py-1 text-xs font-semibold text-neutral-700 transition hover:bg-neutral-100"
                          >
                            Detaylar
                          </button>
                          {canEditWeaving ? (
                            <button
                              type="button"
                              onClick={() => openProgressModal(plan.id)}
                              disabled={isCancelled}
                              className="rounded border border-black/10 bg-white px-2.5 py-1 text-xs font-semibold text-neutral-700 transition hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-40"
                            >
                              Ilerleme Gir
                            </button>
                          ) : null}
                          {canManageDispatch ? (
                            <button
                              type="button"
                              onClick={() => openTransferModal(plan.id)}
                              disabled={isCancelled}
                              className="rounded border border-sky-500/30 bg-sky-50 px-2.5 py-1 text-xs font-semibold text-sky-700 transition hover:bg-sky-100 disabled:cursor-not-allowed disabled:opacity-40"
                            >
                              Boyahane / Depo Sevk
                            </button>
                          ) : null}
                          {canAdvanceWeaving ? (
                            <button
                              type="button"
                              onClick={() => handleToggleManualCompleted(plan)}
                              disabled={isCancelled}
                              className="rounded border border-emerald-500/30 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-40"
                            >
                              {isManualCompleted ? "Tamamlandi (Geri Al)" : "Tamamlandi"}
                            </button>
                          ) : null}
                          {!isCancelled && canAdvanceWeaving ? (
                            <button
                              type="button"
                              onClick={() => handleCancelPlan(plan)}
                              className="rounded border border-rose-500/30 bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-700 transition hover:bg-rose-100"
                            >
                              Iptal
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {filteredAndSortedPlans.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-3 py-8 text-center text-sm text-neutral-500">
                      {plans.length === 0 ? "Henuz dokuma plani yok." : "Filtreye uygun plan yok."}
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {planModalOpen ? (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 px-4"
          onClick={closePlanModal}
        >
          <div
            ref={planModalRef}
            role="dialog"
            aria-modal="true"
            aria-label="Dokuma Plani Olustur"
            tabIndex={-1}
            className="max-h-[85vh] w-full max-w-2xl overflow-auto rounded-2xl bg-white p-6 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-4 flex items-start justify-between">
              <div>
                <h2 className="text-lg font-semibold text-neutral-900">Dokuma Planı Oluştur</h2>
                <p className="text-sm text-neutral-500">
                  {planModalStep === "form"
                    ? "Seçilen desen için plan metre kaydı oluşturulur."
                    : "Desen seçip plan formuna geri dönebilirsiniz."}
                </p>
              </div>
              <button
                type="button"
                onClick={closePlanModal}
                className="rounded-lg px-2 py-1 text-sm text-neutral-500 hover:bg-neutral-100"
              >
                Kapat
              </button>
            </div>

            {planModalStep === "form" ? (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2 rounded-lg border border-black/10 bg-neutral-50 p-3">
                    <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                      Secili Desen
                    </div>
                    {selectedPattern ? (
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-3">
                          <PatternImagePreview pattern={selectedPattern} compact />
                          <div className="min-w-0">
                            <div className="truncate text-sm font-semibold text-neutral-900">
                              {selectedPattern.fabricCode}
                            </div>
                            <div className="truncate text-xs text-neutral-600">
                              {selectedPattern.fabricName}
                            </div>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={openPatternSelector}
                          className="shrink-0 rounded border border-black/10 bg-white px-2 py-1 text-xs font-semibold text-neutral-700 transition hover:bg-neutral-100"
                        >
                          Deseni Degistir
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm text-neutral-600">Henuz desen secilmedi.</p>
                        <button
                          type="button"
                          onClick={openPatternSelector}
                          className="rounded border border-black/10 bg-white px-2 py-1 text-xs font-semibold text-neutral-700 transition hover:bg-neutral-100"
                        >
                          Desen Sec
                        </button>
                      </div>
                    )}
                  </div>

                  <label className="space-y-1 text-sm text-neutral-700">
                    <span>Plan Metre</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={plannedMetersInput}
                      onChange={(event) => setPlannedMetersInput(event.target.value)}
                      placeholder="0"
                      className="w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-coffee-primary"
                    />
                  </label>
                  <label className="space-y-1 text-sm text-neutral-700">
                    <span>Ham Kumas Eni (cm)</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={tarakEniInput}
                      onChange={(event) => setTarakEniInput(event.target.value)}
                      placeholder="Opsiyonel"
                      className="w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-coffee-primary"
                    />
                  </label>

                  <label className="col-span-2 space-y-1 text-sm text-neutral-700">
                    <span>Not (opsiyonel)</span>
                    <textarea
                      value={planNote}
                      onChange={(event) => setPlanNote(event.target.value)}
                      rows={3}
                      placeholder="Not (opsiyonel)"
                      className="w-full resize-none rounded-lg border border-black/10 bg-white px-3 py-2 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-coffee-primary"
                    />
                  </label>
                </div>

                {planError ? <p className="text-sm text-red-600">{planError}</p> : null}

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={closePlanModal}
                    className="rounded-lg px-3 py-2 text-sm text-neutral-600 hover:bg-neutral-100"
                  >
                    İptal
                  </button>
                  {canCreatePlans ? (
                    <button
                      type="button"
                      onClick={handleCreatePlan}
                      className="rounded-lg bg-coffee-primary px-4 py-2 text-sm font-semibold text-white hover:bg-coffee-primary/90"
                    >
                      Kaydet
                    </button>
                  ) : null}
                </div>
              </div>
            ) : (
              <>
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setPatternSelectorTab("SELECT");
                        setPatternSelectorError("");
                        setPatternSelectorSuccess("");
                      }}
                      className={cn(
                        "rounded-lg border px-3 py-1.5 text-xs font-semibold transition",
                        patternSelectorTab === "SELECT"
                          ? "border-coffee-primary bg-coffee-primary/10 text-coffee-primary"
                          : "border-black/10 bg-white text-neutral-700 hover:bg-neutral-100"
                      )}
                    >
                      Desen Sec
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setPatternSelectorTab("NEW");
                        setPatternSelectorError("");
                        setPatternSelectorSuccess("");
                      }}
                      className={cn(
                        "rounded-lg border px-3 py-1.5 text-xs font-semibold transition",
                        patternSelectorTab === "NEW"
                          ? "border-coffee-primary bg-coffee-primary/10 text-coffee-primary"
                          : "border-black/10 bg-white text-neutral-700 hover:bg-neutral-100"
                      )}
                    >
                      Yeni Desen
                    </button>
                  </div>

                  {patternSelectorTab === "SELECT" ? (
                    <div className="space-y-2">
                      <input
                        type="search"
                        value={patternSearch}
                        onChange={(event) => setPatternSearch(event.target.value)}
                        placeholder="Kod veya ad ile ara"
                        className="w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-coffee-primary"
                      />
                      <div className="max-h-[48vh] space-y-2 overflow-auto rounded-lg border border-black/10 bg-neutral-50 p-2">
                        {filteredPatternsForSelector.map((pattern) => (
                          <button
                            key={pattern.id}
                            type="button"
                            onClick={() => {
                              setSelectedPatternId(pattern.id);
                              setPlanModalStep("form");
                              setPatternSelectorError("");
                              setPatternSelectorSuccess("");
                            }}
                            className={cn(
                              "flex w-full items-center gap-3 rounded-lg border bg-white p-2 text-left transition",
                              selectedPatternId === pattern.id
                                ? "border-coffee-primary bg-coffee-primary/5"
                                : "border-black/10 hover:border-coffee-primary/40"
                            )}
                          >
                            <PatternImagePreview pattern={pattern} compact />
                            <div className="min-w-0">
                              <div className="truncate text-sm font-semibold text-neutral-900">
                                {pattern.fabricCode}
                              </div>
                              <div className="truncate text-xs text-neutral-600">{pattern.fabricName}</div>
                            </div>
                          </button>
                        ))}
                        {filteredPatternsForSelector.length === 0 ? (
                          <div className="rounded-lg border border-dashed border-black/10 bg-white px-3 py-8 text-center text-sm text-neutral-500">
                            Eslesen desen bulunamadi.
                          </div>
                        ) : null}
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                        <label className="space-y-1 text-sm text-neutral-700">
                          <span>Kumas Kodu</span>
                          <input
                            type="text"
                            value={newPatternForm.code}
                            onChange={(event) =>
                              setNewPatternForm((prev) => ({
                                ...prev,
                                code: event.target.value,
                              }))
                            }
                            className="w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-coffee-primary"
                          />
                        </label>

                        <label className="space-y-1 text-sm text-neutral-700">
                          <span>Kumas Adi</span>
                          <input
                            type="text"
                            value={newPatternForm.name}
                            onChange={(event) =>
                              setNewPatternForm((prev) => ({
                                ...prev,
                                name: event.target.value,
                              }))
                            }
                            className="w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-coffee-primary"
                          />
                        </label>

                        <label className="space-y-1 text-sm text-neutral-700">
                          <span>Dokuma Tipi</span>
                          <input
                            type="text"
                            value={newPatternForm.weaveType}
                            onChange={(event) =>
                              setNewPatternForm((prev) => ({
                                ...prev,
                                weaveType: event.target.value,
                              }))
                            }
                            className="w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-coffee-primary"
                          />
                        </label>

                        <label className="space-y-1 text-sm text-neutral-700">
                          <span>Renk</span>
                          <input
                            type="text"
                            value={newPatternForm.color}
                            onChange={(event) =>
                              setNewPatternForm((prev) => ({
                                ...prev,
                                color: event.target.value,
                              }))
                            }
                            className="w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-coffee-primary"
                          />
                        </label>

                        <label className="space-y-1 text-sm text-neutral-700">
                          <span>Cozgu</span>
                          <div className="grid grid-cols-2 gap-2">
                            <input
                              type="text"
                              value={newPatternForm.warpCountValue}
                              onChange={(event) =>
                                setNewPatternForm((prev) => ({
                                  ...prev,
                                  warpCountValue: event.target.value,
                                }))
                              }
                              placeholder="Sayi"
                              className="w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-coffee-primary"
                            />
                            <input
                              type="text"
                              value={newPatternForm.warpYarnValue}
                              onChange={(event) =>
                                setNewPatternForm((prev) => ({
                                  ...prev,
                                  warpYarnValue: event.target.value,
                                }))
                              }
                              placeholder="Iplik"
                              className="w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-coffee-primary"
                            />
                          </div>
                        </label>

                        <label className="space-y-1 text-sm text-neutral-700">
                          <span>Atki</span>
                          <div className="grid grid-cols-2 gap-2">
                            <input
                              type="text"
                              value={newPatternForm.weftCountValue}
                              onChange={(event) =>
                                setNewPatternForm((prev) => ({
                                  ...prev,
                                  weftCountValue: event.target.value,
                                }))
                              }
                              placeholder="Sayi"
                              className="w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-coffee-primary"
                            />
                            <input
                              type="text"
                              value={newPatternForm.weftYarnValue}
                              onChange={(event) =>
                                setNewPatternForm((prev) => ({
                                  ...prev,
                                  weftYarnValue: event.target.value,
                                }))
                              }
                              placeholder="Iplik"
                              className="w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-coffee-primary"
                            />
                          </div>
                        </label>

                        <div className="grid grid-cols-1 gap-3 md:col-span-2 md:grid-cols-2">
                          <label className="space-y-1 text-sm text-neutral-700">
                            <span>Toplam Tel</span>
                            <input
                              type="text"
                              value={newPatternForm.totalEnds}
                              onChange={(event) =>
                                setNewPatternForm((prev) => ({
                                  ...prev,
                                  totalEnds: event.target.value,
                                }))
                              }
                              className="w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-coffee-primary"
                            />
                          </label>

                          <label className="space-y-1 text-sm text-neutral-700">
                            <span>Tarak Eni (cm)</span>
                            <input
                              type="number"
                              min="0"
                              step="1"
                              value={newPatternForm.tarakEniCm ?? ""}
                              onChange={(event) =>
                                setNewPatternForm((prev) => ({
                                  ...prev,
                                  tarakEniCm: event.target.value,
                                }))
                              }
                              placeholder="örn: 120"
                              className="w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-coffee-primary"
                            />
                          </label>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                        <PatternUploadCard
                          title="Dijital Foto"
                          src={
                            newPatternForm.digitalPreviewUrl ??
                            newPatternForm.imageDigital ??
                            getPatternDigitalImage(selectedPattern)
                          }
                          onFileChange={handleDigitalFileChange}
                          debugText={
                            newPatternForm.digitalPreviewUrl ? "preview: OK" : "preview: empty"
                          }
                        />
                        <PatternUploadCard
                          title="Final Foto"
                          src={
                            newPatternForm.finalPreviewUrl ??
                            newPatternForm.imageFinal ??
                            getPatternFinalImage(selectedPattern)
                          }
                          onFileChange={handleFinalFileChange}
                        />
                      </div>

                      <div className="flex justify-end pt-2">
                        {canCreatePatterns ? (
                          <button
                            type="button"
                            onClick={handleCreatePatternFromSelector}
                            className="rounded-lg bg-coffee-primary px-4 py-2 text-sm font-semibold text-white transition hover:brightness-95"
                          >
                            Yeni Desen Kaydet ve Sec
                          </button>
                        ) : null}
                      </div>
                    </div>
                  )}
                </div>

                {patternSelectorSuccess ? (
                  <p className="mt-3 text-sm text-emerald-700">{patternSelectorSuccess}</p>
                ) : null}
                {patternSelectorError ? (
                  <p className="mt-3 text-sm text-rose-600">{patternSelectorError}</p>
                ) : null}

                <div className="mt-4 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={closePatternSelector}
                    className="rounded-lg px-3 py-2 text-sm text-neutral-600 transition hover:bg-neutral-100"
                  >
                    Geri
                  </button>
                  <button
                    type="button"
                    onClick={closePlanModal}
                    className="rounded-lg px-3 py-2 text-sm text-neutral-600 transition hover:bg-neutral-100"
                  >
                    Kapat
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      ) : null}

      {detailPlan && detailPlanTotals ? (
        <Modal title="Dokuma Detayları" onClose={() => setDetailPlanId(null)} size="xl">
          <WeavingDetailContent
            plan={detailPlan}
            pattern={detailPattern}
            totals={detailPlanTotals}
            onPatternUpdated={refreshData}
            onPlanUpdated={refreshData}
          />
          <div className="mt-4 flex justify-end">
            <button
              type="button"
              onClick={() => setDetailPlanId(null)}
              className="rounded-lg px-3 py-2 text-sm text-neutral-600 transition hover:bg-neutral-100"
            >
              Kapat
            </button>
          </div>
        </Modal>
      ) : null}

      {selectedProgressPlan ? (
        <Modal title="Ilerleme Gir" onClose={closeProgressModal} size="lg">
          <div className="space-y-3">
            <div className="rounded-lg border border-black/10 bg-neutral-50 px-3 py-2 text-sm text-neutral-700">
              <div className="font-semibold text-neutral-900">
                {selectedProgressPlan.patternNoSnapshot} - {selectedProgressPlan.patternNameSnapshot}
              </div>
              <div className="mt-1">
                Plan: {fmt(planTotalsById.get(selectedProgressPlan.id)?.plannedMeters ?? selectedProgressPlan.plannedMeters)} m / Dokunan: {" "}
                {fmt(planTotalsById.get(selectedProgressPlan.id)?.wovenMeters ?? 0)} m
              </div>
            </div>
            {selectedProgressVariants.length > 0 ? (
              <select
                value={progressVariantId}
                onChange={(event) => setProgressVariantId(event.target.value)}
                className="w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-coffee-primary"
              >
                <option value="">Varyant secin</option>
                {selectedProgressVariants.map((variant) => (
                  <option key={variant.id} value={variant.id}>
                    {(variant.variantCode?.trim() || "-")} / {variant.colorName} / Plan: {fmt(variant.plannedMeters)} m / Dokunan: {fmt(variant.wovenMeters)} m
                  </option>
                ))}
              </select>
            ) : null}

            <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_150px_110px_160px]">
              <label className="space-y-1 text-sm text-neutral-700">
                <span>Tarih / Saat</span>
                <input
                  type="datetime-local"
                  value={progressDateTime}
                  onChange={(event) => setProgressDateTime(event.target.value)}
                  className="w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-coffee-primary"
                />
              </label>

              <label className="space-y-1 text-sm text-neutral-700">
                <span>Metre</span>
                <input
                  ref={progressMetersInputRef}
                  type="number"
                  min="0"
                  step="0.01"
                  value={progressMetersInput}
                  onChange={(event) => setProgressMetersInput(event.target.value)}
                  onKeyDown={handleProgressMetersKeyDown}
                  placeholder="0"
                  className="w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-coffee-primary"
                />
              </label>

              <label className="space-y-1 text-sm text-neutral-700">
                <span>Adet</span>
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={progressUnitCountInput}
                  onChange={(event) => setProgressUnitCountInput(event.target.value)}
                  placeholder="1"
                  className="w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-coffee-primary"
                />
              </label>

              <div className="space-y-1 text-sm text-neutral-700">
                <span className="block">Toplam Ilerleme</span>
                <div className="rounded-lg border border-black/10 bg-neutral-50 px-3 py-2 text-sm font-semibold text-neutral-900">
                  {fmt(progressCalculatedTotal)} m
                </div>
              </div>
            </div>
            <input
              type="text"
              value={progressNote}
              onChange={(event) => setProgressNote(event.target.value)}
              placeholder="Not (opsiyonel)"
              className="w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-coffee-primary"
            />

            {selectedProgressVariants.length > 0 ? (
              <p className="rounded-lg border border-black/10 bg-neutral-50 px-3 py-2 text-xs text-neutral-600">
                Varyantli planlarda toplam ilerleme, secili varyanta metre x adet formulu ile eklenir.
              </p>
            ) : null}

            {progressWarnings.length > 0 ? (
              <div className="rounded-lg border border-rose-500/30 bg-rose-50 px-3 py-3 text-sm text-rose-800">
                <div className="flex items-start gap-2">
                  <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-rose-100 font-semibold text-rose-700">
                    !
                  </span>
                  <div className="space-y-1">
                    <div className="font-medium">Plan uyariyor; isterseniz yine kaydedebilirsiniz.</div>
                    {progressWarnings.map((warning) => (
                      <div key={warning} className="text-xs text-rose-700">
                        {warning}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : null}

            <div className="rounded-lg border border-black/10 bg-white p-2">
              <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                Son 5 Ilerleme
              </div>
              <div className="space-y-1 text-xs text-neutral-700">
                {recentProgressForModal.map((entry) => {
                  const variantText = [entry.variantCodeSnapshot?.trim(), entry.colorNameSnapshot?.trim()]
                    .filter(Boolean)
                    .join(" / ");
                  const amountText =
                    typeof entry.metersPerUnit === "number" &&
                    Number.isFinite(entry.metersPerUnit) &&
                    typeof entry.unitCount === "number" &&
                    Number.isFinite(entry.unitCount)
                      ? entry.unitCount > 1
                        ? `${fmt(entry.metersPerUnit)} m x ${entry.unitCount} = ${fmt(entry.meters)} m`
                        : `${fmt(entry.meters)} m`
                      : `${fmt(entry.meters)} m`;

                  return (
                    <div key={entry.id} className="flex items-center justify-between gap-2">
                      <span>
                        {formatDateTime(entry.createdAt)}
                        {" - "}
                        {variantText ? `${variantText} / ` : ""}
                        {amountText}
                        {entry.note ? ` (${entry.note})` : ""}
                      </span>
                      {canEditWeaving ? (
                        <button
                          type="button"
                          onClick={() => handleDeleteProgress(entry.id)}
                          className="rounded border border-rose-500/30 bg-rose-50 px-1.5 py-0.5 text-[11px] font-semibold text-rose-700 transition hover:bg-rose-100"
                        >
                          Sil
                        </button>
                      ) : null}
                    </div>
                  );
                })}
                {recentProgressForModal.length === 0 ? <div>Kayit yok.</div> : null}
              </div>
            </div>
          </div>
          {progressError ? <p className="mt-3 text-sm text-rose-600">{progressError}</p> : null}
          <div className="mt-4 flex justify-end gap-2">
            <button
              type="button"
              onClick={closeProgressModal}
              className="rounded-lg px-3 py-2 text-sm text-neutral-600 transition hover:bg-neutral-100"
            >
              Kapat
            </button>
            {canEditWeaving ? (
              <button
                type="button"
                onClick={handleAddProgress}
                className="rounded-lg bg-coffee-primary px-4 py-2 text-sm font-semibold text-white transition hover:brightness-95"
              >
                Kaydet
              </button>
            ) : null}
          </div>
        </Modal>
      ) : null}

      {selectedTransferPlan ? (
        <Modal title="Boyahane / Depo Sevk Gir" onClose={closeTransferModal} size="lg">
          <div className="space-y-3">
            <div className="rounded-lg border border-black/10 bg-neutral-50 px-3 py-2 text-sm text-neutral-700">
              <div className="font-semibold text-neutral-900">
                {selectedTransferPlan.patternNoSnapshot} - {selectedTransferPlan.patternNameSnapshot}
              </div>
              <div className="mt-1">
                Dokunan: {fmt(planTotalsById.get(selectedTransferPlan.id)?.wovenMeters ?? 0)} m
                {" / "}
                Sevk: {fmt(planTotalsById.get(selectedTransferPlan.id)?.totalSentMeters ?? 0)} m
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setTransferDestination("DYEHOUSE")}
                className={cn(
                  "rounded-lg border px-3 py-2 text-sm font-semibold transition",
                  transferDestination === "DYEHOUSE"
                    ? "border-coffee-primary bg-coffee-primary/10 text-coffee-primary"
                    : "border-black/10 bg-white text-neutral-700 hover:bg-neutral-100"
                )}
              >
                Boyahane
              </button>
              <button
                type="button"
                onClick={() => setTransferDestination("WAREHOUSE")}
                className={cn(
                  "rounded-lg border px-3 py-2 text-sm font-semibold transition",
                  transferDestination === "WAREHOUSE"
                    ? "border-coffee-primary bg-coffee-primary/10 text-coffee-primary"
                    : "border-black/10 bg-white text-neutral-700 hover:bg-neutral-100"
                )}
              >
                Depo
              </button>
            </div>

            {transferDestination === "DYEHOUSE" ? (
              <div className="space-y-2 rounded-lg border border-black/10 bg-white p-3">
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-neutral-500">
                  Boyahane
                </label>
                <select
                  value={transferDyehouseId}
                  onChange={(event) => setTransferDyehouseId(event.target.value)}
                  className="w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-coffee-primary"
                >
                  <option value="">Boyahane secin</option>
                  {dyehouses.map((dyehouse) => (
                    <option key={dyehouse.id} value={dyehouse.id}>
                      {dyehouse.name}
                    </option>
                  ))}
                </select>

                <div className="flex flex-wrap items-center gap-2">
                  <input
                    type="text"
                    value={newDyehouseName}
                    onChange={(event) => setNewDyehouseName(event.target.value)}
                    placeholder="+ Boyahane ekle"
                    className="min-w-0 flex-1 rounded-lg border border-black/10 bg-white px-3 py-2 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-coffee-primary"
                  />
                  {canManageDispatch ? (
                    <button
                      type="button"
                      onClick={handleAddDyehouse}
                      className="rounded-lg border border-black/10 bg-white px-3 py-2 text-xs font-semibold text-neutral-700 transition hover:bg-neutral-100"
                    >
                      Ekle
                    </button>
                  ) : null}
                  {canEditDispatch ? (
                    <button
                      type="button"
                      onClick={handleDeleteDyehouse}
                      disabled={!transferDyehouseId}
                      className="rounded-lg border border-rose-500/30 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Seciliyi Sil
                    </button>
                  ) : null}
                </div>

                {dyehouses.length === 0 ? (
                  <p className="text-xs text-neutral-500">Henuz boyahane kaydi yok.</p>
                ) : selectedTransferDyehouse ? (
                  <p className="text-xs text-neutral-500">
                    Secili boyahane: <span className="font-semibold">{selectedTransferDyehouse.name}</span>
                  </p>
                ) : null}
              </div>
            ) : null}

            {selectedTransferVariants.length > 0 ? (
              <>
                <input
                  type="datetime-local"
                  value={transferDateTime}
                  onChange={(event) => setTransferDateTime(event.target.value)}
                  className="w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-coffee-primary"
                />
                <div className="overflow-auto rounded-lg border border-black/10 bg-white">
                  <table className="w-full text-left text-xs text-neutral-700">
                    <thead className="bg-neutral-50 text-neutral-600">
                      <tr>
                        <th className="px-2.5 py-2 font-semibold">Varyant</th>
                        <th className="px-2.5 py-2 font-semibold">Plan</th>
                        <th className="px-2.5 py-2 font-semibold">Dokunan</th>
                        <th className="px-2.5 py-2 font-semibold">Sevk Edilen</th>
                        <th className="px-2.5 py-2 font-semibold">Sevk Edilebilir</th>
                        <th className="px-2.5 py-2 font-semibold">Sevk (m)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {transferVariantRows.map((row) => (
                        <tr key={row.variant.id} className="border-t border-black/5">
                          <td className="px-2.5 py-2">
                            {(row.variant.variantCode?.trim() || "-")} / {row.variant.colorName}
                          </td>
                          <td className="px-2.5 py-2">{fmt(row.variant.plannedMeters)}</td>
                          <td className="px-2.5 py-2">{fmt(row.variant.wovenMeters)}</td>
                          <td className="px-2.5 py-2">{fmt(row.variant.shippedMeters)}</td>
                          <td className="px-2.5 py-2">{fmt(row.availableToShip)}</td>
                          <td className="px-2.5 py-2">
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              max={row.availableToShip}
                              value={row.inputRaw}
                              onChange={(event) =>
                                setTransferVariantMetersById((prev) => ({
                                  ...prev,
                                  [row.variant.id]: event.target.value,
                                }))
                              }
                              className="w-28 rounded-lg border border-black/10 bg-white px-2 py-1 text-xs text-neutral-900 focus:outline-none focus:ring-2 focus:ring-coffee-primary"
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="rounded-lg border border-black/10 bg-neutral-50 px-3 py-2 text-xs text-neutral-700">
                  Toplam Sevk: {fmt(transferVariantMetersTotal)} m
                </div>
              </>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2">
                <input
                  type="datetime-local"
                  value={transferDateTime}
                  onChange={(event) => setTransferDateTime(event.target.value)}
                  className="w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-coffee-primary"
                />
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={transferMetersInput}
                  onChange={(event) => setTransferMetersInput(event.target.value)}
                  placeholder="Metre"
                  className="w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-coffee-primary"
                />
              </div>
            )}
            <input
              type="text"
              value={transferNote}
              onChange={(event) => setTransferNote(event.target.value)}
              placeholder="Not (opsiyonel)"
              className="w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-coffee-primary"
            />

            {transferWarning ? (
              <div className="rounded-lg border border-rose-500/30 bg-rose-50 px-3 py-3 text-sm text-rose-800">
                <div className="flex items-start gap-2">
                  <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-rose-100 font-semibold text-rose-700">
                    !
                  </span>
                  <div>
                    <div className="font-medium">Sevk uyarisi</div>
                    <div className="mt-1 text-xs text-rose-700">{transferWarning}</div>
                  </div>
                </div>
              </div>
            ) : null}

            <div className="rounded-lg border border-black/10 bg-white p-2">
              <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                Son 5 Sevk
              </div>
              <div className="space-y-1 text-xs text-neutral-700">
                {recentTransfersForModal.map((entry) => (
                  <div key={entry.id} className="flex items-center justify-between gap-2">
                    <span>
                      {formatDateTime(entry.createdAt)} - {fmt(entry.meters)} m /{" "}
                      {transferDestinationLabel[entry.destination]}
                      {entry.destination === "DYEHOUSE" && entry.dyehouseNameSnapshot
                        ? ` (${entry.dyehouseNameSnapshot})`
                        : ""}
                      {entry.variantLines && entry.variantLines.length > 0
                        ? ` / ${entry.variantLines
                            .map((line) => `${line.variantCodeSnapshot ?? "-"} ${line.colorNameSnapshot}: ${fmt(line.meters)} m`)
                            .join(", ")}`
                        : ""}
                      {entry.note ? ` (${entry.note})` : ""}
                    </span>
                    {canEditDispatch ? (
                      <button
                        type="button"
                        onClick={() => handleDeleteTransfer(entry.id)}
                        className="rounded border border-rose-500/30 bg-rose-50 px-1.5 py-0.5 text-[11px] font-semibold text-rose-700 transition hover:bg-rose-100"
                      >
                        Sil
                      </button>
                    ) : null}
                  </div>
                ))}
                {recentTransfersForModal.length === 0 ? <div>Kayit yok.</div> : null}
              </div>
            </div>
          </div>
          {transferError ? <p className="mt-3 text-sm text-rose-600">{transferError}</p> : null}
          <div className="mt-4 flex justify-end gap-2">
            <button
              type="button"
              onClick={closeTransferModal}
              className="rounded-lg px-3 py-2 text-sm text-neutral-600 transition hover:bg-neutral-100"
            >
              Kapat
            </button>
            {canManageDispatch ? (
              <button
                type="button"
                onClick={handleAddTransfer}
                className="rounded-lg bg-coffee-primary px-4 py-2 text-sm font-semibold text-white transition hover:brightness-95"
              >
                Kaydet
              </button>
            ) : null}
          </div>
        </Modal>
      ) : null}

      {warningConfirm ? (
        <Modal title={warningConfirm.title} onClose={closeWarningConfirm}>
          <div className="space-y-3">
            <div className="rounded-lg border border-rose-500/30 bg-rose-50 px-3 py-3 text-sm text-rose-800">
              <div className="flex items-start gap-2">
                <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-rose-100 font-semibold text-rose-700">
                  !
                </span>
                <div className="space-y-1">
                  <div className="font-medium">{warningConfirm.summary}</div>
                  {warningConfirm.messages.map((message) => (
                    <div key={message} className="text-xs text-rose-700">
                      {message}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={closeWarningConfirm}
                className="rounded-lg border border-black/10 bg-white px-3 py-2 text-sm font-semibold text-neutral-700 transition hover:bg-neutral-100"
              >
                Vazgec
              </button>
              <button
                type="button"
                onClick={confirmWarningAction}
                className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white transition hover:brightness-95"
              >
                {warningConfirm.confirmLabel}
              </button>
            </div>
          </div>
        </Modal>
      ) : null}
    </Layout>
  );
}

type SummaryCardProps = {
  title: string;
  value: string;
};

function SummaryCard({ title, value }: SummaryCardProps) {
  return (
    <div className="rounded-xl border border-black/10 bg-white p-4 shadow-[0_8px_20px_rgba(0,0,0,0.05)]">
      <div className="text-xs uppercase tracking-wide text-neutral-500">{title}</div>
      <div className="mt-2 text-xl font-semibold text-neutral-900">{value}</div>
    </div>
  );
}

type PatternImagePreviewProps = {
  pattern: Pattern;
  compact?: boolean;
};

function PatternImagePreview({ pattern, compact = false }: PatternImagePreviewProps) {
  const image = normalizeImageSrc(getPatternImage(pattern));
  const sizeClass = compact ? "h-12 w-12" : "h-20 w-20";

  if (!image) {
    return (
      <div
        className={cn(
          "inline-flex items-center justify-center rounded-lg border border-dashed border-black/15 bg-neutral-50 text-xs text-neutral-500",
          sizeClass
        )}
      >
        Foto
      </div>
    );
  }

  return (
    <Image
      src={image}
      alt={pattern.fabricCode}
      width={compact ? 48 : 80}
      height={compact ? 48 : 80}
      unoptimized
      className={cn(sizeClass, "rounded-lg object-cover")}
    />
  );
}

type PatternUploadCardProps = {
  title: string;
  src: string | null;
  onFileChange: (event: ChangeEvent<HTMLInputElement>) => void;
  debugText?: string;
};

function PatternUploadCard({
  title,
  src,
  onFileChange,
  debugText,
}: PatternUploadCardProps) {
  const normalizedSrc = normalizeImageSrc(src);

  return (
    <div className="space-y-2 rounded-lg border border-black/10 bg-white p-3">
      <label className="block text-xs font-semibold uppercase tracking-wide text-neutral-500">
        {title}
      </label>
      <div className="flex items-start gap-3">
        {normalizedSrc ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={normalizedSrc}
            alt={`${title} onizleme`}
            className="h-24 w-24 rounded-lg border border-black/10 object-cover"
          />
        ) : (
          <div className="inline-flex h-24 w-24 items-center justify-center rounded-lg border border-dashed border-black/15 bg-neutral-50 text-xs text-neutral-500">
            Fotograf yok
          </div>
        )}
        <div className="pt-0.5 space-y-1">
          <input
            type="file"
            accept="image/*"
            onChange={onFileChange}
            className="w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-sm text-neutral-900 file:mr-3 file:rounded file:border-0 file:bg-coffee-primary/10 file:px-2 file:py-1 file:text-xs file:font-semibold file:text-coffee-primary"
          />
          {debugText ? <p className="text-[11px] text-neutral-500">{debugText}</p> : null}
        </div>
      </div>
    </div>
  );
}

type WeavingDetailContentProps = {
  plan: WeavingPlan;
  pattern: Pattern | null;
  totals: PlanTotals;
  onPatternUpdated: () => void;
  onPlanUpdated: () => void;
};

type DetailTab = "INFO" | "PHOTOS";

function WeavingDetailContent({
  plan,
  pattern,
  totals,
  onPatternUpdated,
  onPlanUpdated,
}: WeavingDetailContentProps) {
  const { permissions } = useAuthProfile();
  const [activeTab, setActiveTab] = useState<DetailTab>("INFO");
  const [digitalPreviewUrl, setDigitalPreviewUrl] = useState<string | null>(null);
  const [finalPreviewUrl, setFinalPreviewUrl] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState("");
  const [photoSuccess, setPhotoSuccess] = useState("");
  const [isEditingFabric, setIsEditingFabric] = useState(false);
  const [fabricDraft, setFabricDraft] = useState<FabricDraft>(() =>
    createFabricDraftFromPattern(pattern)
  );
  const [fabricSaveError, setFabricSaveError] = useState("");
  const [fabricSaveSuccess, setFabricSaveSuccess] = useState("");
  const digitalInputRef = useRef<HTMLInputElement | null>(null);
  const finalInputRef = useRef<HTMLInputElement | null>(null);
  const variantEditorBodyRef = useRef<HTMLDivElement | null>(null);
  const [variantEditorOpen, setVariantEditorOpen] = useState(false);
  const [variantError, setVariantError] = useState("");
  const [variantRows, setVariantRows] = useState<
    Array<{
      id: string;
      variantCode: string;
      colorName: string;
      plannedMetersInput: string;
      wovenMeters: number;
      shippedMeters: number;
      notes: string;
    }>
  >([]);
  const canEditPatterns = permissions.patterns.edit;
  const canEditVariants = permissions.weaving.edit;

  const createVariantRowId = () => {
    const randomUUID = globalThis.crypto?.randomUUID;
    if (typeof randomUUID === "function") {
      return randomUUID.call(globalThis.crypto);
    }
    return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  };

  const planVariants = hasPlanVariants(plan) ? plan.variants : [];

  const setDigitalPreview = (nextUrl: string | null) => {
    setDigitalPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return nextUrl;
    });
  };

  const setFinalPreview = (nextUrl: string | null) => {
    setFinalPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return nextUrl;
    });
  };

  useEffect(() => {
    return () => {
      if (digitalPreviewUrl) URL.revokeObjectURL(digitalPreviewUrl);
      if (finalPreviewUrl) URL.revokeObjectURL(finalPreviewUrl);
    };
  }, [digitalPreviewUrl, finalPreviewUrl]);

  const patternCode = pattern?.fabricCode ?? plan.patternNoSnapshot;
  const patternName = pattern?.fabricName ?? plan.patternNameSnapshot;
  const digitalSrc = normalizeImageSrc(digitalPreviewUrl ?? getPatternDigitalImage(pattern));
  const finalSrc = normalizeImageSrc(finalPreviewUrl ?? getPatternFinalImage(pattern));
  const fabricDetails = getFabricDetailItems(pattern);
  const hasFabricChanges = useMemo(() => {
    const current = createFabricDraftFromPattern(pattern);
    return !isFabricDraftEqual(current, fabricDraft);
  }, [pattern, fabricDraft]);

  useEffect(() => {
    setFabricDraft(createFabricDraftFromPattern(pattern));
    setIsEditingFabric(false);
    setFabricSaveError("");
    setFabricSaveSuccess("");
  }, [pattern]);

  useEffect(() => {
    if (!fabricSaveSuccess) return;
    const timeout = window.setTimeout(() => {
      setFabricSaveSuccess("");
    }, 1600);
    return () => window.clearTimeout(timeout);
  }, [fabricSaveSuccess]);

  const savePatternImage = async (target: "DIGITAL" | "FINAL", dataUrl: string) => {
    if (!canEditPatterns) throw new Error("Bu hesap desen gorseli guncelleyemez.");
    if (!pattern) throw new Error("Desen kaydi bulunamadi.");

    const nextPatch =
      target === "DIGITAL"
        ? {
            imageDigital: dataUrl,
            digitalImageUrl: dataUrl,
          }
        : {
            imageFinal: dataUrl,
            finalImageUrl: dataUrl,
          };

    const updated = await patternsSupabaseRepo.update(pattern.id, nextPatch);
    if (!updated) throw new Error("Gorsel kaydi basarisiz oldu.");
    onPatternUpdated();
  };

  const handlePhotoChange =
    (target: "DIGITAL" | "FINAL") => (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.currentTarget.files?.[0];
      if (!file) return;

      if (!pattern) {
        setPhotoSuccess("");
        setPhotoError("Bu plan icin desen bulunamadi.");
        event.currentTarget.value = "";
        return;
      }

      const previewUrl = URL.createObjectURL(file);
      if (target === "DIGITAL") {
        setDigitalPreview(previewUrl);
      } else {
        setFinalPreview(previewUrl);
      }

      setPhotoError("");
      setPhotoSuccess("");

      const reader = new FileReader();
      reader.onload = async () => {
        const result = reader.result;
        if (typeof result !== "string") {
          setPhotoSuccess("");
          setPhotoError("Gorsel okunamadi.");
          return;
        }

        try {
          await savePatternImage(target, result);
          setPhotoError("");
          setPhotoSuccess(target === "DIGITAL" ? "Dijital foto kaydedildi." : "Final foto kaydedildi.");
        } catch (error) {
          setPhotoSuccess("");
          setPhotoError(error instanceof Error ? error.message : "Gorsel kaydedilemedi.");
        }
      };
      reader.onerror = () => {
        setPhotoSuccess("");
        setPhotoError("Gorsel okunamadi.");
      };
      reader.readAsDataURL(file);
      event.currentTarget.value = "";
    };

  const handleFabricDraftChange = (key: keyof FabricDraft, value: string) => {
    setFabricDraft((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const openFabricEditor = () => {
    if (!canEditPatterns) return;
    setFabricDraft(createFabricDraftFromPattern(pattern));
    setFabricSaveError("");
    setFabricSaveSuccess("");
    setIsEditingFabric(true);
  };

  const cancelFabricEdit = () => {
    setFabricDraft(createFabricDraftFromPattern(pattern));
    setFabricSaveError("");
    setFabricSaveSuccess("");
    setIsEditingFabric(false);
  };

  const saveFabricDetails = async () => {
    if (!canEditPatterns) return;
    if (!pattern) return;

    try {
      const totalEndsInput = fabricDraft.toplamTel.trim().replace(",", ".");
      const tarakEniInput = fabricDraft.tarakEniCm.trim().replace(",", ".");
      const cozguGrInput = fabricDraft.cozguGr.trim().replace(",", ".");
      const atkiGrInput = fabricDraft.atkiGr.trim().replace(",", ".");
      const mtTulInput = fabricDraft.mtTul.trim().replace(",", ".");
      const totalEndsParsed = totalEndsInput ? Number(totalEndsInput) : null;
      const tarakEniParsed = tarakEniInput ? Number(tarakEniInput) : null;
      const cozguGrParsed = cozguGrInput ? Number(cozguGrInput) : null;
      const atkiGrParsed = atkiGrInput ? Number(atkiGrInput) : null;
      const mtTulParsed = mtTulInput ? Number(mtTulInput) : null;

      if (totalEndsParsed !== null && (!Number.isFinite(totalEndsParsed) || totalEndsParsed < 0)) {
        throw new Error("Toplam Tel negatif olamaz.");
      }
      if (tarakEniParsed !== null && (!Number.isFinite(tarakEniParsed) || tarakEniParsed < 0)) {
        throw new Error("Tarak Eni (cm) negatif olamaz.");
      }
      if (cozguGrParsed !== null && (!Number.isFinite(cozguGrParsed) || cozguGrParsed < 0)) {
        throw new Error("Cozgu Gr negatif olamaz.");
      }
      if (atkiGrParsed !== null && (!Number.isFinite(atkiGrParsed) || atkiGrParsed < 0)) {
        throw new Error("Atki Gr negatif olamaz.");
      }
      if (mtTulParsed !== null && (!Number.isFinite(mtTulParsed) || mtTulParsed < 0)) {
        throw new Error("Mt Tul negatif olamaz.");
      }
      const warpCountNormalized = normalizeCountAndYarn(
        fabricDraft.cozguSayi,
        fabricDraft.cozguIplik
      );
      const weftCountNormalized = normalizeCountAndYarn(
        fabricDraft.atkiSayi,
        fabricDraft.atkiIplik
      );

      const nextPatch: Partial<Pattern> = {
        color: fabricDraft.color.trim() || undefined,
        weaveType: fabricDraft.weave.trim() || "-",
        warpCount: (warpCountNormalized ?? null) as unknown as string,
        weftCount: (weftCountNormalized ?? null) as unknown as string,
        totalEnds:
          totalEndsParsed === null
            ? "-"
            : String(Math.max(0, Math.round(totalEndsParsed))),
        tarakNo: fabricDraft.tarakNo.trim() || undefined,
        tarakEniCm: tarakEniParsed === null ? null : Math.max(0, tarakEniParsed),
        cozguGr: cozguGrParsed === null ? null : Math.max(0, cozguGrParsed),
        atkiGr: atkiGrParsed === null ? null : Math.max(0, atkiGrParsed),
        mtTul: mtTulParsed === null ? null : Math.max(0, mtTulParsed),
        opsiyonelNot: fabricDraft.opsiyonelNot.trim() || undefined,
      };

      const updated = await patternsSupabaseRepo.update(pattern.id, nextPatch);
      if (!updated) throw new Error("Kumas detaylari kaydedilemedi.");

      onPatternUpdated();
      setFabricDraft(createFabricDraftFromPattern(updated));
      setFabricSaveError("");
      setFabricSaveSuccess("Kaydedildi.");
      setIsEditingFabric(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Kumas detaylari kaydedilemedi.";
      setFabricSaveError(message);
      setFabricSaveSuccess("");
      window.alert(message);
    }
  };

  const openVariantEditor = () => {
    if (!canEditVariants) return;
    const rows =
      planVariants.length > 0
        ? planVariants.map((variant) => ({
            id: variant.id,
            variantCode: variant.variantCode ?? "",
            colorName: variant.colorName,
            plannedMetersInput: String(variant.plannedMeters),
            wovenMeters: variant.wovenMeters,
            shippedMeters: variant.shippedMeters,
            notes: variant.notes ?? "",
          }))
        : [
            {
              id: createVariantRowId(),
              variantCode: "",
              colorName: "",
              plannedMetersInput: "",
              wovenMeters: 0,
              shippedMeters: 0,
              notes: "",
            },
          ];

    setVariantRows(rows);
    setVariantError("");
    setVariantEditorOpen(true);
  };

  const closeVariantEditor = () => {
    setVariantEditorOpen(false);
    setVariantError("");
  };

  const updateVariantRow = (
    id: string,
    key: "variantCode" | "colorName" | "plannedMetersInput" | "notes",
    value: string
  ) => {
    setVariantRows((prev) =>
      prev.map((row) => (row.id === id ? { ...row, [key]: value } : row))
    );
  };

  const addVariantRow = () => {
    if (!canEditVariants) return;
    setVariantRows((prev) => [
      ...prev,
      {
        id: createVariantRowId(),
        variantCode: "",
        colorName: "",
        plannedMetersInput: "",
        wovenMeters: 0,
        shippedMeters: 0,
        notes: "",
      },
    ]);
    requestAnimationFrame(() => {
      variantEditorBodyRef.current?.scrollTo({
        top: variantEditorBodyRef.current.scrollHeight,
        behavior: "smooth",
      });
    });
  };

  const removeVariantRow = (id: string) => {
    if (!canEditVariants) return;
    setVariantRows((prev) => prev.filter((row) => row.id !== id));
  };

  const saveVariants = async () => {
    if (!canEditVariants) return;
    try {
      if (variantRows.length === 0) {
        throw new Error("En az bir varyant eklemelisiniz.");
      }

      const normalizedVariants: WeavingPlanVariant[] = variantRows.map((row) => {
        const colorName = row.colorName.trim();
        if (!colorName) throw new Error("Varyant renk adi zorunlu.");

        const plannedMeters = Number(row.plannedMetersInput.trim().replace(",", "."));
        if (!Number.isFinite(plannedMeters) || plannedMeters <= 0) {
          throw new Error("Varyant plan metresi 0'dan buyuk olmali.");
        }

        const wovenMeters = Number.isFinite(row.wovenMeters) ? Math.max(0, row.wovenMeters) : 0;
        const shippedMeters = Number.isFinite(row.shippedMeters) ? Math.max(0, row.shippedMeters) : 0;
        return {
          id: row.id || createVariantRowId(),
          variantCode: row.variantCode.trim() || undefined,
          colorName,
          plannedMeters,
          wovenMeters,
          shippedMeters,
          status: wovenMeters >= plannedMeters ? "DONE" : "ACTIVE",
          notes: row.notes.trim() || undefined,
        };
      });

      await weavingSupabaseRepo.updatePlan(plan.id, { variants: normalizedVariants });
      onPlanUpdated();
      closeVariantEditor();
    } catch (error) {
      setVariantError(error instanceof Error ? error.message : "Varyantlar kaydedilemedi.");
    }
  };

  return (
    <div className="space-y-3">
      <div className="inline-flex rounded-full border border-black/10 bg-neutral-50 p-1">
        <button
          type="button"
          onClick={() => setActiveTab("INFO")}
          className={cn(
            "rounded-full px-3 py-1 text-xs font-semibold transition",
            activeTab === "INFO"
              ? "bg-white text-neutral-900 shadow-sm"
              : "text-neutral-600 hover:text-neutral-900"
          )}
        >
          Bilgiler
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("PHOTOS")}
          className={cn(
            "rounded-full px-3 py-1 text-xs font-semibold transition",
            activeTab === "PHOTOS"
              ? "bg-white text-neutral-900 shadow-sm"
              : "text-neutral-600 hover:text-neutral-900"
          )}
        >
          Fotograflar
        </button>
      </div>

      {activeTab === "INFO" ? (
        <div className="space-y-3">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2 rounded-xl border border-black/10 bg-neutral-50 p-3 text-sm text-neutral-700">
              <div className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Plan Bilgileri</div>
              <div className="font-semibold text-neutral-900">
                {patternCode} - {patternName}
              </div>
              <div>Planlanan: {fmt(totals.plannedMeters)} m</div>
              <div>Dokunan: {fmt(totals.wovenMeters)} m</div>
              <div>Sevk: {fmt(totals.totalSentMeters)} m</div>
              <div>Boyahane: {fmt(totals.sentToDyehouse)} m</div>
              <div>Depo: {fmt(totals.sentToWarehouse)} m</div>
              <div>Dokumada Bekleyen: {fmt(totals.pendingToSend)} m</div>
              <div>Kalan: {fmt(totals.remainingPlanned)} m</div>
              <div>Durum: {planStatusLabels[plan.status]}</div>
              {typeof plan.hamKumasEniCm === "number" && Number.isFinite(plan.hamKumasEniCm) ? (
                <div>Ham Kumas Eni: {fmt(plan.hamKumasEniCm)} cm</div>
              ) : null}
              <div>Olusturma: {formatDateTime(plan.createdAt)}</div>
              {plan.note ? <div>Plan Notu: {plan.note}</div> : null}
              {getPlanWarningMessages(plan, totals).length > 0 ? (
                <div className="mt-2 rounded-lg border border-rose-500/30 bg-rose-50 px-3 py-2 text-xs text-rose-800">
                  <div className="flex items-start gap-2">
                    <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-rose-100 font-semibold text-rose-700">
                      !
                    </span>
                    <div className="space-y-1">
                      {getPlanWarningMessages(plan, totals).map((warning) => (
                        <div key={warning}>{warning}</div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : null}
            </div>

            <div className="space-y-2 rounded-xl border border-black/10 bg-white p-3 text-sm text-neutral-700">
              <div className="flex items-center justify-between gap-2">
                <div className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                  Kumas Detaylari
                </div>
                {!isEditingFabric && canEditPatterns ? (
                  <button
                    type="button"
                    onClick={openFabricEditor}
                    disabled={!pattern}
                    className="rounded-lg border border-black/10 bg-neutral-50 px-2.5 py-1 text-xs font-semibold text-neutral-700 transition hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Duzenle
                  </button>
                ) : isEditingFabric ? (
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={cancelFabricEdit}
                      className="rounded-lg border border-black/10 bg-white px-2.5 py-1 text-xs font-semibold text-neutral-700 transition hover:bg-neutral-100"
                    >
                      Iptal
                    </button>
                    <button
                      type="button"
                      onClick={saveFabricDetails}
                      disabled={!hasFabricChanges}
                      className="rounded-lg bg-coffee-primary px-2.5 py-1 text-xs font-semibold text-white transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Kaydet
                    </button>
                  </div>
                ) : null}
              </div>

              {isEditingFabric ? (
                <div className="space-y-2">
                  <div className="grid gap-2 sm:grid-cols-2">
                    <label className="space-y-1 text-xs text-neutral-700">
                      <span>Renk</span>
                      <input
                        type="text"
                        value={fabricDraft.color}
                        onChange={(event) => handleFabricDraftChange("color", event.target.value)}
                        className="w-full rounded-lg border border-black/10 bg-white px-2.5 py-1.5 text-xs text-neutral-900 focus:outline-none focus:ring-2 focus:ring-coffee-primary"
                      />
                    </label>

                    <label className="space-y-1 text-xs text-neutral-700">
                      <span>Orgu</span>
                      <input
                        type="text"
                        value={fabricDraft.weave}
                        onChange={(event) => handleFabricDraftChange("weave", event.target.value)}
                        className="w-full rounded-lg border border-black/10 bg-white px-2.5 py-1.5 text-xs text-neutral-900 focus:outline-none focus:ring-2 focus:ring-coffee-primary"
                      />
                    </label>

                    <label className="space-y-1 text-xs text-neutral-700">
                      <span>Cozgu Sayi</span>
                      <input
                        type="text"
                        value={fabricDraft.cozguSayi}
                        onChange={(event) =>
                          handleFabricDraftChange("cozguSayi", event.target.value)
                        }
                        className="w-full rounded-lg border border-black/10 bg-white px-2.5 py-1.5 text-xs text-neutral-900 focus:outline-none focus:ring-2 focus:ring-coffee-primary"
                      />
                    </label>

                    <label className="space-y-1 text-xs text-neutral-700">
                      <span>Cozgu Iplik</span>
                      <input
                        type="text"
                        value={fabricDraft.cozguIplik}
                        onChange={(event) =>
                          handleFabricDraftChange("cozguIplik", event.target.value)
                        }
                        className="w-full rounded-lg border border-black/10 bg-white px-2.5 py-1.5 text-xs text-neutral-900 focus:outline-none focus:ring-2 focus:ring-coffee-primary"
                      />
                    </label>

                    <label className="space-y-1 text-xs text-neutral-700">
                      <span>Atki Sayi</span>
                      <input
                        type="text"
                        value={fabricDraft.atkiSayi}
                        onChange={(event) => handleFabricDraftChange("atkiSayi", event.target.value)}
                        className="w-full rounded-lg border border-black/10 bg-white px-2.5 py-1.5 text-xs text-neutral-900 focus:outline-none focus:ring-2 focus:ring-coffee-primary"
                      />
                    </label>

                    <label className="space-y-1 text-xs text-neutral-700">
                      <span>Atki Iplik</span>
                      <input
                        type="text"
                        value={fabricDraft.atkiIplik}
                        onChange={(event) =>
                          handleFabricDraftChange("atkiIplik", event.target.value)
                        }
                        className="w-full rounded-lg border border-black/10 bg-white px-2.5 py-1.5 text-xs text-neutral-900 focus:outline-none focus:ring-2 focus:ring-coffee-primary"
                      />
                    </label>

                    <label className="space-y-1 text-xs text-neutral-700">
                      <span>Toplam Tel</span>
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={fabricDraft.toplamTel}
                        onChange={(event) => handleFabricDraftChange("toplamTel", event.target.value)}
                        className="w-full rounded-lg border border-black/10 bg-white px-2.5 py-1.5 text-xs text-neutral-900 focus:outline-none focus:ring-2 focus:ring-coffee-primary"
                      />
                    </label>

                    <label className="space-y-1 text-xs text-neutral-700">
                      <span>Tarak No</span>
                      <input
                        type="text"
                        value={fabricDraft.tarakNo}
                        onChange={(event) => handleFabricDraftChange("tarakNo", event.target.value)}
                        className="w-full rounded-lg border border-black/10 bg-white px-2.5 py-1.5 text-xs text-neutral-900 focus:outline-none focus:ring-2 focus:ring-coffee-primary"
                      />
                    </label>

                    <label className="space-y-1 text-xs text-neutral-700">
                      <span>Tarak Eni (cm)</span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={fabricDraft.tarakEniCm}
                        onChange={(event) =>
                          handleFabricDraftChange("tarakEniCm", event.target.value)
                        }
                        className="w-full rounded-lg border border-black/10 bg-white px-2.5 py-1.5 text-xs text-neutral-900 focus:outline-none focus:ring-2 focus:ring-coffee-primary"
                      />
                    </label>

                    <label className="space-y-1 text-xs text-neutral-700">
                      <span>Cozgu Gr</span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={fabricDraft.cozguGr}
                        onChange={(event) => handleFabricDraftChange("cozguGr", event.target.value)}
                        className="w-full rounded-lg border border-black/10 bg-white px-2.5 py-1.5 text-xs text-neutral-900 focus:outline-none focus:ring-2 focus:ring-coffee-primary"
                      />
                    </label>

                    <label className="space-y-1 text-xs text-neutral-700">
                      <span>Atki Gr</span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={fabricDraft.atkiGr}
                        onChange={(event) => handleFabricDraftChange("atkiGr", event.target.value)}
                        className="w-full rounded-lg border border-black/10 bg-white px-2.5 py-1.5 text-xs text-neutral-900 focus:outline-none focus:ring-2 focus:ring-coffee-primary"
                      />
                    </label>

                    <label className="space-y-1 text-xs text-neutral-700">
                      <span>Mt Tul</span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={fabricDraft.mtTul}
                        onChange={(event) => handleFabricDraftChange("mtTul", event.target.value)}
                        className="w-full rounded-lg border border-black/10 bg-white px-2.5 py-1.5 text-xs text-neutral-900 focus:outline-none focus:ring-2 focus:ring-coffee-primary"
                      />
                    </label>
                  </div>

                  <label className="space-y-1 text-xs text-neutral-700">
                    <span>Opsiyonel Not</span>
                    <textarea
                      value={fabricDraft.opsiyonelNot}
                      onChange={(event) =>
                        handleFabricDraftChange("opsiyonelNot", event.target.value)
                      }
                      rows={3}
                      className="w-full resize-none rounded-lg border border-black/10 bg-white px-2.5 py-1.5 text-xs text-neutral-900 focus:outline-none focus:ring-2 focus:ring-coffee-primary"
                    />
                  </label>
                  <p className="text-xs text-neutral-500">
                    Bu degisiklik desen kartini gunceller.
                  </p>
                  {fabricSaveError ? (
                    <p className="text-xs font-medium text-rose-600">{fabricSaveError}</p>
                  ) : null}
                </div>
              ) : fabricDetails.length > 0 ? (
                <div className="space-y-1.5">
                  {fabricDetails.map((item) => (
                    <div
                      key={item.label}
                      className="flex items-start justify-between gap-3 rounded-lg border border-black/5 bg-neutral-50 px-2.5 py-1.5"
                    >
                      <span className="text-neutral-500">{item.label}</span>
                      <span className="text-right font-medium text-neutral-900">{item.value}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-lg border border-dashed border-black/10 bg-neutral-50 px-3 py-6 text-xs text-neutral-500">
                  Kumas detayi bulunamadi.
                </div>
              )}
              {fabricSaveSuccess ? (
                <p className="text-xs font-medium text-emerald-700">{fabricSaveSuccess}</p>
              ) : null}
            </div>
          </div>

          <div className="space-y-2 rounded-xl border border-black/10 bg-white p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                Varyantlar
              </div>
              {canEditVariants ? (
                <button
                  type="button"
                  onClick={openVariantEditor}
                  className="rounded-lg border border-black/10 bg-neutral-50 px-2.5 py-1 text-xs font-semibold text-neutral-700 transition hover:bg-neutral-100"
                >
                  Varyantlari Duzenle
                </button>
              ) : null}
            </div>

            {planVariants.length > 0 ? (
              <div className="overflow-auto rounded-lg border border-black/10">
                <table className="w-full text-left text-xs text-neutral-700">
                  <thead className="bg-neutral-50 text-neutral-600">
                    <tr>
                      <th className="px-2.5 py-2 font-semibold">Varyant Kodu</th>
                      <th className="px-2.5 py-2 font-semibold">Renk</th>
                      <th className="px-2.5 py-2 font-semibold">Plan (m)</th>
                      <th className="px-2.5 py-2 font-semibold">Dokunan (m)</th>
                      <th className="px-2.5 py-2 font-semibold">Kalan (m)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {planVariants.map((variant) => {
                      const isOverWoven = variant.wovenMeters - variant.plannedMeters > EPSILON;
                      return (
                        <tr key={variant.id} className="border-t border-black/5">
                          <td className="px-2.5 py-2">{variant.variantCode?.trim() || "-"}</td>
                          <td className="px-2.5 py-2">{variant.colorName}</td>
                          <td className="px-2.5 py-2">{fmt(variant.plannedMeters)}</td>
                          <td className={cn("px-2.5 py-2", isOverWoven ? "font-semibold text-rose-700" : "")}>
                            {fmt(variant.wovenMeters)}
                            {isOverWoven ? (
                              <div className="text-[11px] text-rose-700">Plan asildi</div>
                            ) : null}
                          </td>
                          <td className={cn("px-2.5 py-2", isOverWoven ? "font-semibold text-rose-700" : "")}>
                            {fmt(variant.plannedMeters - variant.wovenMeters)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-black/10 bg-neutral-50 px-3 py-6 text-xs text-neutral-500">
                Bu plan icin henuz varyant tanimlanmadi.
              </div>
            )}

            <div className="rounded-lg border border-black/10 bg-neutral-50 px-3 py-2 text-xs text-neutral-700">
              Toplam Plan: {fmt(totals.plannedMeters)} m / Toplam Dokunan: {fmt(totals.wovenMeters)} m / Toplam Kalan: {fmt(totals.remainingPlanned)} m
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-3 rounded-xl border border-black/10 bg-white p-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2 rounded-lg border border-black/10 bg-neutral-50 p-2">
              <div className="text-xs font-semibold text-neutral-600">Dijital Foto</div>
              {digitalSrc ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={digitalSrc}
                  alt={`${patternCode} dijital`}
                  className="h-40 w-full rounded-lg border border-black/10 object-cover"
                />
              ) : (
                <div className="flex h-40 w-full items-center justify-center rounded-lg border border-dashed border-black/15 bg-white text-xs text-neutral-500">
                  Fotograf yok
                </div>
              )}
              {canEditPatterns ? (
                <button
                  type="button"
                  onClick={() => digitalInputRef.current?.click()}
                  disabled={!pattern}
                  className="w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-xs font-semibold text-neutral-700 transition hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {digitalSrc ? "Foto Degistir" : "Foto Ekle"}
                </button>
              ) : null}
              <input
                ref={digitalInputRef}
                type="file"
                accept="image/*"
                onChange={handlePhotoChange("DIGITAL")}
                className="hidden"
              />
            </div>

            <div className="space-y-2 rounded-lg border border-black/10 bg-neutral-50 p-2">
              <div className="text-xs font-semibold text-neutral-600">Final Foto</div>
              {finalSrc ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={finalSrc}
                  alt={`${patternCode} final`}
                  className="h-40 w-full rounded-lg border border-black/10 object-cover"
                />
              ) : (
                <div className="flex h-40 w-full items-center justify-center rounded-lg border border-dashed border-black/15 bg-white text-xs text-neutral-500">
                  Fotograf yok
                </div>
              )}
              {canEditPatterns ? (
                <button
                  type="button"
                  onClick={() => finalInputRef.current?.click()}
                  disabled={!pattern}
                  className="w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-xs font-semibold text-neutral-700 transition hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {finalSrc ? "Foto Degistir" : "Foto Ekle"}
                </button>
              ) : null}
              <input
                ref={finalInputRef}
                type="file"
                accept="image/*"
                onChange={handlePhotoChange("FINAL")}
                className="hidden"
              />
            </div>
          </div>

          {photoSuccess ? <p className="text-xs font-medium text-emerald-700">{photoSuccess}</p> : null}
          {photoError ? <p className="text-xs font-medium text-rose-600">{photoError}</p> : null}
        </div>
      )}

      {variantEditorOpen ? (
        <Modal title="Varyantlari Duzenle" onClose={closeVariantEditor} size="xl">
          <div className="flex max-h-[72vh] min-h-0 flex-col gap-3">
            <div
              ref={variantEditorBodyRef}
              className="min-h-0 flex-1 overflow-auto rounded-lg border border-black/10"
            >
              <table className="w-full text-left text-sm">
                <thead className="sticky top-0 bg-neutral-50 text-neutral-600">
                  <tr>
                    <th className="px-2 py-2 font-semibold">Varyant Kodu</th>
                    <th className="px-2 py-2 font-semibold">Renk</th>
                    <th className="px-2 py-2 font-semibold">Plan (m)</th>
                    <th className="px-2 py-2 font-semibold">Dokunan (m)</th>
                    <th className="px-2 py-2 font-semibold">Sevk Edilen (m)</th>
                    <th className="px-2 py-2 font-semibold">Aksiyon</th>
                  </tr>
                </thead>
                <tbody>
                  {variantRows.map((row) => (
                    <tr key={row.id} className="border-t border-black/5 align-top">
                      <td className="px-2 py-2">
                        <input
                          type="text"
                          value={row.variantCode}
                          onChange={(event) =>
                            updateVariantRow(row.id, "variantCode", event.target.value)
                          }
                          placeholder="-"
                          className="w-full rounded-lg border border-black/10 bg-white px-2 py-1.5 text-xs text-neutral-900 focus:outline-none focus:ring-2 focus:ring-coffee-primary"
                        />
                      </td>
                      <td className="px-2 py-2">
                        <input
                          type="text"
                          value={row.colorName}
                          onChange={(event) =>
                            updateVariantRow(row.id, "colorName", event.target.value)
                          }
                          placeholder="Renk"
                          className="w-full rounded-lg border border-black/10 bg-white px-2 py-1.5 text-xs text-neutral-900 focus:outline-none focus:ring-2 focus:ring-coffee-primary"
                        />
                      </td>
                      <td className="px-2 py-2">
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={row.plannedMetersInput}
                          onChange={(event) =>
                            updateVariantRow(row.id, "plannedMetersInput", event.target.value)
                          }
                          placeholder="0"
                          className="w-full rounded-lg border border-black/10 bg-white px-2 py-1.5 text-xs text-neutral-900 focus:outline-none focus:ring-2 focus:ring-coffee-primary"
                        />
                      </td>
                      <td className="px-2 py-2 text-xs text-neutral-700">{fmt(row.wovenMeters)}</td>
                      <td className="px-2 py-2 text-xs text-neutral-700">{fmt(row.shippedMeters)}</td>
                      <td className="px-2 py-2">
                        {canEditVariants ? (
                          <button
                            type="button"
                            onClick={() => removeVariantRow(row.id)}
                            className="rounded border border-rose-500/30 bg-rose-50 px-2 py-1 text-[11px] font-semibold text-rose-700 transition hover:bg-rose-100"
                          >
                            Sil
                          </button>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex shrink-0 justify-between gap-2 rounded-lg border border-black/10 bg-white p-2">
              <div className="flex items-center gap-2">
                {canEditVariants ? (
                  <button
                    type="button"
                    onClick={addVariantRow}
                    className="rounded-lg border border-black/10 bg-white px-3 py-2 text-xs font-semibold text-neutral-700 transition hover:bg-neutral-100"
                  >
                    + Satir Ekle
                  </button>
                ) : null}
                <span className="text-xs text-neutral-500">Seri giris icin satir alani kendi icinde kayar.</span>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={closeVariantEditor}
                  className="rounded-lg px-3 py-2 text-sm text-neutral-600 transition hover:bg-neutral-100"
                >
                  Kapat
                </button>
                {canEditVariants ? (
                  <button
                    type="button"
                    onClick={saveVariants}
                    className="rounded-lg bg-coffee-primary px-4 py-2 text-sm font-semibold text-white transition hover:brightness-95"
                  >
                    Kaydet
                  </button>
                ) : null}
              </div>
            </div>

            {variantError ? <p className="text-sm text-rose-600">{variantError}</p> : null}
          </div>
        </Modal>
      ) : null}
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
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className={cn(
          "max-h-[88vh] w-full overflow-hidden rounded-2xl border border-black/10 bg-white shadow-2xl",
          widthClass
        )}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="max-h-[88vh] overflow-auto p-5">
          <h3 className="text-lg font-semibold text-neutral-900">{title}</h3>
          <div className="mt-2">{children}</div>
        </div>
      </div>
    </div>
  );
}
