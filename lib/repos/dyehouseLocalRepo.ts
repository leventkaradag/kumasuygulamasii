"use client";

import type { Dyehouse } from "@/lib/domain/dyehouse";

const STORAGE_KEY = "dokuma:dyehouses";

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

const sortByName = (rows: Dyehouse[]) =>
  [...rows].sort((a, b) => a.name.localeCompare(b.name, "tr-TR"));

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
};
