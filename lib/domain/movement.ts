export type Stage = "DOKUMA" | "BOYAHANE" | "DEPO";

export type MovementType = "IN" | "OUT";

export type Movement = {
  id: string;
  patternId: string;
  variantId?: string;
  stage: Stage;
  type: MovementType;
  meters: number;
  date: string; // ISO string (YYYY-MM-DD)
  note?: string;
};
