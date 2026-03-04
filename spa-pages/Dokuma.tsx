"use client";

import { useEffect, useMemo, useRef, useState, type ChangeEvent, type ReactNode } from "react";
import Image from "next/image";

import Layout from "../components/Layout";
import { cn } from "@/lib/cn";
import type { Dyehouse } from "@/lib/domain/dyehouse";
import type { Pattern } from "@/lib/domain/pattern";
import type {
  WeavingPlan,
  WeavingPlanVariant,
  WeavingProgressEntry,
  WeavingTransfer,
  WeavingTransferDestination,
} from "@/lib/domain/weaving";
import { dyehouseLocalRepo } from "@/lib/repos/dyehouseLocalRepo";
import { patternsLocalRepo } from "@/lib/repos/patternsLocalRepo";
import { weavingLocalRepo } from "@/lib/repos/weavingLocalRepo";

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

const nowDateTimeLocal = () => {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
};

const toIsoFromDateTimeLocal = (value: string, label: string) => {
  const trimmed = value.trim();
  if (!trimmed) throw new Error(`${label} gerekli.`);
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) throw new Error(`${label} gecersiz.`);
  return parsed.toISOString();
};

const toPositiveNumber = (value: string, label: string) => {
  const parsed = Number(value.trim().replace(",", "."));
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`${label} 0'dan buyuk olmali.`);
  }
  return parsed;
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

type PlanTotals = {
  plannedMeters: number;
  wovenMeters: number;
  totalSentMeters: number;
  sentToDyehouse: number;
  sentToWarehouse: number;
  remainingPlanned: number;
  pendingToSend: number;
};

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
  const [plans, setPlans] = useState<WeavingPlan[]>(() => weavingLocalRepo.listPlans());
  const [progressEntries, setProgressEntries] = useState<WeavingProgressEntry[]>(() =>
    weavingLocalRepo.listProgress()
  );
  const [transferEntries, setTransferEntries] = useState<WeavingTransfer[]>(() =>
    weavingLocalRepo.listTransfers()
  );
  const [patterns, setPatterns] = useState<Pattern[]>(() =>
    sortPatterns(patternsLocalRepo.list().filter((pattern) => pattern.archived !== true))
  );
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
  const [progressNote, setProgressNote] = useState("");
  const [progressError, setProgressError] = useState("");

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

  const refreshData = () => {
    setPlans(weavingLocalRepo.listPlans());
    setProgressEntries(weavingLocalRepo.listProgress());
    setTransferEntries(weavingLocalRepo.listTransfers());
    setPatterns(
      sortPatterns(patternsLocalRepo.list().filter((pattern) => pattern.archived !== true))
    );
    setDyehouses(dyehouseLocalRepo.list());
  };

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
      patterns.find((pattern) => pattern.id === detailPlan.patternId) ??
      patternsLocalRepo.list().find((pattern) => pattern.id === detailPlan.patternId) ??
      null
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
        return "Ceylan'a sevk, dokunan metreden fazla gorunuyor; rapor gecikmis olabilir.";
      }
      return "";
    }

    const parsedMeters = Number(transferMetersInput.trim().replace(",", "."));
    if (!Number.isFinite(parsedMeters) || parsedMeters <= 0) return "";
    if (totals.totalSentMeters + parsedMeters > totals.wovenMeters) {
      return "Ceylan'a sevk, dokunan metreden fazla gorunuyor; rapor gecikmis olabilir.";
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

  const resetNewPatternForm = () => {
    setNewPatternForm((prev) => {
      if (prev.digitalPreviewUrl) URL.revokeObjectURL(prev.digitalPreviewUrl);
      if (prev.finalPreviewUrl) URL.revokeObjectURL(prev.finalPreviewUrl);
      return createEmptyNewPatternForm();
    });
  };

  const openPlanModal = () => {
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
    reader.onload = () => {
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
    reader.onload = () => {
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

  const handleCreatePatternFromSelector = () => {
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

      const created = patternsLocalRepo.upsertPatternFromForm({
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

  const handleCreatePlan = () => {
    try {
      if (!selectedPattern) throw new Error("Desen secimi zorunlu.");
      const plannedMeters = toPositiveNumber(plannedMetersInput, "Plan metre");
      const tarakEniCm = tarakEniInput.trim()
        ? toPositiveNumber(tarakEniInput, "Tarak Eni")
        : null;

      weavingLocalRepo.createPlan({
        patternId: selectedPattern.id,
        patternNoSnapshot: selectedPattern.fabricCode,
        patternNameSnapshot: selectedPattern.fabricName,
        plannedMeters,
        tarakEniCm,
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
    setProgressNote("");
    setProgressError("");
  };

  const closeProgressModal = () => {
    setProgressPlanId(null);
    setProgressVariantId("");
    setProgressError("");
  };

  const handleAddProgress = () => {
    if (!progressPlanId) return;

    try {
      const meters = toPositiveNumber(progressMetersInput, "Metre");
      const selectedPlan = plans.find((plan) => plan.id === progressPlanId) ?? null;
      if (hasPlanVariants(selectedPlan)) {
        if (!progressVariantId) throw new Error("Varyant secimi gerekli.");
        weavingLocalRepo.addVariantWovenMeters(
          progressPlanId,
          progressVariantId,
          meters,
          progressNote.trim() || undefined
        );
      } else {
        const createdAt = toIsoFromDateTimeLocal(progressDateTime, "Tarih/Saat");
        weavingLocalRepo.addProgress(
          progressPlanId,
          meters,
          createdAt,
          progressNote.trim() || undefined
        );
      }

      setProgressMetersInput("");
      setProgressVariantId(
        hasPlanVariants(selectedPlan)
          ? selectedPlan.variants.find((variant) => variant.id === progressVariantId)?.id ??
              selectedPlan.variants[0]?.id ??
              ""
          : ""
      );
      setProgressDateTime(nowDateTimeLocal());
      setProgressNote("");
      setProgressError("");
      refreshData();
    } catch (error) {
      setProgressError(error instanceof Error ? error.message : "Ilerleme kaydedilemedi.");
    }
  };

  const handleDeleteProgress = (id: string) => {
    weavingLocalRepo.deleteProgress(id);
    refreshData();
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

      weavingLocalRepo.addTransfer({
        planId: transferPlanId,
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
      refreshData();
    } catch (error) {
      setTransferError(error instanceof Error ? error.message : "Sevk kaydedilemedi.");
    }
  };

  const handleDeleteTransfer = (id: string) => {
    weavingLocalRepo.deleteTransfer(id);
    refreshData();
  };

  const handleToggleManualCompleted = (plan: WeavingPlan) => {
    const completed = !(plan.status === "COMPLETED" && plan.manualCompletedAt);
    weavingLocalRepo.setManualCompleted(plan.id, completed);
    refreshData();
  };

  const handleCancelPlan = (plan: WeavingPlan) => {
    if (!window.confirm(`${plan.patternNoSnapshot} planini iptal etmek istiyor musunuz?`)) return;
    weavingLocalRepo.updatePlanStatus(plan.id, "CANCELLED");
    refreshData();
  };

  return (
    <Layout title="Dokuma">
      <div className="flex h-full min-h-0 flex-col gap-4">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <SummaryCard title="Aktif Plan" value={`${activeSummary.activePlanCount}`} />
          <SummaryCard title="Toplam Plan (m)" value={fmt(activeSummary.totalPlanned)} />
          <SummaryCard title="Toplam Dokunan (m)" value={fmt(activeSummary.totalWoven)} />
          <SummaryCard title="Boyahane/Depo Sevk (m)" value={fmt(activeSummary.totalSent)} />
        </div>

        <section className="rounded-xl border border-black/10 bg-white p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-semibold text-neutral-900">Dokuma Planlari</h2>
            <button
              type="button"
              onClick={openPlanModal}
              className="rounded-lg bg-coffee-primary px-3 py-2 text-sm font-semibold text-white transition hover:brightness-95"
            >
              Dokuma Plani Olustur
            </button>
          </div>

          <div className="mt-3 max-h-[58vh] overflow-auto rounded-lg border border-black/10">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 bg-neutral-50 text-neutral-600">
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
                {plans.map((plan) => {
                  const totals =
                    planTotalsById.get(plan.id) ??
                    ({
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
                    } satisfies PlanTotals);
                  const isCancelled = plan.status === "CANCELLED";
                  const isManualCompleted =
                    plan.status === "COMPLETED" && Boolean(plan.manualCompletedAt);

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
                          {plan.status}
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
                          <button
                            type="button"
                            onClick={() => openProgressModal(plan.id)}
                            disabled={isCancelled}
                            className="rounded border border-black/10 bg-white px-2.5 py-1 text-xs font-semibold text-neutral-700 transition hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            Ilerleme Gir
                          </button>
                          <button
                            type="button"
                            onClick={() => openTransferModal(plan.id)}
                            disabled={isCancelled}
                            className="rounded border border-sky-500/30 bg-sky-50 px-2.5 py-1 text-xs font-semibold text-sky-700 transition hover:bg-sky-100 disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            Boyahane / Depo Sevk
                          </button>
                          <button
                            type="button"
                            onClick={() => handleToggleManualCompleted(plan)}
                            disabled={isCancelled}
                            className="rounded border border-emerald-500/30 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            {isManualCompleted ? "Tamamlandi (Geri Al)" : "Tamamlandi"}
                          </button>
                          {!isCancelled ? (
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
                {plans.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-3 py-8 text-center text-sm text-neutral-500">
                      Henuz dokuma plani yok.
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
                    <span>Tarak Eni (cm)</span>
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
                  <button
                    type="button"
                    onClick={handleCreatePlan}
                    className="rounded-lg bg-coffee-primary px-4 py-2 text-sm font-semibold text-white hover:bg-coffee-primary/90"
                  >
                    Kaydet
                  </button>
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

                        <label className="col-span-2 space-y-1 text-sm text-neutral-700">
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
                            placeholder="orn: 120"
                            className="w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-coffee-primary"
                          />
                        </label>

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
                        <div />
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
                        <button
                          type="button"
                          onClick={handleCreatePatternFromSelector}
                          className="rounded-lg bg-coffee-primary px-4 py-2 text-sm font-semibold text-white transition hover:brightness-95"
                        >
                          Yeni Desen Kaydet ve Sec
                        </button>
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
              <>
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
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={progressMetersInput}
                  onChange={(event) => setProgressMetersInput(event.target.value)}
                  placeholder="Metre"
                  className="w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-coffee-primary"
                />
              </>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2">
                <input
                  type="datetime-local"
                  value={progressDateTime}
                  onChange={(event) => setProgressDateTime(event.target.value)}
                  className="w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-coffee-primary"
                />
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={progressMetersInput}
                  onChange={(event) => setProgressMetersInput(event.target.value)}
                  placeholder="Metre"
                  className="w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-coffee-primary"
                />
              </div>
            )}
            <input
              type="text"
              value={progressNote}
              onChange={(event) => setProgressNote(event.target.value)}
              placeholder="Not (opsiyonel)"
              className="w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-coffee-primary"
            />

            {selectedProgressVariants.length > 0 ? (
              <p className="rounded-lg border border-black/10 bg-neutral-50 px-3 py-2 text-xs text-neutral-600">
                Varyantli planlarda ilerleme secili varyantin dokunan metresine eklenir.
              </p>
            ) : (
              <div className="rounded-lg border border-black/10 bg-white p-2">
                <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                  Son 5 Ilerleme
                </div>
                <div className="space-y-1 text-xs text-neutral-700">
                  {recentProgressForModal.map((entry) => (
                    <div key={entry.id} className="flex items-center justify-between gap-2">
                      <span>
                        {formatDateTime(entry.createdAt)} - {fmt(entry.meters)} m
                        {entry.note ? ` (${entry.note})` : ""}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleDeleteProgress(entry.id)}
                        className="rounded border border-rose-500/30 bg-rose-50 px-1.5 py-0.5 text-[11px] font-semibold text-rose-700 transition hover:bg-rose-100"
                      >
                        Sil
                      </button>
                    </div>
                  ))}
                  {recentProgressForModal.length === 0 ? <div>Kayit yok.</div> : null}
                </div>
              </div>
            )}
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
            <button
              type="button"
              onClick={handleAddProgress}
              className="rounded-lg bg-coffee-primary px-4 py-2 text-sm font-semibold text-white transition hover:brightness-95"
            >
              Kaydet
            </button>
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
                  <button
                    type="button"
                    onClick={handleAddDyehouse}
                    className="rounded-lg border border-black/10 bg-white px-3 py-2 text-xs font-semibold text-neutral-700 transition hover:bg-neutral-100"
                  >
                    Ekle
                  </button>
                  <button
                    type="button"
                    onClick={handleDeleteDyehouse}
                    disabled={!transferDyehouseId}
                    className="rounded-lg border border-rose-500/30 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Seciliyi Sil
                  </button>
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
              <p className="rounded-lg border border-rose-500/30 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700">
                {transferWarning}
              </p>
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
                    <button
                      type="button"
                      onClick={() => handleDeleteTransfer(entry.id)}
                      className="rounded border border-rose-500/30 bg-rose-50 px-1.5 py-0.5 text-[11px] font-semibold text-rose-700 transition hover:bg-rose-100"
                    >
                      Sil
                    </button>
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
            <button
              type="button"
              onClick={handleAddTransfer}
              className="rounded-lg bg-coffee-primary px-4 py-2 text-sm font-semibold text-white transition hover:brightness-95"
            >
              Kaydet
            </button>
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
  const [activeTab, setActiveTab] = useState<DetailTab>("INFO");
  const [digitalPreviewUrl, setDigitalPreviewUrl] = useState<string | null>(null);
  const [finalPreviewUrl, setFinalPreviewUrl] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState("");
  const [photoSuccess, setPhotoSuccess] = useState("");
  const digitalInputRef = useRef<HTMLInputElement | null>(null);
  const finalInputRef = useRef<HTMLInputElement | null>(null);
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

  const savePatternImage = (target: "DIGITAL" | "FINAL", dataUrl: string) => {
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

    const updated = patternsLocalRepo.update(pattern.id, nextPatch);
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
      reader.onload = () => {
        const result = reader.result;
        if (typeof result !== "string") {
          setPhotoSuccess("");
          setPhotoError("Gorsel okunamadi.");
          return;
        }

        try {
          savePatternImage(target, result);
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

  const openVariantEditor = () => {
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
  };

  const removeVariantRow = (id: string) => {
    setVariantRows((prev) => prev.filter((row) => row.id !== id));
  };

  const saveVariants = () => {
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

      weavingLocalRepo.updatePlanVariants(plan.id, normalizedVariants);
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
              <div>Durum: {plan.status}</div>
              {typeof plan.tarakEniCm === "number" && Number.isFinite(plan.tarakEniCm) ? (
                <div>Tarak Eni: {fmt(plan.tarakEniCm)} cm</div>
              ) : null}
              <div>Olusturma: {formatDateTime(plan.createdAt)}</div>
              {plan.note ? <div>Plan Notu: {plan.note}</div> : null}
            </div>

            <div className="space-y-2 rounded-xl border border-black/10 bg-white p-3 text-sm text-neutral-700">
              <div className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                Kumas Detaylari
              </div>
              {fabricDetails.length > 0 ? (
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
            </div>
          </div>

          <div className="space-y-2 rounded-xl border border-black/10 bg-white p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                Varyantlar
              </div>
              <button
                type="button"
                onClick={openVariantEditor}
                className="rounded-lg border border-black/10 bg-neutral-50 px-2.5 py-1 text-xs font-semibold text-neutral-700 transition hover:bg-neutral-100"
              >
                Varyantlari Duzenle
              </button>
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
                    {planVariants.map((variant) => (
                      <tr key={variant.id} className="border-t border-black/5">
                        <td className="px-2.5 py-2">{variant.variantCode?.trim() || "-"}</td>
                        <td className="px-2.5 py-2">{variant.colorName}</td>
                        <td className="px-2.5 py-2">{fmt(variant.plannedMeters)}</td>
                        <td className="px-2.5 py-2">{fmt(variant.wovenMeters)}</td>
                        <td className="px-2.5 py-2">{fmt(variant.plannedMeters - variant.wovenMeters)}</td>
                      </tr>
                    ))}
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
              <button
                type="button"
                onClick={() => digitalInputRef.current?.click()}
                disabled={!pattern}
                className="w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-xs font-semibold text-neutral-700 transition hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {digitalSrc ? "Foto Degistir" : "Foto Ekle"}
              </button>
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
              <button
                type="button"
                onClick={() => finalInputRef.current?.click()}
                disabled={!pattern}
                className="w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-xs font-semibold text-neutral-700 transition hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {finalSrc ? "Foto Degistir" : "Foto Ekle"}
              </button>
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
        <Modal title="Varyantlari Duzenle" onClose={closeVariantEditor} size="lg">
          <div className="space-y-3">
            <div className="max-h-[55vh] overflow-auto rounded-lg border border-black/10">
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
                        <button
                          type="button"
                          onClick={() => removeVariantRow(row.id)}
                          className="rounded border border-rose-500/30 bg-rose-50 px-2 py-1 text-[11px] font-semibold text-rose-700 transition hover:bg-rose-100"
                        >
                          Sil
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-between gap-2">
              <button
                type="button"
                onClick={addVariantRow}
                className="rounded-lg border border-black/10 bg-white px-3 py-2 text-xs font-semibold text-neutral-700 transition hover:bg-neutral-100"
              >
                + Satir Ekle
              </button>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={closeVariantEditor}
                  className="rounded-lg px-3 py-2 text-sm text-neutral-600 transition hover:bg-neutral-100"
                >
                  Kapat
                </button>
                <button
                  type="button"
                  onClick={saveVariants}
                  className="rounded-lg bg-coffee-primary px-4 py-2 text-sm font-semibold text-white transition hover:brightness-95"
                >
                  Kaydet
                </button>
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
  const widthClass =
    size === "xl" ? "max-w-3xl" : size === "lg" ? "max-w-xl" : "max-w-md";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className={cn(
          "w-full rounded-2xl border border-black/10 bg-white p-5 shadow-2xl",
          widthClass
        )}
        onClick={(event) => event.stopPropagation()}
      >
        <h3 className="text-lg font-semibold text-neutral-900">{title}</h3>
        <div className="mt-2">{children}</div>
      </div>
    </div>
  );
}
