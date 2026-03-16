import type { DepoTransaction, DepoTransactionLine } from "@/lib/domain/depoTransaction";
import type { Pattern } from "@/lib/domain/pattern";

export type DepoDailyEntryMeterGroup = {
  key: string;
  metrePerTop: number;
  topCount: number;
  totalMetres: number;
};

export type DepoDailyEntryVariantGroup = {
  key: string;
  variantLabel: string;
  rows: DepoDailyEntryMeterGroup[];
  totalTops: number;
  totalMetres: number;
};

export type DepoDailyEntryPatternGroup = {
  key: string;
  patternId: string;
  patternNoSnapshot: string;
  patternNameSnapshot: string;
  variants: DepoDailyEntryVariantGroup[];
  totalTops: number;
  totalMetres: number;
};

export type DepoDailyEntryReport = {
  reportDate: string;
  generatedAt: string;
  patterns: DepoDailyEntryPatternGroup[];
  totalPatternCount: number;
  totalVariantCount: number;
  totalTops: number;
  totalMetres: number;
};

type BuildDepoDailyEntryReportInput = {
  reportDate: string;
  generatedAt?: string;
  transactions: DepoTransaction[];
  transactionLines: DepoTransactionLine[];
  patterns: Pattern[];
};

type WorksheetCell = string | number;

const toTimestamp = (value: string) => {
  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
};

const toDayRange = (dateInput: string) => {
  const start = new Date(`${dateInput}T00:00:00`);
  const end = new Date(`${dateInput}T23:59:59.999`);
  return {
    startMs: start.getTime(),
    endMs: end.getTime(),
  };
};

const normalizeVariantLabel = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return "Varyantsiz";
  if (trimmed.toLocaleLowerCase("tr-TR") === "renk yok") return "Varyantsiz";
  return trimmed;
};

const formatDateLabel = (value: string) => {
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString("tr-TR");
};

const formatDateTimeLabel = (value: string) => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString("tr-TR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
};

export const buildDepoDailyEntryReport = ({
  reportDate,
  generatedAt = new Date().toISOString(),
  transactions,
  transactionLines,
  patterns,
}: BuildDepoDailyEntryReportInput): DepoDailyEntryReport => {
  const { startMs, endMs } = toDayRange(reportDate);
  const linesByTransactionId = new Map<string, DepoTransactionLine[]>();
  const patternsById = new Map(patterns.map((pattern) => [pattern.id, pattern]));

  transactionLines.forEach((line) => {
    const current = linesByTransactionId.get(line.transactionId) ?? [];
    current.push(line);
    linesByTransactionId.set(line.transactionId, current);
  });

  const entryTransactions = transactions.filter((transaction) => {
    if (transaction.type !== "ENTRY") return false;
    if (transaction.status !== "ACTIVE") return false;
    const createdAtMs = toTimestamp(transaction.createdAt);
    return createdAtMs >= startMs && createdAtMs <= endMs;
  });

  const patternGroups = new Map<
    string,
    {
      key: string;
      patternId: string;
      patternNoSnapshot: string;
      patternNameSnapshot: string;
      variants: Map<
        string,
        {
          key: string;
          variantLabel: string;
          rows: Map<string, DepoDailyEntryMeterGroup>;
          totalTops: number;
          totalMetres: number;
        }
      >;
      totalTops: number;
      totalMetres: number;
    }
  >();

  entryTransactions.forEach((transaction) => {
    const lines = linesByTransactionId.get(transaction.id) ?? [];

    lines.forEach((line) => {
      const patternMeta = patternsById.get(line.patternId);
      const patternNoSnapshot = line.patternNoSnapshot || patternMeta?.fabricCode || line.patternId;
      const patternNameSnapshot =
        line.patternNameSnapshot || patternMeta?.fabricName || "Silinmis Desen";
      const patternKey = `${line.patternId}|${patternNoSnapshot}`;
      const variantLabel = normalizeVariantLabel(line.color);
      const variantKey = `${patternKey}|${variantLabel.toLocaleLowerCase("tr-TR")}`;
      const metreKey = `${variantKey}|${line.metrePerTop}`;

      if (!patternGroups.has(patternKey)) {
        patternGroups.set(patternKey, {
          key: patternKey,
          patternId: line.patternId,
          patternNoSnapshot,
          patternNameSnapshot,
          variants: new Map(),
          totalTops: 0,
          totalMetres: 0,
        });
      }

      const patternGroup = patternGroups.get(patternKey)!;
      if (!patternGroup.variants.has(variantKey)) {
        patternGroup.variants.set(variantKey, {
          key: variantKey,
          variantLabel,
          rows: new Map(),
          totalTops: 0,
          totalMetres: 0,
        });
      }

      const variantGroup = patternGroup.variants.get(variantKey)!;
      const currentRow = variantGroup.rows.get(metreKey);

      if (currentRow) {
        currentRow.topCount += line.topCount;
        currentRow.totalMetres += line.totalMetres;
      } else {
        variantGroup.rows.set(metreKey, {
          key: metreKey,
          metrePerTop: line.metrePerTop,
          topCount: line.topCount,
          totalMetres: line.totalMetres,
        });
      }

      variantGroup.totalTops += line.topCount;
      variantGroup.totalMetres += line.totalMetres;
      patternGroup.totalTops += line.topCount;
      patternGroup.totalMetres += line.totalMetres;
    });
  });

  const patternRows: DepoDailyEntryPatternGroup[] = Array.from(patternGroups.values())
    .map((patternGroup) => ({
      key: patternGroup.key,
      patternId: patternGroup.patternId,
      patternNoSnapshot: patternGroup.patternNoSnapshot,
      patternNameSnapshot: patternGroup.patternNameSnapshot,
      variants: Array.from(patternGroup.variants.values())
        .map((variantGroup) => ({
          key: variantGroup.key,
          variantLabel: variantGroup.variantLabel,
          rows: Array.from(variantGroup.rows.values()).sort(
            (left, right) => right.metrePerTop - left.metrePerTop
          ),
          totalTops: variantGroup.totalTops,
          totalMetres: variantGroup.totalMetres,
        }))
        .sort((left, right) => left.variantLabel.localeCompare(right.variantLabel, "tr-TR")),
      totalTops: patternGroup.totalTops,
      totalMetres: patternGroup.totalMetres,
    }))
    .sort((left, right) =>
      left.patternNoSnapshot.localeCompare(right.patternNoSnapshot, "tr-TR")
    );

  return {
    reportDate,
    generatedAt,
    patterns: patternRows,
    totalPatternCount: patternRows.length,
    totalVariantCount: patternRows.reduce((sum, pattern) => sum + pattern.variants.length, 0),
    totalTops: patternRows.reduce((sum, pattern) => sum + pattern.totalTops, 0),
    totalMetres: patternRows.reduce((sum, pattern) => sum + pattern.totalMetres, 0),
  };
};

export const buildDepoDailyEntryWorksheetRows = (
  report: DepoDailyEntryReport
): WorksheetCell[][] => {
  const rows: WorksheetCell[][] = [
    ["DEPO GUNLUK GIRIS CIZELGESI"],
    [`Tarih: ${formatDateLabel(report.reportDate)}`],
    [`Olusturulma Saati: ${formatDateTimeLabel(report.generatedAt)}`],
    [],
  ];

  report.patterns.forEach((pattern) => {
    rows.push([`Desen: ${pattern.patternNoSnapshot} - ${pattern.patternNameSnapshot}`]);

    pattern.variants.forEach((variant) => {
      rows.push([`Varyant: ${variant.variantLabel}`]);
      rows.push(["Metre", "Top Adedi", "Toplam Metre"]);

      variant.rows.forEach((row) => {
        rows.push([row.metrePerTop, row.topCount, row.totalMetres]);
      });

      rows.push(["Varyant Toplami", variant.totalTops, variant.totalMetres]);
      rows.push([]);
    });

    rows.push(["Desen Toplami", pattern.totalTops, pattern.totalMetres]);
    rows.push([]);
  });

  rows.push(["GENEL TOPLAM"]);
  rows.push(["Toplam Desen Sayisi", report.totalPatternCount]);
  rows.push(["Toplam Varyant Sayisi", report.totalVariantCount]);
  rows.push(["Toplam Gelen Top", report.totalTops]);
  rows.push(["Toplam Gelen Metre", report.totalMetres]);
  rows.push(["Rapor Tarihi", formatDateLabel(report.reportDate)]);
  rows.push(["Olusturulma Saati", formatDateTimeLabel(report.generatedAt)]);

  return rows;
};
