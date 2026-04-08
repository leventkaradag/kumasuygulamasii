import { createClient } from "@/lib/supabase/client";
import type { FabricRoll, FabricRollStatus } from "@/lib/domain/depo";
import type { DepoTransaction, DepoTransactionLine } from "@/lib/domain/depoTransaction";
import { depoTransactionsSupabaseRepo } from "@/lib/repos/depoTransactionsSupabaseRepo";

// ─── DB row type (snake_case) ─────────────────────────────────────────────────

type FabricRollRow = {
  id: string;
  pattern_id: string;
  variant_id: string | null;
  color_name: string | null;
  meters: number;
  roll_no: string | null;
  status: string;
  in_at: string;
  out_at: string | null;
  reserved_at: string | null;
  reserved_for: string | null;
  counterparty: string | null;
  note: string | null;
};

type PatternMeterSyncRow = Pick<FabricRollRow, "pattern_id" | "meters" | "status">;
type RollMetersRow = Pick<FabricRollRow, "meters">;

// ─── Mappers ──────────────────────────────────────────────────────────────────

const VALID_STATUSES: FabricRollStatus[] = [
  "IN_STOCK",
  "RESERVED",
  "SHIPPED",
  "RETURNED",
  "VOIDED",
  "SCRAP",
];

const isValidStatus = (value: string): value is FabricRollStatus =>
  VALID_STATUSES.includes(value as FabricRollStatus);

const mapRowToRoll = (row: FabricRollRow): FabricRoll => ({
  id: row.id,
  patternId: row.pattern_id,
  variantId: row.variant_id ?? undefined,
  colorName: row.color_name ?? undefined,
  meters: Number(row.meters),
  rollNo: row.roll_no ?? undefined,
  status: isValidStatus(row.status) ? row.status : "IN_STOCK",
  inAt: row.in_at,
  outAt: row.out_at ?? undefined,
  reservedAt: row.reserved_at ?? undefined,
  reservedFor: row.reserved_for ?? undefined,
  counterparty: row.counterparty ?? undefined,
  note: row.note ?? undefined,
});

const mapRollToRow = (roll: Partial<FabricRoll>): Partial<FabricRollRow> => {
  const row: Partial<FabricRollRow> = {};
  if (roll.id !== undefined) row.id = roll.id;
  if (roll.patternId !== undefined) row.pattern_id = roll.patternId;
  if (roll.variantId !== undefined) row.variant_id = roll.variantId ?? null;
  if (roll.colorName !== undefined) row.color_name = roll.colorName ?? null;
  if (roll.meters !== undefined) row.meters = roll.meters;
  if (roll.rollNo !== undefined) row.roll_no = roll.rollNo ?? null;
  if (roll.status !== undefined) row.status = roll.status;
  if (roll.inAt !== undefined) row.in_at = roll.inAt;
  if (roll.outAt !== undefined) row.out_at = roll.outAt ?? null;
  if (roll.reservedAt !== undefined) row.reserved_at = roll.reservedAt ?? null;
  if (roll.reservedFor !== undefined) row.reserved_for = roll.reservedFor ?? null;
  if (roll.counterparty !== undefined) row.counterparty = roll.counterparty ?? null;
  if (roll.note !== undefined) row.note = roll.note ?? null;
  return row;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const createId = (): string => {
  const randomUUID = globalThis.crypto?.randomUUID;
  if (typeof randomUUID === "function") {
    return randomUUID.call(globalThis.crypto);
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const normalizeText = (value?: string): string | undefined => {
  const trimmed = value?.trim();
  return trimmed || undefined;
};

const toIsoDate = (value: string, label: string): string => {
  const trimmed = value.trim();
  if (!trimmed) throw new Error(`${label} is required`);
  const source = /^\d{4}-\d{2}-\d{2}$/.test(trimmed)
    ? `${trimmed}T00:00:00.000`
    : trimmed;
  const parsed = new Date(source);
  if (Number.isNaN(parsed.getTime())) throw new Error(`${label} is invalid`);
  return parsed.toISOString();
};

const normalizeMeters = (value: number): number => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 0)
    throw new Error("meters cannot be negative");
  return numeric;
};

const STOCK_METER_STATUSES = new Set<FabricRollStatus>([
  "IN_STOCK",
  "RESERVED",
  "RETURNED",
]);
const WAREHOUSE_METER_STATUSES: FabricRollStatus[] = ["IN_STOCK", "RESERVED", "RETURNED"];

const DEFECT_METER_STATUSES = new Set<FabricRollStatus>(["SCRAP"]);

const syncPatternWarehouseMeters = async (
  supabase: ReturnType<typeof createClient>,
  patternIds: string[]
): Promise<void> => {
  const uniquePatternIds = Array.from(
    new Set(patternIds.map((patternId) => patternId.trim()).filter(Boolean))
  );
  if (uniquePatternIds.length === 0) return;

  const { data, error } = await supabase
    .from("fabric_rolls")
    .select("pattern_id, meters, status")
    .in("pattern_id", uniquePatternIds)
    .returns<PatternMeterSyncRow[]>();

  if (error) {
    throw new Error(`patterns.syncMeters fetch: ${error.message}`);
  }

  const totalsByPatternId = new Map<string, { stockMeters: number; defectMeters: number }>();
  uniquePatternIds.forEach((patternId) => {
    totalsByPatternId.set(patternId, { stockMeters: 0, defectMeters: 0 });
  });

  (data ?? []).forEach((row) => {
    const bucket = totalsByPatternId.get(row.pattern_id);
    if (!bucket) return;

    const meters = Number(row.meters);
    if (!Number.isFinite(meters) || meters <= 0) return;
    if (!isValidStatus(row.status)) return;

    if (STOCK_METER_STATUSES.has(row.status)) {
      bucket.stockMeters += meters;
      return;
    }

    if (DEFECT_METER_STATUSES.has(row.status)) {
      bucket.defectMeters += meters;
    }
  });

  for (const [patternId, totals] of totalsByPatternId.entries()) {
    const { error: updateError } = await supabase
      .from("patterns")
      .update({
        stock_meters: totals.stockMeters,
        defect_meters: totals.defectMeters,
      })
      .eq("id", patternId);

    if (updateError) {
      throw new Error(`patterns.syncMeters update: ${updateError.message}`);
    }
  }
};

// ─── Internal updater ─────────────────────────────────────────────────────────

const updateRoll = async (
  rollId: string,
  transform: (roll: FabricRoll) => Partial<FabricRoll> | null
): Promise<FabricRoll | undefined> => {
  const supabase = createClient();

  const { data: existing, error: fetchError } = await supabase
    .from("fabric_rolls")
    .select("*")
    .eq("id", rollId)
    .single<FabricRollRow>();

  if (fetchError || !existing) return undefined;

  const current = mapRowToRoll(existing);
  const patch = transform(current);
  if (!patch) return undefined;

  const rowPatch = mapRollToRow(patch);

  const { data: updated, error: updateError } = await supabase
    .from("fabric_rolls")
    .update(rowPatch)
    .eq("id", rollId)
    .select()
    .single<FabricRollRow>();

  if (updateError || !updated) throw new Error(`fabric_rolls.update: ${updateError?.message}`);
  const nextRoll = mapRowToRoll(updated);
  await syncPatternWarehouseMeters(supabase, [nextRoll.patternId]);
  return nextRoll;
};

// ─── Payload types (mirrors depoLocalRepo) ───────────────────────────────────

export type AddRollPayload = {
  patternId: string;
  variantId?: string;
  colorName?: string;
  meters: number;
  rollNo?: string;
  inAt: string;
  counterparty?: string;
  note?: string;
};

export type EditRollPayload = {
  variantId?: string;
  colorName?: string;
  meters?: number;
  rollNo?: string;
  note?: string;
};

export type RollFilters = {
  patternId?: string;
  variantId?: string;
  status?: FabricRollStatus;
  from?: string;
  to?: string;
  q?: string;
};

type BulkTransactionType = "SHIPMENT" | "RESERVATION";

type BulkTransactionLineInput = Omit<DepoTransactionLine, "id" | "transactionId">;

type ApplyBulkTransactionInput = {
  createdAt?: string;
  customerId: string;
  customerNameSnapshot: string;
  note?: string;
  lines: BulkTransactionLineInput[];
};

type ApplyBulkTransactionResult = {
  transaction: DepoTransaction;
  updatedRolls: FabricRoll[];
};

const LIST_ROLLS_PAGE_SIZE = 1000;

const restoreRollRows = async (
  supabase: ReturnType<typeof createClient>,
  rows: FabricRollRow[]
): Promise<void> => {
  if (rows.length === 0) return;

  const { error } = await supabase
    .from("fabric_rolls")
    .upsert(rows, { onConflict: "id" });

  if (error) {
    throw new Error(`fabric_rolls.restore: ${error.message}`);
  }
};

const normalizeBulkTransactionLines = (lines: BulkTransactionLineInput[]) => {
  if (!lines.length) {
    throw new Error("En az bir satir secilmelidir.");
  }

  const usedRollIds = new Set<string>();
  const normalizedLines = lines.map((line, index) => {
    const label = `Satir ${index + 1}`;
    const patternId = normalizeText(line.patternId);
    const patternNoSnapshot = normalizeText(line.patternNoSnapshot);
    const patternNameSnapshot = normalizeText(line.patternNameSnapshot);
    const color = normalizeText(line.color);

    if (!patternId || !patternNoSnapshot || !patternNameSnapshot || !color) {
      throw new Error(`${label} eksik desen bilgisi iceriyor.`);
    }
    if (!Number.isFinite(line.metrePerTop) || line.metrePerTop <= 0) {
      throw new Error(`${label} gecersiz metre bilgisi iceriyor.`);
    }

    const rollIds = Array.isArray(line.rollIds)
      ? Array.from(new Set(line.rollIds.map((rollId) => rollId.trim()).filter(Boolean)))
      : [];

    if (rollIds.length === 0) {
      throw new Error(`${label} icin secili top bulunamadi.`);
    }

    rollIds.forEach((rollId) => {
      if (usedRollIds.has(rollId)) {
        throw new Error("Ayni top birden fazla satira eklendi. Sepeti yenileyip tekrar deneyin.");
      }
      usedRollIds.add(rollId);
    });

    const topCount = rollIds.length;

    return {
      patternId,
      patternNoSnapshot,
      patternNameSnapshot,
      color,
      metrePerTop: line.metrePerTop,
      topCount,
      totalMetres: topCount * line.metrePerTop,
      rollIds,
    };
  });

  return {
    lines: normalizedLines,
    rollIds: normalizedLines.flatMap((line) => line.rollIds ?? []),
  };
};

const applyBulkTransaction = async (
  type: BulkTransactionType,
  input: ApplyBulkTransactionInput
): Promise<ApplyBulkTransactionResult> => {
  const createdAt = toIsoDate(input.createdAt ?? new Date().toISOString(), "createdAt");
  const customerId = normalizeText(input.customerId);
  const customerNameSnapshot = normalizeText(input.customerNameSnapshot);

  if (!customerId || !customerNameSnapshot) {
    throw new Error("Musteri bilgisi eksik.");
  }

  const normalized = normalizeBulkTransactionLines(input.lines);
  const supabase = createClient();

  const { data: existingRows, error: fetchError } = await supabase
    .from("fabric_rolls")
    .select("*")
    .in("id", normalized.rollIds)
    .returns<FabricRollRow[]>();

  if (fetchError) {
    throw new Error(`fabric_rolls.bulkFetch: ${fetchError.message}`);
  }

  const fetchedRows = existingRows ?? [];
  if (fetchedRows.length !== normalized.rollIds.length) {
    throw new Error("Secili toplarin bir kismi bulunamadi. Listeyi yenileyip tekrar deneyin.");
  }

  const allowedStatuses =
    type === "SHIPMENT"
      ? new Set<FabricRollStatus>(["IN_STOCK", "RESERVED"])
      : new Set<FabricRollStatus>(["IN_STOCK"]);

  const invalidRolls = fetchedRows.filter((row) => !allowedStatuses.has(mapRowToRoll(row).status));
  if (invalidRolls.length > 0) {
    throw new Error("Secilen toplarin durumu degismis. Listeyi yenileyip tekrar deneyin.");
  }

  const updatePatch =
    type === "SHIPMENT"
      ? {
          status: "SHIPPED",
          out_at: createdAt,
          counterparty: customerNameSnapshot,
          reserved_at: null,
          reserved_for: null,
        }
      : {
          status: "RESERVED",
          reserved_at: createdAt,
          reserved_for: customerNameSnapshot,
          out_at: null,
          counterparty: null,
        };

  const { data: updatedRows, error: updateError } = await supabase
    .from("fabric_rolls")
    .update(updatePatch)
    .in("id", normalized.rollIds)
    .in("status", Array.from(allowedStatuses))
    .select("*")
    .returns<FabricRollRow[]>();

  if (updateError) {
    throw new Error(`fabric_rolls.bulkUpdate: ${updateError.message}`);
  }

  const changedRows = updatedRows ?? [];
  const affectedPatternIds = Array.from(new Set(fetchedRows.map((row) => row.pattern_id)));

  if (changedRows.length !== normalized.rollIds.length) {
    await restoreRollRows(supabase, fetchedRows);
    await syncPatternWarehouseMeters(supabase, affectedPatternIds);
    throw new Error("Secilen toplarin durumu islem sirasinda degisti. Listeyi yenileyip tekrar deneyin.");
  }

  try {
    await syncPatternWarehouseMeters(supabase, affectedPatternIds);

    const transaction = await depoTransactionsSupabaseRepo.createTransaction({
      type,
      createdAt,
      customerId,
      customerNameSnapshot,
      note: normalizeText(input.note),
      lines: normalized.lines,
    });

    return {
      transaction,
      updatedRolls: changedRows.map(mapRowToRoll),
    };
  } catch (error) {
    let rollbackMessage = "";

    try {
      await restoreRollRows(supabase, fetchedRows);
      await syncPatternWarehouseMeters(supabase, affectedPatternIds);
    } catch (rollbackError) {
      rollbackMessage =
        rollbackError instanceof Error
          ? ` Geri alma sirasinda ek hata olustu: ${rollbackError.message}`
          : " Geri alma sirasinda ek hata olustu.";
    }

    const message =
      error instanceof Error ? error.message : "Toplu islem tamamlanamadi.";
    throw new Error(`${message}${rollbackMessage}`);
  }
};

export async function listAllRollsFromSupabase(
  filters: RollFilters = {}
): Promise<FabricRoll[]> {
  const supabase = createClient();
  const rows: FabricRollRow[] = [];

  for (let from = 0; ; from += LIST_ROLLS_PAGE_SIZE) {
    const to = from + LIST_ROLLS_PAGE_SIZE - 1;

    let query = supabase
      .from("fabric_rolls")
      .select("*")
      .order("in_at", { ascending: false })
      .range(from, to);

    if (filters.patternId) query = query.eq("pattern_id", filters.patternId);
    if (filters.variantId) query = query.eq("variant_id", filters.variantId);
    if (filters.status) query = query.eq("status", filters.status);
    if (filters.from) query = query.gte("in_at", toIsoDate(filters.from, "from"));
    if (filters.to) {
      const raw = filters.to.trim();
      const endOfDay = /^\d{4}-\d{2}-\d{2}$/.test(raw)
        ? `${raw}T23:59:59.999Z`
        : raw;
      query = query.lte("in_at", endOfDay);
    }

    const { data, error } = await query.returns<FabricRollRow[]>();

    if (error) throw new Error(`fabric_rolls.listAll: ${error.message}`);

    const chunk = data ?? [];
    rows.push(...chunk);

    if (chunk.length < LIST_ROLLS_PAGE_SIZE) {
      break;
    }
  }

  let rolls = rows.map(mapRowToRoll);

  if (filters.q) {
    const normalized = filters.q.trim().toLocaleLowerCase("tr-TR");
    rolls = rolls.filter((roll) => {
      const no = (roll.rollNo ?? "").toLocaleLowerCase("tr-TR");
      const color = (roll.colorName ?? "").toLocaleLowerCase("tr-TR");
      return no.includes(normalized) || color.includes(normalized);
    });
  }

  return rolls;
}

export async function getWarehouseMetersTotalFromSupabase(): Promise<number> {
  const supabase = createClient();
  let totalMeters = 0;

  for (let from = 0; ; from += LIST_ROLLS_PAGE_SIZE) {
    const to = from + LIST_ROLLS_PAGE_SIZE - 1;
    const { data, error } = await supabase
      .from("fabric_rolls")
      .select("meters")
      .in("status", WAREHOUSE_METER_STATUSES)
      .range(from, to)
      .returns<RollMetersRow[]>();

    if (error) throw new Error(`fabric_rolls.listWarehouseMeters: ${error.message}`);

    const chunk = data ?? [];
    chunk.forEach((row) => {
      const meters = Number(row.meters);
      if (Number.isFinite(meters) && meters > 0) {
        totalMeters += meters;
      }
    });

    if (chunk.length < LIST_ROLLS_PAGE_SIZE) {
      break;
    }
  }

  return totalMeters;
}

// ─── Repository ───────────────────────────────────────────────────────────────

export const depoSupabaseRepo = {
  // ── List ─────────────────────────────────────────────────────────────────
  async listRolls(filters: RollFilters = {}): Promise<FabricRoll[]> {
    const supabase = createClient();

    let query = supabase
      .from("fabric_rolls")
      .select("*")
      .order("in_at", { ascending: false })
      .range(0, 49999); // Supabase PostgREST varsayılan 1000 satır limitini aş

    if (filters.patternId) query = query.eq("pattern_id", filters.patternId);
    if (filters.variantId) query = query.eq("variant_id", filters.variantId);
    if (filters.status)    query = query.eq("status", filters.status);
    if (filters.from)      query = query.gte("in_at", toIsoDate(filters.from, "from"));
    if (filters.to) {
      // End of day for "to" filter
      const raw = filters.to.trim();
      const endOfDay = /^\d{4}-\d{2}-\d{2}$/.test(raw)
        ? `${raw}T23:59:59.999Z`
        : raw;
      query = query.lte("in_at", endOfDay);
    }

    const { data, error } = await query.returns<FabricRollRow[]>();

    if (error) throw new Error(`fabric_rolls.list: ${error.message}`);
    if (!data) return [];

    let rolls = data.map(mapRowToRoll);

    // Client-side text search (rollNo, colorName)
    if (filters.q) {
      const normalized = filters.q.trim().toLocaleLowerCase("tr-TR");
      rolls = rolls.filter((roll) => {
        const no = (roll.rollNo ?? "").toLocaleLowerCase("tr-TR");
        const color = (roll.colorName ?? "").toLocaleLowerCase("tr-TR");
        return no.includes(normalized) || color.includes(normalized);
      });
    }

    return rolls;
  },

  // ── Add (single) ─────────────────────────────────────────────────────────
  async addRoll(payload: AddRollPayload): Promise<FabricRoll> {
    const supabase = createClient();

    const newRollRow: FabricRollRow = {
      id: createId(),
      pattern_id: payload.patternId.trim(),
      variant_id: normalizeText(payload.variantId) ?? null,
      color_name: normalizeText(payload.colorName) ?? null,
      meters: normalizeMeters(payload.meters),
      roll_no: normalizeText(payload.rollNo) ?? null,
      status: "IN_STOCK",
      in_at: toIsoDate(payload.inAt, "inAt"),
      out_at: null,
      reserved_at: null,
      reserved_for: null,
      counterparty: normalizeText(payload.counterparty) ?? null,
      note: normalizeText(payload.note) ?? null,
    };

    const { data, error } = await supabase
      .from("fabric_rolls")
      .insert(newRollRow)
      .select()
      .single<FabricRollRow>();

    if (error || !data) {
      const detail = [
        error?.message,
        error?.code ? `code=${error.code}` : null,
        (error as { details?: string } | null)?.details
          ? `details=${(error as { details?: string }).details}`
          : null,
        (error as { hint?: string } | null)?.hint
          ? `hint=${(error as { hint?: string }).hint}`
          : null,
      ]
        .filter(Boolean)
        .join(" | ");
      throw new Error(`fabric_rolls.addRoll: ${detail || "unknown error"}`);
    }
    const addedRoll = mapRowToRoll(data);
    await syncPatternWarehouseMeters(supabase, [addedRoll.patternId]);
    return addedRoll;
  },

  // ── Add (bulk) ────────────────────────────────────────────────────────────
  // Tüm fiziksel topları tek bir INSERT isteğiyle Supabase'e gönderir.
  // N top = 1 network request (N ayrı request yerine).
  async addBulkRolls(payloads: AddRollPayload[]): Promise<FabricRoll[]> {
    if (payloads.length === 0) return [];
    const supabase = createClient();

    const rows: FabricRollRow[] = payloads.map((payload) => ({
      id: createId(),
      pattern_id: payload.patternId.trim(),
      variant_id: normalizeText(payload.variantId) ?? null,
      color_name: normalizeText(payload.colorName) ?? null,
      meters: normalizeMeters(payload.meters),
      roll_no: normalizeText(payload.rollNo) ?? null,
      status: "IN_STOCK",
      in_at: toIsoDate(payload.inAt, "inAt"),
      out_at: null,
      reserved_at: null,
      reserved_for: null,
      counterparty: normalizeText(payload.counterparty) ?? null,
      note: normalizeText(payload.note) ?? null,
    }));

    const { data, error } = await supabase
      .from("fabric_rolls")
      .insert(rows)
      .select()
      .returns<FabricRollRow[]>();

    if (error || !data) {
      const detail = [
        error?.message,
        error?.code ? `code=${error.code}` : null,
        (error as { details?: string } | null)?.details
          ? `details=${(error as { details?: string }).details}`
          : null,
        (error as { hint?: string } | null)?.hint
          ? `hint=${(error as { hint?: string }).hint}`
          : null,
      ]
        .filter(Boolean)
        .join(" | ");
      throw new Error(
        `fabric_rolls.addBulkRolls: ${detail || "unknown error"} (${payloads.length} top insert edilmeye çalışıldı)`
      );
    }

    // Supabase INSERT ... SELECT satırları input sırasıyla döndürür.
    // Yine de gelen row sayısını doğruluyoruz.
    if (data.length !== rows.length) {
      throw new Error(
        `fabric_rolls.addBulkRolls: Beklenen ${rows.length} kayıt yerine ${data.length} kayıt döndü.`
      );
    }

    const addedRolls = data.map(mapRowToRoll);
    await syncPatternWarehouseMeters(
      supabase,
      addedRolls.map((roll) => roll.patternId)
    );
    return addedRolls;
  },

  // ── Reserve ──────────────────────────────────────────────────────────────
  async applyBulkShipment(
    input: ApplyBulkTransactionInput
  ): Promise<ApplyBulkTransactionResult> {
    return applyBulkTransaction("SHIPMENT", input);
  },

  async applyBulkReservation(
    input: ApplyBulkTransactionInput
  ): Promise<ApplyBulkTransactionResult> {
    return applyBulkTransaction("RESERVATION", input);
  },

  async reserveRoll(
    rollId: string,
    reservedFor: string,
    dateISO: string
  ): Promise<FabricRoll | undefined> {
    const reservedAt = toIsoDate(dateISO, "dateISO");
    const nextReservedFor = reservedFor.trim();
    if (!nextReservedFor) return undefined;

    return updateRoll(rollId, (roll) => {
      if (roll.status !== "IN_STOCK") return null;
      return {
        status: "RESERVED" as FabricRollStatus,
        reservedFor: nextReservedFor,
        reservedAt,
      };
    });
  },

  // ── Unreserve ─────────────────────────────────────────────────────────────
  async unreserveRoll(rollId: string): Promise<FabricRoll | undefined> {
    return updateRoll(rollId, (roll) => {
      if (roll.status !== "RESERVED") return null;
      return {
        status: "IN_STOCK" as FabricRollStatus,
        reservedFor: undefined,
        reservedAt: undefined,
      };
    });
  },

  // ── Ship ─────────────────────────────────────────────────────────────────
  async shipRoll(
    rollId: string,
    counterparty: string,
    dateISO: string
  ): Promise<FabricRoll | undefined> {
    const nextCounterparty = normalizeText(counterparty);
    if (!nextCounterparty) return undefined;
    const outAt = toIsoDate(dateISO, "dateISO");

    return updateRoll(rollId, (roll) => {
      if (roll.status !== "IN_STOCK" && roll.status !== "RESERVED") return null;
      return {
        status: "SHIPPED" as FabricRollStatus,
        outAt,
        counterparty: nextCounterparty,
        reservedFor: undefined,
        reservedAt: undefined,
      };
    });
  },

  // ── Return ────────────────────────────────────────────────────────────────
  async returnRoll(rollId: string, dateISO: string): Promise<FabricRoll | undefined> {
    const inAt = toIsoDate(dateISO, "dateISO");

    return updateRoll(rollId, (roll) => {
      if (roll.status !== "SHIPPED") return null;
      return {
        status: "IN_STOCK" as FabricRollStatus,
        inAt,
        outAt: undefined,
        counterparty: undefined,
        reservedFor: undefined,
        reservedAt: undefined,
      };
    });
  },

  // ── Void ─────────────────────────────────────────────────────────────────
  async voidRoll(
    rollId: string,
    dateISO: string,
    reason?: string
  ): Promise<FabricRoll | undefined> {
    const outAt = toIsoDate(dateISO, "dateISO");
    const normalizedReason = normalizeText(reason);

    return updateRoll(rollId, (roll) => {
      if (roll.status !== "IN_STOCK") return null;
      const auditNote = normalizedReason
        ? `VOID: ${normalizedReason}`
        : "VOID: Manuel kaldirma";
      return {
        status: "VOIDED" as FabricRollStatus,
        outAt,
        reservedFor: undefined,
        reservedAt: undefined,
        counterparty: undefined,
        note: roll.note ? `${roll.note} | ${auditNote}` : auditNote,
      };
    });
  },

  // ── Edit ─────────────────────────────────────────────────────────────────
  async editRoll(
    rollId: string,
    payload: EditRollPayload
  ): Promise<FabricRoll | undefined> {
    return updateRoll(rollId, (roll) => {
      if (
        roll.status === "SHIPPED" ||
        roll.status === "VOIDED" ||
        roll.status === "SCRAP"
      ) return null;

      const patch: Partial<FabricRoll> = {};

      if (payload.meters !== undefined) patch.meters = normalizeMeters(payload.meters);
      if (payload.rollNo !== undefined) patch.rollNo = normalizeText(payload.rollNo);
      if (payload.variantId !== undefined) patch.variantId = normalizeText(payload.variantId);
      if (payload.colorName !== undefined) patch.colorName = normalizeText(payload.colorName);
      if (payload.note !== undefined) patch.note = normalizeText(payload.note);

      return patch;
    });
  },
};
