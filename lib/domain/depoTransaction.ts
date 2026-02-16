export type DepoTransactionType =
  | "SHIPMENT"
  | "RESERVATION"
  | "REVERSAL"
  | "ADJUSTMENT";

export type DepoTransactionStatus = "ACTIVE" | "REVERSED";

export type DepoTransactionTotals = {
  totalTops: number;
  totalMetres: number;
  patternCount: number;
};

export type DepoTransaction = {
  id: string;
  type: DepoTransactionType;
  status: DepoTransactionStatus;
  createdAt: string;
  customerId?: string;
  customerNameSnapshot?: string;
  note?: string;
  totals?: DepoTransactionTotals;
  targetTransactionId?: string;
  reversedAt?: string;
  reversedByTransactionId?: string;
};

export type DepoTransactionLine = {
  id: string;
  transactionId: string;
  patternId: string;
  patternNoSnapshot: string;
  patternNameSnapshot: string;
  color: string;
  metrePerTop: number;
  topCount: number;
  totalMetres: number;
  rollIds?: string[];
};
