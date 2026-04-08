import type { Customer } from "@/lib/domain/customer";
import type { FabricRoll } from "@/lib/domain/depo";
import type { Pattern } from "@/lib/domain/pattern";
import type { DepoTransaction, DepoTransactionLine } from "@/lib/domain/depoTransaction";
import { normalizeCustomerName } from "@/lib/repos/customersLocalRepo";
import type {
  SummaryDateRange,
  SummaryTimeScale,
  WarehouseColorBreakdownRow,
  WarehouseCustomerDetailRow,
  WarehouseCustomerDistributionRow,
  WarehousePatternBreakdownRow,
  WarehouseSummaryData,
  WarehouseTrendBucket,
} from "@/lib/summary/summaryTypes";
import {
  clampShare,
  createTimeBuckets,
  getBucketKey,
  isDateInRange,
} from "@/lib/summary/summaryUtils";

type WarehouseSummaryInput = {
  range: SummaryDateRange;
  scale: SummaryTimeScale;
  rolls: FabricRoll[];
  transactions: DepoTransaction[];
  transactionLines: DepoTransactionLine[];
  patterns: Pattern[];
  customers: Customer[];
};

type WarehouseEvent = {
  createdAt: string;
  patternId: string;
  patternCode: string;
  patternName: string;
  patternLabel: string;
  colorName: string;
  customerId: string | null;
  customerName: string;
  metres: number;
  tops: number;
  rollIds: string[];
};

const normalizeText = (value: string | null | undefined) => {
  const trimmed = value?.trim();
  return trimmed ? trimmed.replace(/\s+/g, " ") : null;
};

const createPatternLabel = (patternCode: string, patternName: string) =>
  patternName && patternName !== patternCode ? `${patternCode} / ${patternName}` : patternCode;

const UNKNOWN_CUSTOMER_NAME = "Musteri belirtilmedi";

const isUnknownCustomerName = (value: string | null | undefined) =>
  normalizeCustomerName(value ?? "") === normalizeCustomerName(UNKNOWN_CUSTOMER_NAME);

const hasReadableCase = (value: string) => /[a-zçğıöşü]/u.test(value);

const chooseCustomerLabel = (current: string, candidate: string) => {
  const normalizedCurrent = normalizeText(current);
  const normalizedCandidate = normalizeText(candidate);

  if (!normalizedCandidate) return current;
  if (!normalizedCurrent) return normalizedCandidate;
  if (isUnknownCustomerName(normalizedCurrent) && !isUnknownCustomerName(normalizedCandidate)) {
    return normalizedCandidate;
  }
  if (isUnknownCustomerName(normalizedCandidate)) return normalizedCurrent;
  if (!hasReadableCase(normalizedCurrent) && hasReadableCase(normalizedCandidate)) {
    return normalizedCandidate;
  }
  return normalizedCandidate.length > normalizedCurrent.length
    ? normalizedCandidate
    : normalizedCurrent;
};

const buildCustomerKey = (customerName: string, customerId: string | null) => {
  const normalizedName = normalizeCustomerName(customerName);
  if (normalizedName) return `customer:${normalizedName}`;

  const normalizedId = normalizeText(customerId);
  if (normalizedId) return `customer-id:${normalizedId}`;

  return "customer:tanimsiz";
};

const sortByMetres = <T extends { totalMetres: number; totalTops: number }>(left: T, right: T) => {
  if (right.totalMetres !== left.totalMetres) return right.totalMetres - left.totalMetres;
  return right.totalTops - left.totalTops;
};

const sortByTops = <T extends { totalMetres: number; totalTops: number }>(left: T, right: T) => {
  if (right.totalTops !== left.totalTops) return right.totalTops - left.totalTops;
  return right.totalMetres - left.totalMetres;
};

const buildColorRows = (
  rows: Array<{ colorName: string; totalMetres: number; totalTops: number }>,
  totalMetres: number
): WarehouseColorBreakdownRow[] =>
  rows
    .map((row) => ({
      colorKey: normalizeCustomerName(row.colorName || "renk-belirtilmedi"),
      colorName: row.colorName,
      totalMetres: row.totalMetres,
      totalTops: row.totalTops,
      share: totalMetres > 0 ? clampShare(row.totalMetres / totalMetres) : 0,
    }))
    .sort(sortByMetres);

const resolveRollColor = (roll: FabricRoll, patternsById: Map<string, Pattern>) => {
  const pattern = patternsById.get(roll.patternId);
  if (pattern?.variants && roll.variantId) {
    const variant = pattern.variants.find((item) => item.id === roll.variantId);
    const variantColor = normalizeText(variant?.colorName) ?? normalizeText(variant?.name);
    if (variantColor) return variantColor;
  }
  return normalizeText(roll.colorName) ?? "Renk belirtilmedi";
};

const resolveCustomerNameFromRolls = (
  lines: DepoTransactionLine[],
  rollsById: Map<string, FabricRoll>
) => {
  const candidateCounts = new Map<string, number>();
  const candidateLabels = new Map<string, string>();

  lines.forEach((line) => {
    (line.rollIds ?? []).forEach((rollId) => {
      const roll = rollsById.get(rollId);
      if (!roll) return;

      [roll.counterparty, roll.reservedFor].forEach((candidate) => {
        const normalized = normalizeText(candidate);
        if (!normalized) return;

        const key = normalizeCustomerName(normalized);
        if (!key) return;

        candidateCounts.set(key, (candidateCounts.get(key) ?? 0) + 1);
        candidateLabels.set(key, chooseCustomerLabel(candidateLabels.get(key) ?? "", normalized));
      });
    });
  });

  const winner = Array.from(candidateCounts.entries())
    .sort((left, right) => {
      if (right[1] !== left[1]) return right[1] - left[1];
      return (candidateLabels.get(left[0]) ?? "").localeCompare(
        candidateLabels.get(right[0]) ?? "",
        "tr-TR"
      );
    })[0]?.[0];

  return winner ? candidateLabels.get(winner) ?? null : null;
};

const resolveTransactionCustomerName = (
  transaction: DepoTransaction,
  lines: DepoTransactionLine[],
  customersById: Map<string, Customer>,
  rollsById: Map<string, FabricRoll>
) =>
  normalizeText(transaction.customerNameSnapshot) ??
  resolveCustomerNameFromRolls(lines, rollsById) ??
  normalizeText(customersById.get(transaction.customerId ?? "")?.nameOriginal) ??
  UNKNOWN_CUSTOMER_NAME;

export const buildWarehouseSummary = ({
  range,
  scale,
  rolls,
  transactions,
  transactionLines,
  patterns,
  customers,
}: WarehouseSummaryInput): WarehouseSummaryData => {
  const buckets = createTimeBuckets(range, scale).map<WarehouseTrendBucket>((bucket) => ({
    ...bucket,
    inboundMetres: 0,
    shippedMetres: 0,
    returnedMetres: 0,
    inboundTops: 0,
    shippedTops: 0,
    returnedTops: 0,
  }));

  const bucketMap = new Map<string, WarehouseTrendBucket>();
  buckets.forEach((bucket) => {
    bucketMap.set(bucket.key, bucket);
  });

  const patternsById = new Map(patterns.map((pattern) => [pattern.id, pattern]));
  const customersById = new Map(customers.map((customer) => [customer.id, customer]));
  const rollsById = new Map(rolls.map((roll) => [roll.id, roll]));
  const linesByTransactionId = new Map<string, DepoTransactionLine[]>();

  transactionLines.forEach((line) => {
    const current = linesByTransactionId.get(line.transactionId) ?? [];
    current.push(line);
    linesByTransactionId.set(line.transactionId, current);
  });

  const transactionsById = new Map(transactions.map((transaction) => [transaction.id, transaction]));
  const reversedShipmentIds = new Set(
    transactions
      .filter(
        (transaction) =>
          transaction.type === "REVERSAL" &&
          transaction.targetTransactionId &&
          transactionsById.get(transaction.targetTransactionId)?.type === "SHIPMENT"
      )
      .map((transaction) => transaction.targetTransactionId as string)
  );

  const activeShipmentTransactions = transactions.filter(
    (transaction) =>
      transaction.type === "SHIPMENT" &&
      transaction.status !== "REVERSED" &&
      !reversedShipmentIds.has(transaction.id)
  );

  const returnTransactions = transactions.filter((transaction) => {
    if (transaction.type === "RETURN") return transaction.status === "ACTIVE";
    if (transaction.type !== "REVERSAL" || !transaction.targetTransactionId) return false;
    return transactionsById.get(transaction.targetTransactionId)?.type === "SHIPMENT";
  });

  const shipmentEvents: WarehouseEvent[] = [];
  activeShipmentTransactions.forEach((transaction) => {
    const lines = linesByTransactionId.get(transaction.id) ?? [];
    const customerName = resolveTransactionCustomerName(
      transaction,
      lines,
      customersById,
      rollsById
    );
    const customerId = normalizeText(transaction.customerId);

    lines.forEach((line) => {
      const patternMeta = patternsById.get(line.patternId);
      const patternCode = normalizeText(line.patternNoSnapshot) ?? patternMeta?.fabricCode ?? line.patternId;
      const patternName =
        normalizeText(line.patternNameSnapshot) ?? patternMeta?.fabricName ?? "Silinmis Desen";

      shipmentEvents.push({
        createdAt: transaction.createdAt,
        patternId: line.patternId,
        patternCode,
        patternName,
        patternLabel: createPatternLabel(patternCode, patternName),
        colorName: normalizeText(line.color) ?? "Renk belirtilmedi",
        customerId,
        customerName,
        metres: line.totalMetres,
        tops: line.topCount,
        rollIds: line.rollIds ?? [],
      });
    });
  });

  const returnEvents: WarehouseEvent[] = [];
  const returnedRollIds = new Set<string>();

  returnTransactions.forEach((transaction) => {
    const lines = linesByTransactionId.get(transaction.id) ?? [];
    const customerName = resolveTransactionCustomerName(
      transaction,
      lines,
      customersById,
      rollsById
    );

    lines.forEach((line) => {
      const patternMeta = patternsById.get(line.patternId);
      const patternCode = normalizeText(line.patternNoSnapshot) ?? patternMeta?.fabricCode ?? line.patternId;
      const patternName =
        normalizeText(line.patternNameSnapshot) ?? patternMeta?.fabricName ?? "Silinmis Desen";

      (line.rollIds ?? []).forEach((rollId) => {
        returnedRollIds.add(rollId);
      });

      returnEvents.push({
        createdAt: transaction.createdAt,
        patternId: line.patternId,
        patternCode,
        patternName,
        patternLabel: createPatternLabel(patternCode, patternName),
        colorName: normalizeText(line.color) ?? "Renk belirtilmedi",
        customerId: normalizeText(transaction.customerId),
        customerName,
        metres: line.totalMetres,
        tops: line.topCount,
        rollIds: line.rollIds ?? [],
      });
    });
  });

  const inboundEvents: WarehouseEvent[] = rolls
    .filter((roll) => roll.status !== "VOIDED")
    .filter((roll) => !returnedRollIds.has(roll.id))
    .map((roll) => {
      const patternMeta = patternsById.get(roll.patternId);
      const patternCode = patternMeta?.fabricCode ?? roll.patternId;
      const patternName = patternMeta?.fabricName ?? "Silinmis Desen";

      return {
        createdAt: roll.inAt,
        patternId: roll.patternId,
        patternCode,
        patternName,
        patternLabel: createPatternLabel(patternCode, patternName),
        colorName: resolveRollColor(roll, patternsById),
        customerId: null,
        customerName: "Depo Girisi",
        metres: roll.meters,
        tops: 1,
        rollIds: [roll.id],
      };
    });

  const totals = {
    inbound: { metres: 0, tops: 0 },
    shipped: { metres: 0, tops: 0 },
    returned: { metres: 0, tops: 0 },
    netMovement: { metres: 0, tops: 0 },
  };

  inboundEvents.forEach((event) => {
    if (!isDateInRange(event.createdAt, range)) return;
    totals.inbound.metres += event.metres;
    totals.inbound.tops += event.tops;

    const bucket = bucketMap.get(getBucketKey(new Date(event.createdAt), scale));
    if (!bucket) return;
    bucket.inboundMetres += event.metres;
    bucket.inboundTops += event.tops;
  });

  shipmentEvents.forEach((event) => {
    if (!isDateInRange(event.createdAt, range)) return;
    totals.shipped.metres += event.metres;
    totals.shipped.tops += event.tops;

    const bucket = bucketMap.get(getBucketKey(new Date(event.createdAt), scale));
    if (!bucket) return;
    bucket.shippedMetres += event.metres;
    bucket.shippedTops += event.tops;
  });

  returnEvents.forEach((event) => {
    if (!isDateInRange(event.createdAt, range)) return;
    totals.returned.metres += event.metres;
    totals.returned.tops += event.tops;

    const bucket = bucketMap.get(getBucketKey(new Date(event.createdAt), scale));
    if (!bucket) return;
    bucket.returnedMetres += event.metres;
    bucket.returnedTops += event.tops;
  });

  totals.netMovement.metres =
    totals.inbound.metres + totals.returned.metres - totals.shipped.metres;
  totals.netMovement.tops =
    totals.inbound.tops + totals.returned.tops - totals.shipped.tops;

  const shipmentEventsInRange = shipmentEvents.filter((event) => isDateInRange(event.createdAt, range));

  const customerMap = new Map<string, WarehouseCustomerDistributionRow>();
  shipmentEventsInRange.forEach((event) => {
    const customerKey = buildCustomerKey(event.customerName, event.customerId);
    const current = customerMap.get(customerKey) ?? {
      customerKey,
      customerId: event.customerId,
      customerName: event.customerName,
      totalMetres: 0,
      totalTops: 0,
      share: 0,
    };

    current.customerId = current.customerId ?? event.customerId;
    current.customerName = chooseCustomerLabel(current.customerName, event.customerName);
    current.totalMetres += event.metres;
    current.totalTops += event.tops;
    customerMap.set(customerKey, current);
  });

  const customerTotalMetres = shipmentEventsInRange.reduce((sum, event) => sum + event.metres, 0);
  const customersRows = Array.from(customerMap.values())
    .map((row) => ({
      ...row,
      share: customerTotalMetres > 0 ? clampShare(row.totalMetres / customerTotalMetres) : 0,
    }))
    .sort(sortByMetres);

  type PatternAccumulator = {
    patternKey: string;
    patternId: string;
    patternCode: string;
    patternName: string;
    patternLabel: string;
    totalMetres: number;
    totalTops: number;
    colors: Map<string, { colorName: string; totalMetres: number; totalTops: number }>;
  };

  const patternMap = new Map<string, PatternAccumulator>();
  shipmentEventsInRange.forEach((event) => {
    const patternKey = event.patternId || `${event.patternCode}:${event.patternName}`;
    const current = patternMap.get(patternKey) ?? {
      patternKey,
      patternId: event.patternId,
      patternCode: event.patternCode,
      patternName: event.patternName,
      patternLabel: event.patternLabel,
      totalMetres: 0,
      totalTops: 0,
      colors: new Map(),
    };

    current.totalMetres += event.metres;
    current.totalTops += event.tops;

    const colorKey = normalizeCustomerName(event.colorName) || "renk-belirtilmedi";
    const colorCurrent = current.colors.get(colorKey) ?? {
      colorName: event.colorName,
      totalMetres: 0,
      totalTops: 0,
    };
    colorCurrent.totalMetres += event.metres;
    colorCurrent.totalTops += event.tops;
    current.colors.set(colorKey, colorCurrent);
    patternMap.set(patternKey, current);
  });

  const patternsRows: WarehousePatternBreakdownRow[] = Array.from(patternMap.values())
    .map((row) => {
      const colors = buildColorRows(Array.from(row.colors.values()), row.totalMetres);
      return {
        patternKey: row.patternKey,
        patternId: row.patternId,
        patternCode: row.patternCode,
        patternName: row.patternName,
        patternLabel: row.patternLabel,
        totalMetres: row.totalMetres,
        totalTops: row.totalTops,
        colorCount: colors.length,
        topColorName: colors[0]?.colorName ?? null,
        colors,
      };
    })
    .sort(sortByMetres);

  const customerDetailMap = new Map<
    string,
    {
      customerKey: string;
      customerId: string | null;
      customerName: string;
      totalMetres: number;
      totalTops: number;
      patterns: Map<string, PatternAccumulator>;
    }
  >();

  shipmentEventsInRange.forEach((event) => {
    const customerKey = buildCustomerKey(event.customerName, event.customerId);
    const current = customerDetailMap.get(customerKey) ?? {
      customerKey,
      customerId: event.customerId,
      customerName: event.customerName,
      totalMetres: 0,
      totalTops: 0,
      patterns: new Map(),
    };

    current.customerId = current.customerId ?? event.customerId;
    current.customerName = chooseCustomerLabel(current.customerName, event.customerName);
    current.totalMetres += event.metres;
    current.totalTops += event.tops;

    const patternKey = event.patternId || `${event.patternCode}:${event.patternName}`;
    const patternCurrent = current.patterns.get(patternKey) ?? {
      patternKey,
      patternId: event.patternId,
      patternCode: event.patternCode,
      patternName: event.patternName,
      patternLabel: event.patternLabel,
      totalMetres: 0,
      totalTops: 0,
      colors: new Map<string, { colorName: string; totalMetres: number; totalTops: number }>(),
    };

    patternCurrent.totalMetres += event.metres;
    patternCurrent.totalTops += event.tops;

    const colorKey = normalizeCustomerName(event.colorName) || "renk-belirtilmedi";
    const colorCurrent = patternCurrent.colors.get(colorKey) ?? {
      colorName: event.colorName,
      totalMetres: 0,
      totalTops: 0,
    };
    colorCurrent.totalMetres += event.metres;
    colorCurrent.totalTops += event.tops;
    patternCurrent.colors.set(colorKey, colorCurrent);

    current.patterns.set(patternKey, patternCurrent);
    customerDetailMap.set(customerKey, current);
  });

  const customerDetails: WarehouseCustomerDetailRow[] = Array.from(customerDetailMap.values())
    .map((row) => {
      const patternRows = Array.from(row.patterns.values())
        .map((patternRow) => {
          const colors = buildColorRows(Array.from(patternRow.colors.values()), patternRow.totalMetres);
          return {
            patternKey: patternRow.patternKey,
            patternId: patternRow.patternId,
            patternCode: patternRow.patternCode,
            patternName: patternRow.patternName,
            patternLabel: patternRow.patternLabel,
            totalMetres: patternRow.totalMetres,
            totalTops: patternRow.totalTops,
            colorCount: colors.length,
            topColorName: colors[0]?.colorName ?? null,
            colors,
          };
        })
        .sort(sortByTops);

      return {
        customerKey: row.customerKey,
        customerId: row.customerId,
        customerName: row.customerName,
        totalMetres: row.totalMetres,
        totalTops: row.totalTops,
        patternCount: patternRows.length,
        topPatternLabel: patternRows[0]?.patternLabel ?? null,
        patterns: patternRows,
      };
    })
    .sort(sortByTops);

  const hasData =
    totals.inbound.metres > 0 ||
    totals.shipped.metres > 0 ||
    totals.returned.metres > 0 ||
    customersRows.length > 0 ||
    patternsRows.length > 0;

  return {
    totals,
    trend: buckets,
    customers: customersRows,
    patterns: patternsRows,
    customerDetails,
    hasData,
  };
};
