"use client";

import type {
  Dyehouse,
  DyehouseJob,
  DyehouseJobStatus,
  DyehouseLine,
  DyehouseProgressEntry,
} from "@/lib/domain/dyehouse";
import type { WeavingDispatchDocument } from "@/lib/domain/weaving";

const STORAGE_KEY = "dokuma:dyehouses";
const JOBS_STORAGE_KEY = "dyehouse:jobs";
const PROGRESS_STORAGE_KEY = "dyehouse:progress";
const JOB_STATUSES: DyehouseJobStatus[] = ["RECEIVED", "IN_PROCESS", "FINISHED", "CANCELLED"];

type ListJobsFilters = {
  dyehouseId?: string;
  status?: DyehouseJobStatus;
  query?: string;
};

type ListProgressFilters = {
  jobId?: string;
};

type AddProgressInput = {
  jobId: string;
  meters: number;
  createdAt?: string;
  note?: string;
  metersPerUnit?: number;
  unitCount?: number;
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

const normalizeName = (value: string) =>
  normalizeRequiredText(value, "Boyahane adi").toLocaleLowerCase("tr-TR");

const normalizePositiveNumber = (value: number, label: string) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    throw new Error(`${label} 0'dan buyuk olmali.`);
  }
  return numeric;
};

const normalizeOptionalNonNegativeNumber = (value: unknown): number | undefined => {
  if (value === null || value === undefined || value === "") return undefined;
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 0) return undefined;
  return numeric;
};

const normalizeOptionalNumber = (value: unknown): number | undefined => {
  if (value === null || value === undefined || value === "") return undefined;
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return undefined;
  return numeric;
};

const normalizeOptionalPositiveNumber = (value: unknown): number | undefined => {
  if (value === null || value === undefined || value === "") return undefined;
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return undefined;
  return numeric;
};

const normalizeOptionalPositiveInteger = (value: unknown): number | undefined => {
  if (value === null || value === undefined || value === "") return undefined;
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || !Number.isInteger(numeric) || numeric <= 0) {
    return undefined;
  }
  return numeric;
};

const toIsoDate = (value: string, label: string) => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`${label} gecersiz.`);
  }
  return parsed.toISOString();
};

const toTimestamp = (value: string) => {
  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
};

const hasJobStatus = (value: unknown): value is DyehouseJobStatus =>
  typeof value === "string" && JOB_STATUSES.includes(value as DyehouseJobStatus);

const normalizeStoredDyehouse = (input: unknown): Dyehouse | null => {
  if (!input || typeof input !== "object") return null;
  const raw = input as Partial<Dyehouse>;

  const name = normalizeText(raw.name);
  if (!name) return null;
  const createdAtRaw = normalizeText(raw.createdAt) ?? new Date().toISOString();
  const createdAt = Number.isNaN(new Date(createdAtRaw).getTime())
    ? new Date().toISOString()
    : new Date(createdAtRaw).toISOString();

  return {
    id: normalizeText(raw.id) ?? createId(),
    name,
    createdAt,
  };
};

const normalizeStoredLine = (input: unknown): DyehouseLine | null => {
  if (!input || typeof input !== "object") return null;
  const raw = input as Partial<DyehouseLine>;

  const colorName = normalizeText(raw.colorName) ?? normalizeText(raw.color ?? undefined);
  if (!colorName) return null;

  const metersPlanned =
    typeof raw.metersPlanned === "number" && Number.isFinite(raw.metersPlanned)
      ? raw.metersPlanned
      : Number(raw.metersPlanned || raw.incomingQuantityMeters);
  
  if (!Number.isFinite(metersPlanned) || metersPlanned <= 0) return null;

  return {
    id: normalizeText(raw.id) ?? createId(),
    colorName,
    variantCode: normalizeText(raw.variantCode),
    metersPlanned,
    inputKg: normalizeOptionalNonNegativeNumber(raw.inputKg),
    outputKg: normalizeOptionalNonNegativeNumber(raw.outputKg),
    wasteKg: normalizeOptionalNumber(raw.wasteKg),
    notes: normalizeText(raw.notes),

    sourceDispatchLineId: normalizeText(raw.sourceDispatchLineId ?? undefined) ?? null,
    patternId: normalizeText(raw.patternId ?? undefined) ?? null,
    patternCode: normalizeText(raw.patternCode ?? undefined) ?? null,
    patternName: normalizeText(raw.patternName ?? undefined) ?? null,
    variantId: normalizeText(raw.variantId ?? undefined) ?? null,
    variantName: normalizeText(raw.variantName ?? undefined) ?? null,
    color: normalizeText(raw.color ?? undefined) ?? colorName ?? null,
    incomingQuantityMeters: normalizeOptionalNonNegativeNumber(raw.incomingQuantityMeters) ?? metersPlanned,
    incomingQuantityKg: normalizeOptionalNonNegativeNumber(raw.incomingQuantityKg) ?? null,
    rawKg: normalizeOptionalNonNegativeNumber(raw.rawKg) ?? normalizeOptionalNonNegativeNumber(raw.inputKg) ?? null,
    cleanKg: normalizeOptionalNonNegativeNumber(raw.cleanKg) ?? normalizeOptionalNonNegativeNumber(raw.outputKg) ?? null,
    note: normalizeText(raw.note ?? undefined) ?? normalizeText(raw.notes ?? undefined) ?? null,
  };
};

const normalizeLineInput = (input: DyehouseLine): DyehouseLine => {
  const colorName = normalizeRequiredText(input.colorName, "Renk");
  const metersPlanned = normalizePositiveNumber(input.metersPlanned, "Metre");

  return {
    id: normalizeText(input.id) ?? createId(),
    colorName,
    variantCode: normalizeText(input.variantCode),
    metersPlanned,
    inputKg: normalizeOptionalNonNegativeNumber(input.inputKg),
    outputKg: normalizeOptionalNonNegativeNumber(input.outputKg),
    wasteKg: normalizeOptionalNumber(input.wasteKg),
    notes: normalizeText(input.notes),

    sourceDispatchLineId: normalizeText(input.sourceDispatchLineId ?? undefined) ?? null,
    patternId: normalizeText(input.patternId ?? undefined) ?? null,
    patternCode: normalizeText(input.patternCode ?? undefined) ?? null,
    patternName: normalizeText(input.patternName ?? undefined) ?? null,
    variantId: normalizeText(input.variantId ?? undefined) ?? null,
    variantName: normalizeText(input.variantName ?? undefined) ?? null,
    color: normalizeText(input.color ?? undefined) ?? colorName ?? null,
    incomingQuantityMeters: normalizeOptionalNonNegativeNumber(input.incomingQuantityMeters) ?? metersPlanned,
    incomingQuantityKg: normalizeOptionalNonNegativeNumber(input.incomingQuantityKg) ?? null,
    rawKg: normalizeOptionalNonNegativeNumber(input.rawKg) ?? normalizeOptionalNonNegativeNumber(input.inputKg) ?? null,
    cleanKg: normalizeOptionalNonNegativeNumber(input.cleanKg) ?? normalizeOptionalNonNegativeNumber(input.outputKg) ?? null,
    note: normalizeText(input.note ?? undefined) ?? normalizeText(input.notes ?? undefined) ?? null,
  };
};

const normalizeStoredLines = (input: unknown) => {
  if (!Array.isArray(input)) return [];
  return input
    .map((line) => normalizeStoredLine(line))
    .filter((line): line is DyehouseLine => line !== null);
};

const normalizeStoredProgress = (input: unknown): DyehouseProgressEntry | null => {
  if (!input || typeof input !== "object") return null;
  const raw = input as Partial<DyehouseProgressEntry>;

  const jobId = normalizeText(raw.jobId);
  if (!jobId) return null;

  const meters =
    typeof raw.meters === "number" && Number.isFinite(raw.meters)
      ? raw.meters
      : Number(raw.meters || raw.quantityMeters);
      
  if (!Number.isFinite(meters) || meters <= 0) return null;

  const createdAtRaw = normalizeText(raw.createdAt) ?? new Date().toISOString();
  const createdAt = Number.isNaN(new Date(createdAtRaw).getTime())
    ? new Date().toISOString()
    : new Date(createdAtRaw).toISOString();

  return {
    id: normalizeText(raw.id) ?? createId(),
    jobId,
    createdAt,
    meters,
    metersPerUnit: normalizeOptionalPositiveNumber(raw.metersPerUnit),
    unitCount: normalizeOptionalPositiveInteger(raw.unitCount) ?? 1,
    note: normalizeText(raw.note ?? undefined) ?? null,

    updatedAt: normalizeText(raw.updatedAt),
    lineId: normalizeText(raw.lineId ?? undefined) ?? null,
    processType: normalizeText(raw.processType ?? undefined) ?? null,
    color: normalizeText(raw.color ?? undefined) ?? null,
    quantityKg: normalizeOptionalNonNegativeNumber(raw.quantityKg) ?? null,
    quantityMeters: normalizeOptionalNonNegativeNumber(raw.quantityMeters) ?? meters ?? null,
  };
};

const sumMeters = (lines: DyehouseLine[]) => lines.reduce((sum, line) => sum + line.metersPlanned, 0);

const ensureMetersWithinInputTotal = (lines: DyehouseLine[], inputMetersTotal: number) => {
  const plannedTotal = sumMeters(lines);
  if (plannedTotal - inputMetersTotal > 1e-6) {
    throw new Error("Satir metre toplami, giris metresinden buyuk olamaz.");
  }
};

const normalizeStoredJob = (input: unknown): DyehouseJob | null => {
  if (!input || typeof input !== "object") return null;
  const raw = input as Partial<DyehouseJob> & { lines?: unknown };

  const dyehouseId = normalizeText(raw.dyehouseId);
  const dyehouseNameSnapshot = normalizeText(raw.dyehouseNameSnapshot);
  const sourceDispatchDocId = normalizeText(raw.sourceDispatchDocId);
  const patternId = normalizeText(raw.patternId);
  const patternCodeSnapshot = normalizeText(raw.patternCodeSnapshot);
  const patternNameSnapshot = normalizeText(raw.patternNameSnapshot);
  if (
    !dyehouseId ||
    !dyehouseNameSnapshot ||
    !sourceDispatchDocId ||
    !patternId ||
    !patternCodeSnapshot ||
    !patternNameSnapshot
  ) {
    return null;
  }

  const inputMetersTotal =
    typeof raw.inputMetersTotal === "number" && Number.isFinite(raw.inputMetersTotal)
      ? raw.inputMetersTotal
      : Number(raw.inputMetersTotal);
  if (!Number.isFinite(inputMetersTotal) || inputMetersTotal <= 0) return null;

  const receivedAtRaw = normalizeText(raw.receivedAt) ?? new Date().toISOString();
  const receivedAt = Number.isNaN(new Date(receivedAtRaw).getTime())
    ? new Date().toISOString()
    : new Date(receivedAtRaw).toISOString();

  const finishedAtRaw = normalizeText(raw.finishedAt ?? undefined);
  const finishedAt =
    finishedAtRaw && !Number.isNaN(new Date(finishedAtRaw).getTime())
      ? new Date(finishedAtRaw).toISOString()
      : null;

  const lines = normalizeStoredLines(raw.lines);
  const id = normalizeText(raw.id) ?? createId();
  const status = hasJobStatus(raw.status) ? raw.status : "RECEIVED";

  return {
    id,
    dyehouseId,
    dyehouseNameSnapshot,
    sourceDispatchDocId,
    patternId,
    patternCodeSnapshot,
    patternNameSnapshot,
    receivedAt,
    status,
    inputMetersTotal,
    lines,
    notes: normalizeText(raw.notes) ?? normalizeText(raw.note ?? undefined),
    finishedAt,
    outputDispatchDocId: normalizeText(raw.outputDispatchDocId ?? undefined) ?? null,

    jobNo: normalizeText(raw.jobNo) ?? `BH-${receivedAt.slice(0, 10).replace(/-/g, "")}-${id.slice(0, 4).toUpperCase()}`,
    sourceDispatchId: normalizeText(raw.sourceDispatchId) ?? sourceDispatchDocId,
    sourceDispatchNo: normalizeText(raw.sourceDispatchNo ?? undefined) ?? null,
    sourceUnit: normalizeText(raw.sourceUnit ?? undefined) ?? null,
    targetUnit: normalizeText(raw.targetUnit ?? undefined) ?? null,
    supplierName: normalizeText(raw.supplierName ?? undefined) ?? null,
    dyehouseName: normalizeText(raw.dyehouseName ?? undefined) ?? dyehouseNameSnapshot ?? null,
    createdAt: normalizeText(raw.createdAt) ?? receivedAt,
    updatedAt: normalizeText(raw.updatedAt) ?? receivedAt,
    startedAt: normalizeText(raw.startedAt ?? undefined) ?? (status === "IN_PROCESS" || status === "FINISHED" ? receivedAt : null),
    note: normalizeText(raw.note ?? undefined) ?? normalizeText(raw.notes) ?? null,
    progressEntries: [], // Will be populated dynamically by readJobs to ensure they always exist after normalization
  };
};

const readDyehouses = (): Dyehouse[] => {
  if (!canUseStorage()) return [];
  return safeParseArray<unknown>(window.localStorage.getItem(STORAGE_KEY))
    .map(normalizeStoredDyehouse)
    .filter((row): row is Dyehouse => row !== null);
};

const writeDyehouses = (rows: Dyehouse[]) => {
  if (!canUseStorage()) return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(rows));
};

const readProgress = (): DyehouseProgressEntry[] => {
  if (!canUseStorage()) return [];
  return safeParseArray<unknown>(window.localStorage.getItem(PROGRESS_STORAGE_KEY))
    .map(normalizeStoredProgress)
    .filter((row): row is DyehouseProgressEntry => row !== null);
};

const writeProgress = (rows: DyehouseProgressEntry[]) => {
  if (!canUseStorage()) return;
  window.localStorage.setItem(PROGRESS_STORAGE_KEY, JSON.stringify(rows));
};

const readJobs = (): DyehouseJob[] => {
  if (!canUseStorage()) return [];
  const jobs = safeParseArray<unknown>(window.localStorage.getItem(JOBS_STORAGE_KEY))
    .map(normalizeStoredJob)
    .filter((row): row is DyehouseJob => row !== null);
  
  const entries = readProgress();
  const byJob = new Map<string, DyehouseProgressEntry[]>();
  entries.forEach((e) => {
    const bucket = byJob.get(e.jobId);
    if (bucket) bucket.push(e);
    else byJob.set(e.jobId, [e]);
  });

  jobs.forEach(job => {
    job.progressEntries = byJob.get(job.id) ?? [];
  });

  return jobs;
};

const writeJobs = (rows: DyehouseJob[]) => {
  if (!canUseStorage()) return;
  // Strip progressEntries to keep data separated in localStorage as requested
  const toSave = rows.map(r => ({ ...r, progressEntries: undefined }));
  window.localStorage.setItem(JOBS_STORAGE_KEY, JSON.stringify(toSave));
};

const sortByName = (rows: Dyehouse[]) =>
  [...rows].sort((a, b) => a.name.localeCompare(b.name, "tr-TR"));

const sortJobsByReceivedDesc = (rows: DyehouseJob[]) =>
  [...rows].sort((a, b) => toTimestamp(b.receivedAt) - toTimestamp(a.receivedAt));

const sortProgressByCreatedDesc = (rows: DyehouseProgressEntry[]) =>
  [...rows].sort((a, b) => toTimestamp(b.createdAt) - toTimestamp(a.createdAt));

export const dyehouseLocalRepo = {
  list(): Dyehouse[] {
    return sortByName(readDyehouses());
  },

  get(id: string): Dyehouse | undefined {
    return this.list().find((row) => row.id === id);
  },

  addByName(name: string): Dyehouse {
    const nextName = normalizeRequiredText(name, "Boyahane adi");
    const normalizedTarget = normalizeName(nextName);
    const rows = readDyehouses();
    const existing = rows.find((row) => normalizeName(row.name) === normalizedTarget);
    if (existing) return existing;

    const next: Dyehouse = {
      id: createId(),
      name: nextName,
      createdAt: new Date().toISOString(),
    };
    rows.push(next);
    writeDyehouses(rows);
    return next;
  },

  delete(id: string): boolean {
    const rows = readDyehouses();
    const next = rows.filter((row) => row.id !== id);
    if (next.length === rows.length) return false;
    writeDyehouses(next);
    return true;
  },

  listJobs(filters?: ListJobsFilters): DyehouseJob[] {
    const normalizedQuery = normalizeText(filters?.query)?.toLocaleLowerCase("tr-TR") ?? "";
    return sortJobsByReceivedDesc(readJobs()).filter((job) => {
      if (filters?.dyehouseId && job.dyehouseId !== filters.dyehouseId) return false;
      if (filters?.status && job.status !== filters.status) return false;
      if (!normalizedQuery) return true;

      const code = job.patternCodeSnapshot.toLocaleLowerCase("tr-TR");
      const name = job.patternNameSnapshot.toLocaleLowerCase("tr-TR");
      const dyehouse = job.dyehouseNameSnapshot.toLocaleLowerCase("tr-TR");
      return (
        code.includes(normalizedQuery) ||
        name.includes(normalizedQuery) ||
        dyehouse.includes(normalizedQuery)
      );
    });
  },

  listProgress(filters?: ListProgressFilters): DyehouseProgressEntry[] {
    return sortProgressByCreatedDesc(readProgress()).filter((entry) => {
      if (filters?.jobId && entry.jobId !== filters.jobId) return false;
      return true;
    });
  },

  getJob(id: string): DyehouseJob | undefined {
    const normalizedId = normalizeText(id);
    if (!normalizedId) return undefined;
    return readJobs().find((job) => job.id === normalizedId);
  },

  createFromDispatch(dispatchDoc: WeavingDispatchDocument): DyehouseJob {
    if (dispatchDoc.destination !== "BOYAHANE") {
      throw new Error("Sadece Boyahane sevk belgelerinden is emri olusturulabilir.");
    }

    const jobs = readJobs();
    const existing = jobs.find((job) => job.sourceDispatchDocId === dispatchDoc.id);
    if (existing) return existing;

    const dyehouseName = normalizeText(dispatchDoc.destinationNameSnapshot) ?? "Boyahane";
    const knownDyehouses = readDyehouses();
    let dyehouseId = normalizeText(dispatchDoc.dyehouseId ?? undefined);
    if (!dyehouseId) {
      const matched = knownDyehouses.find(
        (dyehouse) => normalizeName(dyehouse.name) === normalizeName(dyehouseName)
      );
      if (matched) {
        dyehouseId = matched.id;
      } else {
        const createdDyehouse: Dyehouse = {
          id: createId(),
          name: dyehouseName,
          createdAt: new Date().toISOString(),
        };
        knownDyehouses.push(createdDyehouse);
        writeDyehouses(knownDyehouses);
        dyehouseId = createdDyehouse.id;
      }
    }

    const lines: DyehouseLine[] = (dispatchDoc.variantLines ?? []).map((line) => {
      const color = normalizeText(line.colorNameSnapshot) ?? "-";
      const metersPlan = normalizeOptionalPositiveNumber(line.meters) ?? 0;
      return {
        id: createId(),
        colorName: color,
        variantCode: normalizeText(line.variantCodeSnapshot),
        metersPlanned: metersPlan,
        inputKg: undefined,
        outputKg: undefined,
        wasteKg: undefined,
        notes: undefined,

        sourceDispatchLineId: null,
        patternId: normalizeText(dispatchDoc.patternId ?? undefined) ?? null,
        patternCode: normalizeText(dispatchDoc.patternNoSnapshot ?? undefined) ?? null,
        patternName: normalizeText(dispatchDoc.patternNameSnapshot ?? undefined) ?? null,
        variantId: normalizeText(line.variantId ?? undefined) ?? null,
        variantName: null,
        color: color,
        incomingQuantityMeters: metersPlan,
        incomingQuantityKg: null,
        rawKg: null,
        cleanKg: null,
        note: null,
      };
    });

    ensureMetersWithinInputTotal(lines, dispatchDoc.metersTotal);

    const now = new Date().toISOString();
    const datePart = now.slice(0, 10).replace(/-/g, "");
    const timePart = now.slice(11, 16).replace(":", "");
    const id = createId();
    const randomStr = id.slice(0, 4).toUpperCase();
    const jobNo = `BH-${datePart}-${timePart}-${randomStr}`;

    const next: DyehouseJob = {
      id,
      dyehouseId,
      dyehouseNameSnapshot: dyehouseName,
      sourceDispatchDocId: dispatchDoc.id,
      patternId: dispatchDoc.patternId,
      patternCodeSnapshot: dispatchDoc.patternNoSnapshot,
      patternNameSnapshot: dispatchDoc.patternNameSnapshot,
      receivedAt: toIsoDate(dispatchDoc.createdAt, "Belge tarihi"),
      status: "RECEIVED",
      inputMetersTotal: normalizePositiveNumber(dispatchDoc.metersTotal, "Giris metre"),
      lines,
      notes: normalizeText(dispatchDoc.note),
      finishedAt: null,
      outputDispatchDocId: null,

      jobNo,
      sourceDispatchId: dispatchDoc.id,
      sourceDispatchNo: normalizeText(dispatchDoc.docNo ?? undefined) ?? null,
      sourceUnit: "DOKUMA", // Since it comes from WeavingDispatchDocument
      targetUnit: "BOYAHANE",
      supplierName: null,
      dyehouseName: dyehouseName,
      createdAt: now,
      updatedAt: now,
      startedAt: null,
      note: normalizeText(dispatchDoc.note) ?? null,
      progressEntries: [],
    };

    jobs.push(next);
    writeJobs(jobs);
    return next;
  },

  addProgress(input: AddProgressInput): DyehouseProgressEntry {
    const normalizedJobId = normalizeRequiredText(input.jobId, "Is emri");
    const job = readJobs().find((row) => row.id === normalizedJobId);
    if (!job) throw new Error("Is emri bulunamadi.");

    const normalizedMeters = normalizePositiveNumber(input.meters, "Metre");
    const unitCount = normalizeOptionalPositiveInteger(input.unitCount) ?? 1;
    const metersPerUnit =
      normalizeOptionalPositiveNumber(input.metersPerUnit) ??
      (unitCount > 0 ? normalizedMeters / unitCount : undefined);

    if (
      metersPerUnit !== undefined &&
      Math.abs(metersPerUnit * unitCount - normalizedMeters) > 1e-6
    ) {
      throw new Error("Toplam ilerleme, metre x adet ile uyusmuyor.");
    }

    const now = new Date().toISOString();
    const next: DyehouseProgressEntry = {
      id: createId(),
      jobId: job.id,
      createdAt: toIsoDate(input.createdAt ?? now, "createdAt"),
      meters: normalizedMeters,
      metersPerUnit,
      unitCount,
      
      updatedAt: now,
      lineId: null,
      processType: null,
      color: null,
      quantityKg: null,
      quantityMeters: normalizedMeters,
      note: normalizeText(input.note) ?? null,
    };

    const entries = readProgress();
    entries.push(next);
    writeProgress(entries);
    return next;
  },

  addProgressEntry(jobId: string, entry: Partial<DyehouseProgressEntry>): DyehouseProgressEntry {
    const normalizedJobId = normalizeRequiredText(jobId, "Is emri");
    const job = readJobs().find((row) => row.id === normalizedJobId);
    if (!job) throw new Error("Is emri bulunamadi.");

    const normalizedMeters = normalizePositiveNumber(entry.meters ?? entry.quantityMeters ?? 0, "Metre");
    const now = new Date().toISOString();

    const next: DyehouseProgressEntry = {
      id: createId(),
      jobId: job.id,
      createdAt: toIsoDate(entry.createdAt ?? now, "createdAt"),
      meters: normalizedMeters,
      metersPerUnit: normalizeOptionalPositiveNumber(entry.metersPerUnit),
      unitCount: normalizeOptionalPositiveInteger(entry.unitCount),
      
      updatedAt: now,
      lineId: normalizeText(entry.lineId ?? undefined) ?? null,
      processType: normalizeText(entry.processType ?? undefined) ?? null,
      color: normalizeText(entry.color ?? undefined) ?? null,
      quantityKg: normalizeOptionalNonNegativeNumber(entry.quantityKg) ?? null,
      quantityMeters: normalizedMeters,
      note: normalizeText(entry.note ?? undefined) ?? null,
    };

    const entries = readProgress();
    entries.push(next);
    writeProgress(entries);
    return next;
  },

  updateProgressEntry(jobId: string, entryId: string, patch: Partial<DyehouseProgressEntry>): DyehouseProgressEntry | undefined {
    const entries = readProgress();
    const idx = entries.findIndex(e => e.id === entryId && e.jobId === jobId);
    if (idx < 0) return undefined;
    
    const current = entries[idx];
    const normalizedMeters = patch.meters !== undefined ? normalizePositiveNumber(patch.meters, "Metre") : current.meters;

    const next: DyehouseProgressEntry = {
      ...current,
      ...patch,
      id: current.id,
      jobId: current.jobId,
      createdAt: current.createdAt,
      meters: normalizedMeters,
      quantityMeters: normalizedMeters,
      updatedAt: new Date().toISOString(),
    };

    entries[idx] = next;
    writeProgress(entries);
    return next;
  },

  removeProgressEntry(jobId: string, entryId: string): boolean {
    const entries = readProgress();
    const next = entries.filter(e => !(e.id === entryId && e.jobId === jobId));
    if (next.length === entries.length) return false;
    writeProgress(next);
    return true;
  },

  updateJob(id: string, patch: Partial<Omit<DyehouseJob, "id">>): DyehouseJob | undefined {
    const normalizedId = normalizeText(id);
    if (!normalizedId) return undefined;

    const jobs = readJobs();
    const index = jobs.findIndex((job) => job.id === normalizedId);
    if (index < 0) return undefined;

    const current = jobs[index];
    const lines =
      patch.lines !== undefined
        ? patch.lines.map((line) => normalizeLineInput(line))
        : current.lines;

    const inputMetersTotal =
      patch.inputMetersTotal !== undefined
        ? normalizePositiveNumber(patch.inputMetersTotal, "Giris metre")
        : current.inputMetersTotal;
    ensureMetersWithinInputTotal(lines, inputMetersTotal);

    let status: DyehouseJobStatus = current.status;
    if (patch.status !== undefined) {
      if (!hasJobStatus(patch.status)) {
        throw new Error("Is emri durumu gecersiz.");
      }
      status = patch.status;
    }

    if (status === "FINISHED" && lines.length === 0) {
      throw new Error("Bitirmek icin en az bir satir gereklidir.");
    }

    let startedAt = current.startedAt;
    if (status === "IN_PROCESS" && current.status !== "IN_PROCESS" && !startedAt) {
      startedAt = new Date().toISOString();
    }

    let finishedAt = current.finishedAt;
    if (status === "FINISHED" && current.status !== "FINISHED") {
      finishedAt = new Date().toISOString();
    } else if (patch.finishedAt !== undefined) {
      finishedAt = patch.finishedAt
        ? toIsoDate(patch.finishedAt, "Bitis tarihi")
        : null;
    }

    const next: DyehouseJob = {
      ...current,
      dyehouseId:
        patch.dyehouseId !== undefined
          ? normalizeRequiredText(patch.dyehouseId, "Boyahane")
          : current.dyehouseId,
      dyehouseNameSnapshot:
        patch.dyehouseNameSnapshot !== undefined
          ? normalizeRequiredText(patch.dyehouseNameSnapshot, "Boyahane")
          : current.dyehouseNameSnapshot,
      sourceDispatchDocId:
        patch.sourceDispatchDocId !== undefined
          ? normalizeRequiredText(patch.sourceDispatchDocId, "Kaynak belge")
          : current.sourceDispatchDocId,
      patternId:
        patch.patternId !== undefined
          ? normalizeRequiredText(patch.patternId, "Desen")
          : current.patternId,
      patternCodeSnapshot:
        patch.patternCodeSnapshot !== undefined
          ? normalizeRequiredText(patch.patternCodeSnapshot, "Desen kodu")
          : current.patternCodeSnapshot,
      patternNameSnapshot:
        patch.patternNameSnapshot !== undefined
          ? normalizeRequiredText(patch.patternNameSnapshot, "Desen adi")
          : current.patternNameSnapshot,
      receivedAt:
        patch.receivedAt !== undefined
          ? toIsoDate(patch.receivedAt, "Alim tarihi")
          : current.receivedAt,
      status,
      inputMetersTotal,
      lines,
      notes: patch.notes !== undefined ? normalizeText(patch.notes) : current.notes,
      finishedAt,
      outputDispatchDocId:
        patch.outputDispatchDocId !== undefined
          ? normalizeText(patch.outputDispatchDocId ?? undefined) ?? null
          : current.outputDispatchDocId ?? null,

      updatedAt: new Date().toISOString(),
      startedAt,
      note: patch.note !== undefined ? normalizeText(patch.note ?? undefined) ?? null : current.note,
      // Any other targeted fields updated here gracefully
      jobNo: patch.jobNo !== undefined ? normalizeRequiredText(patch.jobNo, "jobNo") : current.jobNo,
    };

    jobs[index] = next;
    writeJobs(jobs);
    return next;
  },

  deleteJob(id: string): boolean {
    const normalizedId = normalizeText(id);
    if (!normalizedId) return false;
    const jobs = readJobs();
    const next = jobs.filter((job) => job.id !== normalizedId);
    if (next.length === jobs.length) return false;
    writeJobs(next);

    const progressEntries = readProgress();
    const nextProgressEntries = progressEntries.filter((entry) => entry.jobId !== normalizedId);
    if (nextProgressEntries.length !== progressEntries.length) {
      writeProgress(nextProgressEntries);
    }

    return true;
  },

  deleteProgress(id: string): boolean {
    const normalizedId = normalizeText(id);
    if (!normalizedId) return false;

    const entries = readProgress();
    const next = entries.filter((entry) => entry.id !== normalizedId);
    if (next.length === entries.length) return false;
    writeProgress(next);
    return true;
  },
};
