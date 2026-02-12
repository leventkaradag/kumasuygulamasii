"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronDown, Image as ImageIcon, ImageOff, Layers, Package, Palette, Sparkles } from "lucide-react";
import { Accordion } from "@/components/Accordion";
import { ImagePicker } from "@/components/ImagePicker";
import { cn } from "@/lib/cn";
import type { Pattern, Variant } from "@/lib/domain/pattern";
import { patternsLocalRepo } from "@/lib/repos/patternsLocalRepo";

type PatternDetailPanelProps = {
  pattern: Pattern | null;
  onPatternUpdated?: (pattern?: Pattern) => void;
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
  onPatternUpdated,
  showArchived = false,
}: PatternDetailPanelProps) {
  const [note, setNote] = useState("");
  const [savedNote, setSavedNote] = useState("");
  const [noteStatus, setNoteStatus] = useState<"idle" | "saving" | "saved">("idle");

  const [savedDigitalUrl, setSavedDigitalUrl] = useState<string | undefined>(undefined);
  const [savedFinalUrl, setSavedFinalUrl] = useState<string | undefined>(undefined);
  const [pendingDigitalUrl, setPendingDigitalUrl] = useState<string | undefined>(undefined);
  const [pendingFinalUrl, setPendingFinalUrl] = useState<string | undefined>(undefined);
  const [imageStatus, setImageStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [metersStatus, setMetersStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [archiveStatus, setArchiveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [showMetersModal, setShowMetersModal] = useState(false);
  const [metersError, setMetersError] = useState("");
  const [savedMeters, setSavedMeters] = useState<MeterFields>({
    totalProducedMeters: 0,
    stockMeters: 0,
    inDyehouseMeters: 0,
    defectMeters: 0,
  });
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
  const [logisticsStatus, setLogisticsStatus] = useState<"idle" | "saving" | "saved">("idle");

  const resetNoteStatusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const resetImageStatusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const resetMetersStatusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const resetArchiveStatusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const resetLogisticsStatusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const resetVariantsStatusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const latestPattern = pattern ? patternsLocalRepo.get(pattern.id) ?? pattern : null;

    const initialNote = latestPattern?.note ?? "";
    setNote(initialNote);
    setSavedNote(initialNote);
    setNoteStatus("idle");

    setSavedDigitalUrl(latestPattern?.digitalImageUrl);
    setSavedFinalUrl(latestPattern?.finalImageUrl);
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
    setSavedMeters({
      totalProducedMeters: latestPattern?.totalProducedMeters ?? 0,
      stockMeters: latestPattern?.stockMeters ?? 0,
      inDyehouseMeters: latestPattern?.inDyehouseMeters ?? 0,
      defectMeters: latestPattern?.defectMeters ?? 0,
    });
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

  const variantCount = variantsDraft.length;

  const hasNoteChanges = note.trim() !== savedNote.trim();
  const canSaveNote = hasNoteChanges && noteStatus !== "saving";
  const noteStatusText =
    noteStatus === "saving"
      ? "Kaydediliyor..."
      : noteStatus === "saved"
        ? "Kaydedildi ✅"
        : hasNoteChanges
          ? "Değişiklik var"
          : "";

  const hasPendingImageChanges = !!pendingDigitalUrl || !!pendingFinalUrl;
  const canSaveImages = hasPendingImageChanges && imageStatus !== "saving";
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
  const canSaveLogistics = logisticsStatus !== "saving" && logisticsHasChanges;

  const variantsStatusText =
    variantsStatus === "saving"
      ? "Kaydediliyor..."
      : variantsStatus === "saved"
        ? "Kaydedildi ✅"
        : "";

  const handleSaveNote = () => {
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
    if (!file) return;
    const dataUrl = await fileToDataUrl(file);
    setPendingDigitalUrl(dataUrl);
    setImageStatus("idle");
  };

  const handlePickFinal = async (file?: File) => {
    if (!file) return;
    const dataUrl = await fileToDataUrl(file);
    setPendingFinalUrl(dataUrl);
    setImageStatus("idle");
  };

  const handleSaveImages = () => {
    if (!canSaveImages) return;

    if (resetImageStatusTimerRef.current) {
      clearTimeout(resetImageStatusTimerRef.current);
      resetImageStatusTimerRef.current = null;
    }

    setImageStatus("saving");

    const patch: Partial<Pattern> = {};
    if (pendingDigitalUrl) {
      patch.digitalImageUrl = pendingDigitalUrl;
    }
    if (pendingFinalUrl) {
      patch.finalImageUrl = pendingFinalUrl;
    }

    const updated = patternsLocalRepo.update(pattern.id, patch);
    setSavedDigitalUrl(updated?.digitalImageUrl ?? savedDigitalUrl);
    setSavedFinalUrl(updated?.finalImageUrl ?? savedFinalUrl);
    setPendingDigitalUrl(undefined);
    setPendingFinalUrl(undefined);
    setImageStatus("saved");

    resetImageStatusTimerRef.current = setTimeout(() => {
      setImageStatus("idle");
      resetImageStatusTimerRef.current = null;
    }, 1200);
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

  const openMetersModal = () => {
    setMetersDraft({
      totalProducedMeters: String(savedMeters.totalProducedMeters),
      stockMeters: String(savedMeters.stockMeters),
      inDyehouseMeters: String(savedMeters.inDyehouseMeters),
      defectMeters: String(savedMeters.defectMeters),
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
    if (metersStatus === "saving") return;

    const totalProducedMeters = parseMeterField("totalProducedMeters");
    const stockMeters = parseMeterField("stockMeters");
    const inDyehouseMeters = parseMeterField("inDyehouseMeters");
    const defectMeters = parseMeterField("defectMeters");

    if (
      totalProducedMeters === null ||
      stockMeters === null ||
      inDyehouseMeters === null ||
      defectMeters === null
    ) {
      setMetersError("Metre alanları 0 veya daha büyük bir sayı olmalı.");
      return;
    }

    if (resetMetersStatusTimerRef.current) {
      clearTimeout(resetMetersStatusTimerRef.current);
      resetMetersStatusTimerRef.current = null;
    }

    setMetersError("");
    setMetersStatus("saving");

    const patch: MeterFields = {
      totalProducedMeters,
      stockMeters,
      inDyehouseMeters,
      defectMeters,
    };

    patternsLocalRepo.update(pattern.id, patch);
    setSavedMeters(patch);
    setMetersStatus("saved");
    setShowMetersModal(false);

    resetMetersStatusTimerRef.current = setTimeout(() => {
      setMetersStatus("idle");
      resetMetersStatusTimerRef.current = null;
    }, 1200);
  };

  const persistVariants = (nextVariants: Variant[]) => {
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
    const nextVariants = variantsDraft.filter((variant) => variant.id !== variantId);
    persistVariants(nextVariants);
  };

  const openLogisticsEditor = () => {
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
    <div className="space-y-4 rounded-2xl border border-black/5 bg-white/80 p-6 shadow-[0_10px_30px_rgba(0,0,0,0.08)]">
      <div className="space-y-2">
        <div className="grid gap-3 sm:grid-cols-2">
          <ImageCard
            title="Dijital Görsel"
            imageUrl={pendingDigitalUrl ?? savedDigitalUrl}
            placeholderIcon={<Sparkles className="h-10 w-10 text-coffee-primary" aria-hidden />}
            onPick={handlePickDigital}
          />
          <ImageCard
            title="Final Görsel"
            imageUrl={pendingFinalUrl ?? savedFinalUrl}
            placeholderIcon={<ImageIcon className="h-10 w-10 text-coffee-primary" aria-hidden />}
            onPick={handlePickFinal}
          />
        </div>

        <div className="flex items-center justify-end gap-3">
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
        </div>
      </div>

      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-xs uppercase tracking-wide text-neutral-500">Desen</div>
          <div className="text-lg font-semibold text-neutral-900">
            {pattern.fabricCode} · {pattern.fabricName}
          </div>
          <div className="mt-1 inline-flex rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] font-semibold text-neutral-700">
            {stageLabel[pattern.currentStage] ?? pattern.currentStage}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <p
            className={cn(
              "text-xs font-medium",
              archiveStatus === "saved"
                ? "text-emerald-600"
                : archiveStatus === "saving"
                  ? "text-neutral-500"
                  : "text-transparent"
            )}
          >
            {archiveStatusText || " "}
          </p>
          {showArchivedActions ? (
            <>
              <button
                type="button"
                onClick={handleRestorePattern}
                disabled={archiveStatus === "saving"}
                className="rounded-lg border border-emerald-500/50 bg-emerald-50 px-3 py-1.5 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-100 disabled:opacity-50"
              >
                Geri Al
              </button>
              <button
                type="button"
                onClick={handleDeletePattern}
                disabled={archiveStatus === "saving"}
                className="rounded-lg border border-red-500/40 bg-red-50 px-3 py-1.5 text-sm font-semibold text-red-700 transition hover:bg-red-100 disabled:opacity-50"
              >
                Kalıcı Sil
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={handleArchive}
              disabled={archiveStatus === "saving"}
              className="rounded-lg border border-black/10 bg-white px-3 py-1.5 text-sm font-semibold text-neutral-700 transition hover:border-coffee-primary/40 disabled:opacity-50"
            >
              Sil
            </button>
          )}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        <StatCard icon={<Package className="h-4 w-4" />} label="Üretim" value={`${fmtMeters(savedMeters.totalProducedMeters)} m`} />
        <StatCard icon={<Package className="h-4 w-4" />} label="Stok" value={`${fmtMeters(savedMeters.stockMeters)} m`} />
        <StatCard icon={<Palette className="h-4 w-4" />} label="Boyahane" value={`${fmtMeters(savedMeters.inDyehouseMeters)} m`} />
        <StatCard icon={<Layers className="h-4 w-4" />} label="Hatalı" value={`${fmtMeters(savedMeters.defectMeters)} m`} />
      </div>

      <div className="flex items-center justify-end gap-3">
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
        <button
          type="button"
          onClick={openMetersModal}
          className="rounded-lg bg-coffee-primary px-3 py-1.5 text-sm font-semibold text-white transition hover:brightness-95"
        >
          Metreleri Düzenle
        </button>
      </div>

      <Accordion title="Detaylar" defaultOpen={false}>
        <div className="space-y-4">
          <SectionBlock title="Ana bilgiler">
            <dl className="grid grid-cols-2 gap-2 text-sm text-neutral-700">
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
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => setIsVariantsOpen((prev) => !prev)}
                className="flex w-full items-center justify-between rounded-lg border border-black/10 bg-white px-3 py-2 text-left transition hover:border-coffee-primary/40"
                aria-expanded={isVariantsOpen}
              >
                <span className="text-sm text-neutral-700">Toplam {variantCount} varyant</span>
                <ChevronDown
                  className={cn("h-4 w-4 text-neutral-500 transition-transform", isVariantsOpen && "rotate-180")}
                  aria-hidden
                />
              </button>

              {isVariantsOpen ? (
                <>
                  <div className="flex items-center justify-end">
                    <button
                      type="button"
                      onClick={handleAddVariant}
                      className="rounded-lg border border-coffee-primary bg-coffee-primary/10 px-3 py-1.5 text-xs font-semibold text-coffee-primary transition hover:border-coffee-primary/70"
                    >
                      + Varyant Ekle
                    </button>
                  </div>

                  <div className="max-h-[240px] space-y-2 overflow-auto pr-1">
                    {variantsDraft.length === 0 ? (
                      <div className="rounded-lg border border-dashed border-black/10 bg-coffee-surface px-3 py-2 text-sm text-neutral-500">
                        Varyant yok
                      </div>
                    ) : (
                      variantsDraft.map((variant) => (
                        <div
                          key={variant.id}
                          className="grid grid-cols-[1fr,1fr,auto] items-center gap-2 rounded-lg border border-black/10 bg-white p-2"
                        >
                          <input
                            type="text"
                            value={variant.colorName}
                            onChange={(event) =>
                              handleVariantFieldChange(variant.id, "colorName", event.target.value)
                            }
                            placeholder="Renk adı"
                            className="w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-coffee-primary"
                          />
                          <input
                            type="text"
                            value={variant.colorCode ?? ""}
                            onChange={(event) =>
                              handleVariantFieldChange(variant.id, "colorCode", event.target.value)
                            }
                            placeholder="Renk kodu"
                            className="w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-coffee-primary"
                          />
                          <button
                            type="button"
                            onClick={() => handleRemoveVariant(variant.id)}
                            className="rounded-lg border border-red-500/30 bg-red-50 px-2 py-1.5 text-sm font-semibold text-red-700 transition hover:bg-red-100"
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
                </>
              ) : null}
            </div>
          </SectionBlock>

          <SectionBlock title="Lojistik">
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-medium text-neutral-700">Lojistik bilgileri</p>
                {!isEditingLogistics ? (
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
                onChange={(event) => setNote(event.target.value)}
                className="w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-sm text-neutral-800 shadow-[0_4px_10px_rgba(0,0,0,0.04)] focus:border-coffee-primary focus:outline-none focus:ring-1 focus:ring-coffee-primary"
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
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
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
                onChange={(value) => setMetersDraft((prev) => ({ ...prev, totalProducedMeters: value }))}
              />
              <MeterField
                label="Stok"
                value={metersDraft.stockMeters}
                onChange={(value) => setMetersDraft((prev) => ({ ...prev, stockMeters: value }))}
              />
              <MeterField
                label="Boyahane"
                value={metersDraft.inDyehouseMeters}
                onChange={(value) => setMetersDraft((prev) => ({ ...prev, inDyehouseMeters: value }))}
              />
              <MeterField
                label="Hatalı"
                value={metersDraft.defectMeters}
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
              <button
                type="button"
                onClick={handleSaveMeters}
                className="rounded-lg bg-coffee-primary px-4 py-2 text-sm font-semibold text-white hover:bg-coffee-primary/90"
              >
                Kaydet
              </button>
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
};

function ImageCard({ title, imageUrl, placeholderIcon, onPick }: ImageCardProps) {
  return (
    <div
      className={cn(
        "relative flex flex-col gap-3 overflow-hidden rounded-xl border border-black/5 bg-white shadow-[0_8px_20px_rgba(0,0,0,0.06)]"
      )}
    >
      <div className="relative" style={{ aspectRatio: "4 / 3" }}>
        {imageUrl ? (
          <img src={imageUrl} alt={title} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-3 bg-coffee-surface text-neutral-500">
            {placeholderIcon}
            <span className="text-sm font-semibold">Fotoğraf yok</span>
          </div>
        )}
      </div>
      <div className="flex items-center justify-between px-3 pb-3">
        <div>
          <div className="text-xs uppercase tracking-wide text-neutral-500">{title}</div>
        </div>
        <ImagePicker onSelect={onPick} />
      </div>
    </div>
  );
}

type StatCardProps = {
  icon: ReactNode;
  label: string;
  value: string;
};

function StatCard({ icon, label, value }: StatCardProps) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-black/5 bg-white px-3 py-3 text-sm shadow-[0_6px_14px_rgba(0,0,0,0.04)]">
      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-coffee-primary/15 text-coffee-primary">
        {icon}
      </span>
      <div>
        <div className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">{label}</div>
        <div className="text-base font-semibold text-neutral-900">{value}</div>
      </div>
    </div>
  );
}

type MeterFieldProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
};

function MeterField({ label, value, onChange }: MeterFieldProps) {
  return (
    <label className="space-y-1 text-sm text-neutral-700">
      <span>{label}</span>
      <input
        type="number"
        min="0"
        step="0.01"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-coffee-primary"
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
    <div className="space-y-1">
      <div className="text-xs font-semibold uppercase tracking-wide text-neutral-500">{title}</div>
      {children}
    </div>
  );
}


