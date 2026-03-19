"use client";

import type {
  CustomerOrder,
  CustomerOrderLine,
  CustomerOrderPatternBlock,
  DyehouseOrder,
  DyehouseOrderDetails,
  DyehouseOrderLine,
  DyehouseOrderPatternBlock,
  OrderNote,
} from "@/lib/domain/orders";

const CUSTOMER_ORDERS_STORAGE_KEY = "orders:customer";
const DYEHOUSE_ORDERS_STORAGE_KEY = "orders:dyehouse";
const ORDER_NOTES_STORAGE_KEY = "orders:notes";

type SaveCustomerOrderInput = {
  id?: string;
  orderDate: string;
  customerName: string;
  orderTitle?: string;
  generalNote?: string;
  patternBlocks: Array<{
    id?: string;
    patternCode?: string;
    patternName?: string;
    lines: Array<Partial<CustomerOrderLine>>;
  }>;
};

type SaveDyehouseOrderInput = {
  id?: string;
  title: string;
  companyTitle: string;
  attentionLine?: string;
  orderDate: string;
  patternBlocks: Array<{
    id?: string;
    patternCode?: string;
    patternName?: string;
    lines: Array<Partial<DyehouseOrderLine>>;
  }>;
  details?: Partial<DyehouseOrderDetails>;
};

type SaveOrderNoteInput = {
  id?: string;
  noteDate: string;
  title: string;
  content: string;
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
  if (!trimmed) {
    throw new Error(`${label} gerekli.`);
  }
  return trimmed;
};

const toIsoDate = (value: string, label: string) => {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error(`${label} gerekli.`);
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const [yearText, monthText, dayText] = trimmed.split("-");
    const year = Number(yearText);
    const month = Number(monthText);
    const day = Number(dayText);
    const parsed = new Date(year, month - 1, day);
    if (
      Number.isNaN(parsed.getTime()) ||
      parsed.getFullYear() !== year ||
      parsed.getMonth() !== month - 1 ||
      parsed.getDate() !== day
    ) {
      throw new Error(`${label} gecersiz.`);
    }
    return trimmed;
  }

  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`${label} gecersiz.`);
  }
  return parsed.toISOString();
};

const toTimestamp = (value: string) => {
  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
};

const normalizeOptionalPositiveNumber = (value: unknown) => {
  if (value === null || value === undefined || value === "") return undefined;
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return undefined;
  return numeric;
};

const normalizeOptionalPositiveInteger = (value: unknown) => {
  if (value === null || value === undefined || value === "") return undefined;
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || !Number.isInteger(numeric) || numeric <= 0) {
    return undefined;
  }
  return numeric;
};

const normalizeStoredCustomerOrderLine = (
  input: unknown,
  fallbackSequence: number
): CustomerOrderLine | null => {
  if (!input || typeof input !== "object") return null;
  const raw = input as Partial<CustomerOrderLine>;

  const meters =
    typeof raw.meters === "number" && Number.isFinite(raw.meters)
      ? raw.meters
      : Number(raw.meters);
  const colorName = normalizeText(raw.colorName);
  const topCount = normalizeOptionalPositiveInteger(raw.topCount);
  const normalizedMeters = Number.isFinite(meters) && meters > 0 ? meters : undefined;
  if (!colorName || (topCount === undefined && normalizedMeters === undefined)) return null;

  const sequence =
    typeof raw.sequence === "number" && Number.isFinite(raw.sequence) && raw.sequence > 0
      ? Math.trunc(raw.sequence)
      : fallbackSequence;

  return {
    id: normalizeText(raw.id) ?? createId(),
    sequence,
    colorName,
    colorCode: normalizeText(raw.colorCode),
    variantDescription: normalizeText(raw.variantDescription),
    topCount,
    meters: normalizedMeters,
    status: normalizeText(raw.status),
    note: normalizeText(raw.note),
  };
};

const normalizeStoredCustomerPatternBlock = (
  input: unknown,
  fallbackSequence: number
): CustomerOrderPatternBlock | null => {
  if (!input || typeof input !== "object") return null;
  const raw = input as Partial<CustomerOrderPatternBlock> & { lines?: unknown };

  const lines = Array.isArray(raw.lines)
    ? raw.lines
        .map((line, index) => normalizeStoredCustomerOrderLine(line, index + 1))
        .filter((line): line is CustomerOrderLine => line !== null)
    : [];
  if (!lines.length) return null;

  const sequence =
    typeof raw.sequence === "number" && Number.isFinite(raw.sequence) && raw.sequence > 0
      ? Math.trunc(raw.sequence)
      : fallbackSequence;

  return {
    id: normalizeText(raw.id) ?? createId(),
    sequence,
    patternCode: normalizeText(raw.patternCode),
    patternName: normalizeText(raw.patternName),
    lines,
  };
};

const buildLegacyCustomerPatternBlocks = (
  input: Partial<{
    patternName: unknown;
    variant: unknown;
    topCount: unknown;
    meters: unknown;
    note: unknown;
  }>
): CustomerOrderPatternBlock[] => {
  const patternName = normalizeText(
    typeof input.patternName === "string" ? input.patternName : undefined
  );
  const topCount = normalizeOptionalPositiveInteger(input.topCount);
  const meters = normalizeOptionalPositiveNumber(input.meters);
  if (!patternName || (topCount === undefined && meters === undefined)) return [];

  return [
    {
      id: createId(),
      sequence: 1,
      patternName,
      lines: [
        {
          id: createId(),
          sequence: 1,
          colorName:
            normalizeText(typeof input.variant === "string" ? input.variant : undefined) ?? "Genel",
          topCount,
          meters,
          note: normalizeText(typeof input.note === "string" ? input.note : undefined),
        },
      ],
    },
  ];
};

const normalizeStoredCustomerOrder = (input: unknown): CustomerOrder | null => {
  if (!input || typeof input !== "object") return null;
  const raw = input as Partial<CustomerOrder> & {
    patternBlocks?: unknown;
    patternName?: unknown;
    variant?: unknown;
    topCount?: unknown;
    meters?: unknown;
    note?: unknown;
  };

  const customerName = normalizeText(raw.customerName);
  if (!customerName) return null;

  const patternBlocks = Array.isArray(raw.patternBlocks)
    ? raw.patternBlocks
        .map((block, index) => normalizeStoredCustomerPatternBlock(block, index + 1))
        .filter((block): block is CustomerOrderPatternBlock => block !== null)
    : buildLegacyCustomerPatternBlocks(raw);
  if (!patternBlocks.length) return null;

  const orderDateRaw = normalizeText(raw.orderDate) ?? new Date().toISOString();
  const createdAtRaw = normalizeText(raw.createdAt) ?? new Date().toISOString();
  const updatedAtRaw = normalizeText(raw.updatedAt) ?? createdAtRaw;

  return {
    id: normalizeText(raw.id) ?? createId(),
    orderDate: Number.isNaN(new Date(orderDateRaw).getTime())
      ? new Date().toISOString()
      : new Date(orderDateRaw).toISOString(),
    customerName,
    orderTitle: normalizeText(raw.orderTitle),
    generalNote: normalizeText(raw.generalNote),
    patternBlocks,
    createdAt: Number.isNaN(new Date(createdAtRaw).getTime())
      ? new Date().toISOString()
      : new Date(createdAtRaw).toISOString(),
    updatedAt: Number.isNaN(new Date(updatedAtRaw).getTime())
      ? new Date().toISOString()
      : new Date(updatedAtRaw).toISOString(),
  };
};

const normalizeStoredDyehouseOrderLine = (
  input: unknown,
  fallbackSequence: number
): DyehouseOrderLine | null => {
  if (!input || typeof input !== "object") return null;
  const raw = input as Partial<DyehouseOrderLine>;

  const colorName = normalizeText(raw.colorName);
  if (!colorName) return null;

  const topCount = normalizeOptionalPositiveInteger(raw.topCount);
  const rawMeters = normalizeOptionalPositiveNumber(raw.rawMeters);
  if (topCount === undefined && rawMeters === undefined) return null;

  const sequence =
    typeof raw.sequence === "number" && Number.isFinite(raw.sequence) && raw.sequence > 0
      ? Math.trunc(raw.sequence)
      : fallbackSequence;

  return {
    id: normalizeText(raw.id) ?? createId(),
    sequence,
    colorName,
    variantDescription: normalizeText(raw.variantDescription),
    topCount,
    rawMeters,
    status: normalizeText(raw.status),
    description: normalizeText(raw.description),
  };
};

const normalizeStoredDyehousePatternBlock = (
  input: unknown,
  fallbackSequence: number
): DyehouseOrderPatternBlock | null => {
  if (!input || typeof input !== "object") return null;
  const raw = input as Partial<DyehouseOrderPatternBlock> & { lines?: unknown };

  const lines = Array.isArray(raw.lines)
    ? raw.lines
        .map((line, index) => normalizeStoredDyehouseOrderLine(line, index + 1))
        .filter((line): line is DyehouseOrderLine => line !== null)
    : [];
  if (!lines.length) return null;

  const sequence =
    typeof raw.sequence === "number" && Number.isFinite(raw.sequence) && raw.sequence > 0
      ? Math.trunc(raw.sequence)
      : fallbackSequence;

  return {
    id: normalizeText(raw.id) ?? createId(),
    sequence,
    patternCode: normalizeText(raw.patternCode),
    patternName: normalizeText(raw.patternName),
    lines,
  };
};

const normalizeStoredDyehouseOrderDetails = (input: unknown): DyehouseOrderDetails => {
  if (!input || typeof input !== "object") return {};
  const raw = input as Partial<DyehouseOrderDetails>;
  return {
    patternCode: normalizeText(raw.patternCode),
    content: normalizeText(raw.content),
    rawWidth: normalizeText(raw.rawWidth),
    rawWeight: normalizeText(raw.rawWeight),
    finishedWidth: normalizeText(raw.finishedWidth),
    processNo: normalizeText(raw.processNo),
    extraNote: normalizeText(raw.extraNote),
    generalNote: normalizeText(raw.generalNote),
  };
};

const buildLegacyPatternBlock = (
  legacyRows: unknown,
  details: DyehouseOrderDetails,
  title: string
): DyehouseOrderPatternBlock[] => {
  if (!Array.isArray(legacyRows)) return [];

  const lines = legacyRows
    .map((row, index) => normalizeStoredDyehouseOrderLine(row, index + 1))
    .filter((row): row is DyehouseOrderLine => row !== null);

  if (!lines.length) return [];

  return [
    {
      id: createId(),
      sequence: 1,
      patternCode: details.patternCode,
      patternName: title,
      lines,
    },
  ];
};

const normalizeStoredDyehouseOrder = (input: unknown): DyehouseOrder | null => {
  if (!input || typeof input !== "object") return null;
  const raw = input as Partial<DyehouseOrder> & {
    rows?: unknown;
    patternBlocks?: unknown;
    details?: unknown;
  };

  const title = normalizeText(raw.title);
  const companyTitle = normalizeText(raw.companyTitle);
  if (!title || !companyTitle) return null;

  const orderDateRaw = normalizeText(raw.orderDate) ?? new Date().toISOString();
  const createdAtRaw = normalizeText(raw.createdAt) ?? new Date().toISOString();
  const updatedAtRaw = normalizeText(raw.updatedAt) ?? createdAtRaw;

  const details = normalizeStoredDyehouseOrderDetails(raw.details);
  const patternBlocks = Array.isArray(raw.patternBlocks)
    ? raw.patternBlocks
        .map((block, index) => normalizeStoredDyehousePatternBlock(block, index + 1))
        .filter((block): block is DyehouseOrderPatternBlock => block !== null)
    : buildLegacyPatternBlock(raw.rows, details, title);
  if (!patternBlocks.length) return null;

  return {
    id: normalizeText(raw.id) ?? createId(),
    title,
    companyTitle,
    attentionLine: normalizeText(raw.attentionLine),
    orderDate: Number.isNaN(new Date(orderDateRaw).getTime())
      ? new Date().toISOString()
      : new Date(orderDateRaw).toISOString(),
    patternBlocks,
    details,
    createdAt: Number.isNaN(new Date(createdAtRaw).getTime())
      ? new Date().toISOString()
      : new Date(createdAtRaw).toISOString(),
    updatedAt: Number.isNaN(new Date(updatedAtRaw).getTime())
      ? new Date().toISOString()
      : new Date(updatedAtRaw).toISOString(),
  };
};

const normalizeStoredOrderNote = (input: unknown): OrderNote | null => {
  if (!input || typeof input !== "object") return null;
  const raw = input as Partial<OrderNote>;

  const title = normalizeText(raw.title);
  const content = normalizeText(raw.content);
  if (!title || !content) return null;

  const noteDateRaw = normalizeText(raw.noteDate) ?? new Date().toISOString();
  const createdAtRaw = normalizeText(raw.createdAt) ?? new Date().toISOString();
  const updatedAtRaw = normalizeText(raw.updatedAt) ?? createdAtRaw;

  return {
    id: normalizeText(raw.id) ?? createId(),
    noteDate: Number.isNaN(new Date(noteDateRaw).getTime())
      ? new Date().toISOString()
      : new Date(noteDateRaw).toISOString(),
    title,
    content,
    createdAt: Number.isNaN(new Date(createdAtRaw).getTime())
      ? new Date().toISOString()
      : new Date(createdAtRaw).toISOString(),
    updatedAt: Number.isNaN(new Date(updatedAtRaw).getTime())
      ? new Date().toISOString()
      : new Date(updatedAtRaw).toISOString(),
  };
};

const readCustomerOrders = (): CustomerOrder[] => {
  if (!canUseStorage()) return [];
  return safeParseArray<unknown>(window.localStorage.getItem(CUSTOMER_ORDERS_STORAGE_KEY))
    .map(normalizeStoredCustomerOrder)
    .filter((row): row is CustomerOrder => row !== null);
};

const writeCustomerOrders = (rows: CustomerOrder[]) => {
  if (!canUseStorage()) return;
  window.localStorage.setItem(CUSTOMER_ORDERS_STORAGE_KEY, JSON.stringify(rows));
};

const readDyehouseOrders = (): DyehouseOrder[] => {
  if (!canUseStorage()) return [];
  return safeParseArray<unknown>(window.localStorage.getItem(DYEHOUSE_ORDERS_STORAGE_KEY))
    .map(normalizeStoredDyehouseOrder)
    .filter((row): row is DyehouseOrder => row !== null);
};

const writeDyehouseOrders = (rows: DyehouseOrder[]) => {
  if (!canUseStorage()) return;
  window.localStorage.setItem(DYEHOUSE_ORDERS_STORAGE_KEY, JSON.stringify(rows));
};

const readOrderNotes = (): OrderNote[] => {
  if (!canUseStorage()) return [];
  return safeParseArray<unknown>(window.localStorage.getItem(ORDER_NOTES_STORAGE_KEY))
    .map(normalizeStoredOrderNote)
    .filter((row): row is OrderNote => row !== null);
};

const writeOrderNotes = (rows: OrderNote[]) => {
  if (!canUseStorage()) return;
  window.localStorage.setItem(ORDER_NOTES_STORAGE_KEY, JSON.stringify(rows));
};

const sortCustomerOrders = (rows: CustomerOrder[]) =>
  [...rows].sort((a, b) => toTimestamp(b.orderDate) - toTimestamp(a.orderDate));

const sortDyehouseOrders = (rows: DyehouseOrder[]) =>
  [...rows].sort((a, b) => toTimestamp(b.orderDate) - toTimestamp(a.orderDate));

const sortOrderNotes = (rows: OrderNote[]) =>
  [...rows].sort((a, b) => toTimestamp(b.noteDate) - toTimestamp(a.noteDate));

const normalizeCustomerLinesInput = (
  inputRows: Array<Partial<CustomerOrderLine>>,
  blockIndex: number
): CustomerOrderLine[] => {
  const meaningfulRows = inputRows.filter((row) => {
    return Boolean(
      normalizeText(row.colorName) ??
        normalizeText(row.colorCode) ??
        normalizeText(row.variantDescription) ??
        normalizeText(row.status) ??
        normalizeText(row.note) ??
        normalizeOptionalPositiveInteger(row.topCount) ??
        normalizeOptionalPositiveNumber(row.meters)
    );
  });

  if (!meaningfulRows.length) {
    throw new Error(`Desen ${blockIndex + 1} icin en az bir renk satiri gerekli.`);
  }

  return meaningfulRows.map((row, rowIndex) => {
    const colorName = normalizeRequiredText(
      row.colorName ?? "",
      `Desen ${blockIndex + 1} / Satir ${rowIndex + 1} renk adi`
    );
    const topCount = normalizeOptionalPositiveInteger(row.topCount);
    const meters = normalizeOptionalPositiveNumber(row.meters);
    if (topCount === undefined && meters === undefined) {
      throw new Error(
        `Desen ${blockIndex + 1} / Satir ${rowIndex + 1} icin top veya metre girilmeli.`
      );
    }

    return {
      id: normalizeText(row.id) ?? createId(),
      sequence: rowIndex + 1,
      colorName,
      colorCode: normalizeText(row.colorCode),
      variantDescription: normalizeText(row.variantDescription),
      topCount,
      meters,
      status: normalizeText(row.status),
      note: normalizeText(row.note),
    };
  });
};

const normalizeCustomerPatternBlocksInput = (
  inputBlocks: SaveCustomerOrderInput["patternBlocks"]
): CustomerOrderPatternBlock[] => {
  const meaningfulBlocks = inputBlocks.filter((block) => {
    return Boolean(
      normalizeText(block.patternCode) ??
        normalizeText(block.patternName) ??
        block.lines.some((line) =>
          Boolean(
            normalizeText(line.colorName) ??
              normalizeText(line.colorCode) ??
              normalizeText(line.variantDescription) ??
              normalizeText(line.status) ??
              normalizeText(line.note) ??
              normalizeOptionalPositiveInteger(line.topCount) ??
              normalizeOptionalPositiveNumber(line.meters)
          )
        )
    );
  });

  if (!meaningfulBlocks.length) {
    throw new Error("En az bir desen blogu gerekli.");
  }

  return meaningfulBlocks.map((block, blockIndex) => {
    const patternCode = normalizeText(block.patternCode);
    const patternName = normalizeText(block.patternName);
    if (!patternCode && !patternName) {
      throw new Error(`Desen ${blockIndex + 1} icin kod veya ad girilmeli.`);
    }

    return {
      id: normalizeText(block.id) ?? createId(),
      sequence: blockIndex + 1,
      patternCode,
      patternName,
      lines: normalizeCustomerLinesInput(block.lines, blockIndex),
    };
  });
};

const normalizeDyehouseLinesInput = (
  inputRows: Array<Partial<DyehouseOrderLine>>,
  blockIndex: number
): DyehouseOrderLine[] => {
  const meaningfulRows = inputRows.filter((row) => {
    return Boolean(
      normalizeText(row.colorName) ??
        normalizeText(row.variantDescription) ??
        normalizeText(row.status) ??
        normalizeText(row.description) ??
        normalizeOptionalPositiveInteger(row.topCount) ??
        normalizeOptionalPositiveNumber(row.rawMeters)
    );
  });

  if (!meaningfulRows.length) {
    throw new Error(`Desen ${blockIndex + 1} icin en az bir renk satiri gerekli.`);
  }

  return meaningfulRows.map((row, rowIndex) => {
    const colorName = normalizeRequiredText(
      row.colorName ?? "",
      `Desen ${blockIndex + 1} / Satir ${rowIndex + 1} renk`
    );
    const topCount = normalizeOptionalPositiveInteger(row.topCount);
    const rawMeters = normalizeOptionalPositiveNumber(row.rawMeters);
    if (topCount === undefined && rawMeters === undefined) {
      throw new Error(
        `Desen ${blockIndex + 1} / Satir ${rowIndex + 1} icin top veya ham metre girilmeli.`
      );
    }

    return {
      id: normalizeText(row.id) ?? createId(),
      sequence: rowIndex + 1,
      colorName,
      variantDescription: normalizeText(row.variantDescription),
      topCount,
      rawMeters,
      status: normalizeText(row.status),
      description: normalizeText(row.description),
    };
  });
};

const normalizeDyehousePatternBlocksInput = (
  inputBlocks: SaveDyehouseOrderInput["patternBlocks"]
): DyehouseOrderPatternBlock[] => {
  const meaningfulBlocks = inputBlocks.filter((block) => {
    return Boolean(
      normalizeText(block.patternCode) ??
        normalizeText(block.patternName) ??
        block.lines.some((line) =>
          Boolean(
            normalizeText(line.colorName) ??
              normalizeText(line.variantDescription) ??
              normalizeText(line.status) ??
              normalizeText(line.description) ??
              normalizeOptionalPositiveInteger(line.topCount) ??
              normalizeOptionalPositiveNumber(line.rawMeters)
          )
        )
    );
  });

  if (!meaningfulBlocks.length) {
    throw new Error("En az bir desen blogu gerekli.");
  }

  return meaningfulBlocks.map((block, blockIndex) => {
    const patternCode = normalizeText(block.patternCode);
    const patternName = normalizeText(block.patternName);
    if (!patternCode && !patternName) {
      throw new Error(`Desen ${blockIndex + 1} icin kod veya ad girilmeli.`);
    }

    return {
      id: normalizeText(block.id) ?? createId(),
      sequence: blockIndex + 1,
      patternCode,
      patternName,
      lines: normalizeDyehouseLinesInput(block.lines, blockIndex),
    };
  });
};

export const ordersLocalRepo = {
  listCustomerOrders(): CustomerOrder[] {
    return sortCustomerOrders(readCustomerOrders());
  },

  saveCustomerOrder(input: SaveCustomerOrderInput): CustomerOrder {
    const now = new Date().toISOString();
    const rows = readCustomerOrders();
    const index = input.id ? rows.findIndex((row) => row.id === input.id) : -1;
    const current = index >= 0 ? rows[index] : undefined;

    const next: CustomerOrder = {
      id: current?.id ?? createId(),
      orderDate: toIsoDate(input.orderDate, "Tarih"),
      customerName: normalizeRequiredText(input.customerName, "Musteri"),
      orderTitle: normalizeText(input.orderTitle),
      generalNote: normalizeText(input.generalNote),
      patternBlocks: normalizeCustomerPatternBlocksInput(input.patternBlocks),
      createdAt: current?.createdAt ?? now,
      updatedAt: now,
    };

    if (index >= 0) {
      rows[index] = next;
    } else {
      rows.push(next);
    }

    writeCustomerOrders(rows);
    return next;
  },

  deleteCustomerOrder(id: string): boolean {
    const normalizedId = normalizeText(id);
    if (!normalizedId) return false;

    const rows = readCustomerOrders();
    const nextRows = rows.filter((row) => row.id !== normalizedId);
    if (nextRows.length === rows.length) return false;
    writeCustomerOrders(nextRows);
    return true;
  },

  listDyehouseOrders(): DyehouseOrder[] {
    return sortDyehouseOrders(readDyehouseOrders());
  },

  saveDyehouseOrder(input: SaveDyehouseOrderInput): DyehouseOrder {
    const now = new Date().toISOString();
    const rows = readDyehouseOrders();
    const index = input.id ? rows.findIndex((row) => row.id === input.id) : -1;
    const current = index >= 0 ? rows[index] : undefined;

    const next: DyehouseOrder = {
      id: current?.id ?? createId(),
      title: normalizeRequiredText(input.title, "Baslik"),
      companyTitle: normalizeRequiredText(input.companyTitle, "Firma basligi"),
      attentionLine: normalizeText(input.attentionLine),
      orderDate: toIsoDate(input.orderDate, "Tarih"),
      patternBlocks: normalizeDyehousePatternBlocksInput(input.patternBlocks),
      details: normalizeStoredDyehouseOrderDetails(input.details),
      createdAt: current?.createdAt ?? now,
      updatedAt: now,
    };

    if (index >= 0) {
      rows[index] = next;
    } else {
      rows.push(next);
    }

    writeDyehouseOrders(rows);
    return next;
  },

  deleteDyehouseOrder(id: string): boolean {
    const normalizedId = normalizeText(id);
    if (!normalizedId) return false;

    const rows = readDyehouseOrders();
    const nextRows = rows.filter((row) => row.id !== normalizedId);
    if (nextRows.length === rows.length) return false;
    writeDyehouseOrders(nextRows);
    return true;
  },

  listOrderNotes(): OrderNote[] {
    return sortOrderNotes(readOrderNotes());
  },

  saveOrderNote(input: SaveOrderNoteInput): OrderNote {
    const now = new Date().toISOString();
    const rows = readOrderNotes();
    const index = input.id ? rows.findIndex((row) => row.id === input.id) : -1;
    const current = index >= 0 ? rows[index] : undefined;

    const next: OrderNote = {
      id: current?.id ?? createId(),
      noteDate: toIsoDate(input.noteDate, "Tarih"),
      title: normalizeRequiredText(input.title, "Baslik"),
      content: normalizeRequiredText(input.content, "Icerik"),
      createdAt: current?.createdAt ?? now,
      updatedAt: now,
    };

    if (index >= 0) {
      rows[index] = next;
    } else {
      rows.push(next);
    }

    writeOrderNotes(rows);
    return next;
  },

  deleteOrderNote(id: string): boolean {
    const normalizedId = normalizeText(id);
    if (!normalizedId) return false;

    const rows = readOrderNotes();
    const nextRows = rows.filter((row) => row.id !== normalizedId);
    if (nextRows.length === rows.length) return false;
    writeOrderNotes(nextRows);
    return true;
  },
};
