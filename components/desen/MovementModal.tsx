"use client";

import { FormEvent, useMemo, useState } from "react";
import { Movement, MovementType, Stage } from "@/lib/domain/movement";
import { Variant } from "@/lib/domain/pattern";
import { movementsLocalRepo } from "@/lib/repos/movementsLocalRepo";
import { patternsLocalRepo } from "@/lib/repos/patternsLocalRepo";

type Props = {
  patternId: string;
  variants: Variant[];
  onClose: () => void;
  onSaved: (movement: Movement) => void;
};

const todayISO = () => new Date().toISOString().slice(0, 10);

const generateId = () => {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `m-${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const shouldUpdateStage = (stage: Stage, type: MovementType) => {
  if (stage === "DOKUMA" && type === "OUT") return true;
  if (stage === "BOYAHANE" && type === "IN") return true;
  if (stage === "DEPO" && type === "IN") return true;
  return false;
};

export function MovementModal({ patternId, variants, onClose, onSaved }: Props) {
  const [stage, setStage] = useState<Stage>("DEPO");
  const [type, setType] = useState<MovementType>("IN");
  const [variantId, setVariantId] = useState<string>("GENEL");
  const [meters, setMeters] = useState<number>(0);
  const [date, setDate] = useState<string>(todayISO());
  const [note, setNote] = useState<string>("");
  const [error, setError] = useState<string>("");

  const variantOptions = useMemo(
    () => [{ id: "GENEL", name: "GENEL", active: true }, ...variants],
    [variants]
  );

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");

    if (meters <= 0 || Number.isNaN(meters)) {
      setError("Metre bilgisi 0'dan büyük olmalı");
      return;
    }

    const movement: Movement = {
      id: generateId(),
      patternId,
      variantId: variantId === "GENEL" ? undefined : variantId,
      stage,
      type,
      meters,
      date,
      note: note.trim() || undefined,
    };

    movementsLocalRepo.add(patternId, movement);
    if (shouldUpdateStage(stage, type)) {
      patternsLocalRepo.update(patternId, { currentStage: stage });
    }
    onSaved(movement);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h2 className="text-lg font-semibold text-neutral-900">Hareket Ekle</h2>
            <p className="text-sm text-neutral-500">Metre hareketini kaydedin</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-sm text-neutral-500 hover:bg-neutral-100"
          >
            Kapat
          </button>
        </div>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="grid grid-cols-2 gap-3">
            <label className="space-y-1 text-sm text-neutral-700">
              <span>Aşama</span>
              <select
                value={stage}
                onChange={(event) => setStage(event.target.value as Stage)}
                className="w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-coffee-primary"
              >
                <option value="DEPO">DEPO</option>
                <option value="BOYAHANE">BOYAHANE</option>
                <option value="DOKUMA">DOKUMA</option>
              </select>
            </label>
            <label className="space-y-1 text-sm text-neutral-700">
              <span>Tip</span>
              <select
                value={type}
                onChange={(event) => setType(event.target.value as MovementType)}
                className="w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-coffee-primary"
              >
                <option value="IN">Giriş</option>
                <option value="OUT">Çıkış</option>
              </select>
            </label>
          </div>

          <label className="space-y-1 text-sm text-neutral-700">
            <span>Varyant</span>
            <select
              value={variantId}
              onChange={(event) => setVariantId(event.target.value)}
              className="w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-coffee-primary"
            >
              {variantOptions.map((variant) => (
                <option key={variant.id} value={variant.id}>
                  {variant.name}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-1 text-sm text-neutral-700">
            <span>Metre</span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={meters}
              onChange={(event) => setMeters(Number(event.target.value))}
              className="w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-coffee-primary"
              placeholder="0"
              required
            />
          </label>

          <label className="space-y-1 text-sm text-neutral-700">
            <span>Tarih</span>
            <input
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
              className="w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-coffee-primary"
              required
            />
          </label>

          <label className="space-y-1 text-sm text-neutral-700">
            <span>Not (isteğe bağlı)</span>
            <input
              type="text"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              className="w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-coffee-primary"
              placeholder="Kısa not"
            />
          </label>

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
