export type Pattern = {
  id: string;
  patternNo: string;
  patternName: string;
  variantsCount: number;
  totalProducedMeters: number;
  stockMeters: number;
  defectMeters: number;
  inDyehouseMeters: number;
  digitalImageUrl?: string;
  finalImageUrl?: string;
};

export const PATTERNS: Pattern[] = [
  {
    id: "p-001",
    patternNo: "D-1201",
    patternName: "Klasik Çizgi",
    variantsCount: 3,
    totalProducedMeters: 3250,
    stockMeters: 1340,
    defectMeters: 40,
    inDyehouseMeters: 210,
    digitalImageUrl:
      "https://images.unsplash.com/photo-1506569422617-6ed97d5ebf68?auto=format&fit=crop&w=800&q=80",
  },
  {
    id: "p-002",
    patternNo: "D-1202",
    patternName: "Ankara Dokuma",
    variantsCount: 4,
    totalProducedMeters: 2710,
    stockMeters: 980,
    defectMeters: 25,
    inDyehouseMeters: 160,
  },
  {
    id: "p-003",
    patternNo: "D-1203",
    patternName: "Keten Soft",
    variantsCount: 2,
    totalProducedMeters: 1840,
    stockMeters: 640,
    defectMeters: 12,
    inDyehouseMeters: 90,
    finalImageUrl:
      "https://images.unsplash.com/photo-1521572267360-ee0c2909d518?auto=format&fit=crop&w=800&q=80",
  },
  {
    id: "p-004",
    patternNo: "D-1204",
    patternName: "Saten Pırıltı",
    variantsCount: 5,
    totalProducedMeters: 3620,
    stockMeters: 1560,
    defectMeters: 30,
    inDyehouseMeters: 240,
  },
  {
    id: "p-005",
    patternNo: "D-1205",
    patternName: "Mesh Nefes",
    variantsCount: 3,
    totalProducedMeters: 1180,
    stockMeters: 420,
    defectMeters: 14,
    inDyehouseMeters: 70,
  },
  {
    id: "p-006",
    patternNo: "D-1206",
    patternName: "Organik Pamuk",
    variantsCount: 6,
    totalProducedMeters: 3980,
    stockMeters: 1870,
    defectMeters: 55,
    inDyehouseMeters: 320,
  },
  {
    id: "p-007",
    patternNo: "D-1207",
    patternName: "Şönil Yumuşak",
    variantsCount: 2,
    totalProducedMeters: 2120,
    stockMeters: 730,
    defectMeters: 18,
    inDyehouseMeters: 110,
  },
  {
    id: "p-008",
    patternNo: "D-1208",
    patternName: "Jakarlı Gece",
    variantsCount: 4,
    totalProducedMeters: 2540,
    stockMeters: 920,
    defectMeters: 20,
    inDyehouseMeters: 180,
  },
  {
    id: "p-009",
    patternNo: "D-1209",
    patternName: "Kanvas Denim",
    variantsCount: 3,
    totalProducedMeters: 3100,
    stockMeters: 1420,
    defectMeters: 45,
    inDyehouseMeters: 260,
  },
  {
    id: "p-010",
    patternNo: "D-1210",
    patternName: "Likra Fit",
    variantsCount: 2,
    totalProducedMeters: 1190,
    stockMeters: 510,
    defectMeters: 10,
    inDyehouseMeters: 70,
  },
  {
    id: "p-011",
    patternNo: "D-1211",
    patternName: "Bambu Breeze",
    variantsCount: 3,
    totalProducedMeters: 2480,
    stockMeters: 860,
    defectMeters: 22,
    inDyehouseMeters: 130,
    finalImageUrl:
      "https://images.unsplash.com/photo-1504198453319-5ce911bafcde?auto=format&fit=crop&w=800&q=80",
  },
  {
    id: "p-012",
    patternNo: "D-1212",
    patternName: "Viscon Shine",
    variantsCount: 1,
    totalProducedMeters: 920,
    stockMeters: 390,
    defectMeters: 8,
    inDyehouseMeters: 60,
    digitalImageUrl:
      "https://images.unsplash.com/photo-1504198453319-5ce911bafcde?auto=format&fit=crop&w=800&q=80",
  },
];
