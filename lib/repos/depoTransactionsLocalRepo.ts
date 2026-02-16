import type {
  DepoTransaction,
  DepoTransactionLine,
  DepoTransactionStatus,
  DepoTransactionTotals,
  DepoTransactionType,
} from "@/lib/domain/depoTransaction";

const TRANSACTIONS_STORAGE_KEY = "depo:transactions";
const TRANSACTION_LINES_STORAGE_KEY = "depo:transaction-lines";

const TRANSACTION_TYPES: DepoTransactionType[] = [
  "SHIPMENT",
  "RESERVATION",
  "REVERSAL",
  "ADJUSTMENT",
];

const TRANSACTION_STATUSES: DepoTransactionStatus[] = ["ACTIVE", "REVERSED"];

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

const normalizeText = (value?: string) => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
};

const toIsoDate = (value: string, label: string) => {
  const source = value.trim();
  if (!source) {
    throw new Error(`${label} is required`);
  }
  const parsed = new Date(source);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`${label} is invalid`);
  }
  return parsed.toISOString();
};

const isTransactionType = (value: unknown): value is DepoTransactionType =>
  typeof value === "string" && TRANSACTION_TYPES.includes(value as DepoTransactionType);

const isTransactionStatus = (value: unknown): value is DepoTransactionStatus =>
  typeof value === "string" && TRANSACTION_STATUSES.includes(value as DepoTransactionStatus);

const toNumber = (value: unknown) => {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const toPositiveInteger = (value: unknown) => {
  const parsed = toNumber(value);
  if (parsed === undefined) return undefined;
  if (parsed <= 0) return undefined;
  return Math.trunc(parsed);
};

const normalizeTotals = (input: unknown): DepoTransactionTotals | undefined => {
  if (!input || typeof input !== "object") return undefined;
  const raw = input as Partial<DepoTransactionTotals>;
  const totalTops = toPositiveInteger(raw.totalTops) ?? 0;
  const totalMetres = toNumber(raw.totalMetres) ?? 0;
  const patternCount = toPositiveInteger(raw.patternCount) ?? 0;
  return {
    totalTops,
    totalMetres: Math.max(0, totalMetres),
    patternCount,
  };
};

const normalizeStoredTransaction = (input: unknown): DepoTransaction | null => {
  if (!input || typeof input !== "object") return null;
  const raw = input as Partial<DepoTransaction>;
  if (!isTransactionType(raw.type)) return null;

  const createdAtRaw = normalizeText(raw.createdAt) ?? new Date().toISOString();
  let createdAt: string;
  try {
    createdAt = toIsoDate(createdAtRaw, "createdAt");
  } catch {
    createdAt = new Date().toISOString();
  }

  const reversedAtRaw = normalizeText(raw.reversedAt);
  let reversedAt: string | undefined;
  if (reversedAtRaw) {
    try {
      reversedAt = toIsoDate(reversedAtRaw, "reversedAt");
    } catch {
      reversedAt = undefined;
    }
  }

  return {
    id: normalizeText(raw.id) ?? createId(),
    type: raw.type,
    status: isTransactionStatus(raw.status) ? raw.status : "ACTIVE",
    createdAt,
    customerId: normalizeText(raw.customerId),
    customerNameSnapshot: normalizeText(raw.customerNameSnapshot),
    note: normalizeText(raw.note),
    totals: normalizeTotals(raw.totals),
    targetTransactionId: normalizeText(raw.targetTransactionId),
    reversedAt,
    reversedByTransactionId: normalizeText(raw.reversedByTransactionId),
  };
};

const normalizeStoredLine = (input: unknown): DepoTransactionLine | null => {
  if (!input || typeof input !== "object") return null;
  const raw = input as Partial<DepoTransactionLine>;

  const transactionId = normalizeText(raw.transactionId);
  const patternId = normalizeText(raw.patternId);
  const patternNoSnapshot = normalizeText(raw.patternNoSnapshot);
  const patternNameSnapshot = normalizeText(raw.patternNameSnapshot);
  const color = normalizeText(raw.color);
  const metrePerTop = toNumber(raw.metrePerTop);
  const topCount = toPositiveInteger(raw.topCount);

  if (!transactionId || !patternId || !patternNoSnapshot || !patternNameSnapshot || !color) {
    return null;
  }
  if (metrePerTop === undefined || metrePerTop <= 0) return null;
  if (!topCount) return null;

  const totalMetresRaw = toNumber(raw.totalMetres);
  const totalMetres =
    totalMetresRaw !== undefined && totalMetresRaw >= 0
      ? totalMetresRaw
      : metrePerTop * topCount;

  const rollIds = Array.isArray(raw.rollIds)
    ? Array.from(
        new Set(
          raw.rollIds
            .map((item) => (typeof item === "string" ? item.trim() : ""))
            .filter(Boolean)
        )
      )
    : undefined;

  return {
    id: normalizeText(raw.id) ?? createId(),
    transactionId,
    patternId,
    patternNoSnapshot,
    patternNameSnapshot,
    color,
    metrePerTop,
    topCount,
    totalMetres,
    rollIds: rollIds && rollIds.length > 0 ? rollIds : undefined,
  };
};

const readTransactions = (): DepoTransaction[] => {
  if (!canUseStorage()) return [];
  return safeParseArray<unknown>(window.localStorage.getItem(TRANSACTIONS_STORAGE_KEY))
    .map(normalizeStoredTransaction)
    .filter((item): item is DepoTransaction => item !== null);
};

const readLines = (): DepoTransactionLine[] => {
  if (!canUseStorage()) return [];
  return safeParseArray<unknown>(window.localStorage.getItem(TRANSACTION_LINES_STORAGE_KEY))
    .map(normalizeStoredLine)
    .filter((item): item is DepoTransactionLine => item !== null);
};

const writeTransactions = (transactions: DepoTransaction[]) => {
  if (!canUseStorage()) return;
  window.localStorage.setItem(
    TRANSACTIONS_STORAGE_KEY,
    JSON.stringify(transactions)
  );
};

const writeLines = (lines: DepoTransactionLine[]) => {
  if (!canUseStorage()) return;
  window.localStorage.setItem(TRANSACTION_LINES_STORAGE_KEY, JSON.stringify(lines));
};

const toTimestamp = (value: string) => {
  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
};

const sortTransactions = (transactions: DepoTransaction[]) =>
  [...transactions].sort((a, b) => toTimestamp(b.createdAt) - toTimestamp(a.createdAt));

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

  return {
    totalTops,
    totalMetres,
    patternCount: patternSet.size,
  };
};

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

export const depoTransactionsLocalRepo = {
  listTransactions(): DepoTransaction[] {
    return sortTransactions(readTransactions());
  },

  listLines(transactionId?: string): DepoTransactionLine[] {
    const lines = readLines();
    if (!transactionId) return lines;
    return lines.filter((line) => line.transactionId === transactionId);
  },

  getTransaction(id: string): DepoTransaction | undefined {
    return this.listTransactions().find((item) => item.id === id);
  },

  getTransactionWithLines(id: string):
    | { transaction: DepoTransaction; lines: DepoTransactionLine[] }
    | undefined {
    const transaction = this.getTransaction(id);
    if (!transaction) return undefined;
    return {
      transaction,
      lines: this.listLines(id),
    };
  },

  createTransaction(payload: CreateTransactionInput): DepoTransaction {
    if (!payload.lines || payload.lines.length === 0) {
      throw new Error("En az bir satir gerekli.");
    }

    const createdAt = toIsoDate(payload.createdAt ?? new Date().toISOString(), "createdAt");
    const transactionId = createId();
    const normalizedLines: DepoTransactionLine[] = payload.lines.map((line) => {
      const patternId = normalizeText(line.patternId);
      const patternNoSnapshot = normalizeText(line.patternNoSnapshot);
      const patternNameSnapshot = normalizeText(line.patternNameSnapshot);
      const color = normalizeText(line.color);
      const metrePerTop = toNumber(line.metrePerTop);
      const topCount = toPositiveInteger(line.topCount);

      if (!patternId || !patternNoSnapshot || !patternNameSnapshot || !color) {
        throw new Error("Islem satiri eksik.");
      }
      if (metrePerTop === undefined || metrePerTop <= 0 || !topCount) {
        throw new Error("Islem satiri gecersiz.");
      }

      const totalMetresRaw = toNumber(line.totalMetres);
      const totalMetres =
        totalMetresRaw !== undefined && totalMetresRaw >= 0
          ? totalMetresRaw
          : metrePerTop * topCount;

      const rollIds = Array.isArray(line.rollIds)
        ? Array.from(
            new Set(
              line.rollIds
                .map((item) => (typeof item === "string" ? item.trim() : ""))
                .filter(Boolean)
            )
          )
        : undefined;

      return {
        id: normalizeText(line.id) ?? createId(),
        transactionId,
        patternId,
        patternNoSnapshot,
        patternNameSnapshot,
        color,
        metrePerTop,
        topCount,
        totalMetres,
        rollIds: rollIds && rollIds.length > 0 ? rollIds : undefined,
      };
    });

    const transactions = readTransactions();
    const lines = readLines();

    const nextTransaction: DepoTransaction = {
      id: transactionId,
      type: payload.type,
      status: "ACTIVE",
      createdAt,
      customerId: normalizeText(payload.customerId),
      customerNameSnapshot: normalizeText(payload.customerNameSnapshot),
      note: normalizeText(payload.note),
      totals: payload.totals ?? calculateTotals(normalizedLines),
      targetTransactionId: normalizeText(payload.targetTransactionId),
    };

    transactions.push(nextTransaction);
    lines.push(...normalizedLines);

    writeTransactions(transactions);
    writeLines(lines);

    return nextTransaction;
  },

  markTransactionReversed(
    transactionId: string,
    reversedByTransactionId: string,
    reversedAt = new Date().toISOString()
  ): DepoTransaction | undefined {
    const transactions = readTransactions();
    const index = transactions.findIndex((item) => item.id === transactionId);
    if (index < 0) return undefined;

    const current = transactions[index];
    const next: DepoTransaction = {
      ...current,
      status: "REVERSED",
      reversedByTransactionId: normalizeText(reversedByTransactionId),
      reversedAt: toIsoDate(reversedAt, "reversedAt"),
    };

    transactions[index] = next;
    writeTransactions(transactions);
    return next;
  },
};
