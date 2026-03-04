"use client";

import type { Pattern } from "@/lib/domain/pattern";
import type {
  WeavingDispatchDocument,
  WeavingDispatchDocumentType,
  WeavingDispatchDocumentDestination,
  WeavingDispatchDocumentVariantLine,
  WeavingPlan,
  WeavingPlanStatus,
  WeavingPlanVariant,
  WeavingPlanVariantStatus,
  WeavingProgressEntry,
  WeavingTransfer,
  WeavingTransferVariantLine,
  WeavingTransferDestination,
} from "@/lib/domain/weaving";
import { upsertPatternFromForm, patternsLocalRepo } from "@/lib/repos/patternsLocalRepo";

const PLANS_STORAGE_KEY = "weaving:plans";
const PROGRESS_STORAGE_KEY = "weaving:progress";
const TRANSFER_STORAGE_KEY = "weaving:transfers";
const DISPATCH_DOCUMENTS_STORAGE_KEY = "weaving:dispatch-documents";

const PLAN_STATUSES: WeavingPlanStatus[] = ["ACTIVE", "COMPLETED", "CANCELLED"];
const PLAN_VARIANT_STATUSES: WeavingPlanVariantStatus[] = ["ACTIVE", "DONE"];
const TRANSFER_DESTINATIONS: WeavingTransferDestination[] = ["DYEHOUSE", "WAREHOUSE"];
const DISPATCH_DOCUMENT_TYPES: WeavingDispatchDocumentType[] = ["SEVK", "BOYAHANE_TO_DEPO"];
const DISPATCH_DOCUMENT_DESTINATIONS: WeavingDispatchDocumentDestination[] = ["BOYAHANE", "DEPO"];

type CreatePlanInput = {
  patternId: string;
  patternNoSnapshot: string;
  patternNameSnapshot: string;
  plannedMeters: number;
  tarakEniCm?: number | null;
  variants?: WeavingPlanVariant[];
  createdAt?: string;
  note?: string;
};

type AddTransferVariantLineInput = {
  variantId: string;
  colorNameSnapshot: string;
  variantCodeSnapshot?: string;
  meters: number;
};

type AddTransferInput = {
  planId: string;
  meters: number;
  createdAt?: string;
  destination: WeavingTransferDestination;
  variantLines?: AddTransferVariantLineInput[];
  dyehouseId?: string | null;
  dyehouseNameSnapshot?: string | null;
  docNo?: string;
  note?: string;
};

type CreateDispatchDocumentInput = {
  type?: WeavingDispatchDocumentType;
  createdAt?: string;
  destination: WeavingDispatchDocumentDestination;
  docNo?: string;
  transferId?: string | null;
  sourceJobId?: string | null;
  sourceDispatchDocId?: string | null;
  planId: string;
  patternId: string;
  patternNoSnapshot: string;
  patternNameSnapshot: string;
  destinationNameSnapshot: string;
  dyehouseId?: string | null;
  variantLines?: WeavingDispatchDocumentVariantLine[];
  metersTotal: number;
  note?: string;
};

type CreateDyehouseToWarehouseDispatchInput = {
  sourceJobId: string;
  sourceDispatchDocId: string;
  createdAt?: string;
  docNo?: string;
  planId: string;
  patternId: string;
  patternNoSnapshot: string;
  patternNameSnapshot: string;
  lines: Array<{
    colorNameSnapshot: string;
    variantCodeSnapshot?: string;
    meters: number;
  }>;
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

const normalizeOptionalPositiveNumber = (value: unknown) => {
  if (value === null || value === undefined || value === "") return null;
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return null;
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

const isPlanVariantStatus = (value: unknown): value is WeavingPlanVariantStatus =>
  typeof value === "string" && PLAN_VARIANT_STATUSES.includes(value as WeavingPlanVariantStatus);

const isTransferDestination = (value: unknown): value is WeavingTransferDestination =>
  typeof value === "string" && TRANSFER_DESTINATIONS.includes(value as WeavingTransferDestination);

const isDispatchDocumentType = (value: unknown): value is WeavingDispatchDocumentType =>
  typeof value === "string" && DISPATCH_DOCUMENT_TYPES.includes(value as WeavingDispatchDocumentType);

const isDispatchDocumentDestination = (
  value: unknown
): value is WeavingDispatchDocumentDestination =>
  typeof value === "string" &&
  DISPATCH_DOCUMENT_DESTINATIONS.includes(value as WeavingDispatchDocumentDestination);

const normalizeStoredPlanVariant = (input: unknown): WeavingPlanVariant | null => {
  if (!input || typeof input !== "object") return null;
  const raw = input as Partial<WeavingPlanVariant>;

  const colorName = normalizeText(raw.colorName);
  if (!colorName) return null;

  const plannedMeters =
    typeof raw.plannedMeters === "number" && Number.isFinite(raw.plannedMeters)
      ? raw.plannedMeters
      : Number(raw.plannedMeters);
  if (!Number.isFinite(plannedMeters) || plannedMeters <= 0) return null;

  const wovenMeters =
    typeof raw.wovenMeters === "number" && Number.isFinite(raw.wovenMeters)
      ? raw.wovenMeters
      : Number(raw.wovenMeters);

  const normalizedWovenMeters = Number.isFinite(wovenMeters) ? Math.max(0, wovenMeters) : 0;
  const shippedMeters =
    typeof raw.shippedMeters === "number" && Number.isFinite(raw.shippedMeters)
      ? raw.shippedMeters
      : Number(raw.shippedMeters);
  const normalizedShippedMeters = Number.isFinite(shippedMeters) ? Math.max(0, shippedMeters) : 0;
  const status = isPlanVariantStatus(raw.status)
    ? raw.status
    : normalizedWovenMeters >= plannedMeters
      ? "DONE"
      : "ACTIVE";

  return {
    id: normalizeText(raw.id) ?? createId(),
    variantCode: normalizeText(raw.variantCode),
    colorName,
    plannedMeters,
    wovenMeters: normalizedWovenMeters,
    shippedMeters: normalizedShippedMeters,
    status,
    notes: normalizeText(raw.notes),
  };
};

const normalizePlanVariants = (input: unknown): WeavingPlanVariant[] => {
  if (!Array.isArray(input)) return [];
  return input
    .map((row) => normalizeStoredPlanVariant(row))
    .filter((row): row is WeavingPlanVariant => row !== null);
};

const sumVariantPlannedMeters = (variants: WeavingPlanVariant[]) =>
  variants.reduce((sum, variant) => sum + variant.plannedMeters, 0);

const sumVariantWovenMeters = (variants: WeavingPlanVariant[]) =>
  variants.reduce((sum, variant) => sum + variant.wovenMeters, 0);

const sumVariantShippedMeters = (variants: WeavingPlanVariant[]) =>
  variants.reduce((sum, variant) => sum + variant.shippedMeters, 0);

const hasPlanVariants = (
  plan: WeavingPlan | null | undefined
): plan is WeavingPlan & { variants: WeavingPlanVariant[] } =>
  Boolean(plan && Array.isArray(plan.variants) && plan.variants.length > 0);

const normalizeStoredPlan = (input: unknown): WeavingPlan | null => {
  if (!input || typeof input !== "object") return null;
  const raw = input as Partial<WeavingPlan> & { variants?: unknown; tarakEniCm?: unknown };

  const patternId = normalizeText(raw.patternId);
  const patternNoSnapshot = normalizeText(raw.patternNoSnapshot);
  const patternNameSnapshot = normalizeText(raw.patternNameSnapshot);
  const variants = normalizePlanVariants(raw.variants);
  const plannedMetersFromRaw =
    typeof raw.plannedMeters === "number" && Number.isFinite(raw.plannedMeters)
      ? raw.plannedMeters
      : Number(raw.plannedMeters);
  const plannedMetersFromVariants = variants.length > 0 ? sumVariantPlannedMeters(variants) : 0;
  const plannedMeters =
    Number.isFinite(plannedMetersFromRaw) && plannedMetersFromRaw > 0
      ? plannedMetersFromRaw
      : plannedMetersFromVariants;
  const tarakEniCm = normalizeOptionalPositiveNumber(raw.tarakEniCm);
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
    tarakEniCm,
    variants: variants.length > 0 ? variants : undefined,
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

const normalizeStoredTransferVariantLine = (input: unknown): WeavingTransferVariantLine | null => {
  if (!input || typeof input !== "object") return null;
  const raw = input as Partial<WeavingTransferVariantLine>;

  const variantId = normalizeText(raw.variantId);
  const colorNameSnapshot = normalizeText(raw.colorNameSnapshot);
  if (!variantId || !colorNameSnapshot) return null;

  const meters =
    typeof raw.meters === "number" && Number.isFinite(raw.meters)
      ? raw.meters
      : Number(raw.meters);
  if (!Number.isFinite(meters) || meters <= 0) return null;

  return {
    variantId,
    colorNameSnapshot,
    variantCodeSnapshot: normalizeText(raw.variantCodeSnapshot),
    meters,
  };
};

const normalizeTransferVariantLines = (input: unknown): WeavingTransferVariantLine[] => {
  if (!Array.isArray(input)) return [];
  return input
    .map((row) => normalizeStoredTransferVariantLine(row))
    .filter((row): row is WeavingTransferVariantLine => row !== null);
};

const normalizeTransferVariantLineInput = (
  input: AddTransferVariantLineInput
): WeavingTransferVariantLine => {
  return {
    variantId: normalizeRequiredText(input.variantId, "Varyant"),
    colorNameSnapshot: normalizeRequiredText(input.colorNameSnapshot, "Renk"),
    variantCodeSnapshot: normalizeText(input.variantCodeSnapshot),
    meters: normalizePositiveNumber(input.meters, "Varyant sevk metre"),
  };
};

const normalizeDispatchDocumentVariantLineInput = (
  input: WeavingDispatchDocumentVariantLine
): WeavingDispatchDocumentVariantLine => {
  const colorNameSnapshot = normalizeRequiredText(input.colorNameSnapshot, "Renk");
  const meters = normalizePositiveNumber(input.meters, "Metre");

  return {
    variantId: normalizeText(input.variantId),
    colorNameSnapshot,
    variantCodeSnapshot: normalizeText(input.variantCodeSnapshot),
    meters,
  };
};

const normalizeStoredDispatchDocumentVariantLine = (
  input: unknown
): WeavingDispatchDocumentVariantLine | null => {
  if (!input || typeof input !== "object") return null;
  const raw = input as Partial<WeavingDispatchDocumentVariantLine>;

  const colorNameSnapshot = normalizeText(raw.colorNameSnapshot);
  if (!colorNameSnapshot) return null;
  const meters =
    typeof raw.meters === "number" && Number.isFinite(raw.meters)
      ? raw.meters
      : Number(raw.meters);
  if (!Number.isFinite(meters) || meters <= 0) return null;

  return {
    variantId: normalizeText(raw.variantId),
    colorNameSnapshot,
    variantCodeSnapshot: normalizeText(raw.variantCodeSnapshot),
    meters,
  };
};

const normalizeDispatchDocumentVariantLines = (
  input: unknown
): WeavingDispatchDocumentVariantLine[] => {
  if (!Array.isArray(input)) return [];
  return input
    .map((line) => normalizeStoredDispatchDocumentVariantLine(line))
    .filter((line): line is WeavingDispatchDocumentVariantLine => line !== null);
};

const normalizeDispatchDocNo = (value: unknown) => {
  const normalized = normalizeText(typeof value === "string" ? value : undefined);
  return normalized ?? undefined;
};

const normalizeStoredTransfer = (input: unknown): WeavingTransfer | null => {
  if (!input || typeof input !== "object") return null;
  const raw = input as Partial<WeavingTransfer> & {
    destination?: string;
    dyehouseId?: string | null;
    dyehouseNameSnapshot?: string | null;
    variantLines?: unknown;
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
  const variantLines = normalizeTransferVariantLines(raw.variantLines);

  return {
    id: normalizeText(raw.id) ?? createId(),
    planId,
    createdAt,
    meters,
    variantLines: variantLines.length > 0 ? variantLines : undefined,
    destination,
    dyehouseId: normalizeText(raw.dyehouseId ?? undefined) ?? null,
    dyehouseNameSnapshot: normalizeText(raw.dyehouseNameSnapshot ?? undefined) ?? null,
    note: normalizeText(raw.note),
  };
};

const toDateParts = (value: string) => {
  const parsed = new Date(value);
  const source = Number.isNaN(parsed.getTime()) ? new Date() : parsed;
  const pad = (n: number) => String(n).padStart(2, "0");
  return {
    ymd: `${source.getFullYear()}${pad(source.getMonth() + 1)}${pad(source.getDate())}`,
    hm: `${pad(source.getHours())}${pad(source.getMinutes())}`,
  };
};

const createDispatchDocNo = (
  type: WeavingDispatchDocumentType,
  destination: WeavingDispatchDocumentDestination,
  createdAt: string,
  existingDocuments: WeavingDispatchDocument[]
) => {
  const { ymd, hm } = toDateParts(createdAt);
  const codePrefix =
    type === "BOYAHANE_TO_DEPO" ? "BP" : destination === "BOYAHANE" ? "BH" : "DP";
  const prefix = `${codePrefix}-${ymd}-${hm}-`;
  const takenSuffixes = new Set(
    existingDocuments
      .map((doc) => normalizeDispatchDocNo(doc.docNo))
      .filter((docNo): docNo is string => typeof docNo === "string" && docNo.length > 0)
      .filter((docNo) => docNo.startsWith(prefix))
      .map((docNo) => Number(docNo.slice(prefix.length)))
      .filter((index) => Number.isInteger(index) && index > 0)
  );
  let next = 1;
  while (takenSuffixes.has(next)) {
    next += 1;
  }
  return `${prefix}${String(next).padStart(3, "0")}`;
};

const normalizeStoredDispatchDocument = (input: unknown): WeavingDispatchDocument | null => {
  if (!input || typeof input !== "object") return null;
  const raw = input as Partial<WeavingDispatchDocument> &
    Record<string, unknown> & {
      variantLines?: unknown;
      irsaliyeNo?: string;
      dyehouseNameSnapshot?: string | null;
      type?: string;
    };

  const createdAtRaw = normalizeText(raw.createdAt) ?? new Date().toISOString();
  let createdAt: string;
  try {
    createdAt = toIsoDate(createdAtRaw, "createdAt");
  } catch {
    createdAt = new Date().toISOString();
  }

  const transferId = normalizeText(raw.transferId ?? undefined) ?? null;
  const planId = normalizeText(raw.planId);
  const patternId = normalizeText(raw.patternId);
  const patternNoSnapshot = normalizeText(raw.patternNoSnapshot);
  const patternNameSnapshot = normalizeText(raw.patternNameSnapshot);
  if (!planId || !patternId || !patternNoSnapshot || !patternNameSnapshot) {
    return null;
  }

  const metersTotal =
    typeof raw.metersTotal === "number" && Number.isFinite(raw.metersTotal)
      ? raw.metersTotal
      : Number(raw.metersTotal);
  if (!Number.isFinite(metersTotal) || metersTotal <= 0) return null;

  const variantLines = normalizeDispatchDocumentVariantLines(raw.variantLines);

  const rawDestination = normalizeText(raw.destination as string | undefined);
  const legacyType = normalizeText((raw as Record<string, unknown>).type as string | undefined);
  const rawDocNo =
    normalizeDispatchDocNo(raw.docNo) ?? normalizeDispatchDocNo(raw.irsaliyeNo);

  const normalizedType: WeavingDispatchDocumentType =
    isDispatchDocumentType(legacyType)
      ? legacyType
      : rawDocNo?.startsWith("BP-")
        ? "BOYAHANE_TO_DEPO"
        : "SEVK";

  const destination: WeavingDispatchDocumentDestination =
    isDispatchDocumentDestination(rawDestination)
      ? rawDestination
      : rawDestination === "BOYAHANE" || legacyType === "BOYAHANE_SEVK"
        ? "BOYAHANE"
        : normalizedType === "BOYAHANE_TO_DEPO"
          ? "DEPO"
        : "DEPO";

  const destinationNameSnapshot =
    normalizeText(raw.destinationNameSnapshot) ??
    normalizeText(raw.dyehouseNameSnapshot ?? undefined) ??
    (destination === "DEPO" ? "Depo" : "Boyahane");

  return {
    id: normalizeText(raw.id) ?? createId(),
    type: normalizedType,
    createdAt,
    destination,
    docNo: rawDocNo ?? createDispatchDocNo(normalizedType, destination, createdAt, []),
    transferId,
    sourceJobId: normalizeText(raw.sourceJobId ?? undefined) ?? null,
    sourceDispatchDocId: normalizeText(raw.sourceDispatchDocId ?? undefined) ?? null,
    planId,
    patternId,
    patternNoSnapshot,
    patternNameSnapshot,
    destinationNameSnapshot,
    dyehouseId: normalizeText(raw.dyehouseId ?? undefined) ?? null,
    variantLines: variantLines.length > 0 ? variantLines : undefined,
    metersTotal,
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

const readDispatchDocuments = (): WeavingDispatchDocument[] => {
  if (!canUseStorage()) return [];
  return safeParseArray<unknown>(window.localStorage.getItem(DISPATCH_DOCUMENTS_STORAGE_KEY))
    .map(normalizeStoredDispatchDocument)
    .filter((row): row is WeavingDispatchDocument => row !== null);
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

const writeDispatchDocuments = (documents: WeavingDispatchDocument[]) => {
  if (!canUseStorage()) return;
  window.localStorage.setItem(DISPATCH_DOCUMENTS_STORAGE_KEY, JSON.stringify(documents));
};

const createDispatchDocumentRecord = (
  input: CreateDispatchDocumentInput,
  existingDocuments: WeavingDispatchDocument[]
): WeavingDispatchDocument => {
  const type = isDispatchDocumentType(input.type) ? input.type : "SEVK";
  if (!isDispatchDocumentDestination(input.destination)) {
    throw new Error("Belge hedefi gecersiz.");
  }

  const destination = input.destination;
  const createdAt = toIsoDate(input.createdAt ?? new Date().toISOString(), "createdAt");
  const transferId = normalizeText(input.transferId ?? undefined) ?? null;
  const sourceJobId = normalizeText(input.sourceJobId ?? undefined) ?? null;
  const sourceDispatchDocId = normalizeText(input.sourceDispatchDocId ?? undefined) ?? null;

  if (
    sourceJobId &&
    existingDocuments.some(
      (document) =>
        normalizeText(document.sourceJobId ?? undefined) === sourceJobId &&
        document.type === type
    )
  ) {
    throw new Error("Bu is emri icin zaten cikis belgesi olusturulmus.");
  }

  const patternId = normalizeRequiredText(input.patternId, "patternId");
  const planId = normalizeRequiredText(input.planId, "planId");
  const patternNoSnapshot = normalizeRequiredText(input.patternNoSnapshot, "patternNoSnapshot");
  const patternNameSnapshot = normalizeRequiredText(input.patternNameSnapshot, "patternNameSnapshot");
  const destinationNameSnapshot = normalizeRequiredText(
    input.destinationNameSnapshot,
    "destinationNameSnapshot"
  );
  const variantLines = (input.variantLines ?? []).map((line) =>
    normalizeDispatchDocumentVariantLineInput(line)
  );
  const metersTotal = normalizePositiveNumber(input.metersTotal, "Toplam metre");
  const variantMetersTotal = variantLines.reduce((sum, line) => sum + line.meters, 0);
  if (variantMetersTotal > 0 && variantMetersTotal - metersTotal > 1e-6) {
    throw new Error("Belge satir toplam metresi, belge toplam metresinden buyuk olamaz.");
  }

  const docNo =
    normalizeDispatchDocNo(input.docNo) ??
    createDispatchDocNo(type, destination, createdAt, existingDocuments);

  return {
    id: createId(),
    type,
    createdAt,
    destination,
    docNo,
    transferId,
    sourceJobId,
    sourceDispatchDocId,
    planId,
    patternId,
    patternNoSnapshot,
    patternNameSnapshot,
    destinationNameSnapshot,
    dyehouseId:
      destination === "BOYAHANE"
        ? normalizeText(input.dyehouseId ?? undefined) ?? null
        : null,
    variantLines: variantLines.length > 0 ? variantLines : undefined,
    metersTotal,
    note: normalizeText(input.note),
  };
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
    if (
      imageDataUrl &&
      !existing.digitalImageUrl &&
      !existing.finalImageUrl &&
      !existing.imageDigital &&
      !existing.imageFinal
    ) {
      patternsLocalRepo.update(existing.id, {
        digitalImageUrl: imageDataUrl,
        imageDigital: imageDataUrl,
      });
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
    patternsLocalRepo.update(created.id, {
      digitalImageUrl: imageDataUrl,
      imageDigital: imageDataUrl,
    });
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
    const normalizedVariants = normalizePlanVariants(input.variants);
    const plannedMeters =
      normalizedVariants.length > 0
        ? sumVariantPlannedMeters(normalizedVariants)
        : normalizePositiveNumber(input.plannedMeters, "Plan metre");
    const tarakEniCm = normalizeOptionalPositiveNumber(input.tarakEniCm);

    const nextPlan: WeavingPlan = {
      id: createId(),
      patternId: normalizeRequiredText(input.patternId, "patternId"),
      patternNoSnapshot: normalizeRequiredText(input.patternNoSnapshot, "patternNoSnapshot"),
      patternNameSnapshot: normalizeRequiredText(input.patternNameSnapshot, "patternNameSnapshot"),
      plannedMeters,
      tarakEniCm,
      variants: normalizedVariants.length > 0 ? normalizedVariants : undefined,
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

  updatePlanVariants(planId: string, variants: WeavingPlanVariant[]): WeavingPlan {
    const normalizedPlanId = normalizeRequiredText(planId, "planId");
    const normalizedVariantsInput = normalizePlanVariants(variants);
    const existingPlan = readPlans().find((plan) => plan.id === normalizedPlanId);
    const existingVariantMap = new Map<string, WeavingPlanVariant>(
      (existingPlan?.variants ?? []).map((variant) => [variant.id, variant])
    );
    const normalizedVariants = normalizedVariantsInput.map((variant) => {
      const existing = existingVariantMap.get(variant.id);
      const shippedMeters =
        variant.shippedMeters > 0
          ? variant.shippedMeters
          : existing?.shippedMeters ?? 0;
      return {
        ...variant,
        shippedMeters,
      };
    });
    if (normalizedVariants.length === 0) {
      throw new Error("En az bir varyant girmelisiniz.");
    }

    const plannedMeters = sumVariantPlannedMeters(normalizedVariants);
    const updated = updatePlan(normalizedPlanId, (plan) => ({
      ...plan,
      plannedMeters,
      variants: normalizedVariants,
    }));

    if (!updated) throw new Error("Plan bulunamadi.");
    return updated;
  },

  addVariantWovenMeters(
    planId: string,
    variantId: string,
    meters: number,
    note?: string
  ): WeavingPlan {
    const normalizedPlanId = normalizeRequiredText(planId, "planId");
    const normalizedVariantId = normalizeRequiredText(variantId, "Varyant");
    const normalizedMeters = normalizePositiveNumber(meters, "Metre");
    const normalizedNote = normalizeText(note);

    const updated = updatePlan(normalizedPlanId, (plan) => {
      const variants = plan.variants ?? [];
      if (variants.length === 0) {
        throw new Error("Bu planda varyant bulunmuyor.");
      }

      let found = false;
      const nextVariants: WeavingPlanVariant[] = variants.map((variant) => {
        if (variant.id !== normalizedVariantId) return variant;
        found = true;

        const wovenMeters = variant.wovenMeters + normalizedMeters;
        const status: WeavingPlanVariantStatus =
          wovenMeters >= variant.plannedMeters ? "DONE" : "ACTIVE";
        const nextVariant: WeavingPlanVariant = {
          ...variant,
          wovenMeters,
          status,
          notes:
            normalizedNote && normalizedNote.length > 0
              ? [variant.notes, normalizedNote].filter(Boolean).join(" | ")
              : variant.notes,
        };
        return nextVariant;
      });

      if (!found) throw new Error("Varyant bulunamadi.");

      return {
        ...plan,
        plannedMeters: sumVariantPlannedMeters(nextVariants),
        variants: nextVariants,
      };
    });

    if (!updated) throw new Error("Plan bulunamadi.");
    return updated;
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

    const createdAt = toIsoDate(input.createdAt ?? new Date().toISOString(), "createdAt");
    const normalizedNote = normalizeText(input.note);
    const normalizedDocNo = normalizeDispatchDocNo(input.docNo);
    let meters = 0;
    let variantLines: WeavingTransferVariantLine[] | undefined;

    if (hasPlanVariants(plan)) {
      const normalizedLines = (input.variantLines ?? []).map((line) =>
        normalizeTransferVariantLineInput(line)
      );
      if (normalizedLines.length === 0) {
        throw new Error("Varyantli planda sevk satiri girilmesi zorunlu.");
      }

      const combinedByVariant = new Map<string, number>();
      normalizedLines.forEach((line) => {
        combinedByVariant.set(line.variantId, (combinedByVariant.get(line.variantId) ?? 0) + line.meters);
      });

      const planVariantMap = new Map<string, WeavingPlanVariant>(
        plan.variants.map((variant) => [variant.id, variant])
      );

      const normalizedVariantLines: WeavingTransferVariantLine[] = [];
      combinedByVariant.forEach((lineMeters, variantId) => {
        const variant = planVariantMap.get(variantId);
        if (!variant) {
          throw new Error("Sevk satirinda gecersiz varyant secildi.");
        }

        const availableToShip = Math.max(0, variant.wovenMeters - variant.shippedMeters);
        if (lineMeters > availableToShip) {
          throw new Error(`${variant.colorName} icin sevk, sevk edilebilir metreden fazla.`);
        }

        if (lineMeters > 0) {
          normalizedVariantLines.push({
            variantId: variant.id,
            colorNameSnapshot: variant.colorName,
            variantCodeSnapshot: variant.variantCode,
            meters: lineMeters,
          });
          meters += lineMeters;
        }
      });

      if (meters <= 0) {
        throw new Error("En az bir varyant icin sevk metresi 0'dan buyuk olmali.");
      }

      const linesByVariantId = new Map<string, number>(
        normalizedVariantLines.map((line) => [line.variantId, line.meters])
      );
      const updated = updatePlan(normalizedPlanId, (currentPlan) => {
        if (!hasPlanVariants(currentPlan)) {
          throw new Error("Plan varyant bilgisi guncel degil.");
        }

        const nextVariants = currentPlan.variants.map((variant) => {
          const shippedAdd = linesByVariantId.get(variant.id) ?? 0;
          if (shippedAdd <= 0) return variant;
          return {
            ...variant,
            shippedMeters: variant.shippedMeters + shippedAdd,
          };
        });

        return {
          ...currentPlan,
          variants: nextVariants,
        };
      });

      if (!updated) throw new Error("Plan bulunamadi.");
      variantLines = normalizedVariantLines;
    } else {
      meters = normalizePositiveNumber(input.meters, "Metre");
    }

    const next: WeavingTransfer = {
      id: createId(),
      planId: normalizedPlanId,
      createdAt,
      meters,
      variantLines,
      destination: input.destination,
      dyehouseId:
        input.destination === "DYEHOUSE"
          ? normalizeText(input.dyehouseId ?? undefined) ?? null
          : null,
      dyehouseNameSnapshot:
        input.destination === "DYEHOUSE"
          ? normalizeText(input.dyehouseNameSnapshot ?? undefined) ?? null
          : null,
      note: normalizedNote,
    };

    const entries = readTransfers();
    entries.push(next);
    writeTransfers(entries);

    const documentDestination: WeavingDispatchDocumentDestination =
      next.destination === "DYEHOUSE" ? "BOYAHANE" : "DEPO";
    const destinationNameSnapshot =
      documentDestination === "BOYAHANE"
        ? next.dyehouseNameSnapshot?.trim() || "Boyahane"
        : "Depo";
    const documents = readDispatchDocuments();
    const dispatchDocument = createDispatchDocumentRecord(
      {
        type: "SEVK",
        createdAt: next.createdAt,
        destination: documentDestination,
        docNo: normalizedDocNo,
        transferId: next.id,
        planId: plan.id,
        patternId: plan.patternId,
        patternNoSnapshot: plan.patternNoSnapshot,
        patternNameSnapshot: plan.patternNameSnapshot,
        destinationNameSnapshot,
        dyehouseId: documentDestination === "BOYAHANE" ? next.dyehouseId ?? null : null,
        variantLines:
          next.variantLines && next.variantLines.length > 0
            ? next.variantLines.map((line) => ({
                variantId: line.variantId,
                variantCodeSnapshot: line.variantCodeSnapshot,
                colorNameSnapshot: line.colorNameSnapshot,
                meters: line.meters,
              }))
            : undefined,
        metersTotal: next.meters,
        note: next.note,
      },
      documents
    );
    documents.push(dispatchDocument);
    writeDispatchDocuments(documents);

    return next;
  },

  listProgress(): WeavingProgressEntry[] {
    return sortByCreatedDesc(readProgress());
  },

  listTransfers(): WeavingTransfer[] {
    return sortByCreatedDesc(readTransfers());
  },

  listDispatchDocuments(): WeavingDispatchDocument[] {
    return sortByCreatedDesc(readDispatchDocuments());
  },

  getDispatchDocument(id: string): WeavingDispatchDocument | undefined {
    const normalizedId = normalizeText(id);
    if (!normalizedId) return undefined;
    return readDispatchDocuments().find((document) => document.id === normalizedId);
  },

  createDispatchDocument(input: CreateDispatchDocumentInput): WeavingDispatchDocument {
    const documents = readDispatchDocuments();
    const next = createDispatchDocumentRecord(input, documents);
    documents.push(next);
    writeDispatchDocuments(documents);
    return next;
  },

  createDyehouseToWarehouseDispatchDocument(
    input: CreateDyehouseToWarehouseDispatchInput
  ): WeavingDispatchDocument {
    const lines = (input.lines ?? []).map((line) =>
      normalizeDispatchDocumentVariantLineInput({
        colorNameSnapshot: line.colorNameSnapshot,
        variantCodeSnapshot: line.variantCodeSnapshot,
        meters: line.meters,
      })
    );
    if (lines.length === 0) {
      throw new Error("En az bir satir olmadan cikis belgesi olusturulamaz.");
    }
    const metersTotal = lines.reduce((sum, line) => sum + line.meters, 0);

    return this.createDispatchDocument({
      type: "BOYAHANE_TO_DEPO",
      createdAt: input.createdAt,
      destination: "DEPO",
      docNo: input.docNo,
      transferId: null,
      sourceJobId: input.sourceJobId,
      sourceDispatchDocId: input.sourceDispatchDocId,
      planId: input.planId,
      patternId: input.patternId,
      patternNoSnapshot: input.patternNoSnapshot,
      patternNameSnapshot: input.patternNameSnapshot,
      destinationNameSnapshot: "Depo",
      dyehouseId: null,
      variantLines: lines,
      metersTotal,
      note: input.note,
    });
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
    const removed = entries.find((entry) => entry.id === id);
    const next = entries.filter((entry) => entry.id !== id);
    if (next.length === entries.length) return false;
    writeTransfers(next);

    if (removed?.variantLines && removed.variantLines.length > 0) {
      updatePlan(removed.planId, (plan) => {
        if (!hasPlanVariants(plan)) return plan;
        const removedMetersByVariantId = new Map<string, number>();
        removed.variantLines?.forEach((line) => {
          removedMetersByVariantId.set(
            line.variantId,
            (removedMetersByVariantId.get(line.variantId) ?? 0) + line.meters
          );
        });
        const nextVariants = plan.variants.map((variant) => ({
          ...variant,
          shippedMeters: Math.max(
            0,
            variant.shippedMeters - (removedMetersByVariantId.get(variant.id) ?? 0)
          ),
        }));
        return {
          ...plan,
          variants: nextVariants,
        };
      });
    }

    const documents = readDispatchDocuments();
    const nextDocuments = documents.filter((document) => document.transferId !== id);
    if (nextDocuments.length !== documents.length) {
      writeDispatchDocuments(nextDocuments);
    }
    return true;
  },

  getPlanTotals(planId: string) {
    const plan = readPlans().find((row) => row.id === planId);
    const variants = plan?.variants ?? [];
    const hasVariants = variants.length > 0;
    const wovenMeters = hasVariants
      ? sumVariantWovenMeters(variants)
      : readProgress()
          .filter((entry) => entry.planId === planId)
          .reduce((sum, entry) => sum + entry.meters, 0);

    const transfers = readTransfers().filter((entry) => entry.planId === planId);
    const totalSentMeters = hasVariants
      ? sumVariantShippedMeters(variants)
      : transfers.reduce((sum, entry) => sum + entry.meters, 0);
    const sentToDyehouse = transfers
      .filter((entry) => entry.destination === "DYEHOUSE")
      .reduce((sum, entry) => sum + entry.meters, 0);
    const sentToWarehouse = transfers
      .filter((entry) => entry.destination === "WAREHOUSE")
      .reduce((sum, entry) => sum + entry.meters, 0);

    const plannedMeters = hasVariants
      ? sumVariantPlannedMeters(variants)
      : plan?.plannedMeters ?? 0;

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
