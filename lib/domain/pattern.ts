import { Stage } from "@/lib/domain/movement";

export type Variant = {
  id: string;
  name: string;
  active?: boolean;
};

export type Pattern = {
  id: string;
  fabricCode: string;
  fabricName: string;
  weaveType: string;
  warpCount: string;
  weftCount: string;
  totalEnds: string;
  variants: Variant[];
  currentStage: Stage;
  totalProducedMeters: number;
  stockMeters: number;
  defectMeters: number;
  inDyehouseMeters: number;
  digitalImageUrl?: string;
  finalImageUrl?: string;
  note?: string;
  archived?: boolean;
  variantsCount?: number;
};
