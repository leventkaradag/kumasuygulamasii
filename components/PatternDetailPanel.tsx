"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronDown, Image as ImageIcon, ImageOff, Layers, Package, Palette, Sparkles, X } from "lucide-react";
import { Accordion } from "@/components/Accordion";
import { useAuthProfile } from "@/components/AuthProfileProvider";
import { ImagePicker } from "@/components/ImagePicker";
import { cn } from "@/lib/cn";
import type { Pattern, Variant } from "@/lib/domain/pattern";
import { getPatternDigitalImageSrc, getPatternFinalImageSrc } from "@/lib/patternImage";
import { getFallbackPatternMetricSummary, type PatternMetricSummary } from "@/lib/patternMetrics";
import { patternsLocalRepo } from "@/lib/repos/patternsLocalRepo";
import { useModalFocusTrap } from "@/lib/useModalFocusTrap";

type PatternDetailPanelProps = {
  pattern: Pattern | null;
  metrics?: PatternMetricSummary;
  onPatternUpdated?: (pattern?: Pattern) => void;
  onImagePreviewChange?: (
    patternId: string,
    preview: {
      digitalPreviewUrl?: string | null;
      finalPreviewUrl?: string | null;
    }
  ) => void;
  showArchived?: boolean;
};

type MeterFields = Pick<
  Pattern,
  "totalProducedMeters" | "stockMeters" | "inDyehouseMeters" | "defectMeters"
>;

type LogisticsDraft = {
  musteri: string;
  depoNo: string;
  kg: string;
  eniCm: string;
  gramajGm2: string;
  fireOrani: string;
  createdAt: string;
};

const stageLabel: Record<string, string> = {
  DEPO: "Depo",
  BOYAHANE: "Boyahane",
  DOKUMA: "Dokuma",
};

const meterFieldLabels: Record<keyof MeterFields, string> = {
  totalProducedMeters: "Uretim",
  stockMeters: "Stok",
  inDyehouseMeters: "Boyahane",
  defectMeters: "Hatali",
};

const warmPanelClass =
  "rounded-xl border border-[#d8c5b3] bg-[#fcf8f2] shadow-[0_10px_24px_rgba(84,59,39,0.08),inset_0_1px_0_rgba(255,255,255,0.75)] transition";

const warmPanelInteractiveClass = `${warmPanelClass} hover:border-[#b9987f] focus-within:border-[#b9987f] focus-within:ring-2 focus-within:ring-[#c9ab92]/35`;

const detailSectionClass =
  "space-y-3 rounded-2xl border border-[#e2d5c8] bg-[#fffaf5] p-3.5 shadow-[0_10px_24px_rgba(63,48,38,0.05),inset_0_1px_0_rgba(255,255,255,0.78)]";

const controlledDangerButtonClass =
  "rounded-xl border border-red-300 bg-white px-3 py-1.5 text-[13px] font-semibold text-red-600 shadow-[0_4px_10px_rgba(127,29,29,0.05)] transition hover:border-red-500 hover:bg-red-50 hover:text-red-700 disabled:opacity-50";

const toDraftNumber = (value?: number) =>
  typeof value === "number" && Number.isFinite(value) ? String(value) : "";

const toDateInputValue = (value?: string) => {
  if (!value) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toISOString().slice(0, 10);
};

const createLogisticsDraft = (source?: Pattern | null): LogisticsDraft => ({
  musteri: source?.musteri ?? "",
  depoNo: source?.depoNo ?? "",
  kg: toDraftNumber(source?.kg),
  eniCm: toDraftNumber(source?.eniCm),
  gramajGm2: toDraftNumber(source?.gramajGm2),
  fireOrani: toDraftNumber(source?.fireOrani),
  createdAt: toDateInputValue(source?.createdAt),
});

const createVariantId = () => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `v-${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const normalizeVariants = (variants?: Variant[]): Variant[] =>
  (variants ?? []).map((variant) => {
    const colorName = variant.colorName ?? variant.name ?? "";
    const colorCode = variant.colorCode?.trim();
    return {
      ...variant,
      id: variant.id || createVariantId(),
      colorName,
      colorCode: colorCode || undefined,
      name: colorName,
    };
  });

const parseOptionalNonNegativeNumber = (value: string): number | undefined | null => {
  const raw = value.trim();
  if (!raw) return undefined;
  const parsed = Number(raw.replace(",", "."));
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return parsed;
};

const normalizeNumberInputForCompare = (value: string): string => {
  const raw = value.trim();
  if (!raw) return "";
  const parsed = parseOptionalNonNegativeNumber(raw);
  if (parsed === null) return raw;
  return parsed === undefined ? "" : String(parsed);
};

const fileToDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
        return;
      }
      reject(new Error("Dosya okunamadi"));
    };
    reader.onerror = () => reject(new Error("Dosya okunamadi"));
    reader.readAsDataURL(file);
  });

export function PatternDetailPanel({
  pattern,
  metrics,
  onPatternUpdated,
  onImagePreviewChange,
  showArchived = false,
}: PatternDetailPanelProps) {
  const { permissions } = useAuthProfile();
  const [note, setNote] = useState("");
  const [savedNote, setSavedNote] = useState("");
  const [noteStatus, setNoteStatus] = useState<"idle" | "saving" | "saved">("idle");

  const [savedDigitalUrl, setSavedDigitalUrl] = useState<string | undefined>(undefined);
  const [savedFinalUrl, setSavedFinalUrl] = useState<string | undefined>(undefined);
  const [pendingDigitalUrl, setPendingDigitalUrl] = useState<string | null | undefined>(undefined);
  const [pendingFinalUrl, setPendingFinalUrl] = useState<string | null | undefined>(undefined);
  const [imageStatus, setImageStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [metersStatus, setMetersStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [archiveStatus, setArchiveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [showMetersModal, setShowMetersModal] = useState(false);
  const metersModalRef = useRef<HTMLDivElement | null>(null);
  const [metersError, setMetersError] = useState("");
  const [metersDraft, setMetersDraft] = useState<Record<keyof MeterFields, string>>({
    totalProducedMeters: "0",
    stockMeters: "0",
    inDyehouseMeters: "0",
    defectMeters: "0",
  });
  const [variantsDraft, setVariantsDraft] = useState<Variant[]>([]);
  const [variantsStatus, setVariantsStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [isVariantsOpen, setIsVariantsOpen] = useState(false);
  const [isEditingLogistics, setIsEditingLogistics] = useState(false);
  const [logisticsDraft, setLogisticsDraft] = useState<LogisticsDraft>(() => createLogisticsDraft());
  const [logisticsError, setLogisticsError] = useState("");

  useModalFocusTrap({ enabled: showMetersModal, containerRef: metersModalRef });
  const [logisticsStatus, setLogisticsStatus] = useState<"idle" | "saving" | "saved">("idle");

  const resetNoteStatusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const resetImageStatusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const resetMetersStatusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const resetArchiveStatusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const resetLogisticsStatusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const resetVariantsStatusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const canEditPattern = permissions.patterns.edit;
  const canDeletePattern = permissions.patterns.delete;

  useEffect(() => {
    const latestPattern = pattern ? patternsLocalRepo.get(pattern.id) ?? pattern : null;

    const initialNote = latestPattern?.note ?? "";
    setNote(initialNote);
    setSavedNote(initialNote);
    setNoteStatus("idle");

    setSavedDigitalUrl(getPatternDigitalImageSrc(latestPattern) ?? undefined);
    setSavedFinalUrl(getPatternFinalImageSrc(latestPattern) ?? undefined);
    setPendingDigitalUrl(undefined);
    setPendingFinalUrl(undefined);
    setImageStatus("idle");
    setMetersStatus("idle");
    setArchiveStatus("idle");
    setVariantsStatus("idle");
    setIsVariantsOpen(false);
    setLogisticsStatus("idle");
    setLogisticsError("");
    setIsEditingLogistics(false);
    setShowMetersModal(false);
    setMetersError("");
    setMetersDraft({
      totalProducedMeters: String(latestPattern?.totalProducedMeters ?? 0),
      stockMeters: String(latestPattern?.stockMeters ?? 0),
      inDyehouseMeters: String(latestPattern?.inDyehouseMeters ?? 0),
      defectMeters: String(latestPattern?.defectMeters ?? 0),
    });
    setVariantsDraft(normalizeVariants(latestPattern?.variants));
    setLogisticsDraft(createLogisticsDraft(latestPattern));

    if (resetNoteStatusTimerRef.current) {
      clearTimeout(resetNoteStatusTimerRef.current);
      resetNoteStatusTimerRef.current = null;
    }

    if (resetImageStatusTimerRef.current) {
      clearTimeout(resetImageStatusTimerRef.current);
      resetImageStatusTimerRef.current = null;
    }
    if (resetMetersStatusTimerRef.current) {
      clearTimeout(resetMetersStatusTimerRef.current);
      resetMetersStatusTimerRef.current = null;
    }
    if (resetArchiveStatusTimerRef.current) {
      clearTimeout(resetArchiveStatusTimerRef.current);
      resetArchiveStatusTimerRef.current = null;
    }
    if (resetLogisticsStatusTimerRef.current) {
      clearTimeout(resetLogisticsStatusTimerRef.current);
      resetLogisticsStatusTimerRef.current = null;
    }
    if (resetVariantsStatusTimerRef.current) {
      clearTimeout(resetVariantsStatusTimerRef.current);
      resetVariantsStatusTimerRef.current = null;
    }
  }, [pattern?.id]);

  useEffect(() => {
    return () => {
      if (resetNoteStatusTimerRef.current) {
        clearTimeout(resetNoteStatusTimerRef.current);
      }
      if (resetImageStatusTimerRef.current) {
        clearTimeout(resetImageStatusTimerRef.current);
      }
      if (resetMetersStatusTimerRef.current) {
        clearTimeout(resetMetersStatusTimerRef.current);
      }
      if (resetArchiveStatusTimerRef.current) {
        clearTimeout(resetArchiveStatusTimerRef.current);
      }
      if (resetLogisticsStatusTimerRef.current) {
        clearTimeout(resetLogisticsStatusTimerRef.current);
      }
      if (resetVariantsStatusTimerRef.current) {
        clearTimeout(resetVariantsStatusTimerRef.current);
      }
    };
  }, []);

  if (!pattern) {
    return (
      <div className="rounded-2xl border border-black/5 bg-white/80 p-6 shadow-[0_10px_30px_rgba(0,0,0,0.08)]">
        <div className="flex h-48 flex-col items-center justify-center gap-3 text-neutral-500">
          <ImageOff className="h-8 w-8" aria-hidden />
          <div className="text-sm font-semibold">Desen seçilmedi</div>
        </div>
      </div>
    );
  }

  const resolvedMetrics = metrics ?? getFallbackPatternMetricSummary(pattern);
  const meterSources = resolvedMetrics.sources;
  const displayedMeters: MeterFields = {
    totalProducedMeters: resolvedMetrics.totalProducedMeters,
    stockMeters: resolvedMetrics.stockMeters,
    inDyehouseMeters: resolvedMetrics.inDyehouseMeters,
    defectMeters: resolvedMetrics.defectMeters,
  };
  const savedMeters = displayedMeters;
  const hasEditableMeters = (Object.keys(meterFieldLabels) as Array<keyof MeterFields>).some(
    (field) => meterSources[field] !== "operations"
  );
  const hasOperationalMeters = (Object.keys(meterFieldLabels) as Array<keyof MeterFields>).some(
    (field) => meterSources[field] === "operations"
  );
  const variantCount = variantsDraft.length;

  const hasNoteChanges = note.trim() !== savedNote.trim();
  const canSaveNote = canEditPattern && hasNoteChanges && noteStatus !== "saving";
  const noteStatusText =
    noteStatus === "saving"
      ? "Kaydediliyor..."
      : noteStatus === "saved"
        ? "Kaydedildi ✅"
        : hasNoteChanges
          ? "Değişiklik var"
          : "";

  const hasPendingImageChanges = pendingDigitalUrl !== undefined || pendingFinalUrl !== undefined;
  const canSaveImages = canEditPattern && hasPendingImageChanges && imageStatus !== "saving";
  const imageStatusText =
    imageStatus === "saving"
      ? "Kaydediliyor..."
      : imageStatus === "saved"
        ? "Kaydedildi ✅"
        : hasPendingImageChanges
          ? "Değişiklik var"
          : "";

  const metersStatusText =
    metersStatus === "saving"
      ? "Kaydediliyor..."
      : metersStatus === "saved"
        ? "Kaydedildi ✅"
        : "";

  const archiveStatusText =
    archiveStatus === "saving"
      ? "Kaydediliyor..."
      : archiveStatus === "saved"
        ? "Kaydedildi ✅"
        : "";

  const logisticsStatusText =
    logisticsStatus === "saving"
      ? "Kaydediliyor..."
      : logisticsStatus === "saved"
        ? "Kaydedildi ✅"
        : "";

  const logisticsHasChanges =
    logisticsDraft.musteri.trim() !== (pattern.musteri ?? "").trim() ||
    logisticsDraft.depoNo.trim() !== (pattern.depoNo ?? "").trim() ||
    normalizeNumberInputForCompare(logisticsDraft.kg) !== normalizeNumberInputForCompare(toDraftNumber(pattern.kg)) ||
    normalizeNumberInputForCompare(logisticsDraft.eniCm) !== normalizeNumberInputForCompare(toDraftNumber(pattern.eniCm)) ||
    normalizeNumberInputForCompare(logisticsDraft.gramajGm2) !==
      normalizeNumberInputForCompare(toDraftNumber(pattern.gramajGm2)) ||
    normalizeNumberInputForCompare(logisticsDraft.fireOrani) !==
      normalizeNumberInputForCompare(toDraftNumber(pattern.fireOrani)) ||
    logisticsDraft.createdAt.trim() !== toDateInputValue(pattern.createdAt);
  const canSaveLogistics = canEditPattern && logisticsStatus !== "saving" && logisticsHasChanges;

  const variantsStatusText =
    variantsStatus === "saving"
      ? "Kaydediliyor..."
      : variantsStatus === "saved"
        ? "Kaydedildi ✅"
        : "";

  const actionFeedbackItems = [
    imageStatus === "saved" || imageStatus === "saving" || hasPendingImageChanges
      ? {
          key: "images",
          text: imageStatusText,
          tone: imageStatus === "saved" ? "success" : "neutral",
        }
      : null,
    metersStatus === "saved" || metersStatus === "saving"
      ? {
          key: "meters",
          text: metersStatusText,
          tone: metersStatus === "saved" ? "success" : "neutral",
        }
      : hasOperationalMeters
        ? {
            key: "metrics-live",
            text: "Canli metrikler operasyon kayitlarindan hesaplanir.",
            tone: "neutral",
          }
        : null,
    archiveStatus === "saved" || archiveStatus === "saving"
      ? {
          key: "archive",
          text: archiveStatusText,
          tone: archiveStatus === "saved" ? "success" : "neutral",
        }
      : null,
  ].filter(
    (
      item
    ): item is {
      key: string;
      text: string;
      tone: "neutral" | "success";
    } => Boolean(item && item.text)
  );

  const handleSaveNote = () => {
    if (!canEditPattern) return;
    if (!canSaveNote) return;

    if (resetNoteStatusTimerRef.current) {
      clearTimeout(resetNoteStatusTimerRef.current);
      resetNoteStatusTimerRef.current = null;
    }

    setNoteStatus("saving");

    const nextNote = note.trim();
    patternsLocalRepo.update(pattern.id, { note: nextNote });
    setNote(nextNote);
    setSavedNote(nextNote);
    setNoteStatus("saved");

    resetNoteStatusTimerRef.current = setTimeout(() => {
      setNoteStatus("idle");
      resetNoteStatusTimerRef.current = null;
    }, 1200);
  };

  const handlePickDigital = async (file?: File) => {
    if (!canEditPattern) return;
    if (!file) return;
    const dataUrl = await fileToDataUrl(file);
    setPendingDigitalUrl(dataUrl);
    onImagePreviewChange?.(pattern.id, { digitalPreviewUrl: dataUrl });
    setImageStatus("idle");
  };

  const handlePickFinal = async (file?: File) => {
    if (!canEditPattern) return;
    if (!file) return;
    const dataUrl = await fileToDataUrl(file);
    setPendingFinalUrl(dataUrl);
    onImagePreviewChange?.(pattern.id, { finalPreviewUrl: dataUrl });
    setImageStatus("idle");
  };

  const handleSaveImages = () => {
    if (!canEditPattern) return;
    if (!canSaveImages) return;

    if (resetImageStatusTimerRef.current) {
      clearTimeout(resetImageStatusTimerRef.current);
      resetImageStatusTimerRef.current = null;
    }

    setImageStatus("saving");

    const patch: Partial<Pattern> = {};
    if (pendingDigitalUrl !== undefined) {
      patch.imageDigital = pendingDigitalUrl;
      patch.digitalImageUrl = pendingDigitalUrl ?? undefined;
    }
    if (pendingFinalUrl !== undefined) {
      patch.imageFinal = pendingFinalUrl;
      patch.finalImageUrl = pendingFinalUrl ?? undefined;
    }

    const updated = patternsLocalRepo.update(pattern.id, patch);
    if (updated) {
      setSavedDigitalUrl(getPatternDigitalImageSrc(updated) ?? undefined);
      setSavedFinalUrl(getPatternFinalImageSrc(updated) ?? undefined);
    }
    setPendingDigitalUrl(undefined);
    setPendingFinalUrl(undefined);
    onImagePreviewChange?.(pattern.id, {
      digitalPreviewUrl: undefined,
      finalPreviewUrl: undefined,
    });
    onPatternUpdated?.(updated);
    setImageStatus("saved");

    resetImageStatusTimerRef.current = setTimeout(() => {
      setImageStatus("idle");
      resetImageStatusTimerRef.current = null;
    }, 1200);
  };

  const displayedDigitalUrl =
    pendingDigitalUrl === undefined ? savedDigitalUrl : pendingDigitalUrl ?? undefined;
  const displayedFinalUrl =
    pendingFinalUrl === undefined ? savedFinalUrl : pendingFinalUrl ?? undefined;

  const handleRemoveDigital = () => {
    if (!canEditPattern) return;
    if (!displayedDigitalUrl) return;
    setPendingDigitalUrl(null);
    onImagePreviewChange?.(pattern.id, { digitalPreviewUrl: null });
    setImageStatus("idle");
  };

  const handleRemoveFinal = () => {
    if (!canEditPattern) return;
    if (!displayedFinalUrl) return;
    setPendingFinalUrl(null);
    onImagePreviewChange?.(pattern.id, { finalPreviewUrl: null });
    setImageStatus("idle");
  };

  const fmtMeters = (value: number) => (Number.isFinite(value) ? value.toLocaleString("tr-TR") : "0");
  const formatOptionalNumber = (value?: number, suffix?: string) => {
    if (typeof value !== "number" || !Number.isFinite(value)) return "-";
    const formatted = value.toLocaleString("tr-TR");
    return suffix ? `${formatted} ${suffix}` : formatted;
  };
  const formatCreatedAt = (value?: string) => {
    if (!value) return "-";
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return "-";
    return parsed.toLocaleDateString("tr-TR");
  };
  const formatOptionalText = (value?: string) => {
    const trimmed = value?.trim();
    return trimmed ? trimmed : "-";
  };
  const logisticsInputClass =
    "w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-coffee-primary";
  const isMeterManagedByOperations = (field: keyof MeterFields) => meterSources[field] === "operations";

  const openMetersModal = () => {
    if (!canEditPattern) return;
    if (!hasEditableMeters) return;
    setMetersDraft({
      totalProducedMeters: String(displayedMeters.totalProducedMeters),
      stockMeters: String(displayedMeters.stockMeters),
      inDyehouseMeters: String(displayedMeters.inDyehouseMeters),
      defectMeters: String(displayedMeters.defectMeters),
    });
    setMetersError("");
    setShowMetersModal(true);
  };

  const parseMeterField = (field: keyof MeterFields): number | null => {
    const raw = metersDraft[field].trim();
    const parsed = Number(raw.replace(",", "."));
    if (!Number.isFinite(parsed) || parsed < 0) return null;
    return parsed;
  };

  const handleSaveMeters = () => {
    if (!canEditPattern) return;
    if (metersStatus === "saving") return;

    const patch: Partial<MeterFields> = {};

    for (const field of Object.keys(meterFieldLabels) as Array<keyof MeterFields>) {
      if (isMeterManagedByOperations(field)) {
        continue;
      }

      const parsedValue = parseMeterField(field);
      if (parsedValue === null) {
        setMetersError("Metre alanlari 0 veya daha buyuk bir sayi olmali.");
        return;
      }

      patch[field] = parsedValue;
    }

    if (Object.keys(patch).length === 0) {
      setMetersError("Metre alanları 0 veya daha büyük bir sayı olmalı.");
      return;
    }

    if (resetMetersStatusTimerRef.current) {
      clearTimeout(resetMetersStatusTimerRef.current);
      resetMetersStatusTimerRef.current = null;
    }

    setMetersError("");
    setMetersStatus("saving");

    patternsLocalRepo.update(pattern.id, patch);
    setMetersStatus("saved");
    setShowMetersModal(false);

    resetMetersStatusTimerRef.current = setTimeout(() => {
      setMetersStatus("idle");
      resetMetersStatusTimerRef.current = null;
    }, 1200);
  };

  const persistVariants = (nextVariants: Variant[]) => {
    if (!canEditPattern) return;
    if (resetVariantsStatusTimerRef.current) {
      clearTimeout(resetVariantsStatusTimerRef.current);
      resetVariantsStatusTimerRef.current = null;
    }

    setVariantsStatus("saving");

    const normalizedNext = normalizeVariants(nextVariants).map((variant) => ({
      id: variant.id,
      colorName: variant.colorName,
      colorCode: variant.colorCode,
      name: variant.colorName,
      active: variant.active,
      stockMeters: variant.stockMeters,
      stockRollCount: variant.stockRollCount,
      reservedMeters: variant.reservedMeters,
      reservedRollCount: variant.reservedRollCount,
      reservedFor: variant.reservedFor,
      lastStockInAt: variant.lastStockInAt,
    }));

    const updated = patternsLocalRepo.update(pattern.id, { variants: normalizedNext });
    const refreshed = normalizeVariants(updated?.variants ?? normalizedNext);
    setVariantsDraft(refreshed);
    onPatternUpdated?.(updated);
    setVariantsStatus("saved");

    resetVariantsStatusTimerRef.current = setTimeout(() => {
      setVariantsStatus("idle");
      resetVariantsStatusTimerRef.current = null;
    }, 1200);
  };

  const handleAddVariant = () => {
    if (!canEditPattern) return;
    if (!isVariantsOpen) {
      setIsVariantsOpen(true);
    }

    const nextVariants = [
      ...variantsDraft,
      {
        id: createVariantId(),
        colorName: "",
        colorCode: undefined,
        name: "",
      },
    ];
    persistVariants(nextVariants);
  };

  const handleVariantFieldChange = (
    variantId: string,
    key: "colorName" | "colorCode",
    rawValue: string
  ) => {
    if (!canEditPattern) return;
    const nextVariants = variantsDraft.map((variant) => {
      if (variant.id !== variantId) return variant;
      if (key === "colorCode") {
        const trimmed = rawValue.trim();
        return {
          ...variant,
          colorCode: trimmed || undefined,
        };
      }
      return {
        ...variant,
        colorName: rawValue,
      };
    });
    persistVariants(nextVariants);
  };

  const handleRemoveVariant = (variantId: string) => {
    if (!canEditPattern) return;
    const nextVariants = variantsDraft.filter((variant) => variant.id !== variantId);
    persistVariants(nextVariants);
  };

  const openLogisticsEditor = () => {
    if (!canEditPattern) return;
    const latestPattern = patternsLocalRepo.get(pattern.id) ?? pattern;
    if (resetLogisticsStatusTimerRef.current) {
      clearTimeout(resetLogisticsStatusTimerRef.current);
      resetLogisticsStatusTimerRef.current = null;
    }
    setLogisticsDraft(createLogisticsDraft(latestPattern));
    setLogisticsError("");
    setLogisticsStatus("idle");
    setIsEditingLogistics(true);
  };

  const handleCancelLogistics = () => {
    const latestPattern = patternsLocalRepo.get(pattern.id) ?? pattern;
    if (resetLogisticsStatusTimerRef.current) {
      clearTimeout(resetLogisticsStatusTimerRef.current);
      resetLogisticsStatusTimerRef.current = null;
    }
    setLogisticsDraft(createLogisticsDraft(latestPattern));
    setLogisticsError("");
    setLogisticsStatus("idle");
    setIsEditingLogistics(false);
  };

  const handleSaveLogistics = () => {
    if (!canEditPattern) return;
    if (logisticsStatus === "saving") return;

    const kg = parseOptionalNonNegativeNumber(logisticsDraft.kg);
    const eniCm = parseOptionalNonNegativeNumber(logisticsDraft.eniCm);
    const gramajGm2 = parseOptionalNonNegativeNumber(logisticsDraft.gramajGm2);
    const fireOrani = parseOptionalNonNegativeNumber(logisticsDraft.fireOrani);

    if (kg === null || eniCm === null || gramajGm2 === null || fireOrani === null) {
      setLogisticsError("Sayisal alanlar bos veya 0'dan buyuk olmali.");
      return;
    }
    if (typeof fireOrani === "number" && fireOrani > 100) {
      setLogisticsError("Fire orani 0 ile 100 arasinda olmali.");
      return;
    }

    const rawDate = logisticsDraft.createdAt.trim();
    let createdAt = pattern.createdAt ?? new Date().toISOString();
    if (rawDate) {
      const parsed = new Date(`${rawDate}T00:00:00`);
      if (Number.isNaN(parsed.getTime())) {
        setLogisticsError("Gecerli bir tarih girin.");
        return;
      }
      createdAt = parsed.toISOString();
    }

    if (resetLogisticsStatusTimerRef.current) {
      clearTimeout(resetLogisticsStatusTimerRef.current);
      resetLogisticsStatusTimerRef.current = null;
    }

    setLogisticsError("");
    setLogisticsStatus("saving");

    const patch: Partial<Pattern> = {
      musteri: logisticsDraft.musteri.trim(),
      depoNo: logisticsDraft.depoNo.trim(),
      kg,
      eniCm,
      gramajGm2,
      fireOrani,
      createdAt,
    };

    const updated = patternsLocalRepo.update(pattern.id, patch);
    if (updated) {
      setLogisticsDraft(createLogisticsDraft(updated));
      onPatternUpdated?.(updated);
    }

    setIsEditingLogistics(false);
    setLogisticsStatus("saved");

    resetLogisticsStatusTimerRef.current = setTimeout(() => {
      setLogisticsStatus("idle");
      resetLogisticsStatusTimerRef.current = null;
    }, 1200);
  };

  const handleArchive = () => {
    if (!canDeletePattern) return;
    if (archiveStatus === "saving") return;

    if (resetArchiveStatusTimerRef.current) {
      clearTimeout(resetArchiveStatusTimerRef.current);
      resetArchiveStatusTimerRef.current = null;
    }

    setArchiveStatus("saving");

    const updated = patternsLocalRepo.archivePattern(pattern.id);
    onPatternUpdated?.(updated);
    setArchiveStatus("saved");

    resetArchiveStatusTimerRef.current = setTimeout(() => {
      setArchiveStatus("idle");
      resetArchiveStatusTimerRef.current = null;
    }, 1200);
  };

  const handleRestorePattern = () => {
    if (!canDeletePattern) return;
    if (archiveStatus === "saving") return;

    if (resetArchiveStatusTimerRef.current) {
      clearTimeout(resetArchiveStatusTimerRef.current);
      resetArchiveStatusTimerRef.current = null;
    }

    setArchiveStatus("saving");

    const updated = patternsLocalRepo.restorePattern(pattern.id);
    onPatternUpdated?.(updated);
    setArchiveStatus("saved");

    resetArchiveStatusTimerRef.current = setTimeout(() => {
      setArchiveStatus("idle");
      resetArchiveStatusTimerRef.current = null;
    }, 1200);
  };

  const handleDeletePattern = () => {
    if (!canDeletePattern) return;
    if (archiveStatus === "saving") return;
    const accepted = window.confirm("Bu desen kalıcı olarak silinecek. Emin misin?");
    if (!accepted) return;

    if (resetArchiveStatusTimerRef.current) {
      clearTimeout(resetArchiveStatusTimerRef.current);
      resetArchiveStatusTimerRef.current = null;
    }

    setArchiveStatus("saving");
    patternsLocalRepo.deletePatternHard(pattern.id);
    onPatternUpdated?.(undefined);
    setArchiveStatus("saved");

    resetArchiveStatusTimerRef.current = setTimeout(() => {
      setArchiveStatus("idle");
      resetArchiveStatusTimerRef.current = null;
    }, 1200);
  };

  const showArchivedActions = showArchived;

  return (
    <div className="space-y-5 rounded-[28px] border border-black/5 bg-white/85 p-4 shadow-[0_18px_44px_rgba(63,48,38,0.08)] sm:p-5">
      <div className="space-y-4 rounded-[24px] border border-[#dfd0c2] bg-[linear-gradient(180deg,rgba(255,252,248,0.96),rgba(247,239,230,0.95))] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.78)] sm:p-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <ImageCard
            title="Dijital Görsel"
            imageUrl={displayedDigitalUrl}
            placeholderIcon={<Sparkles className="h-10 w-10 text-coffee-primary" aria-hidden />}
            onPick={handlePickDigital}
            onRemove={handleRemoveDigital}
            disabled={!canEditPattern}
          />
          <ImageCard
            title="Final Görsel"
            imageUrl={displayedFinalUrl}
            placeholderIcon={<ImageIcon className="h-10 w-10 text-coffee-primary" aria-hidden />}
            onPick={handlePickFinal}
            onRemove={handleRemoveFinal}
            disabled={!canEditPattern}
          />
        </div>

        <div className="hidden">
          <p
            className={cn(
              "text-xs font-medium",
              imageStatus === "saved"
                ? "text-emerald-600"
                : imageStatus === "saving" || hasPendingImageChanges
                  ? "text-neutral-500"
                  : "text-transparent"
            )}
          >
            {imageStatusText || " "}
          </p>
          {canEditPattern ? (
          <button
            type="button"
            onClick={handleSaveImages}
            disabled={!canSaveImages}
            className={cn(
              "rounded-lg px-3 py-1.5 text-sm font-semibold transition",
              canSaveImages
                ? "bg-coffee-primary text-white hover:brightness-95"
                : "cursor-not-allowed bg-neutral-200 text-neutral-500"
            )}
          >
            Görselleri Kaydet
          </button>
          ) : null}
        </div>
      </div>

      <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
        <div className="space-y-1.5">
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[#7a6656]">Desen</div>
          <div className="text-[19px] font-semibold tracking-[-0.01em] text-neutral-900">
            {pattern.fabricCode} · {pattern.fabricName}
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <div className="inline-flex rounded-full border border-[#e2d5c7] bg-[#faf6f1] px-2.5 py-0.5 text-[10px] font-semibold text-[#6d5b4f]">
              {stageLabel[pattern.currentStage] ?? pattern.currentStage}
            </div>
            <div className="text-[11px] font-medium text-[#8a7462]">
              {pattern.weaveType} | Tel: {pattern.totalEnds}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-1.5 rounded-2xl border border-[#e2d5c7] bg-[#fbf6ef] p-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.76)] xl:max-w-[390px] xl:justify-end">
          <p
            className={cn(
              "hidden text-xs font-medium",
              archiveStatus === "saved"
                ? "text-emerald-600"
                : archiveStatus === "saving"
                  ? "text-neutral-500"
                  : "text-transparent"
            )}
          >
            {archiveStatusText || " "}
          </p>
          {canEditPattern ? (
            <button
              type="button"
              onClick={handleSaveImages}
              disabled={!canSaveImages}
              className={cn(
                "rounded-xl px-3 py-1.5 text-[13px] font-semibold transition",
                canSaveImages
                  ? "bg-coffee-primary text-white shadow-[0_10px_22px_rgba(63,48,38,0.18)] hover:brightness-95"
                  : "cursor-not-allowed bg-[#ece4dc] text-[#9b8a7b]"
              )}
            >
              Gorselleri Kaydet
            </button>
          ) : null}
          {canEditPattern ? (
            <button
              type="button"
              onClick={openMetersModal}
              disabled={!hasEditableMeters}
              className={cn(
                "rounded-xl border px-3 py-1.5 text-[13px] font-semibold transition",
                hasEditableMeters
                  ? "border-[#ccb39c] bg-[#fffaf4] text-[#4a372c] hover:border-[#b48e73] hover:bg-[#fffdf9]"
                  : "cursor-not-allowed border-[#e6dbd0] bg-[#f3ede6] text-[#9c8a7c]"
              )}
            >
              Metreleri Duzenle
            </button>
          ) : null}
          {showArchivedActions && canDeletePattern ? (
            <>
              <button
                type="button"
                onClick={handleRestorePattern}
                disabled={archiveStatus === "saving"}
                className="rounded-xl border border-emerald-500/50 bg-emerald-50 px-3 py-1.5 text-[13px] font-semibold text-emerald-700 transition hover:bg-emerald-100 disabled:opacity-50"
              >
                Geri Al
              </button>
              <button
                type="button"
                onClick={handleDeletePattern}
                disabled={archiveStatus === "saving"}
                className={controlledDangerButtonClass}
              >
                Kalıcı Sil
              </button>
            </>
          ) : canDeletePattern ? (
            <button
              type="button"
              onClick={handleArchive}
              disabled={archiveStatus === "saving"}
              className={controlledDangerButtonClass}
            >
              Sil
            </button>
          ) : null}
        </div>
      </div>

      {actionFeedbackItems.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {actionFeedbackItems.map((item) => (
            <StatusChip key={item.key} tone={item.tone}>
              {item.text}
            </StatusChip>
          ))}
        </div>
      ) : null}

      <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={<Package className="h-4 w-4" />} label="Üretim" value={`${fmtMeters(savedMeters.totalProducedMeters)} m`} />
        <StatCard icon={<Package className="h-4 w-4" />} label="Stok" value={`${fmtMeters(savedMeters.stockMeters)} m`} />
        <StatCard icon={<Palette className="h-4 w-4" />} label="Boyahane" value={`${fmtMeters(savedMeters.inDyehouseMeters)} m`} />
        <StatCard icon={<Layers className="h-4 w-4" />} label="Hatalı" value={`${fmtMeters(savedMeters.defectMeters)} m`} />
      </div>

      <div className="hidden">
        <p
          className={cn(
            "text-xs font-medium",
            metersStatus === "saved"
              ? "text-emerald-600"
              : metersStatus === "saving"
                ? "text-neutral-500"
                : "text-transparent"
          )}
        >
          {metersStatusText || " "}
        </p>
        {canEditPattern ? (
        <button
          type="button"
          onClick={openMetersModal}
          disabled={!hasEditableMeters}
          className={cn(
            "rounded-lg px-3 py-1.5 text-sm font-semibold transition",
            hasEditableMeters
              ? "bg-coffee-primary text-white hover:brightness-95"
              : "cursor-not-allowed bg-[#ebe2d7] text-[#8e7a69]"
          )}
        >
          Metreleri Düzenle
        </button>
        ) : null}
      </div>

      <Accordion title="Detaylar" defaultOpen={false}>
        <div className="space-y-4">
          <SectionBlock title="Ana bilgiler">
            <dl className="grid grid-cols-2 gap-3 text-sm text-neutral-700">
              <div>
                <dt className="text-xs uppercase tracking-wide text-neutral-500">Dokuma tipi</dt>
                <dd className="font-medium text-neutral-900">{pattern.weaveType}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-neutral-500">Çözgü</dt>
                <dd className="font-medium text-neutral-900">{pattern.warpCount}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-neutral-500">Atkı</dt>
                <dd className="font-medium text-neutral-900">{pattern.weftCount}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-neutral-500">Toplam tel</dt>
                <dd className="font-medium text-neutral-900">{pattern.totalEnds}</dd>
              </div>
            </dl>
          </SectionBlock>

          <SectionBlock title="Varyantlar">
            <div className="space-y-3">
              <button
                type="button"
                onClick={() => setIsVariantsOpen((prev) => !prev)}
                className={cn(
                  "flex w-full items-center justify-between rounded-2xl px-4 py-3.5 text-left",
                  warmPanelInteractiveClass
                )}
                aria-expanded={isVariantsOpen}
              >
                <span className="space-y-1">
                  <span className="block text-[11px] font-semibold uppercase tracking-[0.18em] text-[#7a6656]">
                    Varyant Secici
                  </span>
                  <span className="block text-sm font-semibold text-[#3f3128]">
                    Toplam {variantCount} varyant
                  </span>
                </span>
                <ChevronDown
                  className={cn("h-4 w-4 text-[#7a6656] transition-transform", isVariantsOpen && "rotate-180")}
                  aria-hidden
                />
              </button>

              {isVariantsOpen ? (
                <div className="space-y-3 rounded-2xl border border-[#eadfd3] bg-[#fcf7f1] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.78)]">
                  {canEditPattern ? (
                  <div className="flex items-center justify-end">
                    <button
                      type="button"
                      onClick={handleAddVariant}
                      className="rounded-lg border border-coffee-primary bg-coffee-primary/10 px-3 py-1.5 text-xs font-semibold text-coffee-primary transition hover:border-coffee-primary/70"
                    >
                      + Varyant Ekle
                    </button>
                  </div>
                  ) : null}

                  <div className="max-h-[240px] space-y-2 overflow-auto pr-1">
                    {variantsDraft.length === 0 ? (
                      <div className="rounded-lg border border-dashed border-black/10 bg-coffee-surface px-3 py-2 text-sm text-neutral-500">
                        Varyant yok
                      </div>
                    ) : (
                      variantsDraft.map((variant) => (
                        <div
                          key={variant.id}
                          className="grid grid-cols-[1fr,1fr,auto] items-center gap-2 rounded-xl border border-[#dbc9b8] bg-[#fffdf9] p-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.72)]"
                        >
                          <input
                            type="text"
                            value={variant.colorName}
                            disabled={!canEditPattern}
                            onChange={(event) =>
                              handleVariantFieldChange(variant.id, "colorName", event.target.value)
                            }
                            placeholder="Renk adı"
                            className="w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-coffee-primary disabled:cursor-not-allowed disabled:bg-neutral-100"
                          />
                          <input
                            type="text"
                            value={variant.colorCode ?? ""}
                            disabled={!canEditPattern}
                            onChange={(event) =>
                              handleVariantFieldChange(variant.id, "colorCode", event.target.value)
                            }
                            placeholder="Renk kodu"
                            className="w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-coffee-primary disabled:cursor-not-allowed disabled:bg-neutral-100"
                          />
                          <button
                            type="button"
                            disabled={!canEditPattern}
                            onClick={() => handleRemoveVariant(variant.id)}
                            className="rounded-lg border border-red-300 bg-white px-2.5 py-1.5 text-sm font-semibold text-red-600 transition hover:border-red-500 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"
                            aria-label="Varyantı kaldır"
                          >
                            x
                          </button>
                        </div>
                      ))
                    )}
                  </div>

                  <p
                    className={cn(
                      "text-xs font-medium",
                      variantsStatus === "saved"
                        ? "text-emerald-600"
                        : variantsStatus === "saving"
                          ? "text-neutral-500"
                          : "text-transparent"
                    )}
                  >
                    {variantsStatusText || " "}
                  </p>
                </div>
              ) : null}
            </div>
          </SectionBlock>

          <SectionBlock title="Lojistik">
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-medium text-neutral-700">Lojistik bilgileri</p>
                {!isEditingLogistics && canEditPattern ? (
                  <button
                    type="button"
                    onClick={openLogisticsEditor}
                    className="rounded-lg border border-black/10 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-700 transition hover:border-coffee-primary/40"
                  >
                    Düzenle
                  </button>
                ) : null}
              </div>

              {isEditingLogistics ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <label className="space-y-1 text-sm text-neutral-700">
                      <span>Müşteri</span>
                      <input
                        type="text"
                        value={logisticsDraft.musteri}
                        onChange={(event) =>
                          setLogisticsDraft((prev) => ({ ...prev, musteri: event.target.value }))
                        }
                        className={logisticsInputClass}
                      />
                    </label>
                    <label className="space-y-1 text-sm text-neutral-700">
                      <span>Depo No</span>
                      <input
                        type="text"
                        value={logisticsDraft.depoNo}
                        onChange={(event) =>
                          setLogisticsDraft((prev) => ({ ...prev, depoNo: event.target.value }))
                        }
                        className={logisticsInputClass}
                      />
                    </label>
                    <label className="space-y-1 text-sm text-neutral-700">
                      <span>Kg</span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={logisticsDraft.kg}
                        onChange={(event) =>
                          setLogisticsDraft((prev) => ({ ...prev, kg: event.target.value }))
                        }
                        className={logisticsInputClass}
                      />
                    </label>
                    <label className="space-y-1 text-sm text-neutral-700">
                      <span>Eni (cm)</span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={logisticsDraft.eniCm}
                        onChange={(event) =>
                          setLogisticsDraft((prev) => ({ ...prev, eniCm: event.target.value }))
                        }
                        className={logisticsInputClass}
                      />
                    </label>
                    <label className="space-y-1 text-sm text-neutral-700">
                      <span>Gramaj (g/m²)</span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={logisticsDraft.gramajGm2}
                        onChange={(event) =>
                          setLogisticsDraft((prev) => ({ ...prev, gramajGm2: event.target.value }))
                        }
                        className={logisticsInputClass}
                      />
                    </label>
                    <label className="space-y-1 text-sm text-neutral-700">
                      <span>Fire Oranı (%)</span>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="0.01"
                        value={logisticsDraft.fireOrani}
                        onChange={(event) =>
                          setLogisticsDraft((prev) => ({ ...prev, fireOrani: event.target.value }))
                        }
                        className={logisticsInputClass}
                      />
                    </label>
                    <label className="space-y-1 text-sm text-neutral-700 sm:col-span-2">
                      <span>Eklendiği Tarih</span>
                      <input
                        type="date"
                        value={logisticsDraft.createdAt}
                        onChange={(event) =>
                          setLogisticsDraft((prev) => ({ ...prev, createdAt: event.target.value }))
                        }
                        className={logisticsInputClass}
                      />
                    </label>
                  </div>

                  {logisticsError ? <p className="text-sm text-red-600">{logisticsError}</p> : null}

                  <div className="flex items-center justify-end gap-2">
                    <p
                      className={cn(
                        "text-xs font-medium",
                        logisticsStatus === "saved"
                          ? "text-emerald-600"
                          : logisticsStatus === "saving"
                            ? "text-neutral-500"
                            : "text-transparent"
                      )}
                    >
                      {logisticsStatusText || " "}
                    </p>
                    <button
                      type="button"
                      onClick={handleCancelLogistics}
                      className="rounded-lg px-3 py-1.5 text-sm text-neutral-600 hover:bg-neutral-100"
                    >
                      İptal
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveLogistics}
                      disabled={!canSaveLogistics}
                      className={cn(
                        "rounded-lg px-3 py-1.5 text-sm font-semibold transition",
                        canSaveLogistics
                          ? "bg-coffee-primary text-white hover:brightness-95"
                          : "cursor-not-allowed bg-neutral-200 text-neutral-500"
                      )}
                    >
                      Kaydet
                    </button>
                  </div>
                </div>
              ) : (
                <dl className="grid grid-cols-2 gap-2 text-sm text-neutral-700">
                  <div>
                    <dt className="text-xs uppercase tracking-wide text-neutral-500">Müşteri</dt>
                    <dd className="font-medium text-neutral-900">{formatOptionalText(pattern.musteri)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase tracking-wide text-neutral-500">Depo no</dt>
                    <dd className="font-medium text-neutral-900">{formatOptionalText(pattern.depoNo)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase tracking-wide text-neutral-500">Kg</dt>
                    <dd className="font-medium text-neutral-900">{formatOptionalNumber(pattern.kg, "kg")}</dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase tracking-wide text-neutral-500">Eni</dt>
                    <dd className="font-medium text-neutral-900">{formatOptionalNumber(pattern.eniCm, "cm")}</dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase tracking-wide text-neutral-500">Gramaj</dt>
                    <dd className="font-medium text-neutral-900">
                      {formatOptionalNumber(pattern.gramajGm2, "g/m²")}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase tracking-wide text-neutral-500">Fire oranı</dt>
                    <dd className="font-medium text-neutral-900">
                      {formatOptionalNumber(pattern.fireOrani, "%")}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase tracking-wide text-neutral-500">Eklendiği tarih</dt>
                    <dd className="font-medium text-neutral-900">{formatCreatedAt(pattern.createdAt)}</dd>
                  </div>
                </dl>
              )}

              <div>
                <div className="mb-1 text-xs uppercase tracking-wide text-neutral-500">Partiler</div>
                <div className="flex flex-wrap gap-2">
                  {(pattern.partiNos ?? []).length === 0 ? (
                    <span className="text-sm text-neutral-500">-</span>
                  ) : (
                    (pattern.partiNos ?? []).map((partiNo) => (
                      <span
                        key={partiNo}
                        className="inline-flex items-center rounded-full border border-black/10 bg-coffee-surface px-2.5 py-1 text-xs font-medium text-neutral-700"
                      >
                        {partiNo}
                      </span>
                    ))
                  )}
                </div>
              </div>
            </div>
          </SectionBlock>

          <SectionBlock title="Notlar">
            <div className="space-y-2">
              <textarea
                placeholder="Not ekle"
                value={note}
                disabled={!canEditPattern}
                onChange={(event) => setNote(event.target.value)}
                className="w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-sm text-neutral-800 shadow-[0_4px_10px_rgba(0,0,0,0.04)] focus:border-coffee-primary focus:outline-none focus:ring-1 focus:ring-coffee-primary disabled:cursor-not-allowed disabled:bg-neutral-100"
                rows={3}
              />
              <div className="flex items-center justify-between gap-3">
                <p
                  className={cn(
                    "text-xs font-medium",
                    noteStatus === "saved"
                      ? "text-emerald-600"
                      : noteStatus === "saving" || hasNoteChanges
                        ? "text-neutral-500"
                        : "text-transparent"
                  )}
                >
                  {noteStatusText || " "}
                </p>
                {canEditPattern ? (
                  <button
                    type="button"
                    onClick={handleSaveNote}
                    disabled={!canSaveNote}
                    className={cn(
                      "rounded-lg px-3 py-1.5 text-sm font-semibold transition",
                      canSaveNote
                        ? "bg-coffee-primary text-white hover:brightness-95"
                        : "cursor-not-allowed bg-neutral-200 text-neutral-500"
                    )}
                  >
                    Kaydet
                  </button>
                ) : null}
              </div>
            </div>
          </SectionBlock>

          <SectionBlock title="İşlem Geçmişi">
            <ul className="space-y-2 text-sm text-neutral-700">
              <li className="rounded-lg bg-coffee-surface px-3 py-2">Geçmiş kaydı (placeholder)</li>
              <li className="rounded-lg bg-coffee-surface px-3 py-2">Geçmiş kaydı (placeholder)</li>
              <li className="rounded-lg bg-coffee-surface px-3 py-2">Geçmiş kaydı (placeholder)</li>
            </ul>
          </SectionBlock>
        </div>
      </Accordion>

      {showMetersModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div
            ref={metersModalRef}
            role="dialog"
            aria-modal="true"
            aria-label="Metreleri Duzenle"
            tabIndex={-1}
            className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl"
          >
            <div className="mb-4 flex items-start justify-between">
              <div>
                <h2 className="text-lg font-semibold text-neutral-900">Metreleri Düzenle</h2>
                <p className="text-sm text-neutral-500">Alanlar 0 veya daha büyük olmalı.</p>
              </div>
              <button
                type="button"
                onClick={() => setShowMetersModal(false)}
                className="rounded-lg px-2 py-1 text-sm text-neutral-500 hover:bg-neutral-100"
              >
                Kapat
              </button>
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <MeterField
                label="Üretim"
                value={metersDraft.totalProducedMeters}
                disabled={!canEditPattern || isMeterManagedByOperations("totalProducedMeters")}
                onChange={(value) => setMetersDraft((prev) => ({ ...prev, totalProducedMeters: value }))}
              />
              <MeterField
                label="Stok"
                value={metersDraft.stockMeters}
                disabled={!canEditPattern || isMeterManagedByOperations("stockMeters")}
                onChange={(value) => setMetersDraft((prev) => ({ ...prev, stockMeters: value }))}
              />
              <MeterField
                label="Boyahane"
                value={metersDraft.inDyehouseMeters}
                disabled={!canEditPattern || isMeterManagedByOperations("inDyehouseMeters")}
                onChange={(value) => setMetersDraft((prev) => ({ ...prev, inDyehouseMeters: value }))}
              />
              <MeterField
                label="Hatalı"
                value={metersDraft.defectMeters}
                disabled={!canEditPattern || isMeterManagedByOperations("defectMeters")}
                onChange={(value) => setMetersDraft((prev) => ({ ...prev, defectMeters: value }))}
              />
            </div>

            {metersError && <p className="mt-3 text-sm text-red-600">{metersError}</p>}

            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowMetersModal(false)}
                className="rounded-lg px-3 py-2 text-sm text-neutral-600 hover:bg-neutral-100"
              >
                İptal
              </button>
              {canEditPattern ? (
              <button
                type="button"
                onClick={handleSaveMeters}
                className="rounded-lg bg-coffee-primary px-4 py-2 text-sm font-semibold text-white hover:bg-coffee-primary/90"
              >
                Kaydet
              </button>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

type ImageCardProps = {
  title: string;
  imageUrl?: string;
  placeholderIcon: ReactNode;
  onPick: (file?: File) => void;
  onRemove?: () => void;
  disabled?: boolean;
};

function ImageCard({
  title,
  imageUrl,
  placeholderIcon,
  onPick,
  onRemove,
  disabled = false,
}: ImageCardProps) {
  return (
    <div
      className={cn("relative flex flex-col gap-3 overflow-hidden", warmPanelInteractiveClass)}
    >
      <div className="relative overflow-hidden rounded-[18px] border border-[#d7c3b1] bg-[#f7efe5]" style={{ aspectRatio: "4 / 3" }}>
        {imageUrl && onRemove ? (
          <button
            type="button"
            onClick={onRemove}
            disabled={disabled}
            className="absolute right-3 top-3 z-10 inline-flex h-8 w-8 items-center justify-center rounded-full border border-[#ddcdbf] bg-[rgba(255,250,244,0.92)] text-[#6d584a] shadow-[0_8px_18px_rgba(63,48,38,0.10)] backdrop-blur-sm transition hover:border-[#c8ad94] hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c9ab92]/45 disabled:cursor-not-allowed disabled:opacity-60"
            aria-label={`${title} gorselini kaldir`}
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        ) : null}
        {imageUrl ? (
          <img src={imageUrl} alt={title} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-3 bg-[linear-gradient(180deg,rgba(255,252,247,0.95),rgba(245,235,223,0.92))] px-6 text-[#705d4f]">
            <span className="flex h-16 w-16 items-center justify-center rounded-full border border-[#d8c4b0] bg-white/75 shadow-[inset_0_1px_0_rgba(255,255,255,0.75)]">
              {placeholderIcon}
            </span>
            <span className="text-sm font-semibold">Fotoğraf yok</span>
            <span className="text-xs font-medium text-[#8a7462]">Gorsel eklemek icin butonu kullanin.</span>
          </div>
        )}
      </div>
      <div className="flex items-center justify-between gap-2.5 border-t border-[#e3d2c4] bg-[#fbf6ef] px-3.5 pb-3.5 pt-2">
        <div className="space-y-1.5">
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[#7a6656]">{title}</div>
        </div>
        <ImagePicker
          onSelect={onPick}
          disabled={disabled}
          buttonClassName="border-[#c9ae96] bg-[#fffaf3] text-[#49382d] shadow-[0_6px_16px_rgba(84,59,39,0.08)] hover:border-[#b79276] hover:bg-[#fffdf8]"
        />
      </div>
    </div>
  );
}

type StatusChipProps = {
  children: ReactNode;
  tone?: "neutral" | "success";
};

function StatusChip({ children, tone = "neutral" }: StatusChipProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-medium shadow-[inset_0_1px_0_rgba(255,255,255,0.68)]",
        tone === "success"
          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
          : "border-[#ddcfc1] bg-[#fbf6f0] text-[#7a6656]"
      )}
    >
      {children}
    </span>
  );
}

type StatCardProps = {
  icon: ReactNode;
  label: string;
  value: string;
};

function StatCard({ icon, label, value }: StatCardProps) {
  return (
    <div className="flex items-center gap-2.5 rounded-2xl border border-[#dfd1c4] bg-[#fffaf5] px-3.5 py-3 text-sm shadow-[0_10px_22px_rgba(63,48,38,0.05)]">
      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-coffee-primary/15 text-coffee-primary">
        {icon}
      </span>
      <div>
        <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#7a6656]">{label}</div>
        <div className="pt-0.5 text-[15px] font-semibold text-neutral-900">{value}</div>
      </div>
    </div>
  );
}

type MeterFieldProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
};

function MeterField({ label, value, onChange, disabled = false }: MeterFieldProps) {
  return (
    <label className="space-y-1 text-sm text-neutral-700">
      <span>{label}</span>
      <input
        type="number"
        min="0"
        step="0.01"
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-coffee-primary disabled:cursor-not-allowed disabled:bg-neutral-100"
      />
    </label>
  );
}

type SectionBlockProps = {
  title: string;
  children: ReactNode;
};

function SectionBlock({ title, children }: SectionBlockProps) {
  return (
    <div className={detailSectionClass}>
      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#7a6656]">{title}</div>
      {children}
    </div>
  );
}


