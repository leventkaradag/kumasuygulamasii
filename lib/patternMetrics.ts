import type { Pattern } from "@/lib/domain/pattern";
import type { FabricRoll } from "@/lib/domain/depo";
import type { DyehouseJob } from "@/lib/domain/dyehouse";
import type { WeavingDispatchDocument, WeavingPlan, WeavingProgressEntry } from "@/lib/domain/weaving";
import { dyehouseLocalRepo } from "@/lib/repos/dyehouseLocalRepo";
import { weavingLocalRepo } from "@/lib/repos/weavingLocalRepo";

type MeterMetricKey =
  | "totalProducedMeters"
  | "stockMeters"
  | "inDyehouseMeters"
  | "defectMeters";

export type PatternMetricSource = "operations" | "manual";

export type PatternMetricSummary = Pick<
  Pattern,
  "totalProducedMeters" | "stockMeters" | "inDyehouseMeters" | "defectMeters"
> & {
  stockRollCount: number;
  reservedMeters: number;
  reservedRollCount: number;
  defectRollCount: number;
  sources: Record<MeterMetricKey, PatternMetricSource>;
};

type WarehouseAccumulator = {
  hasWarehouseData: boolean;
  hasDefectData: boolean;
  stockMeters: number;
  stockRollCount: number;
  reservedMeters: number;
  reservedRollCount: number;
  defectMeters: number;
  defectRollCount: number;
};

const metricKeys: MeterMetricKey[] = [
  "totalProducedMeters",
  "stockMeters",
  "inDyehouseMeters",
  "defectMeters",
];

const createEmptySummary = (): PatternMetricSummary => ({
  totalProducedMeters: 0,
  stockMeters: 0,
  inDyehouseMeters: 0,
  defectMeters: 0,
  stockRollCount: 0,
  reservedMeters: 0,
  reservedRollCount: 0,
  defectRollCount: 0,
  sources: {
    totalProducedMeters: "manual",
    stockMeters: "manual",
    inDyehouseMeters: "manual",
    defectMeters: "manual",
  },
});

const normalizeMetricValue = (value: unknown) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : 0;
};

const addToMap = (map: Map<string, number>, key: string, value: number) => {
  map.set(key, (map.get(key) ?? 0) + value);
};

const getWarehouseAccumulator = (
  map: Map<string, WarehouseAccumulator>,
  patternId: string
): WarehouseAccumulator => {
  const current = map.get(patternId);
  if (current) return current;

  const next: WarehouseAccumulator = {
    hasWarehouseData: false,
    hasDefectData: false,
    stockMeters: 0,
    stockRollCount: 0,
    reservedMeters: 0,
    reservedRollCount: 0,
    defectMeters: 0,
    defectRollCount: 0,
  };
  map.set(patternId, next);
  return next;
};

const applyRollToWarehouseMetrics = (
  roll: FabricRoll,
  warehouseByPatternId: Map<string, WarehouseAccumulator>
) => {
  // VOIDED ve SHIPPED toplar hiçbir metriğe katkı sağlamaz.
  // hasWarehouseData'yı kirletmemek için bu satırların başında kontrol et.
  // (Eski hata: VOIDED toplar hasWarehouseData=true yapıyor, stockMeters'a katmıyor
  //  → pattern.stockMeters fallback'i devre dışı → Desenler'de 0 gösteriyordu.)
  if (roll.status === "VOIDED" || roll.status === "SHIPPED") return;

  const bucket = getWarehouseAccumulator(warehouseByPatternId, roll.patternId);

  if (roll.status === "IN_STOCK" || roll.status === "RETURNED") {
    bucket.hasWarehouseData = true;
    bucket.stockMeters += roll.meters;
    bucket.stockRollCount += 1;
    return;
  }

  if (roll.status === "RESERVED") {
    bucket.hasWarehouseData = true;
    bucket.stockMeters += roll.meters;
    bucket.stockRollCount += 1;
    bucket.reservedMeters += roll.meters;
    bucket.reservedRollCount += 1;
    return;
  }

  if (roll.status === "SCRAP") {
    bucket.hasWarehouseData = true;
    bucket.hasDefectData = true;
    bucket.defectMeters += roll.meters;
    bucket.defectRollCount += 1;
  }
};

const buildProgressByPlanId = (entries: WeavingProgressEntry[]) => {
  const progressByPlanId = new Map<string, number>();
  entries.forEach((entry) => {
    addToMap(progressByPlanId, entry.planId, entry.meters);
  });
  return progressByPlanId;
};

const sumProducedMetersFromPlan = (
  plan: WeavingPlan,
  progressByPlanId: Map<string, number>
) => {
  if (Array.isArray(plan.variants) && plan.variants.length > 0) {
    return plan.variants.reduce((total, variant) => total + normalizeMetricValue(variant.wovenMeters), 0);
  }

  return normalizeMetricValue(progressByPlanId.get(plan.id));
};




const buildInDyehouseMetricsFromDocuments = (documents: WeavingDispatchDocument[]) => {
  const sentToDyehouse = new Map<string, number>();
  const returnedFromDyehouse = new Map<string, number>();
  const patternsWithDocumentFlow = new Set<string>();

  documents.forEach((document) => {
    if (!document.patternId) return;

    if (document.type === "SEVK" && document.destination === "BOYAHANE") {
      patternsWithDocumentFlow.add(document.patternId);
      addToMap(sentToDyehouse, document.patternId, document.metersTotal);
      return;
    }

    if (document.type === "BOYAHANE_TO_DEPO") {
      patternsWithDocumentFlow.add(document.patternId);
      addToMap(returnedFromDyehouse, document.patternId, document.metersTotal);
    }
  });

  return {
    patternsWithDocumentFlow,
    sentToDyehouse,
    returnedFromDyehouse,
  };
};

const buildInDyehouseMetricsFromJobs = (jobs: DyehouseJob[]) => {
  const openJobMeters = new Map<string, number>();
  const patternsWithJobs = new Set<string>();

  jobs.forEach((job) => {
    if (!job.patternId) return;
    patternsWithJobs.add(job.patternId);

    if (job.status === "CANCELLED" || job.outputDispatchDocId) {
      return;
    }

    addToMap(openJobMeters, job.patternId, job.inputMetersTotal);
  });

  return {
    patternsWithJobs,
    openJobMeters,
  };
};

/**
 * Desen metrik haritasını oluşturur.
 *
 * @param patterns  - Supabase'den gelen desen listesi
 * @param rolls     - Supabase'den gelen kumaş top listesi.
 *                    Her iki sayfa (Depo + Desenler) aynı kaynaktan (depoSupabaseRepo.listRolls)
 *                    aldığı rolls listesini buraya geçirmelidir.
 *                    Geçilmezse boş array kullanılır (localStorage fallback yok).
 */
export const buildPatternMetricMap = (patterns: Pattern[], rolls: FabricRoll[] = []) => {
  const summaries = new Map<string, PatternMetricSummary>();

  const warehouseByPatternId = new Map<string, WarehouseAccumulator>();
  rolls.forEach((roll) => {
    applyRollToWarehouseMetrics(roll, warehouseByPatternId);
  });

  const progressByPlanId = buildProgressByPlanId(weavingLocalRepo.listProgress());
  const producedMetersByPatternId = new Map<string, number>();
  const patternsWithProductionData = new Set<string>();

  weavingLocalRepo.listPlans().forEach((plan) => {
    if (!plan.patternId) return;
    patternsWithProductionData.add(plan.patternId);
    addToMap(
      producedMetersByPatternId,
      plan.patternId,
      sumProducedMetersFromPlan(plan, progressByPlanId)
    );
  });

  const dispatchMetrics = buildInDyehouseMetricsFromDocuments(
    weavingLocalRepo.listDispatchDocuments()
  );
  const jobMetrics = buildInDyehouseMetricsFromJobs(dyehouseLocalRepo.listJobs());

  patterns.forEach((pattern) => {
    const summary = createEmptySummary();
    const warehouse = warehouseByPatternId.get(pattern.id);

    summary.stockRollCount = warehouse?.stockRollCount ?? 0;
    summary.reservedMeters = warehouse?.reservedMeters ?? 0;
    summary.reservedRollCount = warehouse?.reservedRollCount ?? 0;
    summary.defectRollCount = warehouse?.defectRollCount ?? 0;

    if (warehouse?.hasWarehouseData) {
      summary.stockMeters = warehouse.stockMeters;
      summary.sources.stockMeters = "operations";
    } else {
      // Operasyonel (roll) verisi yok → pattern tablosundaki alanı kullan.
      summary.stockMeters = normalizeMetricValue(pattern.stockMeters);
    }

    if (warehouse?.hasDefectData) {
      summary.defectMeters = warehouse.defectMeters;
      summary.sources.defectMeters = "operations";
    } else {
      summary.defectMeters = normalizeMetricValue(pattern.defectMeters);
    }

    if (patternsWithProductionData.has(pattern.id)) {
      summary.totalProducedMeters = producedMetersByPatternId.get(pattern.id) ?? 0;
      summary.sources.totalProducedMeters = "operations";
    } else {
      summary.totalProducedMeters = normalizeMetricValue(pattern.totalProducedMeters);
    }

    if (dispatchMetrics.patternsWithDocumentFlow.has(pattern.id)) {
      const sent = dispatchMetrics.sentToDyehouse.get(pattern.id) ?? 0;
      const returned = dispatchMetrics.returnedFromDyehouse.get(pattern.id) ?? 0;
      summary.inDyehouseMeters = Math.max(0, sent - returned);
      summary.sources.inDyehouseMeters = "operations";
    } else if (jobMetrics.patternsWithJobs.has(pattern.id)) {
      summary.inDyehouseMeters = jobMetrics.openJobMeters.get(pattern.id) ?? 0;
      summary.sources.inDyehouseMeters = "operations";
    } else {
      summary.inDyehouseMeters = normalizeMetricValue(pattern.inDyehouseMeters);
    }

    metricKeys.forEach((key) => {
      summary[key] = normalizeMetricValue(summary[key]);
    });

    summaries.set(pattern.id, summary);
  });

  return summaries;
};

export const getFallbackPatternMetricSummary = (
  pattern: Pick<
    Pattern,
    "totalProducedMeters" | "stockMeters" | "inDyehouseMeters" | "defectMeters"
  >
): PatternMetricSummary => {
  const summary = createEmptySummary();
  summary.totalProducedMeters = normalizeMetricValue(pattern.totalProducedMeters);
  summary.stockMeters = normalizeMetricValue(pattern.stockMeters);
  summary.inDyehouseMeters = normalizeMetricValue(pattern.inDyehouseMeters);
  summary.defectMeters = normalizeMetricValue(pattern.defectMeters);
  return summary;
};
