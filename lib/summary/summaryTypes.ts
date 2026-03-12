export type SummaryModule = "WAREHOUSE" | "DYEHOUSE" | "WEAVING";

export type SummaryTimeScale = "DAY" | "MONTH" | "YEAR";

export type SummaryRangePreset =
  | "THIS_MONTH"
  | "PREVIOUS_MONTH"
  | "LAST_3_MONTHS"
  | "LAST_12_MONTHS"
  | "THIS_YEAR"
  | "CUSTOM";

export type SummaryDateRange = {
  start: Date;
  end: Date;
};

export type SummaryBucketMeta = {
  key: string;
  label: string;
  shortLabel: string;
  start: Date;
  end: Date;
};

export type SummaryMetricValue = {
  metres: number;
  tops: number;
};

export type WarehouseSummaryTotals = {
  inbound: SummaryMetricValue;
  shipped: SummaryMetricValue;
  returned: SummaryMetricValue;
  netMovement: SummaryMetricValue;
};

export type WarehouseTrendBucket = SummaryBucketMeta & {
  inboundMetres: number;
  shippedMetres: number;
  returnedMetres: number;
  inboundTops: number;
  shippedTops: number;
  returnedTops: number;
};

export type WarehouseCustomerDistributionRow = {
  customerKey: string;
  customerId: string | null;
  customerName: string;
  totalMetres: number;
  totalTops: number;
  share: number;
};

export type WarehouseColorBreakdownRow = {
  colorKey: string;
  colorName: string;
  totalMetres: number;
  totalTops: number;
  share: number;
};

export type WarehousePatternBreakdownRow = {
  patternKey: string;
  patternId: string;
  patternCode: string;
  patternName: string;
  patternLabel: string;
  totalMetres: number;
  totalTops: number;
  colorCount: number;
  topColorName: string | null;
  colors: WarehouseColorBreakdownRow[];
};

export type WarehouseCustomerDetailRow = {
  customerKey: string;
  customerId: string | null;
  customerName: string;
  totalMetres: number;
  totalTops: number;
  patternCount: number;
  topPatternLabel: string | null;
  patterns: WarehousePatternBreakdownRow[];
};

export type WarehouseSummaryData = {
  totals: WarehouseSummaryTotals;
  trend: WarehouseTrendBucket[];
  customers: WarehouseCustomerDistributionRow[];
  patterns: WarehousePatternBreakdownRow[];
  customerDetails: WarehouseCustomerDetailRow[];
  hasData: boolean;
};
