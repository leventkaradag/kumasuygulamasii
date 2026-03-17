import type {
  DepoTransaction,
  DepoTransactionLine,
  DepoTransactionType,
} from "@/lib/domain/depoTransaction";
import type { Pattern } from "@/lib/domain/pattern";
import type { WeavingPlan, WeavingProgressEntry } from "@/lib/domain/weaving";

export type PatternNoteOperationLabel =
  | "Top Girisi"
  | "Sevk"
  | "Rezerv"
  | "Dokuma Ilerlemesi";

export type PatternNoteEntry = {
  id: string;
  patternId: string;
  transactionId?: string;
  operationLabel: PatternNoteOperationLabel;
  note: string;
  createdAt: string;
  colorName?: string;
  variantCode?: string;
  scopeSummary?: string;
  meters?: number;
  metersPerUnit?: number;
  unitCount?: number;
  topCount?: number;
  metrePerTop?: number;
  lineCount?: number;
  sourceType: "DEPO" | "DOKUMA";
};

type BuildPatternNoteHistoryInput = {
  patternId: string;
  transactions: DepoTransaction[];
  transactionLines: DepoTransactionLine[];
  weavingPlans: WeavingPlan[];
  weavingProgressEntries: WeavingProgressEntry[];
  patterns?: Pattern[];
};

const noteTypeLabelByTransactionType: Partial<
  Record<DepoTransactionType, PatternNoteOperationLabel>
> = {
  ENTRY: "Top Girisi",
  SHIPMENT: "Sevk",
  RESERVATION: "Rezerv",
};

const normalizeText = (value?: string | null) => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
};

const normalizeKey = (value?: string | null) =>
  normalizeText(value)?.toLocaleLowerCase("tr-TR");

const toTimestamp = (value: string) => {
  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
};

const summarizeValues = (values: Array<string | undefined>) => {
  const unique = Array.from(new Set(values.map((value) => normalizeText(value)).filter(Boolean)));
  if (unique.length === 0) return undefined;
  if (unique.length === 1) return unique[0];
  if (unique.length === 2) return `${unique[0]}, ${unique[1]}`;
  return `${unique[0]}, ${unique[1]} +${unique.length - 2} renk`;
};

export const buildPatternNoteHistory = ({
  patternId,
  transactions,
  transactionLines,
  weavingPlans,
  weavingProgressEntries,
  patterns = [],
}: BuildPatternNoteHistoryInput): PatternNoteEntry[] => {
  const linesByTransactionId = new Map<string, DepoTransactionLine[]>();
  transactionLines.forEach((line) => {
    const current = linesByTransactionId.get(line.transactionId) ?? [];
    current.push(line);
    linesByTransactionId.set(line.transactionId, current);
  });

  const plansById = new Map(weavingPlans.map((plan) => [plan.id, plan] as const));
  const patternsById = new Map(patterns.map((pattern) => [pattern.id, pattern] as const));

  const depoNotes = transactions.flatMap((transaction) => {
    const operationLabel = noteTypeLabelByTransactionType[transaction.type];
    const note = normalizeText(transaction.note);
    if (!operationLabel || !note) return [];

    const relevantLines = (linesByTransactionId.get(transaction.id) ?? []).filter(
      (line) => line.patternId === patternId
    );
    if (relevantLines.length === 0) return [];

    const totalTopCount = relevantLines.reduce((sum, line) => sum + line.topCount, 0);
    const totalMeters = relevantLines.reduce((sum, line) => sum + line.totalMetres, 0);
    const colorSummary = summarizeValues(relevantLines.map((line) => line.color));
    const singleLine = relevantLines.length === 1 ? relevantLines[0] : null;

    return [
      {
        id: `depo:${transaction.id}:${patternId}`,
        patternId,
        transactionId: transaction.id,
        operationLabel,
        note,
        createdAt: transaction.createdAt,
        colorName: singleLine ? normalizeText(singleLine.color) : undefined,
        scopeSummary: colorSummary,
        meters: totalMeters,
        topCount: totalTopCount,
        metrePerTop: singleLine?.metrePerTop,
        lineCount: relevantLines.length,
        sourceType: "DEPO" as const,
      },
    ];
  });

  const dokumaNotes = weavingProgressEntries.flatMap((entry) => {
    const note = normalizeText(entry.note);
    if (!note) return [];

    const plan = plansById.get(entry.planId);
    if (!plan || plan.patternId !== patternId) return [];

    const variant =
      entry.variantId && Array.isArray(plan.variants)
        ? plan.variants.find((item) => item.id === entry.variantId)
        : undefined;
    const variantCode =
      normalizeText(entry.variantCodeSnapshot) ??
      normalizeText(variant?.variantCode) ??
      (() => {
        const pattern = patternsById.get(patternId);
        const matched = pattern?.variants.find((item) => {
          return normalizeKey(item.colorName ?? item.name) === normalizeKey(entry.colorNameSnapshot);
        });
        return normalizeText(matched?.colorCode);
      })();
    const variantSummary = [variantCode, normalizeText(entry.colorNameSnapshot) ?? normalizeText(variant?.colorName)]
      .filter(Boolean)
      .join(" / ");

    return [
      {
        id: `dokuma:${entry.id}`,
        patternId,
        operationLabel: "Dokuma Ilerlemesi" as const,
        note,
        createdAt: entry.createdAt,
        colorName: normalizeText(entry.colorNameSnapshot) ?? normalizeText(variant?.colorName),
        variantCode,
        scopeSummary: variantSummary || undefined,
        meters: entry.meters,
        metersPerUnit: entry.metersPerUnit,
        unitCount: entry.unitCount,
        lineCount: 1,
        sourceType: "DOKUMA" as const,
      },
    ];
  });

  return [...depoNotes, ...dokumaNotes].sort(
    (left, right) => toTimestamp(right.createdAt) - toTimestamp(left.createdAt)
  );
};
