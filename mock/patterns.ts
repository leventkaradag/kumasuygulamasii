import { Pattern, Variant } from "@/lib/domain/pattern";
import { Stage } from "@/lib/domain/movement";

export type { Pattern } from "@/lib/domain/pattern";

const buildVariants = (patternId: string, count: number): Variant[] =>
  Array.from({ length: count }, (_, index) => ({
    id: `${patternId}-v${index + 1}`,
    name: `V${index + 1}`,
    active: true,
  }));

const entry = (
  id: string,
  fabricCode: string,
  fabricName: string,
  weaveType: string,
  warpCount: string,
  weftCount: string,
  totalEnds: string,
  variantsCount: number,
  currentStage: Stage,
  meters: { total: number; stock: number; defect: number; dyehouse: number },
  images?: { digital?: string; final?: string }
): Pattern => ({
  id,
  fabricCode,
  fabricName,
  weaveType,
  warpCount,
  weftCount,
  totalEnds,
  variants: buildVariants(id, variantsCount),
  variantsCount,
  currentStage,
  totalProducedMeters: meters.total,
  stockMeters: meters.stock,
  defectMeters: meters.defect,
  inDyehouseMeters: meters.dyehouse,
  digitalImageUrl: images?.digital,
  finalImageUrl: images?.final,
});

export const PATTERNS: Pattern[] = [
  entry(
    "p-001",
    "D-1201",
    "Klasik Çizgi",
    "Poplin",
    "30/1 NE",
    "40/1 NE",
    "7600",
    3,
    "DEPO",
    { total: 3250, stock: 1340, defect: 40, dyehouse: 210 },
    {
      digital:
        "https://images.unsplash.com/photo-1506569422617-6ed97d5ebf68?auto=format&fit=crop&w=800&q=80",
    }
  ),
  entry("p-002", "D-1202", "Ankara Dokuma", "Dimi", "20/1 NE", "20/1 NE", "6800", 4, "DOKUMA", {
    total: 2710,
    stock: 980,
    defect: 25,
    dyehouse: 160,
  }),
  entry(
    "p-003",
    "D-1203",
    "Keten Soft",
    "Keten",
    "30/1 Keten",
    "30/1 Keten",
    "5400",
    2,
    "BOYAHANE",
    { total: 1840, stock: 640, defect: 12, dyehouse: 90 },
    {
      final:
        "https://images.unsplash.com/photo-1521572267360-ee0c2909d518?auto=format&fit=crop&w=800&q=80",
    }
  ),
  entry("p-004", "D-1204", "Saten Pırıltı", "Saten", "60/2 NE", "80/2 NE", "8800", 5, "DEPO", {
    total: 3620,
    stock: 1560,
    defect: 30,
    dyehouse: 240,
  }),
  entry("p-005", "D-1205", "Mesh Nefes", "Mesh", "40/1 PES", "40/1 PES", "6200", 3, "DOKUMA", {
    total: 1180,
    stock: 420,
    defect: 14,
    dyehouse: 70,
  }),
  entry(
    "p-006",
    "D-1206",
    "Organik Pamuk",
    "Bezayağı",
    "30/1 Organic",
    "30/1 Organic",
    "7200",
    6,
    "DEPO",
    { total: 3980, stock: 1870, defect: 55, dyehouse: 320 }
  ),
  entry(
    "p-007",
    "D-1207",
    "Şönil Yumuşak",
    "Şönil",
    "10/1 Şönil",
    "10/1 Şönil",
    "5600",
    2,
    "BOYAHANE",
    { total: 2120, stock: 730, defect: 18, dyehouse: 110 }
  ),
  entry("p-008", "D-1208", "Jakarlı Gece", "Jakar", "40/2 NE", "40/2 NE", "9100", 4, "DOKUMA", {
    total: 2540,
    stock: 920,
    defect: 20,
    dyehouse: 180,
  }),
  entry("p-009", "D-1209", "Kanvas Denim", "Denim", "10 oz", "10 oz", "7400", 3, "DEPO", {
    total: 3100,
    stock: 1420,
    defect: 45,
    dyehouse: 260,
  }),
  entry("p-010", "D-1210", "Likra Fit", "Likra", "40/1 NE", "40/1 NE", "6100", 2, "BOYAHANE", {
    total: 1190,
    stock: 510,
    defect: 10,
    dyehouse: 70,
  }),
  entry(
    "p-011",
    "D-1211",
    "Bambu Breeze",
    "Bambu",
    "40/1 Bambu",
    "40/1 Bambu",
    "6600",
    3,
    "DEPO",
    { total: 2480, stock: 860, defect: 22, dyehouse: 130 },
    {
      final:
        "https://images.unsplash.com/photo-1504198453319-5ce911bafcde?auto=format&fit=crop&w=800&q=80",
    }
  ),
  entry(
    "p-012",
    "D-1212",
    "Viscon Shine",
    "Viskon",
    "30/1 Viskon",
    "30/1 Viskon",
    "6000",
    1,
    "BOYAHANE",
    { total: 920, stock: 390, defect: 8, dyehouse: 60 },
    {
      digital:
        "https://images.unsplash.com/photo-1504198453319-5ce911bafcde?auto=format&fit=crop&w=800&q=80",
    }
  ),
];
