import type { FabricRoll, FabricRollStatus } from "@/lib/domain/depo";

const STORAGE_KEY = "depo:rolls";

export type RollFilters = {
  patternId?: string;
  variantId?: string;
  status?: FabricRollStatus;
  from?: string;
  to?: string;
  q?: string;
};

type AddRollPayload = {
  patternId: string;
  variantId?: string;
  colorName?: string;
  meters: number;
  rollNo?: string;
  inAt: string;
  note?: string;
};

type EditRollPayload = {
  variantId?: string;
  colorName?: string;
  meters?: number;
  rollNo?: string;
  note?: string;
};

const ROLL_STATUSES: FabricRollStatus[] = [
  "IN_STOCK",
  "RESERVED",
  "SHIPPED",
  "RETURNED",
  "VOIDED",
  "SCRAP",
];

const hasWindow = () =>
  typeof window !== "undefined" && typeof window.localStorage !== "undefined";

const safeParseArray = <T,>(raw: string | null): T[] => {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
};

const isFabricRollStatus = (value: unknown): value is FabricRollStatus =>
  typeof value === "string" && ROLL_STATUSES.includes(value as FabricRollStatus);

const normalizeText = (value?: string) => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
};

const normalizeRequiredText = (value: string, label: string) => {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error(`${label} is required`);
  }
  return trimmed;
};

const toIsoDate = (value: string, label: string) => {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error(`${label} is required`);
  }

  const source = /^\d{4}-\d{2}-\d{2}$/.test(trimmed)
    ? `${trimmed}T00:00:00.000`
    : trimmed;
  const parsed = new Date(source);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`${label} is invalid`);
  }
  return parsed.toISOString();
};

const parseFilterDate = (value: string | undefined, endOfDay: boolean) => {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;

  const source = /^\d{4}-\d{2}-\d{2}$/.test(trimmed)
    ? `${trimmed}T${endOfDay ? "23:59:59.999" : "00:00:00.000"}`
    : trimmed;
  const parsed = new Date(source);
  if (Number.isNaN(parsed.getTime())) return undefined;
  return parsed.getTime();
};

const toTimestamp = (value: string) => {
  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
};

const toOptionalIsoDate = (value?: string) => {
  if (!value) return undefined;
  try {
    return toIsoDate(value, "date");
  } catch {
    return undefined;
  }
};

const normalizeMeters = (value: number) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 0) {
    throw new Error("meters cannot be negative");
  }
  return numeric;
};

const createId = () => {
  const randomUUID = globalThis.crypto?.randomUUID;
  if (typeof randomUUID === "function") {
    return randomUUID.call(globalThis.crypto);
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const normalizeStoredRoll = (input: unknown): FabricRoll | null => {
  if (!input || typeof input !== "object") return null;
  const raw = input as Partial<FabricRoll>;

  if (typeof raw.patternId !== "string" || !raw.patternId.trim()) return null;
  if (typeof raw.meters !== "number" || !Number.isFinite(raw.meters) || raw.meters < 0) {
    return null;
  }
  if (typeof raw.inAt !== "string" || !raw.inAt.trim()) return null;

  let inAt: string;
  try {
    inAt = toIsoDate(raw.inAt, "inAt");
  } catch {
    return null;
  }

  return {
    id: normalizeText(raw.id) ?? createId(),
    patternId: raw.patternId.trim(),
    variantId: normalizeText(raw.variantId),
    colorName: normalizeText(raw.colorName),
    meters: raw.meters,
    rollNo: normalizeText(raw.rollNo),
    status: isFabricRollStatus(raw.status) ? raw.status : "IN_STOCK",
    inAt,
    outAt: toOptionalIsoDate(raw.outAt),
    reservedAt: toOptionalIsoDate(raw.reservedAt),
    reservedFor: normalizeText(raw.reservedFor),
    counterparty: normalizeText(raw.counterparty),
    note: normalizeText(raw.note),
  };
};

const readRolls = (): FabricRoll[] => {
  if (!hasWindow()) return [];
  return safeParseArray<unknown>(window.localStorage.getItem(STORAGE_KEY))
    .map(normalizeStoredRoll)
    .filter((roll): roll is FabricRoll => roll !== null);
};

const writeRolls = (rolls: FabricRoll[]) => {
  if (!hasWindow()) return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(rolls));
};

const updateRoll = (
  rollId: string,
  transform: (roll: FabricRoll) => FabricRoll | null
): FabricRoll | undefined => {
  const rolls = readRolls();
  const index = rolls.findIndex((roll) => roll.id === rollId);
  if (index < 0) return undefined;

  const next = transform(rolls[index]);
  if (!next) return undefined;

  rolls[index] = next;
  writeRolls(rolls);
  return next;
};

export const depoLocalRepo = {
  listRolls(filters: RollFilters = {}): FabricRoll[] {
    const fromTimestamp = parseFilterDate(filters.from, false);
    const toFilterTimestamp = parseFilterDate(filters.to, true);
    const normalizedQuery = filters.q?.trim().toLocaleLowerCase("tr-TR") ?? "";

    return readRolls()
      .filter((roll) => {
        if (filters.patternId && roll.patternId !== filters.patternId) return false;
        if (filters.variantId && roll.variantId !== filters.variantId) return false;
        if (filters.status && roll.status !== filters.status) return false;

        const inAtTimestamp = toTimestamp(roll.inAt);
        if (fromTimestamp !== undefined && inAtTimestamp < fromTimestamp) return false;
        if (toFilterTimestamp !== undefined && inAtTimestamp > toFilterTimestamp) return false;

        if (normalizedQuery) {
          const rollNo = (roll.rollNo ?? "").toLocaleLowerCase("tr-TR");
          const colorName = (roll.colorName ?? "").toLocaleLowerCase("tr-TR");
          if (!rollNo.includes(normalizedQuery) && !colorName.includes(normalizedQuery)) {
            return false;
          }
        }

        return true;
      })
      .sort((a, b) => toTimestamp(b.inAt) - toTimestamp(a.inAt));
  },

  getRoll(rollId: string): FabricRoll | undefined {
    return readRolls().find((roll) => roll.id === rollId);
  },

  addRoll(payload: AddRollPayload): FabricRoll {
    const nextRoll: FabricRoll = {
      id: createId(),
      patternId: normalizeRequiredText(payload.patternId, "patternId"),
      variantId: normalizeText(payload.variantId),
      colorName: normalizeText(payload.colorName),
      meters: normalizeMeters(payload.meters),
      rollNo: normalizeText(payload.rollNo),
      status: "IN_STOCK",
      inAt: toIsoDate(payload.inAt, "inAt"),
      note: normalizeText(payload.note),
    };

    const rolls = readRolls();
    rolls.push(nextRoll);
    writeRolls(rolls);
    return nextRoll;
  },

  reserveRoll(rollId: string, reservedFor: string, dateISO: string): FabricRoll | undefined {
    const nextReservedFor = normalizeRequiredText(reservedFor, "reservedFor");
    const reservedAt = toIsoDate(dateISO, "dateISO");

    return updateRoll(rollId, (roll) => {
      if (roll.status !== "IN_STOCK") return null;
      return {
        ...roll,
        status: "RESERVED",
        reservedFor: nextReservedFor,
        reservedAt,
      };
    });
  },

  unreserveRoll(rollId: string): FabricRoll | undefined {
    return updateRoll(rollId, (roll) => {
      if (roll.status !== "RESERVED") return null;
      return {
        ...roll,
        status: "IN_STOCK",
        reservedFor: undefined,
        reservedAt: undefined,
      };
    });
  },

  shipRoll(rollId: string, counterparty: string, dateISO: string): FabricRoll | undefined {
    const nextCounterparty = normalizeText(counterparty);
    if (!nextCounterparty) return undefined;
    const outAt = toIsoDate(dateISO, "dateISO");

    return updateRoll(rollId, (roll) => {
      if (roll.status !== "IN_STOCK" && roll.status !== "RESERVED") return null;
      return {
        ...roll,
        status: "SHIPPED",
        outAt,
        counterparty: nextCounterparty,
        reservedFor: undefined,
        reservedAt: undefined,
      };
    });
  },

  returnRoll(rollId: string, dateISO: string): FabricRoll | undefined {
    const inAt = toIsoDate(dateISO, "dateISO");

    return updateRoll(rollId, (roll) => {
      if (roll.status !== "SHIPPED") return null;
      return {
        ...roll,
        status: "IN_STOCK",
        inAt,
        outAt: undefined,
        counterparty: undefined,
        reservedFor: undefined,
        reservedAt: undefined,
      };
    });
  },

  voidRoll(rollId: string, dateISO: string, reason?: string): FabricRoll | undefined {
    const outAt = toIsoDate(dateISO, "dateISO");
    const normalizedReason = normalizeText(reason);

    return updateRoll(rollId, (roll) => {
      if (roll.status !== "IN_STOCK") return null;
      const auditNote = normalizedReason
        ? `VOID: ${normalizedReason}`
        : "VOID: Manuel kaldirma";

      return {
        ...roll,
        status: "VOIDED",
        outAt,
        reservedFor: undefined,
        reservedAt: undefined,
        counterparty: undefined,
        note: roll.note ? `${roll.note} | ${auditNote}` : auditNote,
      };
    });
  },

  editRoll(rollId: string, payload: EditRollPayload): FabricRoll | undefined {
    return updateRoll(rollId, (roll) => {
      if (roll.status === "SHIPPED") return null;
      if (roll.status === "VOIDED") return null;
      if (roll.status === "SCRAP") return null;

      const nextMeters =
        payload.meters === undefined ? roll.meters : normalizeMeters(payload.meters);
      const nextRollNo =
        payload.rollNo === undefined ? roll.rollNo : normalizeText(payload.rollNo);
      const nextVariantId =
        payload.variantId === undefined ? roll.variantId : normalizeText(payload.variantId);
      const nextColorName =
        payload.colorName === undefined ? roll.colorName : normalizeText(payload.colorName);

      return {
        ...roll,
        meters: nextMeters,
        rollNo: nextRollNo,
        variantId: nextVariantId,
        colorName: nextColorName,
        note:
          payload.note === undefined
            ? roll.note
            : normalizeText(payload.note),
      };
    });
  },

  scrapRoll(rollId: string, dateISO: string, reason?: string): FabricRoll | undefined {
    const outAt = toIsoDate(dateISO, "dateISO");
    return updateRoll(rollId, (roll) => {
      if (roll.status === "SHIPPED") return null;
      if (roll.status === "SCRAP") return null;

      return {
        ...roll,
        status: "SCRAP",
        outAt,
        reservedFor: undefined,
        reservedAt: undefined,
        counterparty: undefined,
        note: normalizeText(reason) ?? roll.note,
      };
    });
  },

  deleteRollHard(rollId: string): boolean {
    // HARD DELETE DISABLED. Use voidRoll + transactions.
    if (process.env.NODE_ENV !== "production") {
      console.warn("[depoLocalRepo] deleteRollHard blocked; returning false.", { rollId });
    }
    return false;
  },
};
