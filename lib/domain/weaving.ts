export type WeavingPlanStatus = "ACTIVE" | "COMPLETED" | "CANCELLED";

export type WeavingPlanVariantStatus = "ACTIVE" | "DONE";

export type WeavingPlanVariant = {
  id: string;
  variantCode?: string;
  colorName: string;
  plannedMeters: number;
  wovenMeters: number;
  shippedMeters: number;
  status?: WeavingPlanVariantStatus;
  notes?: string;
};

export type WeavingPlan = {
  id: string;
  patternId: string;
  patternNoSnapshot: string;
  patternNameSnapshot: string;
  plannedMeters: number;
  hamKumasEniCm?: number | null;
  tarakEniCm?: number | null;
  variants?: WeavingPlanVariant[];
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
  metersPerUnit?: number;
  unitCount?: number;
  variantId?: string;
  variantCodeSnapshot?: string;
  colorNameSnapshot?: string;
  note?: string;
};

export type WeavingTransferDestination = "DYEHOUSE" | "WAREHOUSE";

export type WeavingTransferVariantLine = {
  variantId: string;
  colorNameSnapshot: string;
  variantCodeSnapshot?: string;
  meters: number;
};

export type WeavingTransfer = {
  id: string;
  planId: string;
  createdAt: string;
  meters: number;
  variantLines?: WeavingTransferVariantLine[];
  destination: WeavingTransferDestination;
  dyehouseId?: string | null;
  dyehouseNameSnapshot?: string | null;
  note?: string;
};

export type WeavingDispatchDocumentType = "SEVK" | "BOYAHANE_TO_DEPO";

export type WeavingDispatchDocumentDestination = "BOYAHANE" | "DEPO";

export type WeavingDispatchDocumentVariantLine = {
  variantId?: string;
  colorNameSnapshot: string;
  variantCodeSnapshot?: string;
  meters: number;
};

export type WeavingDispatchDocument = {
  id: string;
  type: WeavingDispatchDocumentType;
  createdAt: string;
  destination: WeavingDispatchDocumentDestination;
  docNo: string;
  transferId?: string | null;
  sourceJobId?: string | null;
  sourceDispatchDocId?: string | null;
  planId: string;
  patternId: string;
  patternNoSnapshot: string;
  patternNameSnapshot: string;
  destinationNameSnapshot: string;
  dyehouseId?: string | null;
  variantLines?: WeavingDispatchDocumentVariantLine[];
  metersTotal: number;
  note?: string;
};
