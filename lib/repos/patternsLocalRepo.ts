"use client";

import type { Stage } from "@/lib/domain/movement";
import type { Pattern } from "@/lib/domain/pattern";
import { patternsRepo } from "@/lib/repos/patternsRepo";

const STORAGE_KEY = "patterns:overrides";

type PatternPatch = Partial<Pattern> & { id?: string; __deleted?: boolean };

export type PatternMetersTarget = "AUTO" | "URETIM" | "STOK" | "BOYAHANE" | "HATALI";

export type UpsertPatternFromFormPayload = Pick<
  Pattern,
  "fabricCode" | "fabricName" | "weaveType" | "warpCount" | "weftCount" | "totalEnds"
> & {
  currentStage?: Stage;
  tarakEniCm?: number | null;
  color?: string;
  imageDigital?: string | null;
  imageFinal?: string | null;
  metersToAdd?: number;
  metersTarget?: PatternMetersTarget;
};

const canUseStorage = () =>
  typeof window !== "undefined" && typeof window.localStorage !== "undefined";

const safeParse = <T,>(raw: string | null, fallback: T): T => {
  if (!raw) return fallback;
  try {
    const parsed = JSON.parse(raw) as T;
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

const isDeletedOverride = (override?: PatternPatch) => !!override?.__deleted;

const isCompletePattern = (override: PatternPatch): override is Pattern => {
  return (
    !!override &&
    typeof override.createdAt === "string" &&
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
    typeof override.inDyehouseMeters === "number" &&
    Array.isArray(override.variants)
  );
};

const normalizeText = (value: string) => value.trim();
const normalizeOptionalText = (value?: string | null) => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
};
const normalizeImage = (value?: string | null) => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
};

const normalizePartiNos = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
};

const normalizeCreatedAt = (value?: string): string => {
  if (!value) return new Date().toISOString();
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return new Date().toISOString();
  return parsed.toISOString();
};

const withPatternDefaults = (pattern: Pattern): Pattern => ({
  ...pattern,
  createdAt: normalizeCreatedAt(pattern.createdAt),
  partiNos: normalizePartiNos(pattern.partiNos),
  color: normalizeOptionalText(pattern.color),
  imageDigital: normalizeImage(pattern.imageDigital ?? pattern.digitalImageUrl),
  imageFinal: normalizeImage(pattern.imageFinal ?? pattern.finalImageUrl),
  digitalImageUrl: normalizeOptionalText(pattern.digitalImageUrl ?? pattern.imageDigital),
  finalImageUrl: normalizeOptionalText(pattern.finalImageUrl ?? pattern.imageFinal),
});

const normalizeMeters = (value?: number) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : 0;
};

const normalizeOptionalDimension = (
  value?: number | null
): number | null | undefined => {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 0) return null;
  return numeric;
};

const resolveMetersTarget = (
  target: PatternMetersTarget,
  stage: Stage
): Exclude<PatternMetersTarget, "AUTO"> => {
  if (target !== "AUTO") return target;
  if (stage === "DOKUMA") return "URETIM";
  if (stage === "BOYAHANE") return "BOYAHANE";
  return "STOK";
};

const incrementMeters = (
  pattern: Pattern,
  target: Exclude<PatternMetersTarget, "AUTO">,
  metersToAdd: number
): Pattern => {
  if (metersToAdd <= 0) return pattern;

  if (target === "URETIM") {
    return { ...pattern, totalProducedMeters: pattern.totalProducedMeters + metersToAdd };
  }

  if (target === "STOK") {
    return { ...pattern, stockMeters: pattern.stockMeters + metersToAdd };
  }

  if (target === "BOYAHANE") {
    return { ...pattern, inDyehouseMeters: pattern.inDyehouseMeters + metersToAdd };
  }

  return { ...pattern, defectMeters: pattern.defectMeters + metersToAdd };
};

const mergePatterns = (base: Pattern[], overrides: Record<string, PatternPatch>): Pattern[] => {
  const deletedIds = new Set<string>();
  const deletedFabricCodes = new Set<string>();

  Object.entries(overrides).forEach(([key, override]) => {
    if (!isDeletedOverride(override)) return;
    const deletedId = normalizeText(`${override?.id ?? key}`);
    const deletedCode = normalizeText(override?.fabricCode ?? "");
    if (deletedId) deletedIds.add(deletedId);
    if (deletedCode) deletedFabricCodes.add(deletedCode);
  });

  const merged = base
    .filter(
      (pattern) =>
        !deletedIds.has(pattern.id) &&
        !deletedIds.has(pattern.fabricCode) &&
        !deletedFabricCodes.has(pattern.id) &&
        !deletedFabricCodes.has(pattern.fabricCode)
    )
    .map((pattern) => ({
    ...pattern,
    ...(overrides[pattern.id] ?? {}),
  }));

  Object.entries(overrides).forEach(([key, override]) => {
    if (!override || isDeletedOverride(override)) return;

    const overrideId = normalizeText(`${override.id ?? key}`);
    const overrideFabricCode = normalizeText(override.fabricCode ?? "");

    const byIdIndex = merged.findIndex((item) => item.id === overrideId);
    const byCodeIndex = overrideFabricCode
      ? merged.findIndex((item) => item.fabricCode === overrideFabricCode)
      : -1;
    const targetIndex = byIdIndex >= 0 ? byIdIndex : byCodeIndex;

    if (targetIndex >= 0) {
      merged[targetIndex] = {
        ...merged[targetIndex],
        ...override,
        id: overrideId || merged[targetIndex].id,
        fabricCode: overrideFabricCode || merged[targetIndex].fabricCode,
      } as Pattern;
      return;
    }

    if (!isCompletePattern(override)) return;

    merged.push({
      ...override,
      id: overrideId || override.fabricCode,
      fabricCode: overrideFabricCode || override.fabricCode,
    });
  });

  return merged.map(withPatternDefaults);
};

const buildNewPattern = (payload: UpsertPatternFromFormPayload): Pattern => {
  const fabricCode = normalizeText(payload.fabricCode);
  const currentStage = payload.currentStage ?? "DEPO";
  const tarakEniCm = normalizeOptionalDimension(payload.tarakEniCm);

  return {
    id: fabricCode,
    createdAt: new Date().toISOString(),
    fabricCode,
    fabricName: normalizeText(payload.fabricName),
    weaveType: normalizeText(payload.weaveType),
    warpCount: normalizeText(payload.warpCount),
    weftCount: normalizeText(payload.weftCount),
    totalEnds: normalizeText(payload.totalEnds),
    variants: [],
    partiNos: [],
    currentStage,
    totalProducedMeters: 0,
    stockMeters: 0,
    defectMeters: 0,
    inDyehouseMeters: 0,
    tarakEniCm: tarakEniCm ?? null,
    color: normalizeOptionalText(payload.color),
    imageDigital: normalizeImage(payload.imageDigital),
    imageFinal: normalizeImage(payload.imageFinal),
    digitalImageUrl: normalizeOptionalText(payload.imageDigital),
    finalImageUrl: normalizeOptionalText(payload.imageFinal),
  };
};

const removeExistingFabricCodeOverrides = (
  overrides: Record<string, PatternPatch>,
  fabricCode: string
) => {
  Object.entries(overrides).forEach(([key, value]) => {
    if (!value) return;
    const candidateId = normalizeText(value.id ?? key);
    const candidateCode = normalizeText(value.fabricCode ?? "");
    if (candidateId === fabricCode || candidateCode === fabricCode) {
      delete overrides[key];
    }
  });
};

const removeExistingPatternOverrides = (
  overrides: Record<string, PatternPatch>,
  id: string,
  fabricCode?: string
) => {
  const normalizedId = normalizeText(id);
  const normalizedCode = normalizeText(fabricCode ?? "");

  Object.entries(overrides).forEach(([key, value]) => {
    if (!value) return;
    const candidateId = normalizeText(value.id ?? key);
    const candidateCode = normalizeText(value.fabricCode ?? "");
    if (
      candidateId === normalizedId ||
      candidateCode === normalizedId ||
      (normalizedCode &&
        (candidateId === normalizedCode || candidateCode === normalizedCode))
    ) {
      delete overrides[key];
    }
  });
};

const upsertWithBaseProvider = (
  baseProvider: { list: () => Pattern[] },
  payload: UpsertPatternFromFormPayload
): Pattern => {
  const fabricCode = normalizeText(payload.fabricCode);
  const fabricName = normalizeText(payload.fabricName);
  const weaveType = normalizeText(payload.weaveType);
  const warpCount = normalizeText(payload.warpCount);
  const weftCount = normalizeText(payload.weftCount);
  const totalEnds = normalizeText(payload.totalEnds);
  const color = normalizeOptionalText(payload.color);
  const imageDigital = normalizeImage(payload.imageDigital);
  const imageFinal = normalizeImage(payload.imageFinal);
  const metersToAdd = normalizeMeters(payload.metersToAdd);
  const tarakEniCm = normalizeOptionalDimension(payload.tarakEniCm);

  const overrides = readOverrides();
  const mergedPatterns = mergePatterns(baseProvider.list(), overrides);
  const existingPattern = mergedPatterns.find(
    (pattern) => pattern.fabricCode === fabricCode || pattern.id === fabricCode
  );
  const currentStage = payload.currentStage ?? existingPattern?.currentStage ?? "DEPO";
  const metersTarget = resolveMetersTarget(payload.metersTarget ?? "AUTO", currentStage);

  const nextBase = existingPattern ?? buildNewPattern(payload);
  const nextPatternBeforeMeters: Pattern = {
    ...nextBase,
    id: fabricCode,
    createdAt: nextBase.createdAt ?? new Date().toISOString(),
    fabricCode,
    fabricName,
    weaveType,
    warpCount,
    weftCount,
    totalEnds,
    currentStage,
    totalProducedMeters: nextBase.totalProducedMeters ?? 0,
    stockMeters: nextBase.stockMeters ?? 0,
    defectMeters: nextBase.defectMeters ?? 0,
    inDyehouseMeters: nextBase.inDyehouseMeters ?? 0,
    variants: nextBase.variants ?? [],
    partiNos: nextBase.partiNos ?? [],
    tarakEniCm:
      payload.tarakEniCm === undefined ? nextBase.tarakEniCm : tarakEniCm,
    color: color ?? nextBase.color,
    imageDigital:
      imageDigital ?? normalizeImage(nextBase.imageDigital ?? nextBase.digitalImageUrl),
    imageFinal: imageFinal ?? normalizeImage(nextBase.imageFinal ?? nextBase.finalImageUrl),
    digitalImageUrl:
      imageDigital ??
      normalizeOptionalText(nextBase.digitalImageUrl ?? nextBase.imageDigital),
    finalImageUrl:
      imageFinal ?? normalizeOptionalText(nextBase.finalImageUrl ?? nextBase.imageFinal),
  };

  const nextPattern = incrementMeters(nextPatternBeforeMeters, metersTarget, metersToAdd);

  if (existingPattern) {
    delete overrides[existingPattern.id];
  }
  removeExistingFabricCodeOverrides(overrides, fabricCode);
  overrides[fabricCode] = nextPattern;
  writeOverrides(overrides);

  return nextPattern;
};

export const createPatternsLocalRepo = (baseProvider: {
  list: () => Pattern[];
  get: (id: string) => Pattern | undefined;
}) => {
  return {
    list(): Pattern[] {
      const overrides = readOverrides();
      return mergePatterns(baseProvider.list(), overrides);
    },

    get(id: string): Pattern | undefined {
      return this.list().find((pattern) => pattern.id === id);
    },

    update(id: string, patch: PatternPatch): Pattern | undefined {
      const overrides = readOverrides();
      const currentBase = baseProvider.get(id);
      const currentOverride = overrides[id] ?? {};

      const next = withPatternDefaults({
        ...(currentBase ?? (currentOverride as Pattern)),
        ...currentOverride,
        ...patch,
        id,
      } as Pattern);

      overrides[id] = next;
      writeOverrides(overrides);

      return this.get(id);
    },

    archivePattern(id: string): Pattern | undefined {
      return this.update(id, { archived: true });
    },

    restorePattern(id: string): Pattern | undefined {
      return this.update(id, { archived: false });
    },

    upsertPatternFromForm(payload: UpsertPatternFromFormPayload): Pattern {
      return upsertWithBaseProvider(baseProvider, payload);
    },

    add(pattern: Pattern): Pattern {
      const nextPattern = withPatternDefaults(pattern);
      const overrides = readOverrides();
      overrides[nextPattern.id] = nextPattern;
      writeOverrides(overrides);
      return nextPattern;
    },

    deletePatternHard(id: string): boolean {
      const overrides = readOverrides();
      const current = this.list().find((pattern) => pattern.id === id);
      const currentFabricCode = current?.fabricCode;

      removeExistingPatternOverrides(overrides, id, currentFabricCode);

      const isSeedPattern = baseProvider
        .list()
        .some((item) => item.id === id || item.fabricCode === id || (currentFabricCode ? item.fabricCode === currentFabricCode : false));

      if (isSeedPattern) {
        const tombstoneId = currentFabricCode || id;
        overrides[tombstoneId] = {
          id: tombstoneId,
          fabricCode: currentFabricCode || id,
          __deleted: true,
        };
      }

      writeOverrides(overrides);
      return true;
    },

    deletePattern(id: string): boolean {
      return this.deletePatternHard(id);
    },

    remove(id: string): boolean {
      return this.deletePattern(id);
    },

    clear() {
      if (!canUseStorage()) return;
      window.localStorage.removeItem(STORAGE_KEY);
    },
  };
};

export const patternsLocalRepo = createPatternsLocalRepo(patternsRepo);

export function upsertPatternFromForm(payload: UpsertPatternFromFormPayload): Pattern {
  return patternsLocalRepo.upsertPatternFromForm(payload);
}
