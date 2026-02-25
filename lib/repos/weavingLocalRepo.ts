"use client";

import type { Pattern } from "@/lib/domain/pattern";
import type {
  WeavingPlan,
  WeavingPlanStatus,
  WeavingProgressEntry,
  WeavingTransfer,
  WeavingTransferDestination,
} from "@/lib/domain/weaving";
import { upsertPatternFromForm, patternsLocalRepo } from "@/lib/repos/patternsLocalRepo";

const PLANS_STORAGE_KEY = "weaving:plans";
const PROGRESS_STORAGE_KEY = "weaving:progress";
const TRANSFER_STORAGE_KEY = "weaving:transfers";

const PLAN_STATUSES: WeavingPlanStatus[] = ["ACTIVE", "COMPLETED", "CANCELLED"];
const TRANSFER_DESTINATIONS: WeavingTransferDestination[] = ["DYEHOUSE", "WAREHOUSE"];

type CreatePlanInput = {
  patternId: string;
  patternNoSnapshot: string;
  patternNameSnapshot: string;
  plannedMeters: number;
  createdAt?: string;
  note?: string;
};

type AddTransferInput = {
  planId: string;
  meters: number;
  createdAt?: string;
  destination: WeavingTransferDestination;
  dyehouseId?: string | null;
  dyehouseNameSnapshot?: string | null;
  note?: string;
};

const canUseStorage = () =>
  typeof window !== "undefined" && typeof window.localStorage !== "undefined";

const createId = () => {
  const randomUUID = globalThis.crypto?.randomUUID;
  if (typeof randomUUID === "function") {
    return randomUUID.call(globalThis.crypto);
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const safeParseArray = <T,>(raw: string | null): T[] => {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
};

const normalizeText = (value?: string | null) => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
};

const normalizeRequiredText = (value: string, label: string) => {
  const trimmed = value.trim();
  if (!trimmed) throw new Error(`${label} gerekli.`);
  return trimmed;
};

const toIsoDate = (value: string, label: string) => {
  const trimmed = value.trim();
  if (!trimmed) throw new Error(`${label} gerekli.`);

  const normalized = /^\d{4}-\d{2}-\d{2}$/.test(trimmed)
    ? `${trimmed}T00:00:00`
    : trimmed;

  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`${label} gecersiz.`);
  }
  return parsed.toISOString();
};

const normalizePositiveNumber = (value: number, label: string) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    throw new Error(`${label} 0'dan buyuk olmali.`);
  }
  return numeric;
};

const toTimestamp = (value: string) => {
  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
};

const sortByCreatedDesc = <T extends { createdAt: string }>(rows: T[]) =>
  [...rows].sort((a, b) => toTimestamp(b.createdAt) - toTimestamp(a.createdAt));

const isPlanStatus = (value: unknown): value is WeavingPlanStatus =>
  typeof value === "string" && PLAN_STATUSES.includes(value as WeavingPlanStatus);

const isTransferDestination = (value: unknown): value is WeavingTransferDestination =>
  typeof value === "string" && TRANSFER_DESTINATIONS.includes(value as WeavingTransferDestination);

const normalizeStoredPlan = (input: unknown): WeavingPlan | null => {
  if (!input || typeof input !== "object") return null;
  const raw = input as Partial<WeavingPlan>;

  const patternId = normalizeText(raw.patternId);
  const patternNoSnapshot = normalizeText(raw.patternNoSnapshot);
  const patternNameSnapshot = normalizeText(raw.patternNameSnapshot);
  const plannedMeters =
    typeof raw.plannedMeters === "number" && Number.isFinite(raw.plannedMeters)
      ? raw.plannedMeters
      : Number(raw.plannedMeters);
  if (!patternId || !patternNoSnapshot || !patternNameSnapshot) return null;
  if (!Number.isFinite(plannedMeters) || plannedMeters <= 0) return null;

  const createdAtRaw = normalizeText(raw.createdAt) ?? new Date().toISOString();
  let createdAt: string;
  try {
    createdAt = toIsoDate(createdAtRaw, "createdAt");
  } catch {
    createdAt = new Date().toISOString();
  }

  const manualCompletedRaw = normalizeText(raw.manualCompletedAt ?? undefined);
  let manualCompletedAt: string | null | undefined;
  if (manualCompletedRaw) {
    try {
      manualCompletedAt = toIsoDate(manualCompletedRaw, "manualCompletedAt");
    } catch {
      manualCompletedAt = null;
    }
  } else {
    manualCompletedAt = null;
  }

  return {
    id: normalizeText(raw.id) ?? createId(),
    patternId,
    patternNoSnapshot,
    patternNameSnapshot,
    plannedMeters,
    createdAt,
    note: normalizeText(raw.note),
    status: isPlanStatus(raw.status) ? raw.status : "ACTIVE",
    manualCompletedAt,
  };
};

const normalizeStoredProgress = (input: unknown): WeavingProgressEntry | null => {
  if (!input || typeof input !== "object") return null;
  const raw = input as Partial<WeavingProgressEntry>;

  const planId = normalizeText(raw.planId);
  if (!planId) return null;
  const meters =
    typeof raw.meters === "number" && Number.isFinite(raw.meters)
      ? raw.meters
      : Number(raw.meters);
  if (!Number.isFinite(meters) || meters <= 0) return null;

  const createdAtRaw = normalizeText(raw.createdAt) ?? new Date().toISOString();
  let createdAt: string;
  try {
    createdAt = toIsoDate(createdAtRaw, "createdAt");
  } catch {
    createdAt = new Date().toISOString();
  }

  return {
    id: normalizeText(raw.id) ?? createId(),
    planId,
    createdAt,
    meters,
    note: normalizeText(raw.note),
  };
};

const normalizeStoredTransfer = (input: unknown): WeavingTransfer | null => {
  if (!input || typeof input !== "object") return null;
  const raw = input as Partial<WeavingTransfer> & {
    destination?: string;
    dyehouseId?: string | null;
    dyehouseNameSnapshot?: string | null;
  };

  const planId = normalizeText(raw.planId);
  if (!planId) return null;
  const meters =
    typeof raw.meters === "number" && Number.isFinite(raw.meters)
      ? raw.meters
      : Number(raw.meters);
  if (!Number.isFinite(meters) || meters <= 0) return null;

  const createdAtRaw = normalizeText(raw.createdAt) ?? new Date().toISOString();
  let createdAt: string;
  try {
    createdAt = toIsoDate(createdAtRaw, "createdAt");
  } catch {
    createdAt = new Date().toISOString();
  }

  const destination = isTransferDestination(raw.destination)
    ? raw.destination
    : "WAREHOUSE";

  return {
    id: normalizeText(raw.id) ?? createId(),
    planId,
    createdAt,
    meters,
    destination,
    dyehouseId: normalizeText(raw.dyehouseId ?? undefined) ?? null,
    dyehouseNameSnapshot: normalizeText(raw.dyehouseNameSnapshot ?? undefined) ?? null,
    note: normalizeText(raw.note),
  };
};

const readPlans = (): WeavingPlan[] => {
  if (!canUseStorage()) return [];
  return safeParseArray<unknown>(window.localStorage.getItem(PLANS_STORAGE_KEY))
    .map(normalizeStoredPlan)
    .filter((row): row is WeavingPlan => row !== null);
};

const readProgress = (): WeavingProgressEntry[] => {
  if (!canUseStorage()) return [];
  return safeParseArray<unknown>(window.localStorage.getItem(PROGRESS_STORAGE_KEY))
    .map(normalizeStoredProgress)
    .filter((row): row is WeavingProgressEntry => row !== null);
};

const readTransfers = (): WeavingTransfer[] => {
  if (!canUseStorage()) return [];
  return safeParseArray<unknown>(window.localStorage.getItem(TRANSFER_STORAGE_KEY))
    .map(normalizeStoredTransfer)
    .filter((row): row is WeavingTransfer => row !== null);
};

const writePlans = (plans: WeavingPlan[]) => {
  if (!canUseStorage()) return;
  window.localStorage.setItem(PLANS_STORAGE_KEY, JSON.stringify(plans));
};

const writeProgress = (entries: WeavingProgressEntry[]) => {
  if (!canUseStorage()) return;
  window.localStorage.setItem(PROGRESS_STORAGE_KEY, JSON.stringify(entries));
};

const writeTransfers = (entries: WeavingTransfer[]) => {
  if (!canUseStorage()) return;
  window.localStorage.setItem(TRANSFER_STORAGE_KEY, JSON.stringify(entries));
};

const updatePlan = (
  planId: string,
  transform: (plan: WeavingPlan) => WeavingPlan | null
): WeavingPlan | undefined => {
  const plans = readPlans();
  const index = plans.findIndex((plan) => plan.id === planId);
  if (index < 0) return undefined;

  const next = transform(plans[index]);
  if (!next) return undefined;

  plans[index] = next;
  writePlans(plans);
  return next;
};

export const ensurePatternByCodeAndNameAndImage = (
  fabricCode: string,
  fabricName: string,
  imageDataUrl?: string
): Pattern => {
  const normalizedCode = normalizeRequiredText(fabricCode, "Desen kodu");
  const normalizedName = normalizeRequiredText(fabricName, "Desen adi");
  const normalizedCodeSearch = normalizedCode.toLocaleLowerCase("tr-TR");

  const existing = patternsLocalRepo.list().find((pattern) => {
    return pattern.fabricCode.trim().toLocaleLowerCase("tr-TR") === normalizedCodeSearch;
  });

  if (existing) {
    if (imageDataUrl && !existing.digitalImageUrl && !existing.finalImageUrl) {
      patternsLocalRepo.update(existing.id, { digitalImageUrl: imageDataUrl });
      return patternsLocalRepo.get(existing.id) ?? existing;
    }
    return existing;
  }

  const created = upsertPatternFromForm({
    fabricCode: normalizedCode,
    fabricName: normalizedName,
    weaveType: "-",
    warpCount: "-",
    weftCount: "-",
    totalEnds: "-",
    currentStage: "DOKUMA",
  });

  if (imageDataUrl) {
    patternsLocalRepo.update(created.id, { digitalImageUrl: imageDataUrl });
    return patternsLocalRepo.get(created.id) ?? created;
  }

  return created;
};

export const ensurePatternByCodeAndName = (
  fabricCode: string,
  fabricName: string
): Pattern => ensurePatternByCodeAndNameAndImage(fabricCode, fabricName);

export const weavingLocalRepo = {
  listPlans(): WeavingPlan[] {
    return sortByCreatedDesc(readPlans());
  },

  createPlan(input: CreatePlanInput): WeavingPlan {
    const nextPlan: WeavingPlan = {
      id: createId(),
      patternId: normalizeRequiredText(input.patternId, "patternId"),
      patternNoSnapshot: normalizeRequiredText(input.patternNoSnapshot, "patternNoSnapshot"),
      patternNameSnapshot: normalizeRequiredText(input.patternNameSnapshot, "patternNameSnapshot"),
      plannedMeters: normalizePositiveNumber(input.plannedMeters, "Plan metre"),
      createdAt: toIsoDate(input.createdAt ?? new Date().toISOString(), "createdAt"),
      note: normalizeText(input.note),
      status: "ACTIVE",
      manualCompletedAt: null,
    };

    const plans = readPlans();
    plans.push(nextPlan);
    writePlans(plans);
    return nextPlan;
  },

  updatePlanStatus(id: string, status: WeavingPlanStatus): WeavingPlan | undefined {
    return updatePlan(id, (plan) => {
      if (status === "ACTIVE") {
        return { ...plan, status: "ACTIVE", manualCompletedAt: null };
      }
      if (status === "COMPLETED") {
        return {
          ...plan,
          status: "COMPLETED",
          manualCompletedAt: plan.manualCompletedAt ?? new Date().toISOString(),
        };
      }
      return {
        ...plan,
        status: "CANCELLED",
      };
    });
  },

  setManualCompleted(id: string, completed: boolean): WeavingPlan | undefined {
    if (completed) return this.updatePlanStatus(id, "COMPLETED");
    return this.updatePlanStatus(id, "ACTIVE");
  },

  addProgress(
    planId: string,
    meters: number,
    createdAt?: string,
    note?: string
  ): WeavingProgressEntry {
    const normalizedPlanId = normalizeRequiredText(planId, "planId");
    const plan = readPlans().find((row) => row.id === normalizedPlanId);
    if (!plan) throw new Error("Plan bulunamadi.");

    const next: WeavingProgressEntry = {
      id: createId(),
      planId: normalizedPlanId,
      createdAt: toIsoDate(createdAt ?? new Date().toISOString(), "createdAt"),
      meters: normalizePositiveNumber(meters, "Metre"),
      note: normalizeText(note),
    };

    const entries = readProgress();
    entries.push(next);
    writeProgress(entries);
    return next;
  },

  addTransfer(input: AddTransferInput): WeavingTransfer {
    const normalizedPlanId = normalizeRequiredText(input.planId, "planId");
    const plan = readPlans().find((row) => row.id === normalizedPlanId);
    if (!plan) throw new Error("Plan bulunamadi.");

    if (!isTransferDestination(input.destination)) {
      throw new Error("Sevk hedefi gecersiz.");
    }

    const next: WeavingTransfer = {
      id: createId(),
      planId: normalizedPlanId,
      createdAt: toIsoDate(input.createdAt ?? new Date().toISOString(), "createdAt"),
      meters: normalizePositiveNumber(input.meters, "Metre"),
      destination: input.destination,
      dyehouseId:
        input.destination === "DYEHOUSE"
          ? normalizeText(input.dyehouseId ?? undefined) ?? null
          : null,
      dyehouseNameSnapshot:
        input.destination === "DYEHOUSE"
          ? normalizeText(input.dyehouseNameSnapshot ?? undefined) ?? null
          : null,
      note: normalizeText(input.note),
    };

    const entries = readTransfers();
    entries.push(next);
    writeTransfers(entries);
    return next;
  },

  listProgress(): WeavingProgressEntry[] {
    return sortByCreatedDesc(readProgress());
  },

  listTransfers(): WeavingTransfer[] {
    return sortByCreatedDesc(readTransfers());
  },

  deleteProgress(id: string): boolean {
    const entries = readProgress();
    const next = entries.filter((entry) => entry.id !== id);
    if (next.length === entries.length) return false;
    writeProgress(next);
    return true;
  },

  deleteTransfer(id: string): boolean {
    const entries = readTransfers();
    const next = entries.filter((entry) => entry.id !== id);
    if (next.length === entries.length) return false;
    writeTransfers(next);
    return true;
  },

  getPlanTotals(planId: string) {
    const plan = readPlans().find((row) => row.id === planId);
    const wovenMeters = readProgress()
      .filter((entry) => entry.planId === planId)
      .reduce((sum, entry) => sum + entry.meters, 0);

    const transfers = readTransfers().filter((entry) => entry.planId === planId);
    const totalSentMeters = transfers.reduce((sum, entry) => sum + entry.meters, 0);
    const sentToDyehouse = transfers
      .filter((entry) => entry.destination === "DYEHOUSE")
      .reduce((sum, entry) => sum + entry.meters, 0);
    const sentToWarehouse = transfers
      .filter((entry) => entry.destination === "WAREHOUSE")
      .reduce((sum, entry) => sum + entry.meters, 0);

    const plannedMeters = plan?.plannedMeters ?? 0;

    return {
      wovenMeters,
      totalSentMeters,
      sentMeters: totalSentMeters,
      sentToDyehouse,
      sentToWarehouse,
      remainingPlanned: plannedMeters - wovenMeters,
      pendingToSend: wovenMeters - totalSentMeters,
    };
  },
};
