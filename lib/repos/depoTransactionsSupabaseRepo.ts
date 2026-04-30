import { createClient } from "@/lib/supabase/client";
import type {
  DepoTransaction,
  DepoTransactionLine,
  DepoTransactionStatus,
  DepoTransactionTotals,
  DepoTransactionType,
} from "@/lib/domain/depoTransaction";

// ─── DB row types (snake_case) ────────────────────────────────────────────────

type DepoTransactionRow = {
  id: string;
  type: string;
  status: string;
  created_at: string;
  customer_id: string | null;
  customer_name_snapshot: string | null;
  note: string | null;
  total_tops: number | null;
  total_metres: number | null;
  pattern_count: number | null;
  target_transaction_id: string | null;
  reversed_by_transaction_id: string | null;
  reversed_at: string | null;
};

type DepoTransactionLineRow = {
  id: string;
  transaction_id: string;
  pattern_id: string;       // text — matches patterns.id (fabricCode)
  pattern_no_snapshot: string;
  pattern_name_snapshot: string;
  color: string;
  metre_per_top: number;
  top_count: number;
  total_metres: number;
  roll_ids: string[] | null; // text[] — matches fabric_rolls.id (text uuid)
};

// ─── Validators ───────────────────────────────────────────────────────────────

const VALID_TYPES: DepoTransactionType[] = [
  "ENTRY",
  "SHIPMENT",
  "RESERVATION",
  "RETURN",
  "REVERSAL",
  "ADJUSTMENT",
];

const VALID_STATUSES: DepoTransactionStatus[] = ["ACTIVE", "REVERSED"];

const isValidType = (v: unknown): v is DepoTransactionType =>
  typeof v === "string" && VALID_TYPES.includes(v as DepoTransactionType);

const isValidStatus = (v: unknown): v is DepoTransactionStatus =>
  typeof v === "string" && VALID_STATUSES.includes(v as DepoTransactionStatus);

// ─── Mappers ──────────────────────────────────────────────────────────────────

const mapRowToTransaction = (row: DepoTransactionRow): DepoTransaction => {
  const totals: DepoTransactionTotals | undefined =
    row.total_tops != null && row.total_metres != null && row.pattern_count != null
      ? {
          totalTops: row.total_tops,
          totalMetres: row.total_metres,
          patternCount: row.pattern_count,
        }
      : undefined;

  return {
    id: row.id,
    type: isValidType(row.type) ? row.type : "ENTRY",
    status: isValidStatus(row.status) ? row.status : "ACTIVE",
    createdAt: row.created_at,
    customerId: row.customer_id ?? undefined,
    customerNameSnapshot: row.customer_name_snapshot ?? undefined,
    note: row.note ?? undefined,
    totals,
    targetTransactionId: row.target_transaction_id ?? undefined,
    reversedByTransactionId: row.reversed_by_transaction_id ?? undefined,
    reversedAt: row.reversed_at ?? undefined,
  };
};

const mapRowToLine = (row: DepoTransactionLineRow): DepoTransactionLine => ({
  id: row.id,
  transactionId: row.transaction_id,
  patternId: row.pattern_id,
  patternNoSnapshot: row.pattern_no_snapshot,
  patternNameSnapshot: row.pattern_name_snapshot,
  color: row.color,
  metrePerTop: Number(row.metre_per_top),
  topCount: row.top_count,
  totalMetres: Number(row.total_metres),
  rollIds: row.roll_ids && row.roll_ids.length > 0 ? row.roll_ids : undefined,
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

const createId = (): string => {
  const randomUUID = globalThis.crypto?.randomUUID;
  if (typeof randomUUID === "function") return randomUUID.call(globalThis.crypto);
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const normalizeText = (value?: string): string | undefined => {
  const trimmed = value?.trim();
  return trimmed || undefined;
};

const calculateTotals = (
  lines: Array<Pick<DepoTransactionLine, "patternId" | "topCount" | "totalMetres">>
): DepoTransactionTotals => {
  const patternSet = new Set<string>();
  let totalTops = 0;
  let totalMetres = 0;
  lines.forEach((line) => {
    patternSet.add(line.patternId);
    totalTops += line.topCount;
    totalMetres += line.totalMetres;
  });
  return { totalTops, totalMetres, patternCount: patternSet.size };
};

// ─── Input types (mirrors depoTransactionsLocalRepo) ─────────────────────────

type CreateLineInput = Omit<DepoTransactionLine, "id" | "transactionId"> &
  Partial<Pick<DepoTransactionLine, "id">>;

type CreateTransactionInput = {
  type: DepoTransactionType;
  createdAt?: string;
  customerId?: string;
  customerNameSnapshot?: string;
  note?: string;
  targetTransactionId?: string;
  totals?: DepoTransactionTotals;
  lines: CreateLineInput[];
};

type ListTransactionsFilters = {
  from?: string;
  to?: string;
};

const TRANSACTIONS_PAGE_SIZE = 1000;

// ─── Repository ───────────────────────────────────────────────────────────────

export const depoTransactionsSupabaseRepo = {
  // ── List transactions ───────────────────────────────────────────────────────
  async listTransactions(): Promise<DepoTransaction[]> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("depo_transactions")
      .select("*")
      .order("created_at", { ascending: false })
      .returns<DepoTransactionRow[]>();

    if (error) throw new Error(`depo_transactions.list: ${error.message}`);
    return (data ?? []).map(mapRowToTransaction);
  },

  // ── List lines (all, or filtered by transactionId) ─────────────────────────
  async listLines(transactionId?: string): Promise<DepoTransactionLine[]> {
    const supabase = createClient();

    if (transactionId) {
      const { data, error } = await supabase
        .from("depo_transaction_lines")
        .select("*")
        .eq("transaction_id", transactionId)
        .returns<DepoTransactionLineRow[]>();

      if (error) throw new Error(`depo_transaction_lines.list: ${error.message}`);
      return (data ?? []).map(mapRowToLine);
    }

    const { data, error } = await supabase
      .from("depo_transaction_lines")
      .select("*")
      .returns<DepoTransactionLineRow[]>();

    if (error) throw new Error(`depo_transaction_lines.list: ${error.message}`);
    return (data ?? []).map(mapRowToLine);
  },

  async listAllTransactions(filters: ListTransactionsFilters = {}): Promise<DepoTransaction[]> {
    const supabase = createClient();
    const rows: DepoTransactionRow[] = [];

    for (let from = 0; ; from += TRANSACTIONS_PAGE_SIZE) {
      const to = from + TRANSACTIONS_PAGE_SIZE - 1;
      let query = supabase
        .from("depo_transactions")
        .select("*")
        .order("created_at", { ascending: false })
        .range(from, to);

      if (filters.from) query = query.gte("created_at", new Date(filters.from).toISOString());
      if (filters.to) query = query.lte("created_at", new Date(filters.to).toISOString());

      const { data, error } = await query.returns<DepoTransactionRow[]>();

      if (error) throw new Error(`depo_transactions.listAll: ${error.message}`);

      const chunk = data ?? [];
      rows.push(...chunk);

      if (chunk.length < TRANSACTIONS_PAGE_SIZE) {
        break;
      }
    }

    return rows.map(mapRowToTransaction);
  },

  async listAllLines(transactionId?: string): Promise<DepoTransactionLine[]> {
    const supabase = createClient();
    const rows: DepoTransactionLineRow[] = [];

    for (let from = 0; ; from += TRANSACTIONS_PAGE_SIZE) {
      const to = from + TRANSACTIONS_PAGE_SIZE - 1;
      let query = supabase
        .from("depo_transaction_lines")
        .select("*")
        .range(from, to);

      if (transactionId) query = query.eq("transaction_id", transactionId);

      const { data, error } = await query.returns<DepoTransactionLineRow[]>();

      if (error) throw new Error(`depo_transaction_lines.listAll: ${error.message}`);

      const chunk = data ?? [];
      rows.push(...chunk);

      if (chunk.length < TRANSACTIONS_PAGE_SIZE) {
        break;
      }
    }

    return rows.map(mapRowToLine);
  },

  // ── Get single transaction ─────────────────────────────────────────────────
  async listLinesByTransactionIds(transactionIds: string[]): Promise<DepoTransactionLine[]> {
    const supabase = createClient();
    const rows: DepoTransactionLineRow[] = [];
    const normalizedIds = Array.from(
      new Set(transactionIds.map((id) => id.trim()).filter(Boolean))
    );

    if (normalizedIds.length === 0) return [];

    for (let from = 0; ; from += TRANSACTIONS_PAGE_SIZE) {
      const to = from + TRANSACTIONS_PAGE_SIZE - 1;
      const { data, error } = await supabase
        .from("depo_transaction_lines")
        .select("*")
        .in("transaction_id", normalizedIds)
        .range(from, to)
        .returns<DepoTransactionLineRow[]>();

      if (error) {
        throw new Error(`depo_transaction_lines.listByTransactionIds: ${error.message}`);
      }

      const chunk = data ?? [];
      rows.push(...chunk);

      if (chunk.length < TRANSACTIONS_PAGE_SIZE) {
        break;
      }
    }

    return rows.map(mapRowToLine);
  },

  async getTransaction(id: string): Promise<DepoTransaction | undefined> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("depo_transactions")
      .select("*")
      .eq("id", id)
      .maybeSingle<DepoTransactionRow>();

    if (error) throw new Error(`depo_transactions.get: ${error.message}`);
    if (!data) return undefined;
    return mapRowToTransaction(data);
  },

  // ── Create transaction + lines ─────────────────────────────────────────────
  // header ve satırlar ayrı insert'lerdir. header başarılıysa satırlar insert
  // edilir; satır insert başarısızsa header'ı sil (best-effort cleanup).
  async createTransaction(payload: CreateTransactionInput): Promise<DepoTransaction> {
    if (!payload.lines || payload.lines.length === 0) {
      throw new Error("En az bir satir gerekli.");
    }

    const supabase = createClient();
    const transactionId = createId();
    const createdAt = payload.createdAt
      ? new Date(payload.createdAt).toISOString()
      : new Date().toISOString();

    // Build normalized lines
    const normalizedLines = payload.lines.map((line) => {
      const patternId = normalizeText(line.patternId);
      const patternNoSnapshot = normalizeText(line.patternNoSnapshot);
      const patternNameSnapshot = normalizeText(line.patternNameSnapshot);
      const color = normalizeText(line.color);

      if (!patternId || !patternNoSnapshot || !patternNameSnapshot || !color) {
        throw new Error("Transaction satiri eksik alan iceriyor.");
      }
      if (!Number.isFinite(line.metrePerTop) || line.metrePerTop <= 0) {
        throw new Error("metrePerTop gecersiz.");
      }
      if (!Number.isFinite(line.topCount) || line.topCount <= 0) {
        throw new Error("topCount gecersiz.");
      }

      const totalMetres =
        Number.isFinite(line.totalMetres) && line.totalMetres >= 0
          ? line.totalMetres
          : line.metrePerTop * line.topCount;

      const rollIds =
        Array.isArray(line.rollIds) && line.rollIds.length > 0
          ? Array.from(new Set(line.rollIds.map((r) => r.trim()).filter(Boolean)))
          : null;

      const lineRow: DepoTransactionLineRow = {
        id: normalizeText(line.id) ?? createId(),
        transaction_id: transactionId,
        pattern_id: patternId,
        pattern_no_snapshot: patternNoSnapshot,
        pattern_name_snapshot: patternNameSnapshot,
        color,
        metre_per_top: line.metrePerTop,
        top_count: line.topCount,
        total_metres: totalMetres,
        roll_ids: rollIds,
      };
      return lineRow;
    });

    const totals = payload.totals ?? calculateTotals(
      normalizedLines.map((l) => ({
        patternId: l.pattern_id,
        topCount: l.top_count,
        totalMetres: l.total_metres,
      }))
    );

    const headerRow: DepoTransactionRow = {
      id: transactionId,
      type: payload.type,
      status: "ACTIVE",
      created_at: createdAt,
      customer_id: normalizeText(payload.customerId) ?? null,
      customer_name_snapshot: normalizeText(payload.customerNameSnapshot) ?? null,
      note: normalizeText(payload.note) ?? null,
      total_tops: totals.totalTops,
      total_metres: totals.totalMetres,
      pattern_count: totals.patternCount,
      target_transaction_id: normalizeText(payload.targetTransactionId) ?? null,
      reversed_by_transaction_id: null,
      reversed_at: null,
    };

    // Insert header
    const { error: headerError } = await supabase
      .from("depo_transactions")
      .insert(headerRow);

    if (headerError) {
      throw new Error(`depo_transactions.insert: ${headerError.message}`);
    }

    // Insert lines
    const { error: linesError } = await supabase
      .from("depo_transaction_lines")
      .insert(normalizedLines);

    if (linesError) {
      // Best-effort: temizle header'ı
      await supabase.from("depo_transactions").delete().eq("id", transactionId);
      throw new Error(`depo_transaction_lines.insert: ${linesError.message}`);
    }

    return mapRowToTransaction(headerRow);
  },

  // ── Mark transaction as reversed ───────────────────────────────────────────
  async markTransactionReversed(
    transactionId: string,
    reversedByTransactionId: string,
    reversedAt = new Date().toISOString()
  ): Promise<DepoTransaction | undefined> {
    const supabase = createClient();

    const { data, error } = await supabase
      .from("depo_transactions")
      .update({
        status: "REVERSED",
        reversed_by_transaction_id: reversedByTransactionId,
        reversed_at: new Date(reversedAt).toISOString(),
      })
      .eq("id", transactionId)
      .select()
      .maybeSingle<DepoTransactionRow>();

    if (error) throw new Error(`depo_transactions.markReversed: ${error.message}`);
    if (!data) return undefined;
    return mapRowToTransaction(data);
  },
};
