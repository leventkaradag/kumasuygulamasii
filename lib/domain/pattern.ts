import { Stage } from "@/lib/domain/movement";

export type Variant = {
  id: string;
  colorName: string;
  colorCode?: string;
  name?: string;
  active?: boolean;
};

export type Pattern = {
  id: string;
  createdAt: string;
  fabricCode: string;
  fabricName: string;
  weaveType: string;
  warpCount: string;
  weftCount: string;
  totalEnds: string;
  variants: Variant[];
  partiNos: string[];
  gramajGm2?: number;
  fireOrani?: number;
  musteri?: string;
  depoNo?: string;
  kg?: number;
  eniCm?: number;
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
