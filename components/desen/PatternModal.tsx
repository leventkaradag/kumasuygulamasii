"use client";

import { FormEvent, useState } from "react";
import { Pattern } from "@/lib/domain/pattern";

type Props = {
  pattern: Pattern;
  onClose: () => void;
  onSave: (payload: Pick<Pattern, "fabricCode" | "fabricName" | "weaveType" | "warpCount" | "weftCount" | "totalEnds">) => void;
};

const fieldLabels: Record<string, string> = {
  fabricCode: "Kumaş Kodu",
  fabricName: "Kumaş Adı",
  weaveType: "Dokuma Tipi",
  warpCount: "Çözgü Sayısı",
  weftCount: "Atkı Sayısı",
  totalEnds: "Toplam Tel",
};

export function PatternModal({ pattern, onClose, onSave }: Props) {
  const [fabricCode, setFabricCode] = useState(pattern.fabricCode);
  const [fabricName, setFabricName] = useState(pattern.fabricName);
  const [weaveType, setWeaveType] = useState(pattern.weaveType);
  const [warpCount, setWarpCount] = useState(pattern.warpCount);
  const [weftCount, setWeftCount] = useState(pattern.weftCount);
  const [totalEnds, setTotalEnds] = useState(pattern.totalEnds);
  const [error, setError] = useState("");

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const fields = { fabricCode, fabricName, weaveType, warpCount, weftCount, totalEnds };

    const missing = Object.entries(fields).find(([, value]) => !value.trim());
    if (missing) {
      const [key] = missing;
      setError(`${fieldLabels[key]} boş olamaz.`);
      return;
    }

    onSave(fields);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-xl rounded-2xl bg-white p-6 shadow-2xl">
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h2 className="text-lg font-semibold text-neutral-900">Desen Bilgilerini Güncelle</h2>
            <p className="text-sm text-neutral-500">Ana alanları ayrı ayrı doldurun</p>
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
