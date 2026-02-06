import { Pattern } from "@/lib/domain/pattern";
import { patternsRepo } from "@/lib/repos/patternsRepo";

const STORAGE_KEY = "patterns:overrides";

type PatternPatch = Partial<Pattern> & { id?: string };

// ✅ SSR / build güvenliği
const canUseStorage = () =>
  typeof window !== "undefined" && typeof window.localStorage !== "undefined";

// ✅ güvenli JSON parse
const safeParse = <T,>(raw: string | null, fallback: T): T => {
  if (!raw) return fallback;
  try {
    const parsed = JSON.parse(raw) as T;
    // basic sanity check (object beklediğimiz yerlerde)
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
};

const readOverrides = (): Record<string, PatternPatch> => {
  if (!canUseStorage()) return {};
  const raw = window.localStorage.getItem(STORAGE_KEY);

  const parsed = safeParse<Record<string, PatternPatch>>(raw, {});
  return parsed && typeof parsed === "object" ? parsed : {};
};

const writeOverrides = (overrides: Record<string, PatternPatch>) => {
  if (!canUseStorage()) return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(overrides));
};

const mergePatterns = (overrides: Record<string, PatternPatch>): Pattern[] => {
  const base = patternsRepo.list();

  const merged = base.map((pattern) => ({
    ...pattern,
    ...(overrides[pattern.id] ?? {}),
  }));

  // overrides içinde olup base’de olmayan “tam” pattern’leri ekle
  Object.entries(overrides).forEach(([id, override]) => {
    const alreadyExists = merged.some((item) => item.id === id);

    const isComplete =
      !!override &&
      !!override.fabricCode &&
      !!override.fabricName &&
      !!override.weaveType &&
      !!override.warpCount &&
      !!override.weftCount &&
      !!override.totalEnds &&
      !!override.currentStage &&
      typeof override.totalProducedMeters === "number" &&
      typeof override.stockMeters === "number" &&
      typeof override.defectMeters === "number" &&
      typeof override.inDyehouseMeters === "number";

    if (!alreadyExists && isComplete) {
      merged.push(override as Pattern);
    }
  });

  return merged;
};

export const patternsLocalRepo = {
  list(): Pattern[] {
    const overrides = readOverrides();
    return mergePatterns(overrides);
  },

  get(id: string): Pattern | undefined {
    return this.list().find((pattern) => pattern.id === id);
  },

  update(id: string, patch: PatternPatch): Pattern | undefined {
    const overrides = readOverrides();
    const currentBase = patternsRepo.get(id);
    const currentOverride = overrides[id] ?? {};

    const next: Pattern = {
      ...(currentBase ?? (currentOverride as Pattern)),
      ...currentOverride,
      ...patch,
      id,
    } as Pattern;

    overrides[id] = next;
    writeOverrides(overrides);

    return this.get(id);
  },

  add(pattern: Pattern): Pattern {
    const overrides = readOverrides();
    overrides[pattern.id] = pattern;
    writeOverrides(overrides);
    return pattern;
  },

  // ✅ lazım olursa debug/temizleme
  clear() {
    if (!canUseStorage()) return;
    window.localStorage.removeItem(STORAGE_KEY);
  },
};
