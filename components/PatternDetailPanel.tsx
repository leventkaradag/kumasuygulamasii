"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Image as ImageIcon, ImageOff, Layers, Package, Palette, Sparkles } from "lucide-react";
import { Accordion } from "@/components/Accordion";
import { ImagePicker } from "@/components/ImagePicker";
import { cn } from "@/lib/cn";
import type { Pattern } from "@/lib/domain/pattern";
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

const stageLabel: Record<string, string> = {
  DEPO: "Depo",
  BOYAHANE: "Boyahane",
  DOKUMA: "Dokuma",
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

  const resetNoteStatusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const resetImageStatusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const resetMetersStatusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const resetArchiveStatusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  const variantCount = pattern.variants?.length ?? 0;

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

  const handleArchive = () => {
    if (archiveStatus === "saving") return;

    if (resetArchiveStatusTimerRef.current) {
      clearTimeout(resetArchiveStatusTimerRef.current);
      resetArchiveStatusTimerRef.current = null;
    }

    setArchiveStatus("saving");

    const updated = patternsLocalRepo.update(pattern.id, { archived: true });
    onPatternUpdated?.(updated);
    setArchiveStatus("saved");

    resetArchiveStatusTimerRef.current = setTimeout(() => {
      setArchiveStatus("idle");
      resetArchiveStatusTimerRef.current = null;
    }, 1200);
  };

  const handleUnarchive = () => {
    if (archiveStatus === "saving") return;

    if (resetArchiveStatusTimerRef.current) {
      clearTimeout(resetArchiveStatusTimerRef.current);
      resetArchiveStatusTimerRef.current = null;
    }

    setArchiveStatus("saving");

    const updated = patternsLocalRepo.update(pattern.id, { archived: false });
    onPatternUpdated?.(updated);
    setArchiveStatus("saved");

    resetArchiveStatusTimerRef.current = setTimeout(() => {
      setArchiveStatus("idle");
      resetArchiveStatusTimerRef.current = null;
    }, 1200);
  };

  const handlePermanentRemove = () => {
    if (archiveStatus === "saving") return;
    const accepted = window.confirm("Bu desen kalıcı olarak silinecek. Emin misin?");
    if (!accepted) return;

    if (resetArchiveStatusTimerRef.current) {
      clearTimeout(resetArchiveStatusTimerRef.current);
      resetArchiveStatusTimerRef.current = null;
    }

    setArchiveStatus("saving");
    patternsLocalRepo.remove(pattern.id);
    onPatternUpdated?.();
    setArchiveStatus("saved");

    resetArchiveStatusTimerRef.current = setTimeout(() => {
      setArchiveStatus("idle");
      resetArchiveStatusTimerRef.current = null;
    }, 1200);
  };

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
          {showArchived && pattern.archived ? (
            <>
              <button
                type="button"
                onClick={handleUnarchive}
                className="rounded-lg border border-emerald-500/50 bg-emerald-50 px-3 py-1.5 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-100"
              >
                Arşivden Çıkar
              </button>
              <button
                type="button"
                onClick={handlePermanentRemove}
                className="rounded-lg border border-red-500/40 bg-red-50 px-3 py-1.5 text-sm font-semibold text-red-700 transition hover:bg-red-100"
              >
                Kalıcı Sil
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={handleArchive}
              className="rounded-lg border border-black/10 bg-white px-3 py-1.5 text-sm font-semibold text-neutral-700 transition hover:border-coffee-primary/40"
            >
              Kaldır
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
            <p className="text-sm text-neutral-600">Toplam {variantCount} varyant</p>
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
