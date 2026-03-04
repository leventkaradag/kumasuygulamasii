export type Dyehouse = {
  id: string;
  name: string;
  createdAt: string;
};

export type DyehouseJobStatus = "RECEIVED" | "IN_PROCESS" | "FINISHED" | "CANCELLED";

export type DyehouseLine = {
  id: string;
  colorName: string;
  variantCode?: string;
  metersPlanned: number;
  inputKg?: number;
  outputKg?: number;
  wasteKg?: number;
  notes?: string;
};

export type DyehouseJob = {
  id: string;
  dyehouseId: string;
  dyehouseNameSnapshot: string;
  sourceDispatchDocId: string;
  patternId: string;
  patternCodeSnapshot: string;
  patternNameSnapshot: string;
  receivedAt: string;
  status: DyehouseJobStatus;
  inputMetersTotal: number;
  lines: DyehouseLine[];
  notes?: string;
  finishedAt?: string | null;
  outputDispatchDocId?: string | null;
};
