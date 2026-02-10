"use client";

import { FormEvent, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import type { Stage } from "@/lib/domain/movement";
import type { Pattern } from "@/lib/domain/pattern";
import {
  patternsLocalRepo,
  type PatternMetersTarget,
  type UpsertPatternFromFormPayload,
} from "@/lib/repos/patternsLocalRepo";

type Props = {
  pattern: Pattern;
  onClose: () => void;
  onSave: (pattern: Pattern) => void;
};

const fieldLabels: Record<string, string> = {
  fabricCode: "Kumaş Kodu",
  fabricName: "Kumaş Adı",
  weaveType: "Dokuma Tipi",
  warpCount: "Çözgü Sayısı",
  weftCount: "Atkı Sayısı",
  totalEnds: "Toplam Tel",
};

const stageOptions: Stage[] = ["DOKUMA", "BOYAHANE", "DEPO"];

const stageLabel: Record<Stage, string> = {
  DOKUMA: "Dokuma",
  BOYAHANE: "Boyahane",
  DEPO: "Depo",
};

const metersTargetLabel: Record<PatternMetersTarget, string> = {
  AUTO: "AUTO",
  URETIM: "URETIM",
  STOK: "STOK",
  BOYAHANE: "BOYAHANE",
  HATALI: "HATALI",
};

type CountAndYarn = {
  count: string;
  yarn: string;
};

const parseCountAndYarn = (value: string): CountAndYarn => {
  const trimmed = value.trim();
  if (!trimmed) return { count: "", yarn: "" };

  const slashIndex = trimmed.indexOf("/");
  if (slashIndex > 0 && slashIndex < trimmed.length - 1) {
    return {
      count: trimmed.slice(0, slashIndex).trim(),
      yarn: trimmed.slice(slashIndex + 1).trim(),
    };
  }

  const firstSpaceIndex = trimmed.indexOf(" ");
  if (firstSpaceIndex > 0 && firstSpaceIndex < trimmed.length - 1) {
    return {
      count: trimmed.slice(0, firstSpaceIndex).trim(),
      yarn: trimmed.slice(firstSpaceIndex + 1).trim(),
    };
  }

  return { count: trimmed, yarn: "" };
};

const composeCountAndYarn = (count: string, yarn: string) => {
  const countValue = count.trim();
  const yarnValue = yarn.trim();
  if (countValue && yarnValue) return `${countValue}/${yarnValue}`;
  if (countValue) return countValue;
  if (yarnValue) return yarnValue;
  return "";
};

export function PatternModal({ pattern, onClose, onSave }: Props) {
  const initialWarp = parseCountAndYarn(pattern.warpCount);
  const initialWeft = parseCountAndYarn(pattern.weftCount);
  const [mounted, setMounted] = useState(false);
  const [fabricCode, setFabricCode] = useState(pattern.fabricCode);
  const [fabricName, setFabricName] = useState(pattern.fabricName);
  const [weaveType, setWeaveType] = useState(pattern.weaveType);
  const [warpCountValue, setWarpCountValue] = useState(initialWarp.count);
  const [warpYarnValue, setWarpYarnValue] = useState(initialWarp.yarn);
  const [weftCountValue, setWeftCountValue] = useState(initialWeft.count);
  const [weftYarnValue, setWeftYarnValue] = useState(initialWeft.yarn);
  const [totalEnds, setTotalEnds] = useState(pattern.totalEnds);
  const [currentStage, setCurrentStage] = useState<Stage>(pattern.currentStage);
  const [metersToAdd, setMetersToAdd] = useState<string>("");
  const [metersTarget, setMetersTarget] = useState<PatternMetersTarget>("AUTO");
  const [error, setError] = useState("");

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [mounted]);

  useEffect(() => {
    if (!mounted) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [mounted, onClose]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");

    const warpCount = composeCountAndYarn(warpCountValue, warpYarnValue);
    const weftCount = composeCountAndYarn(weftCountValue, weftYarnValue);
    const requiredFields = { fabricCode, fabricName, weaveType, warpCount, weftCount, totalEnds };
    const missing = Object.entries(requiredFields).find(([, value]) => !value.trim());
    if (missing) {
      const [key] = missing;
      setError(`${fieldLabels[key]} boş olamaz.`);
      return;
    }

    const metersRaw = metersToAdd.trim();
    let parsedMeters: number | undefined;
    if (metersRaw) {
      const numeric = Number(metersRaw.replace(",", "."));
      if (!Number.isFinite(numeric) || numeric < 0) {
        setError("Eklenecek metre 0 veya daha büyük bir sayı olmalı.");
        return;
      }
      parsedMeters = numeric;
    }

    const payload: UpsertPatternFromFormPayload = {
      fabricCode: fabricCode.trim(),
      fabricName: fabricName.trim(),
      weaveType: weaveType.trim(),
      warpCount: warpCount.trim(),
      weftCount: weftCount.trim(),
      totalEnds: totalEnds.trim(),
      currentStage,
      metersToAdd: parsedMeters,
      metersTarget,
    };

    const savedPattern = patternsLocalRepo.upsertPatternFromForm(payload);
    onSave(savedPattern);
    onClose();
  };

  if (!mounted) return null;

  const overlay = (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 px-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl max-h-[85vh] overflow-auto rounded-2xl bg-white p-6 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h2 className="text-lg font-semibold text-neutral-900">Desen Bilgilerini Güncelle</h2>
            <p className="text-sm text-neutral-500">Aynı kumaş kodu tekrar kaydedilirse mevcut desen güncellenir.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-sm text-neutral-500 hover:bg-neutral-100"
          >
            Kapat
          </button>
        </div>

        <form className="space-y-3" onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <TextField label="Kumaş Kodu" value={fabricCode} onChange={setFabricCode} required />
            <TextField label="Kumaş Adı" value={fabricName} onChange={setFabricName} required />
            <TextField label="Dokuma Tipi" value={weaveType} onChange={setWeaveType} required />
            <CountYarnField
              label="Çözgü"
              countValue={warpCountValue}
              yarnValue={warpYarnValue}
              onCountChange={setWarpCountValue}
              onYarnChange={setWarpYarnValue}
            />
            <CountYarnField
              label="Atkı"
              countValue={weftCountValue}
              yarnValue={weftYarnValue}
              onCountChange={setWeftCountValue}
              onYarnChange={setWeftYarnValue}
            />
            <TextField label="Toplam Tel" value={totalEnds} onChange={setTotalEnds} required />
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <label className="space-y-1 text-sm text-neutral-700">
              <span>Aşama</span>
              <select
                value={currentStage}
                onChange={(event) => setCurrentStage(event.target.value as Stage)}
                className="w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-coffee-primary"
              >
                {stageOptions.map((stage) => (
                  <option key={stage} value={stage}>
                    {stageLabel[stage]}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-1 text-sm text-neutral-700">
              <span>Eklenecek Metre (opsiyonel)</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={metersToAdd}
                onChange={(event) => setMetersToAdd(event.target.value)}
                placeholder="0"
                className="w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-coffee-primary"
              />
            </label>

            <label className="space-y-1 text-sm text-neutral-700">
              <span>Metre Hedefi</span>
              <select
                value={metersTarget}
                onChange={(event) => setMetersTarget(event.target.value as PatternMetersTarget)}
                className="w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-coffee-primary"
              >
                {(Object.keys(metersTargetLabel) as PatternMetersTarget[]).map((target) => (
                  <option key={target} value={target}>
                    {metersTargetLabel[target]}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-3 py-2 text-sm text-neutral-600 hover:bg-neutral-100"
            >
              İptal
            </button>
            <button
              type="submit"
              className="rounded-lg bg-coffee-primary px-4 py-2 text-sm font-semibold text-white hover:bg-coffee-primary/90"
            >
              Kaydet
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  return createPortal(overlay, document.body);
}

type CountYarnFieldProps = {
  label: string;
  countValue: string;
  yarnValue: string;
  onCountChange: (value: string) => void;
  onYarnChange: (value: string) => void;
};

function CountYarnField({
  label,
  countValue,
  yarnValue,
  onCountChange,
  onYarnChange,
}: CountYarnFieldProps) {
  return (
    <label className="space-y-1 text-sm text-neutral-700">
      <span>{label}</span>
      <div className="grid grid-cols-2 gap-2">
        <input
          type="text"
          value={countValue}
          onChange={(event) => onCountChange(event.target.value)}
          placeholder="Sayı"
          className="w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-coffee-primary"
        />
        <input
          type="text"
          value={yarnValue}
          onChange={(event) => onYarnChange(event.target.value)}
          placeholder="İplik"
          className="w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-coffee-primary"
        />
      </div>
    </label>
  );
}

type TextFieldProps = {
  label: string;
  value: string;
  required?: boolean;
  onChange: (value: string) => void;
};

function TextField({ label, value, onChange, required }: TextFieldProps) {
  return (
    <label className="space-y-1 text-sm text-neutral-700">
      <span>{label}</span>
      <input
        type="text"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        required={required}
        className="w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-coffee-primary"
      />
    </label>
  );
}
