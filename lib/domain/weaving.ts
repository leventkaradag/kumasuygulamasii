export type WeavingPlanStatus = "ACTIVE" | "COMPLETED" | "CANCELLED";

export type WeavingPlan = {
  id: string;
  patternId: string;
  patternNoSnapshot: string;
  patternNameSnapshot: string;
  plannedMeters: number;
  createdAt: string;
  note?: string;
  status: WeavingPlanStatus;
  manualCompletedAt?: string | null;
};

export type WeavingProgressEntry = {
  id: string;
  planId: string;
  createdAt: string;
  meters: number;
  note?: string;
};

export type WeavingTransferDestination = "DYEHOUSE" | "WAREHOUSE";

export type WeavingTransfer = {
  id: string;
  planId: string;
  createdAt: string;
  meters: number;
  destination: WeavingTransferDestination;
  dyehouseId?: string | null;
  dyehouseNameSnapshot?: string | null;
  note?: string;
};
