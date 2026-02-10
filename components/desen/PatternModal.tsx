"use client";

import { FormEvent, useState } from "react";
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

export function PatternModal({ pattern, onClose, onSave }: Props) {
  const [fabricCode, setFabricCode] = useState(pattern.fabricCode);
  const [fabricName, setFabricName] = useState(pattern.fabricName);
  const [weaveType, setWeaveType] = useState(pattern.weaveType);
  const [warpCount, setWarpCount] = useState(pattern.warpCount);
  const [weftCount, setWeftCount] = useState(pattern.weftCount);
  const [totalEnds, setTotalEnds] = useState(pattern.totalEnds);
  const [currentStage, setCurrentStage] = useState<Stage>(pattern.currentStage);
  const [metersToAdd, setMetersToAdd] = useState<string>("");
  const [metersTarget, setMetersTarget] = useState<PatternMetersTarget>("AUTO");
  const [error, setError] = useState("");

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");

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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-xl rounded-2xl bg-white p-6 shadow-2xl">
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
            <TextField label="Çözgü Sayısı" value={warpCount} onChange={setWarpCount} required />
            <TextField label="Atkı Sayısı" value={weftCount} onChange={setWeftCount} required />
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
