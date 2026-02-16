import type { Customer } from "@/lib/domain/customer";

const STORAGE_KEY = "depo:customers";

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
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`${label} is invalid`);
  }
  return parsed.toISOString();
};

export const normalizeCustomerName = (value: string) =>
  value.trim().toLocaleLowerCase("tr-TR").replace(/\s+/g, " ");

const normalizeStoredCustomer = (input: unknown): Customer | null => {
  if (!input || typeof input !== "object") return null;
  const raw = input as Partial<Customer>;

  const nameOriginal = normalizeText(raw.nameOriginal);
  if (!nameOriginal) return null;

  const nameNormalized = normalizeCustomerName(raw.nameNormalized ?? nameOriginal);
  if (!nameNormalized) return null;

  const createdAtRaw = normalizeText(raw.createdAt) ?? new Date().toISOString();
  let createdAt: string;
  try {
    createdAt = toIsoDate(createdAtRaw, "createdAt");
  } catch {
    createdAt = new Date().toISOString();
  }

  return {
    id: normalizeText(raw.id) ?? createId(),
    nameOriginal,
    nameNormalized,
    createdAt,
  };
};

const readCustomers = (): Customer[] => {
  if (!canUseStorage()) return [];
  return safeParseArray<unknown>(window.localStorage.getItem(STORAGE_KEY))
    .map(normalizeStoredCustomer)
    .filter((item): item is Customer => item !== null);
};

const writeCustomers = (customers: Customer[]) => {
  if (!canUseStorage()) return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(customers));
};

const sortCustomers = (customers: Customer[]) =>
  [...customers].sort((a, b) => a.nameOriginal.localeCompare(b.nameOriginal, "tr-TR"));

export const customersLocalRepo = {
  list(): Customer[] {
    return sortCustomers(readCustomers());
  },

  get(id: string): Customer | undefined {
    return this.list().find((customer) => customer.id === id);
  },

  findByNormalized(nameNormalized: string): Customer | undefined {
    const normalized = normalizeCustomerName(nameNormalized);
    if (!normalized) return undefined;
    return this.list().find((customer) => customer.nameNormalized === normalized);
  },

  ensureByName(name: string): Customer {
    const nameOriginal = normalizeText(name);
    if (!nameOriginal) {
      throw new Error("Musteri adi gerekli.");
    }
    const nameNormalized = normalizeCustomerName(nameOriginal);
    if (!nameNormalized) {
      throw new Error("Musteri adi gerekli.");
    }

    const customers = readCustomers();
    const existing = customers.find((customer) => customer.nameNormalized === nameNormalized);
    if (existing) {
      return existing;
    }

    const nextCustomer: Customer = {
      id: createId(),
      nameOriginal,
      nameNormalized,
      createdAt: new Date().toISOString(),
    };

    customers.push(nextCustomer);
    writeCustomers(customers);
    return nextCustomer;
  },
};
