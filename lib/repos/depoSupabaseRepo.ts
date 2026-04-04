import { createClient } from "@/lib/supabase/client";
import type { FabricRoll, FabricRollStatus } from "@/lib/domain/depo";

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
  return mapRowToRoll(updated);
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
    return mapRowToRoll(data);
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

    return data.map(mapRowToRoll);
  },

  // ── Reserve ──────────────────────────────────────────────────────────────
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
