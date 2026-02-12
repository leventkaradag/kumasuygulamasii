export type FabricRollStatus =
  | "IN_STOCK"
  | "RESERVED"
  | "SHIPPED"
  | "RETURNED"
  | "SCRAP";

export type FabricRoll = {
  id: string;
  patternId: string;
  variantId?: string;
  colorName?: string;
  meters: number;
  rollNo?: string;
  status: FabricRollStatus;
  inAt: string;
  outAt?: string;
  reservedAt?: string;
  reservedFor?: string;
  counterparty?: string;
  note?: string;
};
