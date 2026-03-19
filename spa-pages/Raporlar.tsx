"use client";

import {
  ClipboardList,
  FileSpreadsheet,
  NotebookPen,
  Plus,
  Printer,
  RotateCcw,
  Search,
  Trash2,
} from "lucide-react";
import { useMemo, useState, type FormEvent } from "react";

import { cn } from "@/lib/cn";
import {
  buildDyehouseOrderPrintHtml,
  printDyehouseOrderHtml,
  type DyehouseOrderPrintPayload,
} from "@/lib/dyehouseOrderPrint";
import type {
  CustomerOrder,
  DyehouseOrder,
  DyehouseOrderLine,
  OrderNote,
} from "@/lib/domain/orders";
import { ordersLocalRepo } from "@/lib/repos/ordersLocalRepo";
import Layout from "../components/Layout";

type OrdersTab = "CUSTOMER" | "DYEHOUSE" | "NOTES";

type CustomerOrderForm = {
  orderDate: string;
  customerName: string;
  patternName: string;
  variant: string;
  topCount: string;
  meters: string;
  note: string;
};

type DyehouseOrderRowDraft = {
  id: string;
  colorName: string;
  variantDescription: string;
  topCount: string;
  rawMeters: string;
  status: string;
  description: string;
};

type DyehousePatternBlockDraft = {
  id: string;
  patternCode: string;
  patternName: string;
  rows: DyehouseOrderRowDraft[];
};

type DyehouseOrderForm = {
  title: string;
  companyTitle: string;
  attentionLine: string;
  orderDate: string;
  patternBlocks: DyehousePatternBlockDraft[];
  generalReference: string;
  content: string;
  rawWidth: string;
  rawWeight: string;
  finishedWidth: string;
  processNo: string;
  extraNote: string;
  generalNote: string;
};

type OrderNoteForm = {
  noteDate: string;
  title: string;
  content: string;
};

type FeedbackState = {
  tone: "error" | "success";
  message: string;
};

const ORDER_TABS: Array<{ id: OrdersTab; label: string; icon: typeof ClipboardList }> = [
  { id: "CUSTOMER", label: "Musteri Siparisi", icon: ClipboardList },
  { id: "DYEHOUSE", label: "Boyahane Siparisi", icon: FileSpreadsheet },
  { id: "NOTES", label: "Siparis Yeri", icon: NotebookPen },
];

const todayDate = () => new Date().toISOString().slice(0, 10);

const createDraftId = () => {
  const randomUUID = globalThis.crypto?.randomUUID;
  if (typeof randomUUID === "function") {
    return randomUUID.call(globalThis.crypto);
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const fmt = (value: number) => value.toLocaleString("tr-TR", { maximumFractionDigits: 2 });
const normalizeQuery = (value: string) => value.trim().toLocaleLowerCase("tr-TR");

const toInputDate = (value: string) => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return todayDate();
  return parsed.toISOString().slice(0, 10);
};

const formatDate = (value: string) => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";
  return parsed.toLocaleDateString("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
};

const toPositiveNumber = (value: string) => {
  const normalized = value.trim().replace(",", ".");
  if (!normalized) return undefined;
  const numeric = Number(normalized);
  if (!Number.isFinite(numeric) || numeric <= 0) return undefined;
  return numeric;
};

const toPositiveInteger = (value: string) => {
  const numeric = toPositiveNumber(value);
  if (numeric === undefined || !Number.isInteger(numeric)) return undefined;
  return numeric;
};

const matchesDateFilters = (value: string, exact: string, from: string, to: string) => {
  const normalizedValue = toInputDate(value);
  if (exact && normalizedValue !== exact) return false;
  if (from && normalizedValue < from) return false;
  if (to && normalizedValue > to) return false;
  return true;
};

const createEmptyCustomerForm = (date = todayDate()): CustomerOrderForm => ({
  orderDate: date,
  customerName: "",
  patternName: "",
  variant: "",
  topCount: "",
  meters: "",
  note: "",
});

const createEmptyDyehouseRow = (): DyehouseOrderRowDraft => ({
  id: createDraftId(),
  colorName: "",
  variantDescription: "",
  topCount: "",
  rawMeters: "",
  status: "",
  description: "",
});

const createEmptyDyehousePatternBlock = (): DyehousePatternBlockDraft => ({
  id: createDraftId(),
  patternCode: "",
  patternName: "",
  rows: [createEmptyDyehouseRow()],
});

const createEmptyDyehouseForm = (date = todayDate()): DyehouseOrderForm => ({
  title: "",
  companyTitle: "KUMASCI TEKSTIL",
  attentionLine: "",
  orderDate: date,
  patternBlocks: [createEmptyDyehousePatternBlock()],
  generalReference: "",
  content: "",
  rawWidth: "",
  rawWeight: "",
  finishedWidth: "",
  processNo: "",
  extraNote: "",
  generalNote: "",
});

const createEmptyNoteForm = (date = todayDate()): OrderNoteForm => ({
  noteDate: date,
  title: "",
  content: "",
});

const mapCustomerOrderToForm = (order: CustomerOrder): CustomerOrderForm => ({
  orderDate: toInputDate(order.orderDate),
  customerName: order.customerName,
  patternName: order.patternName,
  variant: order.variant ?? "",
  topCount: String(order.topCount),
  meters: String(order.meters),
  note: order.note ?? "",
});

const mapDyehouseOrderToForm = (order: DyehouseOrder): DyehouseOrderForm => ({
  title: order.title,
  companyTitle: order.companyTitle,
  attentionLine: order.attentionLine ?? "",
  orderDate: toInputDate(order.orderDate),
  patternBlocks: order.patternBlocks.map((block) => ({
    id: block.id,
    patternCode: block.patternCode ?? "",
    patternName: block.patternName ?? "",
    rows: block.lines.map((row) => ({
      id: row.id,
      colorName: row.colorName,
      variantDescription: row.variantDescription ?? "",
      topCount: row.topCount ? String(row.topCount) : "",
      rawMeters: row.rawMeters ? String(row.rawMeters) : "",
      status: row.status ?? "",
      description: row.description ?? "",
    })),
  })),
  generalReference: order.details.patternCode ?? "",
  content: order.details.content ?? "",
  rawWidth: order.details.rawWidth ?? "",
  rawWeight: order.details.rawWeight ?? "",
  finishedWidth: order.details.finishedWidth ?? "",
  processNo: order.details.processNo ?? "",
  extraNote: order.details.extraNote ?? "",
  generalNote: order.details.generalNote ?? "",
});

const mapOrderNoteToForm = (note: OrderNote): OrderNoteForm => ({
  noteDate: toInputDate(note.noteDate),
  title: note.title,
  content: note.content,
});

const isMeaningfulDyehouseRow = (row: DyehouseOrderRowDraft) =>
  Boolean(
    row.colorName.trim() ||
      row.variantDescription.trim() ||
      row.status.trim() ||
      row.description.trim() ||
      toPositiveInteger(row.topCount) ||
      toPositiveNumber(row.rawMeters)
  );

const isMeaningfulDyehousePatternBlock = (block: DyehousePatternBlockDraft) =>
  Boolean(block.patternCode.trim() || block.patternName.trim() || block.rows.some(isMeaningfulDyehouseRow));

const buildDyehousePatternBlocksPayload = (
  patternBlocks: DyehousePatternBlockDraft[]
): Array<{
  id?: string;
  patternCode?: string;
  patternName?: string;
  lines: Array<Partial<DyehouseOrderLine>>;
}> =>
  patternBlocks.map((block) => ({
    id: block.id,
    patternCode: block.patternCode,
    patternName: block.patternName,
    lines: block.rows.map((row) => ({
      id: row.id,
      colorName: row.colorName,
      variantDescription: row.variantDescription,
      topCount: toPositiveInteger(row.topCount),
      rawMeters: toPositiveNumber(row.rawMeters),
      status: row.status,
      description: row.description,
    })),
  }));

const buildDyehousePrintPayload = (form: DyehouseOrderForm): DyehouseOrderPrintPayload => {
  const meaningfulBlocks = form.patternBlocks.filter(isMeaningfulDyehousePatternBlock);
  if (!meaningfulBlocks.length) {
    throw new Error("Yazdirma icin en az bir desen blogu gerekli.");
  }

  const patternBlocks = meaningfulBlocks.map((block, blockIndex) => {
    if (!block.patternCode.trim() && !block.patternName.trim()) {
      throw new Error(`Desen ${blockIndex + 1} icin kod veya ad girilmeli.`);
    }

    const meaningfulRows = block.rows.filter(isMeaningfulDyehouseRow);
    if (!meaningfulRows.length) {
      throw new Error(`Desen ${blockIndex + 1} icin en az bir renk satiri gerekli.`);
    }

    return {
      sequence: blockIndex + 1,
      patternCode: block.patternCode.trim() || undefined,
      patternName: block.patternName.trim() || undefined,
      rows: meaningfulRows.map((row, rowIndex) => {
        const topCount = toPositiveInteger(row.topCount);
        const rawMeters = toPositiveNumber(row.rawMeters);
        if (!row.colorName.trim()) {
          throw new Error(`Desen ${blockIndex + 1} / Satir ${rowIndex + 1} icin renk gerekli.`);
        }
        if (topCount === undefined && rawMeters === undefined) {
          throw new Error(
            `Desen ${blockIndex + 1} / Satir ${rowIndex + 1} icin top veya ham metre gerekli.`
          );
        }

        return {
          sequence: rowIndex + 1,
          colorName: row.colorName.trim(),
          variantDescription: row.variantDescription.trim() || undefined,
          topCount,
          rawMeters,
          status: row.status.trim() || undefined,
          description: row.description.trim() || undefined,
        };
      }),
    };
  });

  return {
    title: form.title.trim() || "Boyahane Siparisi",
    companyTitle: form.companyTitle.trim() || "KUMASCI TEKSTIL",
    attentionLine: form.attentionLine.trim() || undefined,
    orderDate: form.orderDate || todayDate(),
    patternBlocks,
    details: {
      patternCode: form.generalReference.trim() || undefined,
      content: form.content.trim() || undefined,
      rawWidth: form.rawWidth.trim() || undefined,
      rawWeight: form.rawWeight.trim() || undefined,
      finishedWidth: form.finishedWidth.trim() || undefined,
      processNo: form.processNo.trim() || undefined,
      extraNote: form.extraNote.trim() || undefined,
      generalNote: form.generalNote.trim() || undefined,
    },
  };
};

function SectionCard({
  title,
  subtitle,
  children,
  className,
}: Readonly<{
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
}>) {
  return (
    <section
      className={cn(
        "rounded-[24px] border border-black/5 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,242,234,0.96))] p-5 shadow-[0_12px_28px_rgba(0,0,0,0.08)]",
        className
      )}
    >
      <div className="mb-4">
        <h2 className="font-display text-xl font-semibold text-neutral-900">{title}</h2>
        {subtitle ? <p className="mt-1 text-sm text-neutral-600">{subtitle}</p> : null}
      </div>
      {children}
    </section>
  );
}

function MetricCard({
  label,
  value,
  detail,
}: Readonly<{
  label: string;
  value: string;
  detail: string;
}>) {
  return (
    <div className="rounded-[22px] border border-black/5 bg-white/90 p-4 shadow-[0_10px_24px_rgba(0,0,0,0.06)]">
      <div className="text-[11px] uppercase tracking-[0.22em] text-neutral-500">{label}</div>
      <div className="mt-3 text-2xl font-semibold text-neutral-900">{value}</div>
      <div className="mt-2 text-sm text-neutral-600">{detail}</div>
    </div>
  );
}

function FeedbackBanner({ feedback }: Readonly<{ feedback: FeedbackState | null }>) {
  if (!feedback) return null;
  return (
    <div
      className={cn(
        "rounded-2xl border px-4 py-3 text-sm font-medium",
        feedback.tone === "error"
          ? "border-rose-500/30 bg-rose-50 text-rose-700"
          : "border-emerald-500/30 bg-emerald-50 text-emerald-700"
      )}
    >
      {feedback.message}
    </div>
  );
}

function EmptyState({
  title,
  description,
}: Readonly<{
  title: string;
  description: string;
}>) {
  return (
    <div className="rounded-[22px] border border-dashed border-black/10 bg-white/70 px-4 py-10 text-center">
      <div className="text-base font-semibold text-neutral-900">{title}</div>
      <p className="mt-2 text-sm text-neutral-600">{description}</p>
    </div>
  );
}

export default function Raporlar() {
  const [activeTab, setActiveTab] = useState<OrdersTab>("CUSTOMER");
  const [, setRepoVersion] = useState(0);

  const [editingCustomerOrderId, setEditingCustomerOrderId] = useState<string | null>(null);
  const [customerForm, setCustomerForm] = useState<CustomerOrderForm>(() => createEmptyCustomerForm());
  const [customerQuery, setCustomerQuery] = useState("");
  const [customerExactDate, setCustomerExactDate] = useState("");
  const [customerFromDate, setCustomerFromDate] = useState("");
  const [customerToDate, setCustomerToDate] = useState("");
  const [customerFeedback, setCustomerFeedback] = useState<FeedbackState | null>(null);

  const [editingDyehouseOrderId, setEditingDyehouseOrderId] = useState<string | null>(null);
  const [dyehouseForm, setDyehouseForm] = useState<DyehouseOrderForm>(() => createEmptyDyehouseForm());
  const [dyehouseQuery, setDyehouseQuery] = useState("");
  const [dyehouseDate, setDyehouseDate] = useState("");
  const [dyehouseFeedback, setDyehouseFeedback] = useState<FeedbackState | null>(null);

  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [noteForm, setNoteForm] = useState<OrderNoteForm>(() => createEmptyNoteForm());
  const [noteQuery, setNoteQuery] = useState("");
  const [noteFeedback, setNoteFeedback] = useState<FeedbackState | null>(null);

  const refreshAll = () => {
    setRepoVersion((current) => current + 1);
  };

  const customerOrders = ordersLocalRepo.listCustomerOrders();
  const dyehouseOrders = ordersLocalRepo.listDyehouseOrders();
  const orderNotes = ordersLocalRepo.listOrderNotes();

  const filteredCustomerOrders = useMemo(() => {
    const normalizedQuery = normalizeQuery(customerQuery);
    return customerOrders.filter((order) => {
      if (
        normalizedQuery &&
        ![order.customerName, order.patternName, order.variant ?? "", order.note ?? ""].some((field) =>
          field.toLocaleLowerCase("tr-TR").includes(normalizedQuery)
        )
      ) {
        return false;
      }
      return matchesDateFilters(order.orderDate, customerExactDate, customerFromDate, customerToDate);
    });
  }, [customerExactDate, customerFromDate, customerOrders, customerQuery, customerToDate]);

  const filteredDyehouseOrders = useMemo(() => {
    const normalizedQuery = normalizeQuery(dyehouseQuery);
    return dyehouseOrders.filter((order) => {
      const searchableFields = [
        order.title,
        order.companyTitle,
        order.attentionLine ?? "",
        order.details.patternCode ?? "",
        ...order.patternBlocks.flatMap((block) => [
          block.patternCode ?? "",
          block.patternName ?? "",
          ...block.lines.flatMap((line) => [
            line.colorName,
            line.variantDescription ?? "",
            line.status ?? "",
            line.description ?? "",
          ]),
        ]),
      ];
      if (
        normalizedQuery &&
        !searchableFields.some((field) =>
          field.toLocaleLowerCase("tr-TR").includes(normalizedQuery)
        )
      ) {
        return false;
      }
      return !dyehouseDate || toInputDate(order.orderDate) === dyehouseDate;
    });
  }, [dyehouseDate, dyehouseOrders, dyehouseQuery]);

  const filteredOrderNotes = useMemo(() => {
    const normalizedQuery = normalizeQuery(noteQuery);
    if (!normalizedQuery) return orderNotes;
    return orderNotes.filter((note) =>
      [note.title, note.content].some((field) =>
        field.toLocaleLowerCase("tr-TR").includes(normalizedQuery)
      )
    );
  }, [noteQuery, orderNotes]);

  const customerTotals = useMemo(
    () =>
      filteredCustomerOrders.reduce(
        (acc, order) => {
          acc.topCount += order.topCount;
          acc.meters += order.meters;
          return acc;
        },
        { topCount: 0, meters: 0 }
      ),
    [filteredCustomerOrders]
  );

  const dyehouseTotals = useMemo(
    () =>
      dyehouseOrders.reduce(
        (acc, order) => {
          acc.blockCount += order.patternBlocks.length;
          acc.rowCount += order.patternBlocks.reduce((sum, block) => sum + block.lines.length, 0);
          acc.topCount += order.patternBlocks.reduce(
            (sum, block) => sum + block.lines.reduce((lineSum, line) => lineSum + (line.topCount ?? 0), 0),
            0
          );
          acc.rawMeters += order.patternBlocks.reduce(
            (sum, block) => sum + block.lines.reduce((lineSum, line) => lineSum + (line.rawMeters ?? 0), 0),
            0
          );
          return acc;
        },
        { blockCount: 0, rowCount: 0, topCount: 0, rawMeters: 0 }
      ),
    [dyehouseOrders]
  );

  const todayNotesCount = useMemo(() => {
    const today = todayDate();
    return orderNotes.filter((note) => toInputDate(note.noteDate) === today).length;
  }, [orderNotes]);

  const handleCustomerSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setCustomerFeedback(null);
    try {
      ordersLocalRepo.saveCustomerOrder({
        id: editingCustomerOrderId ?? undefined,
        orderDate: customerForm.orderDate,
        customerName: customerForm.customerName,
        patternName: customerForm.patternName,
        variant: customerForm.variant,
        topCount: Number(customerForm.topCount.trim().replace(",", ".")),
        meters: Number(customerForm.meters.trim().replace(",", ".")),
        note: customerForm.note,
      });
      refreshAll();
      setCustomerForm(createEmptyCustomerForm(customerForm.orderDate));
      setEditingCustomerOrderId(null);
      setCustomerFeedback({ tone: "success", message: "Musteri siparisi kaydedildi." });
    } catch (error) {
      setCustomerFeedback({
        tone: "error",
        message: error instanceof Error ? error.message : "Musteri siparisi kaydedilemedi.",
      });
    }
  };

  const handleEditCustomerOrder = (order: CustomerOrder) => {
    setActiveTab("CUSTOMER");
    setEditingCustomerOrderId(order.id);
    setCustomerForm(mapCustomerOrderToForm(order));
    setCustomerFeedback(null);
  };

  const handleDeleteCustomerOrder = (id: string) => {
    if (!window.confirm("Bu musteri siparisi silinsin mi?")) return;
    ordersLocalRepo.deleteCustomerOrder(id);
    refreshAll();
    if (editingCustomerOrderId === id) {
      setEditingCustomerOrderId(null);
      setCustomerForm(createEmptyCustomerForm(customerForm.orderDate));
    }
    setCustomerFeedback({ tone: "success", message: "Musteri siparisi silindi." });
  };

  const handleDyehousePatternBlockChange = (
    blockId: string,
    field: keyof Pick<DyehousePatternBlockDraft, "patternCode" | "patternName">,
    value: string
  ) => {
    setDyehouseForm((current) => ({
      ...current,
      patternBlocks: current.patternBlocks.map((block) =>
        block.id === blockId ? { ...block, [field]: value } : block
      ),
    }));
  };

  const handleDyehouseRowChange = (
    blockId: string,
    rowId: string,
    field: keyof DyehouseOrderRowDraft,
    value: string
  ) => {
    setDyehouseForm((current) => ({
      ...current,
      patternBlocks: current.patternBlocks.map((block) =>
        block.id !== blockId
          ? block
          : {
              ...block,
              rows: block.rows.map((row) => (row.id === rowId ? { ...row, [field]: value } : row)),
            }
      ),
    }));
  };

  const handleAddDyehousePatternBlock = () => {
    setDyehouseForm((current) => ({
      ...current,
      patternBlocks: [...current.patternBlocks, createEmptyDyehousePatternBlock()],
    }));
  };

  const handleRemoveDyehousePatternBlock = (blockId: string) => {
    setDyehouseForm((current) => {
      const nextBlocks = current.patternBlocks.filter((block) => block.id !== blockId);
      return {
        ...current,
        patternBlocks: nextBlocks.length ? nextBlocks : [createEmptyDyehousePatternBlock()],
      };
    });
  };

  const handleAddDyehouseRow = (blockId: string) => {
    setDyehouseForm((current) => ({
      ...current,
      patternBlocks: current.patternBlocks.map((block) =>
        block.id === blockId ? { ...block, rows: [...block.rows, createEmptyDyehouseRow()] } : block
      ),
    }));
  };

  const handleRemoveDyehouseRow = (blockId: string, rowId: string) => {
    setDyehouseForm((current) => ({
      ...current,
      patternBlocks: current.patternBlocks.map((block) => {
        if (block.id !== blockId) return block;
        const nextRows = block.rows.filter((row) => row.id !== rowId);
        return {
          ...block,
          rows: nextRows.length ? nextRows : [createEmptyDyehouseRow()],
        };
      }),
    }));
  };

  const handleSaveDyehouseOrder = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setDyehouseFeedback(null);
    try {
      const saved = ordersLocalRepo.saveDyehouseOrder({
        id: editingDyehouseOrderId ?? undefined,
        title: dyehouseForm.title,
        companyTitle: dyehouseForm.companyTitle,
        attentionLine: dyehouseForm.attentionLine,
        orderDate: dyehouseForm.orderDate,
        patternBlocks: buildDyehousePatternBlocksPayload(dyehouseForm.patternBlocks),
        details: {
          patternCode: dyehouseForm.generalReference,
          content: dyehouseForm.content,
          rawWidth: dyehouseForm.rawWidth,
          rawWeight: dyehouseForm.rawWeight,
          finishedWidth: dyehouseForm.finishedWidth,
          processNo: dyehouseForm.processNo,
          extraNote: dyehouseForm.extraNote,
          generalNote: dyehouseForm.generalNote,
        },
      });
      refreshAll();
      setEditingDyehouseOrderId(saved.id);
      setDyehouseForm(mapDyehouseOrderToForm(saved));
      setDyehouseFeedback({ tone: "success", message: "Boyahane siparisi taslak olarak kaydedildi." });
    } catch (error) {
      setDyehouseFeedback({
        tone: "error",
        message: error instanceof Error ? error.message : "Boyahane siparisi kaydedilemedi.",
      });
    }
  };

  const handleSelectDyehouseOrder = (order: DyehouseOrder) => {
    setActiveTab("DYEHOUSE");
    setEditingDyehouseOrderId(order.id);
    setDyehouseForm(mapDyehouseOrderToForm(order));
    setDyehouseFeedback(null);
  };

  const handleDeleteDyehouseOrder = (id: string) => {
    if (!window.confirm("Bu boyahane siparis taslagi silinsin mi?")) return;
    ordersLocalRepo.deleteDyehouseOrder(id);
    refreshAll();
    if (editingDyehouseOrderId === id) {
      setEditingDyehouseOrderId(null);
      setDyehouseForm(createEmptyDyehouseForm(dyehouseForm.orderDate));
    }
    setDyehouseFeedback({ tone: "success", message: "Boyahane siparis taslagi silindi." });
  };

  const handleResetDyehouseOrder = () => {
    setEditingDyehouseOrderId(null);
    setDyehouseForm(createEmptyDyehouseForm(dyehouseForm.orderDate));
    setDyehouseFeedback(null);
  };

  const handlePrintDyehouseOrder = async () => {
    setDyehouseFeedback(null);
    try {
      const html = buildDyehouseOrderPrintHtml(buildDyehousePrintPayload(dyehouseForm));
      await printDyehouseOrderHtml(html);
    } catch (error) {
      setDyehouseFeedback({
        tone: "error",
        message: error instanceof Error ? error.message : "Yazdirma hazirlanamadi.",
      });
    }
  };

  const handleNoteSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setNoteFeedback(null);
    try {
      ordersLocalRepo.saveOrderNote({
        id: editingNoteId ?? undefined,
        noteDate: noteForm.noteDate,
        title: noteForm.title,
        content: noteForm.content,
      });
      refreshAll();
      setEditingNoteId(null);
      setNoteForm(createEmptyNoteForm(noteForm.noteDate));
      setNoteFeedback({ tone: "success", message: "Siparis notu kaydedildi." });
    } catch (error) {
      setNoteFeedback({
        tone: "error",
        message: error instanceof Error ? error.message : "Siparis notu kaydedilemedi.",
      });
    }
  };

  const handleEditOrderNote = (note: OrderNote) => {
    setActiveTab("NOTES");
    setEditingNoteId(note.id);
    setNoteForm(mapOrderNoteToForm(note));
    setNoteFeedback(null);
  };

  const handleDeleteOrderNote = (id: string) => {
    if (!window.confirm("Bu siparis notu silinsin mi?")) return;
    ordersLocalRepo.deleteOrderNote(id);
    refreshAll();
    if (editingNoteId === id) {
      setEditingNoteId(null);
      setNoteForm(createEmptyNoteForm(noteForm.noteDate));
    }
    setNoteFeedback({ tone: "success", message: "Siparis notu silindi." });
  };

  return (
    <Layout
      title="Siparisler"
      description="Musteri siparisleri, boyahane calisma sayfalari ve operasyon notlari ayni ekranda yonetilir."
    >
      <div className="flex h-full min-h-0 flex-col gap-6 overflow-y-auto pr-1">
        <div className="grid gap-4 xl:grid-cols-3">
          <MetricCard
            label="Musteri Siparisleri"
            value={String(customerOrders.length)}
            detail={`${fmt(customerOrders.reduce((sum, order) => sum + order.meters, 0))} m toplam siparis`}
          />
          <MetricCard
            label="Boyahane Taslaklari"
            value={String(dyehouseOrders.length)}
            detail={`${dyehouseTotals.rowCount} satir, ${fmt(dyehouseTotals.rawMeters)} m ham metre`}
          />
          <MetricCard
            label="Siparis Yeri"
            value={String(orderNotes.length)}
            detail={`${todayNotesCount} kayit bugun eklendi`}
          />
        </div>

        <div className="flex flex-wrap gap-3">
          {ORDER_TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "inline-flex items-center gap-2 rounded-full border px-4 py-2.5 text-sm font-semibold transition",
                  isActive
                    ? "border-coffee-primary/40 bg-coffee-primary/15 text-neutral-900 shadow-[0_8px_20px_rgba(0,0,0,0.08)]"
                    : "border-black/10 bg-white text-neutral-700 hover:border-black/20 hover:bg-white/90"
                )}
              >
                <Icon className="h-4 w-4" aria-hidden />
                {tab.label}
              </button>
            );
          })}
        </div>

        {activeTab === "CUSTOMER" ? (
          <div className="grid min-h-0 gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
            <SectionCard
              title={editingCustomerOrderId ? "Musteri Siparisini Duzenle" : "Yeni Musteri Siparisi"}
              subtitle="Tarih korunur, kalan alanlar hizli giris icin kayit sonrasi temizlenir."
            >
              <form className="space-y-4" onSubmit={handleCustomerSubmit}>
                <FeedbackBanner feedback={customerFeedback} />
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="space-y-2 text-sm font-medium text-neutral-700">
                    <span>Tarih</span>
                    <input
                      type="date"
                      value={customerForm.orderDate}
                      onChange={(event) => setCustomerForm((current) => ({ ...current, orderDate: event.target.value }))}
                      className="w-full rounded-2xl border border-black/10 bg-white px-3 py-2.5 text-neutral-900 focus:border-coffee-primary focus:outline-none focus:ring-2 focus:ring-coffee-primary/30"
                    />
                  </label>
                  <label className="space-y-2 text-sm font-medium text-neutral-700">
                    <span>Musteri Ismi</span>
                    <input
                      type="text"
                      value={customerForm.customerName}
                      onChange={(event) => setCustomerForm((current) => ({ ...current, customerName: event.target.value }))}
                      placeholder="Musteri adi"
                      className="w-full rounded-2xl border border-black/10 bg-white px-3 py-2.5 text-neutral-900 focus:border-coffee-primary focus:outline-none focus:ring-2 focus:ring-coffee-primary/30"
                    />
                  </label>
                  <label className="space-y-2 text-sm font-medium text-neutral-700 sm:col-span-2">
                    <span>Desen Ismi / Kodu</span>
                    <input
                      type="text"
                      value={customerForm.patternName}
                      onChange={(event) => setCustomerForm((current) => ({ ...current, patternName: event.target.value }))}
                      placeholder="Desen kodu veya adi"
                      className="w-full rounded-2xl border border-black/10 bg-white px-3 py-2.5 text-neutral-900 focus:border-coffee-primary focus:outline-none focus:ring-2 focus:ring-coffee-primary/30"
                    />
                  </label>
                  <label className="space-y-2 text-sm font-medium text-neutral-700">
                    <span>Varyant</span>
                    <input
                      type="text"
                      value={customerForm.variant}
                      onChange={(event) => setCustomerForm((current) => ({ ...current, variant: event.target.value }))}
                      placeholder="Opsiyonel"
                      className="w-full rounded-2xl border border-black/10 bg-white px-3 py-2.5 text-neutral-900 focus:border-coffee-primary focus:outline-none focus:ring-2 focus:ring-coffee-primary/30"
                    />
                  </label>
                  <label className="space-y-2 text-sm font-medium text-neutral-700">
                    <span>Top Adeti</span>
                    <input
                      type="number"
                      min="1"
                      step="1"
                      value={customerForm.topCount}
                      onChange={(event) => setCustomerForm((current) => ({ ...current, topCount: event.target.value }))}
                      placeholder="0"
                      className="w-full rounded-2xl border border-black/10 bg-white px-3 py-2.5 text-neutral-900 focus:border-coffee-primary focus:outline-none focus:ring-2 focus:ring-coffee-primary/30"
                    />
                  </label>
                  <label className="space-y-2 text-sm font-medium text-neutral-700 sm:col-span-2">
                    <span>Metre</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={customerForm.meters}
                      onChange={(event) => setCustomerForm((current) => ({ ...current, meters: event.target.value }))}
                      placeholder="0"
                      className="w-full rounded-2xl border border-black/10 bg-white px-3 py-2.5 text-neutral-900 focus:border-coffee-primary focus:outline-none focus:ring-2 focus:ring-coffee-primary/30"
                    />
                  </label>
                  <label className="space-y-2 text-sm font-medium text-neutral-700 sm:col-span-2">
                    <span>Not</span>
                    <textarea
                      rows={4}
                      value={customerForm.note}
                      onChange={(event) => setCustomerForm((current) => ({ ...current, note: event.target.value }))}
                      placeholder="Opsiyonel siparis notu"
                      className="w-full rounded-2xl border border-black/10 bg-white px-3 py-2.5 text-neutral-900 focus:border-coffee-primary focus:outline-none focus:ring-2 focus:ring-coffee-primary/30"
                    />
                  </label>
                </div>
                <div className="flex flex-wrap gap-3">
                  <button
                    type="submit"
                    className="rounded-full bg-coffee-primary px-5 py-2.5 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(0,0,0,0.14)] transition hover:-translate-y-0.5"
                  >
                    {editingCustomerOrderId ? "Guncelle" : "Kaydet"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingCustomerOrderId(null);
                      setCustomerForm(createEmptyCustomerForm(customerForm.orderDate));
                      setCustomerFeedback(null);
                    }}
                    className="rounded-full border border-black/10 bg-white px-5 py-2.5 text-sm font-semibold text-neutral-700 transition hover:border-black/20"
                  >
                    Formu Temizle
                  </button>
                </div>
              </form>
            </SectionCard>

            <div className="flex min-h-0 flex-col gap-4">
              <SectionCard
                title="Arama ve Liste"
                subtitle="Musteri metni, tek tarih ve tarih araligi birlikte filtrelenebilir."
              >
                <div className="grid gap-3 lg:grid-cols-[minmax(0,1.4fr)_repeat(3,minmax(0,0.7fr))]">
                  <label className="relative block">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
                    <input
                      type="search"
                      value={customerQuery}
                      onChange={(event) => setCustomerQuery(event.target.value)}
                      placeholder="Musteri, desen, varyant..."
                      className="w-full rounded-2xl border border-black/10 bg-white px-10 py-2.5 text-sm text-neutral-900 focus:border-coffee-primary focus:outline-none focus:ring-2 focus:ring-coffee-primary/30"
                    />
                  </label>
                  <input
                    type="date"
                    value={customerExactDate}
                    onChange={(event) => setCustomerExactDate(event.target.value)}
                    className="w-full rounded-2xl border border-black/10 bg-white px-3 py-2.5 text-sm text-neutral-900 focus:border-coffee-primary focus:outline-none focus:ring-2 focus:ring-coffee-primary/30"
                  />
                  <input
                    type="date"
                    value={customerFromDate}
                    onChange={(event) => setCustomerFromDate(event.target.value)}
                    className="w-full rounded-2xl border border-black/10 bg-white px-3 py-2.5 text-sm text-neutral-900 focus:border-coffee-primary focus:outline-none focus:ring-2 focus:ring-coffee-primary/30"
                  />
                  <input
                    type="date"
                    value={customerToDate}
                    onChange={(event) => setCustomerToDate(event.target.value)}
                    className="w-full rounded-2xl border border-black/10 bg-white px-3 py-2.5 text-sm text-neutral-900 focus:border-coffee-primary focus:outline-none focus:ring-2 focus:ring-coffee-primary/30"
                  />
                </div>
                <div className="mt-4 grid gap-3 md:grid-cols-3">
                  <MetricCard label="Filtreli Siparis" value={String(filteredCustomerOrders.length)} detail="Aktif filtre sonucunda gorunen kayit" />
                  <MetricCard label="Top Adedi" value={String(customerTotals.topCount)} detail="Liste icindeki toplam top" />
                  <MetricCard label="Metre" value={`${fmt(customerTotals.meters)} m`} detail="Liste icindeki toplam siparis metresi" />
                </div>
              </SectionCard>

              <SectionCard
                title="Musteri Siparisleri"
                subtitle="Kayitlar tarih bazli saklanir ve masaustunde tablo rahatliginda okunur."
                className="flex min-h-0 flex-1 flex-col"
              >
                {filteredCustomerOrders.length ? (
                  <div className="min-h-0 overflow-auto rounded-[20px] border border-black/5">
                    <table className="w-full min-w-[920px] border-collapse text-sm">
                      <thead className="sticky top-0 bg-[#f3e9db] text-left text-[11px] uppercase tracking-[0.18em] text-neutral-600">
                        <tr>
                          <th className="px-4 py-3">Tarih</th><th className="px-4 py-3">Musteri</th><th className="px-4 py-3">Desen</th><th className="px-4 py-3">Varyant</th><th className="px-4 py-3">Top</th><th className="px-4 py-3">Metre</th><th className="px-4 py-3">Not</th><th className="px-4 py-3">Islem</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredCustomerOrders.map((order) => (
                          <tr key={order.id} className="border-t border-black/5 bg-white/80 align-top">
                            <td className="px-4 py-3 text-neutral-700">{formatDate(order.orderDate)}</td>
                            <td className="px-4 py-3 font-semibold text-neutral-900">{order.customerName}</td>
                            <td className="px-4 py-3 text-neutral-700">{order.patternName}</td>
                            <td className="px-4 py-3 text-neutral-700">{order.variant ?? "-"}</td>
                            <td className="px-4 py-3 text-neutral-700">{order.topCount}</td>
                            <td className="px-4 py-3 text-neutral-700">{fmt(order.meters)} m</td>
                            <td className="px-4 py-3 text-neutral-600">{order.note ?? "-"}</td>
                            <td className="px-4 py-3">
                              <div className="flex gap-2">
                                <button
                                  type="button"
                                  onClick={() => handleEditCustomerOrder(order)}
                                  className="rounded-full border border-black/10 px-3 py-1.5 text-xs font-semibold text-neutral-700 transition hover:border-black/20"
                                >
                                  Duzenle
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteCustomerOrder(order.id)}
                                  className="rounded-full border border-rose-500/20 px-3 py-1.5 text-xs font-semibold text-rose-700 transition hover:bg-rose-50"
                                >
                                  Sil
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <EmptyState
                    title="Musteri siparisi bulunamadi"
                    description="Filtreleri gevseterek veya yeni siparis ekleyerek listeyi doldurabilirsiniz."
                  />
                )}
              </SectionCard>
            </div>
          </div>
        ) : null}
        {activeTab === "DYEHOUSE" ? (
          <div className="grid min-h-0 gap-4 xl:grid-cols-[320px_minmax(0,1fr)]">
            <SectionCard
              title="Kayitli Boyahane Siparisleri"
              subtitle="Basliga ve tarihe gore taslak bulabilir, secip duzenleyebilirsiniz."
              className="flex min-h-0 flex-col"
            >
              <div className="space-y-3">
                <label className="relative block">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
                  <input
                    type="search"
                    value={dyehouseQuery}
                    onChange={(event) => setDyehouseQuery(event.target.value)}
                    placeholder="Baslik, firma, proses no..."
                    className="w-full rounded-2xl border border-black/10 bg-white px-10 py-2.5 text-sm text-neutral-900 focus:border-coffee-primary focus:outline-none focus:ring-2 focus:ring-coffee-primary/30"
                  />
                </label>
                <input
                  type="date"
                  value={dyehouseDate}
                  onChange={(event) => setDyehouseDate(event.target.value)}
                  className="w-full rounded-2xl border border-black/10 bg-white px-3 py-2.5 text-sm text-neutral-900 focus:border-coffee-primary focus:outline-none focus:ring-2 focus:ring-coffee-primary/30"
                />
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                <MetricCard label="Taslak" value={String(filteredDyehouseOrders.length)} detail="Listede gorunen siparis sayfasi" />
                <MetricCard label="Top Toplami" value={String(dyehouseTotals.topCount)} detail={`${dyehouseTotals.blockCount} desen blogu, ${dyehouseTotals.rowCount} renk satiri`} />
              </div>

              <div className="mt-4 min-h-0 flex-1 overflow-y-auto pr-1">
                {filteredDyehouseOrders.length ? (
                  <div className="space-y-3">
                    {filteredDyehouseOrders.map((order) => {
                      const isActive = editingDyehouseOrderId === order.id;
                      const topTotal = order.patternBlocks.reduce(
                        (sum, block) => sum + block.lines.reduce((lineSum, line) => lineSum + (line.topCount ?? 0), 0),
                        0
                      );
                      const meterTotal = order.patternBlocks.reduce(
                        (sum, block) => sum + block.lines.reduce((lineSum, line) => lineSum + (line.rawMeters ?? 0), 0),
                        0
                      );
                      const lineCount = order.patternBlocks.reduce((sum, block) => sum + block.lines.length, 0);
                      const patternSummary = order.patternBlocks
                        .map((block) => block.patternCode || block.patternName || `Desen ${block.sequence}`)
                        .slice(0, 2)
                        .join(", ");
                      return (
                        <div
                          key={order.id}
                          className={cn(
                            "rounded-[22px] border p-4 transition",
                            isActive ? "border-coffee-primary/40 bg-coffee-primary/10" : "border-black/5 bg-white/80"
                          )}
                        >
                          <button type="button" onClick={() => handleSelectDyehouseOrder(order)} className="w-full text-left">
                            <div className="text-xs uppercase tracking-[0.18em] text-neutral-500">{formatDate(order.orderDate)}</div>
                            <div className="mt-2 text-base font-semibold text-neutral-900">{order.title}</div>
                            <div className="mt-1 text-sm text-neutral-600">{order.companyTitle}</div>
                            <div className="mt-1 text-xs text-neutral-500">{patternSummary || "-"}</div>
                            <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-neutral-600">
                              <div>{order.patternBlocks.length} desen</div>
                              <div>{lineCount} satir</div>
                              <div>{topTotal} top</div>
                              <div>{fmt(meterTotal)} m</div>
                            </div>
                          </button>
                          <div className="mt-3 flex justify-end">
                            <button
                              type="button"
                              onClick={() => handleDeleteDyehouseOrder(order.id)}
                              className="inline-flex items-center gap-1 rounded-full border border-rose-500/20 px-3 py-1.5 text-xs font-semibold text-rose-700 transition hover:bg-rose-50"
                            >
                              <Trash2 className="h-3.5 w-3.5" aria-hidden />
                              Sil
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <EmptyState
                    title="Boyahane taslagi yok"
                    description="Sag taraftaki calisma sayfasindan yeni bir siparis sayfasi hazirlayabilirsiniz."
                  />
                )}
              </div>
            </SectionCard>

            <SectionCard
              title="Boyahane Calisma Sayfasi"
              subtitle="Excel benzeri satir yapisi ile taslagi hazirlayin, kaydedin ve temiz A4 cikti alin."
              className="flex min-h-0 flex-col"
            >
              <form className="flex min-h-0 flex-1 flex-col gap-4" onSubmit={handleSaveDyehouseOrder}>
                <FeedbackBanner feedback={dyehouseFeedback} />
                <div className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)_220px]">
                  <label className="space-y-2 text-sm font-medium text-neutral-700">
                    <span>Baslik</span>
                    <input
                      type="text"
                      value={dyehouseForm.title}
                      onChange={(event) => setDyehouseForm((current) => ({ ...current, title: event.target.value }))}
                      placeholder="Orn. Nuri Bey Siparisi"
                      className="w-full rounded-2xl border border-black/10 bg-white px-3 py-2.5 text-neutral-900 focus:border-coffee-primary focus:outline-none focus:ring-2 focus:ring-coffee-primary/30"
                    />
                  </label>
                  <label className="space-y-2 text-sm font-medium text-neutral-700">
                    <span>Firma Basligi</span>
                    <input
                      type="text"
                      value={dyehouseForm.companyTitle}
                      onChange={(event) => setDyehouseForm((current) => ({ ...current, companyTitle: event.target.value }))}
                      className="w-full rounded-2xl border border-black/10 bg-white px-3 py-2.5 text-neutral-900 focus:border-coffee-primary focus:outline-none focus:ring-2 focus:ring-coffee-primary/30"
                    />
                  </label>
                  <label className="space-y-2 text-sm font-medium text-neutral-700">
                    <span>Tarih</span>
                    <input
                      type="date"
                      value={dyehouseForm.orderDate}
                      onChange={(event) => setDyehouseForm((current) => ({ ...current, orderDate: event.target.value }))}
                      className="w-full rounded-2xl border border-black/10 bg-white px-3 py-2.5 text-neutral-900 focus:border-coffee-primary focus:outline-none focus:ring-2 focus:ring-coffee-primary/30"
                    />
                  </label>
                </div>

                <label className="space-y-2 text-sm font-medium text-neutral-700">
                  <span>Hitap / Aciklama</span>
                  <textarea
                    rows={2}
                    value={dyehouseForm.attentionLine}
                    onChange={(event) => setDyehouseForm((current) => ({ ...current, attentionLine: event.target.value }))}
                    placeholder="Orn. Nuri Beyin dikkatine"
                    className="w-full rounded-2xl border border-black/10 bg-white px-3 py-2.5 text-neutral-900 focus:border-coffee-primary focus:outline-none focus:ring-2 focus:ring-coffee-primary/30"
                  />
                </label>

                <div className="rounded-[24px] border border-black/5 bg-[#fffaf4] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div>
                      <div className="text-[11px] uppercase tracking-[0.2em] text-neutral-500">Desen Bloklari</div>
                      <div className="mt-1 text-sm text-neutral-600">Ayni sipariste birden fazla desen acin; her desenin altinda renk satirlarini ayri yonetin.</div>
                    </div>
                    <button
                      type="button"
                      onClick={handleAddDyehousePatternBlock}
                      className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-semibold text-neutral-700 transition hover:border-black/20"
                    >
                      <Plus className="h-4 w-4" aria-hidden />
                      Desen Ekle
                    </button>
                  </div>

                  <div className="space-y-4">
                    {dyehouseForm.patternBlocks.map((block, blockIndex) => (
                      <div key={block.id} className="rounded-[22px] border border-black/5 bg-white p-4 shadow-[0_8px_18px_rgba(0,0,0,0.04)]">
                        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                          <div className="grid min-w-0 flex-1 gap-3 md:grid-cols-2">
                            <label className="space-y-2 text-sm font-medium text-neutral-700">
                              <span>Desen Kodu</span>
                              <input
                                type="text"
                                value={block.patternCode}
                                onChange={(event) => handleDyehousePatternBlockChange(block.id, "patternCode", event.target.value)}
                                placeholder={`Orn. D-${blockIndex + 1}`}
                                className="w-full rounded-2xl border border-black/10 bg-white px-3 py-2.5 text-neutral-900 focus:border-coffee-primary focus:outline-none focus:ring-2 focus:ring-coffee-primary/30"
                              />
                            </label>
                            <label className="space-y-2 text-sm font-medium text-neutral-700">
                              <span>Desen Adi</span>
                              <input
                                type="text"
                                value={block.patternName}
                                onChange={(event) => handleDyehousePatternBlockChange(block.id, "patternName", event.target.value)}
                                placeholder="Desen adi"
                                className="w-full rounded-2xl border border-black/10 bg-white px-3 py-2.5 text-neutral-900 focus:border-coffee-primary focus:outline-none focus:ring-2 focus:ring-coffee-primary/30"
                              />
                            </label>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRemoveDyehousePatternBlock(block.id)}
                            className="inline-flex items-center gap-1 rounded-full border border-rose-500/20 px-3 py-1.5 text-xs font-semibold text-rose-700 transition hover:bg-rose-50"
                          >
                            <Trash2 className="h-3.5 w-3.5" aria-hidden />
                            Deseni Sil
                          </button>
                        </div>

                        <div className="overflow-x-auto rounded-[18px] border border-black/5 bg-white">
                          <table className="w-full min-w-[1080px] border-collapse text-sm">
                            <thead className="bg-[#f3e7d7] text-left text-[11px] uppercase tracking-[0.18em] text-neutral-600">
                              <tr>
                                <th className="px-3 py-3">Sira</th>
                                <th className="px-3 py-3">Renk</th>
                                <th className="px-3 py-3">Renk / Varyant Aciklamasi</th>
                                <th className="px-3 py-3">Top</th>
                                <th className="px-3 py-3">Ham Metre</th>
                                <th className="px-3 py-3">Durum</th>
                                <th className="px-3 py-3">Not</th>
                                <th className="px-3 py-3">Islem</th>
                              </tr>
                            </thead>
                            <tbody>
                              {block.rows.map((row, rowIndex) => (
                                <tr key={row.id} className="border-t border-black/5 align-top">
                                  <td className="px-3 py-2 text-neutral-500">{rowIndex + 1}</td>
                                  <td className="px-3 py-2"><input type="text" value={row.colorName} onChange={(event) => handleDyehouseRowChange(block.id, row.id, "colorName", event.target.value)} className="w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-neutral-900 focus:border-coffee-primary focus:outline-none focus:ring-2 focus:ring-coffee-primary/20" placeholder="Renk" /></td>
                                  <td className="px-3 py-2"><input type="text" value={row.variantDescription} onChange={(event) => handleDyehouseRowChange(block.id, row.id, "variantDescription", event.target.value)} className="w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-neutral-900 focus:border-coffee-primary focus:outline-none focus:ring-2 focus:ring-coffee-primary/20" placeholder="Varyant notu" /></td>
                                  <td className="px-3 py-2"><input type="number" min="0" step="1" value={row.topCount} onChange={(event) => handleDyehouseRowChange(block.id, row.id, "topCount", event.target.value)} className="w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-neutral-900 focus:border-coffee-primary focus:outline-none focus:ring-2 focus:ring-coffee-primary/20" placeholder="0" /></td>
                                  <td className="px-3 py-2"><input type="number" min="0" step="0.01" value={row.rawMeters} onChange={(event) => handleDyehouseRowChange(block.id, row.id, "rawMeters", event.target.value)} className="w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-neutral-900 focus:border-coffee-primary focus:outline-none focus:ring-2 focus:ring-coffee-primary/20" placeholder="0" /></td>
                                  <td className="px-3 py-2"><input type="text" value={row.status} onChange={(event) => handleDyehouseRowChange(block.id, row.id, "status", event.target.value)} className="w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-neutral-900 focus:border-coffee-primary focus:outline-none focus:ring-2 focus:ring-coffee-primary/20" placeholder="Durum" /></td>
                                  <td className="px-3 py-2"><input type="text" value={row.description} onChange={(event) => handleDyehouseRowChange(block.id, row.id, "description", event.target.value)} className="w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-neutral-900 focus:border-coffee-primary focus:outline-none focus:ring-2 focus:ring-coffee-primary/20" placeholder="Opsiyonel" /></td>
                                  <td className="px-3 py-2">
                                    <button
                                      type="button"
                                      onClick={() => handleRemoveDyehouseRow(block.id, row.id)}
                                      className="inline-flex items-center gap-1 rounded-full border border-rose-500/20 px-3 py-1.5 text-xs font-semibold text-rose-700 transition hover:bg-rose-50"
                                    >
                                      <Trash2 className="h-3.5 w-3.5" aria-hidden />
                                      Sil
                                    </button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>

                        <div className="mt-4 flex justify-end">
                          <button
                            type="button"
                            onClick={() => handleAddDyehouseRow(block.id)}
                            className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-semibold text-neutral-700 transition hover:border-black/20"
                          >
                            <Plus className="h-4 w-4" aria-hidden />
                            Satir Ekle
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="grid gap-4 lg:grid-cols-2">
                  <label className="space-y-2 text-sm font-medium text-neutral-700">
                    <span>Genel Referans</span>
                    <input
                      type="text"
                      value={dyehouseForm.generalReference}
                      onChange={(event) => setDyehouseForm((current) => ({ ...current, generalReference: event.target.value }))}
                      className="w-full rounded-2xl border border-black/10 bg-white px-3 py-2.5 text-neutral-900 focus:border-coffee-primary focus:outline-none focus:ring-2 focus:ring-coffee-primary/30"
                    />
                  </label>
                  <label className="space-y-2 text-sm font-medium text-neutral-700">
                    <span>Icerik</span>
                    <input
                      type="text"
                      value={dyehouseForm.content}
                      onChange={(event) => setDyehouseForm((current) => ({ ...current, content: event.target.value }))}
                      className="w-full rounded-2xl border border-black/10 bg-white px-3 py-2.5 text-neutral-900 focus:border-coffee-primary focus:outline-none focus:ring-2 focus:ring-coffee-primary/30"
                    />
                  </label>
                  <label className="space-y-2 text-sm font-medium text-neutral-700">
                    <span>Ham En</span>
                    <input
                      type="text"
                      value={dyehouseForm.rawWidth}
                      onChange={(event) => setDyehouseForm((current) => ({ ...current, rawWidth: event.target.value }))}
                      className="w-full rounded-2xl border border-black/10 bg-white px-3 py-2.5 text-neutral-900 focus:border-coffee-primary focus:outline-none focus:ring-2 focus:ring-coffee-primary/30"
                    />
                  </label>
                  <label className="space-y-2 text-sm font-medium text-neutral-700">
                    <span>Ham Gramaj</span>
                    <input
                      type="text"
                      value={dyehouseForm.rawWeight}
                      onChange={(event) => setDyehouseForm((current) => ({ ...current, rawWeight: event.target.value }))}
                      className="w-full rounded-2xl border border-black/10 bg-white px-3 py-2.5 text-neutral-900 focus:border-coffee-primary focus:outline-none focus:ring-2 focus:ring-coffee-primary/30"
                    />
                  </label>
                  <label className="space-y-2 text-sm font-medium text-neutral-700">
                    <span>Mamul En</span>
                    <input
                      type="text"
                      value={dyehouseForm.finishedWidth}
                      onChange={(event) => setDyehouseForm((current) => ({ ...current, finishedWidth: event.target.value }))}
                      className="w-full rounded-2xl border border-black/10 bg-white px-3 py-2.5 text-neutral-900 focus:border-coffee-primary focus:outline-none focus:ring-2 focus:ring-coffee-primary/30"
                    />
                  </label>
                  <label className="space-y-2 text-sm font-medium text-neutral-700">
                    <span>Proses No</span>
                    <input
                      type="text"
                      value={dyehouseForm.processNo}
                      onChange={(event) => setDyehouseForm((current) => ({ ...current, processNo: event.target.value }))}
                      className="w-full rounded-2xl border border-black/10 bg-white px-3 py-2.5 text-neutral-900 focus:border-coffee-primary focus:outline-none focus:ring-2 focus:ring-coffee-primary/30"
                    />
                  </label>
                  <label className="space-y-2 text-sm font-medium text-neutral-700 lg:col-span-2">
                    <span>Ekstra Not</span>
                    <textarea
                      rows={2}
                      value={dyehouseForm.extraNote}
                      onChange={(event) => setDyehouseForm((current) => ({ ...current, extraNote: event.target.value }))}
                      className="w-full rounded-2xl border border-black/10 bg-white px-3 py-2.5 text-neutral-900 focus:border-coffee-primary focus:outline-none focus:ring-2 focus:ring-coffee-primary/30"
                    />
                  </label>
                  <label className="space-y-2 text-sm font-medium text-neutral-700 lg:col-span-2">
                    <span>Genel Aciklama</span>
                    <textarea
                      rows={4}
                      value={dyehouseForm.generalNote}
                      onChange={(event) => setDyehouseForm((current) => ({ ...current, generalNote: event.target.value }))}
                      placeholder="Asagi dogru buyuyebilen not alani"
                      className="w-full rounded-2xl border border-black/10 bg-white px-3 py-2.5 text-neutral-900 focus:border-coffee-primary focus:outline-none focus:ring-2 focus:ring-coffee-primary/30"
                    />
                  </label>
                </div>

                <div className="flex flex-wrap gap-3 border-t border-black/5 pt-4">
                  <button
                    type="submit"
                    className="rounded-full bg-coffee-primary px-5 py-2.5 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(0,0,0,0.14)] transition hover:-translate-y-0.5"
                  >
                    {editingDyehouseOrderId ? "Taslagi Guncelle" : "Taslagi Kaydet"}
                  </button>
                  <button
                    type="button"
                    onClick={handlePrintDyehouseOrder}
                    className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-white px-5 py-2.5 text-sm font-semibold text-neutral-700 transition hover:border-black/20"
                  >
                    <Printer className="h-4 w-4" aria-hidden />
                    Tabloyu Yazdir
                  </button>
                  <button
                    type="button"
                    onClick={handleResetDyehouseOrder}
                    className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-white px-5 py-2.5 text-sm font-semibold text-neutral-700 transition hover:border-black/20"
                  >
                    <RotateCcw className="h-4 w-4" aria-hidden />
                    Yeni Taslak
                  </button>
                </div>
              </form>
            </SectionCard>
          </div>
        ) : null}

        {activeTab === "NOTES" ? (
          <div className="grid min-h-0 gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
            <SectionCard
              title={editingNoteId ? "Siparis Notunu Duzenle" : "Yeni Siparis Notu"}
              subtitle="Kisa operasyon notlari, hatirlatmalar ve musteri gorusmeleri icin serbest alan."
            >
              <form className="space-y-4" onSubmit={handleNoteSubmit}>
                <FeedbackBanner feedback={noteFeedback} />
                <label className="space-y-2 text-sm font-medium text-neutral-700">
                  <span>Tarih</span>
                  <input
                    type="date"
                    value={noteForm.noteDate}
                    onChange={(event) => setNoteForm((current) => ({ ...current, noteDate: event.target.value }))}
                    className="w-full rounded-2xl border border-black/10 bg-white px-3 py-2.5 text-neutral-900 focus:border-coffee-primary focus:outline-none focus:ring-2 focus:ring-coffee-primary/30"
                  />
                </label>
                <label className="space-y-2 text-sm font-medium text-neutral-700">
                  <span>Baslik</span>
                  <input
                    type="text"
                    value={noteForm.title}
                    onChange={(event) => setNoteForm((current) => ({ ...current, title: event.target.value }))}
                    placeholder="Orn. Numune bekleniyor"
                    className="w-full rounded-2xl border border-black/10 bg-white px-3 py-2.5 text-neutral-900 focus:border-coffee-primary focus:outline-none focus:ring-2 focus:ring-coffee-primary/30"
                  />
                </label>
                <label className="space-y-2 text-sm font-medium text-neutral-700">
                  <span>Aciklama / Icerik</span>
                  <textarea
                    rows={8}
                    value={noteForm.content}
                    onChange={(event) => setNoteForm((current) => ({ ...current, content: event.target.value }))}
                    placeholder="Musteri konusmasi, alinacak is, boyahaneye sorulacak renk..."
                    className="w-full rounded-2xl border border-black/10 bg-white px-3 py-2.5 text-neutral-900 focus:border-coffee-primary focus:outline-none focus:ring-2 focus:ring-coffee-primary/30"
                  />
                </label>
                <div className="flex flex-wrap gap-3">
                  <button
                    type="submit"
                    className="rounded-full bg-coffee-primary px-5 py-2.5 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(0,0,0,0.14)] transition hover:-translate-y-0.5"
                  >
                    {editingNoteId ? "Guncelle" : "Kaydet"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingNoteId(null);
                      setNoteForm(createEmptyNoteForm(noteForm.noteDate));
                      setNoteFeedback(null);
                    }}
                    className="rounded-full border border-black/10 bg-white px-5 py-2.5 text-sm font-semibold text-neutral-700 transition hover:border-black/20"
                  >
                    Temizle
                  </button>
                </div>
              </form>
            </SectionCard>

            <SectionCard
              title="Siparis Yeri Defteri"
              subtitle="Baslik veya icerik aramasi ile notlari hizla bulun."
              className="flex min-h-0 flex-col"
            >
              <label className="relative block">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
                <input
                  type="search"
                  value={noteQuery}
                  onChange={(event) => setNoteQuery(event.target.value)}
                  placeholder="Baslik veya not icerigi..."
                  className="w-full rounded-2xl border border-black/10 bg-white px-10 py-2.5 text-sm text-neutral-900 focus:border-coffee-primary focus:outline-none focus:ring-2 focus:ring-coffee-primary/30"
                />
              </label>

              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <MetricCard label="Bulunan Not" value={String(filteredOrderNotes.length)} detail="Arama sonucunda gorunen kayit" />
                <MetricCard label="Bugun" value={String(todayNotesCount)} detail="Bugun acilan operasyon notu" />
              </div>

              <div className="mt-4 min-h-0 flex-1 overflow-y-auto pr-1">
                {filteredOrderNotes.length ? (
                  <div className="space-y-3">
                    {filteredOrderNotes.map((note) => (
                      <article key={note.id} className="rounded-[22px] border border-black/5 bg-white/85 p-4 shadow-[0_10px_24px_rgba(0,0,0,0.05)]">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <div className="text-xs uppercase tracking-[0.18em] text-neutral-500">{formatDate(note.noteDate)}</div>
                            <h3 className="mt-2 text-lg font-semibold text-neutral-900">{note.title}</h3>
                          </div>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => handleEditOrderNote(note)}
                              className="rounded-full border border-black/10 px-3 py-1.5 text-xs font-semibold text-neutral-700 transition hover:border-black/20"
                            >
                              Duzenle
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteOrderNote(note.id)}
                              className="rounded-full border border-rose-500/20 px-3 py-1.5 text-xs font-semibold text-rose-700 transition hover:bg-rose-50"
                            >
                              Sil
                            </button>
                          </div>
                        </div>
                        <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-neutral-700">{note.content}</p>
                      </article>
                    ))}
                  </div>
                ) : (
                  <EmptyState
                    title="Not bulunamadi"
                    description="Arama ifadesini degistirin veya soldan yeni bir siparis notu ekleyin."
                  />
                )}
              </div>
            </SectionCard>
          </div>
        ) : null}
      </div>
    </Layout>
  );
}
