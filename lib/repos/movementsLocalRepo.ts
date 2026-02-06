import { Movement, Stage } from "@/lib/domain/movement";
import { seedMovements } from "@/mock/movements";

const storageKey = (patternId: string) => `movements:${patternId}`;

const hasWindow = typeof window !== "undefined";

const readLocal = (patternId: string): Movement[] => {
  if (!hasWindow) return [];

  const raw = window.localStorage.getItem(storageKey(patternId));
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw) as Movement[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const writeLocal = (patternId: string, movements: Movement[]) => {
  if (!hasWindow) return;
  window.localStorage.setItem(storageKey(patternId), JSON.stringify(movements));
};

const mergeMovements = (patternId: string): Movement[] => {
  const seeds = seedMovements.filter((movement) => movement.patternId === patternId);
  const locals = readLocal(patternId);

  const byId = new Map<string, Movement>();

  seeds.forEach((movement) => byId.set(movement.id, movement));
  locals.forEach((movement) => byId.set(movement.id, movement));

  return Array.from(byId.values());
};

const applyDelta = (value: number, type: Movement["type"]) => (type === "IN" ? value : -value);

const emptyStock = (): Record<Stage, number> => ({
  DEPO: 0,
  BOYAHANE: 0,
  DOKUMA: 0,
});

export const movementsLocalRepo = {
  list(patternId: string): Movement[] {
    return mergeMovements(patternId);
  },

  add(patternId: string, movement: Movement): Movement {
    if (!hasWindow) return movement;

    const locals = readLocal(patternId).filter((item) => item.id !== movement.id);
    const next = [...locals, movement];
    writeLocal(patternId, next);
    return movement;
  },

  stockByStage(patternId: string): Record<Stage, number> {
    const stock = emptyStock();
    mergeMovements(patternId).forEach((movement) => {
      stock[movement.stage] += applyDelta(movement.meters, movement.type);
    });
    return stock;
  },

  stockByVariant(patternId: string): Map<string, Record<Stage, number>> {
    const stockMap = new Map<string, Record<Stage, number>>();

    mergeMovements(patternId).forEach((movement) => {
      const key = movement.variantId ?? "GENEL";
      if (!stockMap.has(key)) {
        stockMap.set(key, emptyStock());
      }
      const bucket = stockMap.get(key)!;
      bucket[movement.stage] += applyDelta(movement.meters, movement.type);
    });

    return stockMap;
  },
};
