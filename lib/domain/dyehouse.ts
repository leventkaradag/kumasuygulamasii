export type Dyehouse = {
  id: string;
  name: string;
  createdAt: string;
};

export type DyehouseJobStatus = "RECEIVED" | "IN_PROCESS" | "FINISHED" | "CANCELLED";

export type DyehouseLine = {
  id: string;

  // --- Legacy / Existing Fields (Kept required/as-is to prevent breaking repo/UI) ---
  colorName: string;
  variantCode?: string;
  metersPlanned: number;
  inputKg?: number;
  outputKg?: number;
  wasteKg?: number;
  notes?: string;

  // --- Target Schema Fields (Added as optional to prevent breaking repo/UI) ---
  sourceDispatchLineId?: string | null;
  patternId?: string | null;
  patternCode?: string | null;
  patternName?: string | null;
  variantId?: string | null;
  variantName?: string | null;
  color?: string | null;
  incomingQuantityMeters?: number | null;
  incomingQuantityKg?: number | null;
  rawKg?: number | null;
  cleanKg?: number | null;
  note?: string | null;
};

export type DyehouseProgressEntry = {
  id: string;

  // --- Legacy / Existing Fields ---
  jobId: string;
  createdAt: string;
  meters: number;
  metersPerUnit?: number;
  unitCount?: number;

  // --- Target Schema Fields ---
  updatedAt?: string;
  lineId?: string | null;
  processType?: string | null;
  color?: string | null;
  quantityKg?: number | null;
  quantityMeters?: number | null;
  note?: string | null;
};

export type DyehouseJob = {
  id: string;

  // --- Legacy / Existing Fields ---
  dyehouseId: string;
  dyehouseNameSnapshot: string;
  sourceDispatchDocId: string;
  patternId: string;
  patternCodeSnapshot: string;
  patternNameSnapshot: string;
  receivedAt: string; // Not string|null|undefined to keep UI/repo compatible
  status: DyehouseJobStatus;
  inputMetersTotal: number;
  lines: DyehouseLine[];
  notes?: string;
  finishedAt?: string | null;
  outputDispatchDocId?: string | null;

  // --- Target Schema Fields ---
  jobNo?: string;
  sourceDispatchId?: string;
  sourceDispatchNo?: string | null;
  sourceUnit?: string | null;
  targetUnit?: string | null;
  supplierName?: string | null;
  dyehouseName?: string | null;
  createdAt?: string;
  updatedAt?: string;
  startedAt?: string | null;
  note?: string | null;
  progressEntries?: DyehouseProgressEntry[];
};

/**
 * Calculates waste kg for a line.
 * - uses manual wasteKg if present
 * - otherwise computes rawKg - cleanKg (or legacy inputKg - outputKg)
 * - guards null/undefined/NaN
 */
export function calculateLineWasteKg(line: DyehouseLine): number {
  if (typeof line.wasteKg === "number" && !Number.isNaN(line.wasteKg)) {
    return line.wasteKg;
  }

  const raw = Number(line.rawKg);
  const clean = Number(line.cleanKg);
  if (line.rawKg != null && line.cleanKg != null && !Number.isNaN(raw) && !Number.isNaN(clean)) {
    return raw - clean;
  }

  const inKg = Number(line.inputKg);
  const outKg = Number(line.outputKg);
  if (line.inputKg != null && line.outputKg != null && !Number.isNaN(inKg) && !Number.isNaN(outKg)) {
    return inKg - outKg;
  }

  return 0;
}

export type DyehouseJobTotals = {
  totalIncomingKg: number;
  totalRawKg: number;
  totalCleanKg: number;
  totalWasteKg: number;
  totalIncomingMeters: number;
};

export function calculateJobTotals(job: DyehouseJob): DyehouseJobTotals {
  let totalIncomingKg = 0;
  let totalRawKg = 0;
  let totalCleanKg = 0;
  let totalWasteKg = 0;
  let totalIncomingMeters = 0;

  for (const line of job.lines || []) {
    totalIncomingKg += Number(line.incomingQuantityKg) || 0;

    const incomingMeters = line.incomingQuantityMeters != null
      ? Number(line.incomingQuantityMeters)
      : Number(line.metersPlanned);
    totalIncomingMeters += incomingMeters || 0;

    const currentRaw = line.rawKg != null ? Number(line.rawKg) : Number(line.inputKg);
    totalRawKg += currentRaw || 0;

    const currentClean = line.cleanKg != null ? Number(line.cleanKg) : Number(line.outputKg);
    totalCleanKg += currentClean || 0;

    totalWasteKg += calculateLineWasteKg(line);
  }

  return {
    totalIncomingKg,
    totalRawKg,
    totalCleanKg,
    totalWasteKg,
    totalIncomingMeters,
  };
}

export function isDyehouseJobClosable(job: DyehouseJob): boolean {
  if (job.status === "FINISHED") return true;
  if (job.status === "CANCELLED") return false;

  const lines = job.lines || [];
  if (lines.length === 0) return false;

  return lines.some(l => (l.rawKg != null && l.rawKg > 0) || (l.inputKg != null && l.inputKg > 0));
}
