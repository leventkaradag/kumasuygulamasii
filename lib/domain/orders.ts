export type CustomerOrder = {
  id: string;
  orderDate: string;
  customerName: string;
  patternName: string;
  variant?: string;
  topCount: number;
  meters: number;
  note?: string;
  createdAt: string;
  updatedAt: string;
};

export type DyehouseOrderLine = {
  id: string;
  sequence: number;
  colorName: string;
  variantDescription?: string;
  topCount?: number;
  rawMeters?: number;
  status?: string;
  description?: string;
};

export type DyehouseOrderPatternBlock = {
  id: string;
  sequence: number;
  patternCode?: string;
  patternName?: string;
  lines: DyehouseOrderLine[];
};

export type DyehouseOrderDetails = {
  patternCode?: string;
  content?: string;
  rawWidth?: string;
  rawWeight?: string;
  finishedWidth?: string;
  processNo?: string;
  extraNote?: string;
  generalNote?: string;
};

export type DyehouseOrder = {
  id: string;
  title: string;
  companyTitle: string;
  attentionLine?: string;
  orderDate: string;
  patternBlocks: DyehouseOrderPatternBlock[];
  details: DyehouseOrderDetails;
  createdAt: string;
  updatedAt: string;
};

export type OrderNote = {
  id: string;
  noteDate: string;
  title: string;
  content: string;
  createdAt: string;
  updatedAt: string;
};
