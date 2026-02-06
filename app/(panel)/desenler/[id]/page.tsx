"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Movement, Stage } from "@/lib/domain/movement";
import { Pattern } from "@/lib/domain/pattern";
import { movementsLocalRepo } from "@/lib/repos/movementsLocalRepo";
import { patternsLocalRepo } from "@/lib/repos/patternsLocalRepo";
import { MovementModal } from "@/components/desen/MovementModal";

type StageStock = Record<Stage, number>;

const emptyStageStock = (): StageStock => ({
  DEPO: 0,
  BOYAHANE: 0,
  DOKUMA: 0,
});

const stageLabels: Record<Stage, string> = {
  DEPO: "Depo",
  BOYAHANE: "Boyahane",
  DOKUMA: "Dokuma",
};

export default function PatternDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const patternId = params?.id;

  const [pattern, setPattern] = useState<Pattern | null>(null);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    if (!patternId) return;
    const found = patternsLocalRepo.get(patternId) ?? null;
    setPattern(found);
    setMovements(movementsLocalRepo.list(patternId));
  }, [patternId]);

  const stageStock = useMemo(() => {
    return movements.reduce<StageStock>((acc, movement) => {
      const delta = movement.type === "IN" ? movement.meters : -movement.meters;
      acc[movement.stage] += delta;
      return acc;
    }, emptyStageStock());
  }, [movements]);

  const variantStock = useMemo(() => {
    const map = new Map<
      string,
      {
        name: string;
        stock: StageStock;
      }
    >();

    movements.forEach((movement) => {
      const key = movement.variantId ?? "GENEL";
      const displayName =
        key === "GENEL"
          ? "GENEL"
          : pattern?.variants.find((variant) => variant.id === key)?.name ?? key;

      if (!map.has(key)) {
        map.set(key, { name: displayName, stock: emptyStageStock() });
      }

      const delta = movement.type === "IN" ? movement.meters : -movement.meters;
      const current = map.get(key)!;
      current.stock[movement.stage] += delta;
    });

    return Array.from(map.entries());
  }, [movements, pattern?.variants]);

  const recentMovements = useMemo(
    () =>
      [...movements]
        .sort(
          (a, b) =>
            new Date(b.date).getTime() -
            new Date(a.date).getTime()
        )
        .slice(0, 10),
    [movements]
  );

  const handleSaved = () => {
    if (!patternId) return;
    setMovements(movementsLocalRepo.list(patternId));
    setPattern(patternsLocalRepo.get(patternId) ?? null);
  };

  if (!patternId) {
    return (
      <div className="p-6">
        <p className="text-sm text-neutral-600">Geçersiz desen adresi.</p>
      </div>
    );
  }

  if (!pattern) {
    return (
      <div className="p-6">
        <div className="rounded-lg border border-dashed border-neutral-300 bg-white p-6">
          <p className="text-sm text-neutral-700">Desen bulunamadı.</p>
          <button
            type="button"
            onClick={() => router.push("/desenler")}
            className="mt-3 rounded-md bg-coffee-primary px-3 py-2 text-sm font-medium text-white"
          >
            Listeye dön
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 bg-coffee-surface p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-neutral-900">
            {pattern.fabricCode} · {pattern.fabricName}
          </h1>
          <p className="text-sm text-neutral-600">Hareket ve stok takibi</p>
          <span className="mt-1 inline-flex rounded-full bg-neutral-200 px-2 py-0.5 text-xs font-semibold text-neutral-700">
            {stageLabels[pattern.currentStage]}
          </span>
        </div>
        <button
          type="button"
          onClick={() => setShowModal(true)}
          className="rounded-lg bg-coffee-primary px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-coffee-primary/90"
        >
          Hareket Ekle
        </button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {(["DEPO", "BOYAHANE", "DOKUMA"] as Stage[]).map((stage) => (
          <div
            key={stage}
            className="rounded-2xl border border-black/5 bg-white p-4 shadow-[0_10px_20px_rgba(0,0,0,0.05)]"
          >
            <p className="text-xs font-medium uppercase text-neutral-500">
              {stageLabels[stage]}
            </p>
            <p className="mt-2 text-2xl font-semibold text-neutral-900">
              {stageStock[stage].toLocaleString("tr-TR")} m
            </p>
            <p className="text-xs text-neutral-500">Net metraj</p>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-black/5 bg-white p-4 shadow-[0_10px_20px_rgba(0,0,0,0.05)]">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-neutral-900">Hareketler</h2>
          <p className="text-xs text-neutral-500">Son 10 kayıt</p>
        </div>
        <div className="mt-3 divide-y divide-black/5">
          {recentMovements.map((movement) => (
            <div
              key={movement.id}
              className="flex items-start justify-between gap-3 py-3 text-sm"
            >
              <div>
                <p className="font-medium text-neutral-900">
                  {stageLabels[movement.stage]} · {movement.type === "IN" ? "Giriş" : "Çıkış"}
                </p>
                <p className="text-xs text-neutral-500">
                  {movement.variantId
                    ? pattern.variants.find((variant) => variant.id === movement.variantId)?.name ??
                      movement.variantId
                    : "GENEL"}
                </p>
                {movement.note && <p className="text-xs text-neutral-500">{movement.note}</p>}
              </div>
              <div className="text-right">
                <p className="font-semibold text-neutral-900">
                  {movement.type === "OUT" ? "-" : "+"}
                  {movement.meters.toLocaleString("tr-TR")} m
                </p>
                <p className="text-xs text-neutral-500">
                  {new Date(movement.date).toLocaleDateString("tr-TR")}
                </p>
              </div>
            </div>
          ))}
          {recentMovements.length === 0 && (
            <div className="py-6 text-center text-sm text-neutral-500">
              Henüz hareket yok.
            </div>
          )}
        </div>
      </div>

      <details className="rounded-2xl border border-black/5 bg-white p-4 shadow-[0_10px_20px_rgba(0,0,0,0.05)]">
        <summary className="cursor-pointer text-base font-semibold text-neutral-900">
          Varyant stok detayı
        </summary>
        <div className="mt-3 space-y-3">
          {variantStock.map(([variantId, entry]) => (
            <div
              key={variantId}
              className="rounded-xl border border-black/5 bg-neutral-50 p-3 text-sm"
            >
              <div className="mb-2 flex items-center justify-between">
                <p className="font-medium text-neutral-900">{entry.name}</p>
                <span className="text-xs text-neutral-500">{variantId === "GENEL" ? "" : variantId}</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {(["DEPO", "BOYAHANE", "DOKUMA"] as Stage[]).map((stage) => (
                  <div key={stage} className="rounded-lg bg-white p-2 shadow-sm">
                    <p className="text-[11px] font-medium uppercase text-neutral-500">
                      {stageLabels[stage]}
                    </p>
                    <p className="text-sm font-semibold text-neutral-900">
                      {entry.stock[stage].toLocaleString("tr-TR")} m
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ))}
          {variantStock.length === 0 && (
            <p className="text-sm text-neutral-500">Varyant stoğu için hareket ekleyin.</p>
          )}
        </div>
      </details>

      {showModal && (
        <MovementModal
          patternId={pattern.id}
          variants={pattern.variants}
          onClose={() => setShowModal(false)}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
}
