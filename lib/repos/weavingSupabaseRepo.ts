"use client";

import { createClient } from "@/lib/supabase/client";
import type {
  WeavingPlan,
  WeavingPlanStatus,
  WeavingPlanVariant,
  WeavingProgressEntry,
  WeavingTransfer,
  WeavingTransferVariantLine,
  WeavingDispatchDocument,
  WeavingDispatchDocumentVariantLine,
} from "@/lib/domain/weaving";

const safeParseArray = <T,>(raw: unknown): T[] => {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw as T[];
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? (parsed as T[]) : [];
    } catch {
      return [];
    }
  }
  return [];
};

const createId = () => {
  const randomUUID = globalThis.crypto?.randomUUID;
  if (typeof randomUUID === "function") {
    return randomUUID.call(globalThis.crypto);
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

type DateRangeFilters = {
  from?: string;
  to?: string;
};

const WEAVING_PAGE_SIZE = 1000;
type DbRecord = Record<string, unknown>;

// Database mappers

const mapPlanFromDb = (row: DbRecord): WeavingPlan => {
  return {
    id: row.id as string,
    patternId: row.pattern_id as string,
    patternNoSnapshot: (row.pattern_no_snapshot as string) || "",
    patternNameSnapshot: (row.pattern_name_snapshot as string) || "",
    plannedMeters: Number(row.planned_meters),
    hamKumasEniCm: row.ham_kumas_eni_cm ? Number(row.ham_kumas_eni_cm) : null,
    tarakEniCm: row.tarak_eni_cm ? Number(row.tarak_eni_cm) : null,
    variants: safeParseArray<WeavingPlanVariant>(row.variants),
    createdAt: row.created_at as string,
    status: row.status as WeavingPlanStatus,
    manualCompletedAt: row.manual_completed_at as string | null | undefined,
    note: row.note as string | undefined,
  };
};

const mapProgressFromDb = (row: DbRecord): WeavingProgressEntry => {
  return {
    id: row.id as string,
    planId: row.plan_id as string,
    createdAt: row.created_at as string,
    meters: Number(row.meters),
    metersPerUnit: row.meters_per_unit ? Number(row.meters_per_unit) : undefined,
    unitCount: row.unit_count ? Number(row.unit_count) : undefined,
    variantId: (row.variant_id as string | null) || undefined,
    note: (row.note as string | null) || undefined,
  };
};

const mapTransferFromDb = (row: DbRecord): WeavingTransfer => {
  return {
    id: row.id as string,
    planId: row.plan_id as string,
    createdAt: row.created_at as string,
    meters: Number(row.meters),
    variantLines: safeParseArray<WeavingTransferVariantLine>(row.variant_lines),
    destination: row.destination as WeavingTransfer["destination"],
    dyehouseId: (row.dyehouse_id as string | null) || null,
    dyehouseNameSnapshot: (row.dyehouse_name_snapshot as string | null) || null,
    note: (row.note as string | null) || undefined,
  };
};

const mapDispatchDocumentFromDb = (row: DbRecord): WeavingDispatchDocument => {
  return {
    id: row.id as string,
    type: row.type as WeavingDispatchDocument["type"],
    createdAt: row.created_at as string,
    destination: row.destination as WeavingDispatchDocument["destination"],
    docNo: row.doc_no as string,
    transferId: (row.transfer_id as string | null) || null,
    sourceJobId: (row.source_job_id as string | null) || null,
    sourceDispatchDocId: (row.source_dispatch_doc_id as string | null) || null,
    planId: row.plan_id as string,
    patternId: row.pattern_id as string,
    patternNoSnapshot: row.pattern_no_snapshot as string,
    patternNameSnapshot: row.pattern_name_snapshot as string,
    destinationNameSnapshot: row.destination_name_snapshot as string,
    dyehouseId: (row.dyehouse_id as string | null) || null,
    variantLines: safeParseArray<WeavingDispatchDocumentVariantLine>(row.variant_lines),
    metersTotal: Number(row.meters_total),
    note: (row.note as string | null) || undefined,
  };
};

export const weavingSupabaseRepo = {
  async listPlans(): Promise<WeavingPlan[]> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("weaving_plans")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("List plans error:", error);
      throw new Error("Dokuma planları yüklenemedi: " + error.message);
    }

    return (data || []).map(mapPlanFromDb);
  },

  async listAllPlans(): Promise<WeavingPlan[]> {
    const supabase = createClient();
    const rows: DbRecord[] = [];

    for (let from = 0; ; from += WEAVING_PAGE_SIZE) {
      const to = from + WEAVING_PAGE_SIZE - 1;
      const { data, error } = await supabase
        .from("weaving_plans")
        .select("*")
        .order("created_at", { ascending: false })
        .range(from, to);

      if (error) {
        console.error("List all plans error:", error);
        throw new Error("Dokuma planlari yuklenemedi: " + error.message);
      }

      const chunk = data || [];
      rows.push(...chunk);

      if (chunk.length < WEAVING_PAGE_SIZE) {
        break;
      }
    }

    return rows.map(mapPlanFromDb);
  },

  async getPlan(id: string): Promise<WeavingPlan | null> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("weaving_plans")
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      if (error.code === "PGRST116") return null;
      console.error("Get plan error:", error);
      throw new Error("Dokuma planı yüklenemedi: " + error.message);
    }

    return data ? mapPlanFromDb(data) : null;
  },

  async createPlan(input: {
    patternId: string;
    patternNoSnapshot: string;
    patternNameSnapshot: string;
    plannedMeters: number;
    hamKumasEniCm?: number | null;
    tarakEniCm?: number | null;
    variants?: WeavingPlanVariant[];
    createdAt?: string;
    note?: string;
  }): Promise<WeavingPlan> {
    const supabase = createClient();

    const variants = input.variants || [];
    const planned_meters =
      variants.length > 0
        ? variants.reduce((sum, v) => sum + v.plannedMeters, 0)
        : input.plannedMeters;

    const rowToInsert = {
      id: createId(),
      pattern_id: input.patternId,
      pattern_no_snapshot: input.patternNoSnapshot,
      pattern_name_snapshot: input.patternNameSnapshot,
      planned_meters,
      ham_kumas_eni_cm: input.hamKumasEniCm,
      tarak_eni_cm: input.tarakEniCm,
      variants,
      created_at: input.createdAt || new Date().toISOString(),
      note: input.note || null,
      status: "ACTIVE",
    };

    const { data, error } = await supabase
      .from("weaving_plans")
      .insert(rowToInsert)
      .select()
      .single();

    if (error) {
      console.error("Create plan error:", error);
      throw new Error("Dokuma planı oluşturulamadı: " + error.message);
    }

    return mapPlanFromDb(data);
  },

  async updatePlan(
    id: string,
    updates: {
      plannedMeters?: number;
      hamKumasEniCm?: number | null;
      tarakEniCm?: number | null;
      variants?: WeavingPlanVariant[];
      note?: string | null;
    }
  ): Promise<WeavingPlan> {
    const supabase = createClient();

    const rowUpdates: Record<string, unknown> = {};
    if (updates.plannedMeters !== undefined) rowUpdates.planned_meters = updates.plannedMeters;
    if (updates.hamKumasEniCm !== undefined) rowUpdates.ham_kumas_eni_cm = updates.hamKumasEniCm;
    if (updates.tarakEniCm !== undefined) rowUpdates.tarak_eni_cm = updates.tarakEniCm;
    if (updates.variants !== undefined) rowUpdates.variants = updates.variants;
    if (updates.note !== undefined) rowUpdates.note = updates.note;

    const { data, error } = await supabase
      .from("weaving_plans")
      .update(rowUpdates)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("Update plan error:", error);
      throw new Error("Dokuma planı güncellenemedi: " + error.message);
    }

    return mapPlanFromDb(data);
  },

  async markCompleted(id: string): Promise<WeavingPlan> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("weaving_plans")
      .update({
        status: "COMPLETED",
        manual_completed_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("Mark completed error:", error);
      throw new Error("Dokuma planı tamamlanamadı: " + error.message);
    }

    return mapPlanFromDb(data);
  },

  async restorePlan(id: string): Promise<WeavingPlan> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("weaving_plans")
      .update({
        status: "ACTIVE",
        manual_completed_at: null,
      })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("Restore plan error:", error);
      throw new Error("Dokuma planı geri alınamadı: " + error.message);
    }

    return mapPlanFromDb(data);
  },

  async updatePlanStatus(id: string, status: WeavingPlanStatus): Promise<WeavingPlan> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("weaving_plans")
      .update({ status })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("Update plan status error:", error);
      throw new Error("Dokuma planı durumu güncellenemedi: " + error.message);
    }

    return mapPlanFromDb(data);
  },

  async listProgress(): Promise<WeavingProgressEntry[]> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("weaving_progress")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("List progress error:", error);
      throw new Error("Dokuma gerçekleşmeleri yüklenemedi: " + error.message);
    }

    return (data || []).map(mapProgressFromDb);
  },

  async listProgressInRange(filters: DateRangeFilters = {}): Promise<WeavingProgressEntry[]> {
    const supabase = createClient();
    const rows: DbRecord[] = [];

    for (let from = 0; ; from += WEAVING_PAGE_SIZE) {
      const to = from + WEAVING_PAGE_SIZE - 1;
      let query = supabase
        .from("weaving_progress")
        .select("*")
        .order("created_at", { ascending: false })
        .range(from, to);

      if (filters.from) query = query.gte("created_at", new Date(filters.from).toISOString());
      if (filters.to) query = query.lte("created_at", new Date(filters.to).toISOString());

      const { data, error } = await query;

      if (error) {
        console.error("List progress range error:", error);
        throw new Error("Dokuma gerÃ§ekleÅŸmeleri yÃ¼klenemedi: " + error.message);
      }

      const chunk = data || [];
      rows.push(...chunk);

      if (chunk.length < WEAVING_PAGE_SIZE) {
        break;
      }
    }

    return rows.map(mapProgressFromDb);
  },

  async addProgress(input: {
    planId: string;
    meters: number;
    createdAt?: string;
    note?: string;
    variantId?: string;
    metersPerUnit?: number;
    unitCount?: number;
  }): Promise<WeavingProgressEntry> {
    const supabase = createClient();

    const rowToInsert = {
      id: createId(),
      plan_id: input.planId,
      created_at: input.createdAt || new Date().toISOString(),
      meters: input.meters,
      meters_per_unit: input.metersPerUnit,
      unit_count: input.unitCount || 1,
      variant_id: input.variantId,
      note: input.note,
    };

    const { data, error } = await supabase
      .from("weaving_progress")
      .insert(rowToInsert)
      .select()
      .single();

    if (error) {
      console.error("Add progress error:", error);
      throw new Error("Dokuma gerçekleşmesi eklenemedi: " + error.message);
    }

    return mapProgressFromDb(data);
  },

  async deleteProgress(id: string): Promise<void> {
    const supabase = createClient();
    const { error } = await supabase
      .from("weaving_progress")
      .delete()
      .eq("id", id);
      
    if (error) {
      console.error("Delete progress error:", error);
      throw new Error("Dokuma gerçekleşmesi silinemedi: " + error.message);
    }
  },

  async listTransfers(): Promise<WeavingTransfer[]> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("weaving_transfers")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("List transfers error:", error);
      throw new Error("Sevk bilgileri yüklenemedi: " + error.message);
    }

    return (data || []).map(mapTransferFromDb);
  },

  async listAllTransfers(): Promise<WeavingTransfer[]> {
    const supabase = createClient();
    const rows: DbRecord[] = [];

    for (let from = 0; ; from += WEAVING_PAGE_SIZE) {
      const to = from + WEAVING_PAGE_SIZE - 1;
      const { data, error } = await supabase
        .from("weaving_transfers")
        .select("*")
        .order("created_at", { ascending: false })
        .range(from, to);

      if (error) {
        console.error("List all transfers error:", error);
        throw new Error("Sevk bilgileri yuklenemedi: " + error.message);
      }

      const chunk = data || [];
      rows.push(...chunk);

      if (chunk.length < WEAVING_PAGE_SIZE) {
        break;
      }
    }

    return rows.map(mapTransferFromDb);
  },

  async addTransfer(input: {
    planId: string;
    meters: number;
    variantLines?: WeavingTransferVariantLine[];
    createdAt?: string;
    destination: import("@/lib/domain/weaving").WeavingTransferDestination;
    dyehouseId?: string | null;
    dyehouseNameSnapshot?: string | null;
    note?: string;
    docNo?: string;
  }): Promise<WeavingTransfer> {
    const supabase = createClient();

    // 1. Fetch Plan to access variants
    const { data: planData, error: planError } = await supabase
      .from("weaving_plans")
      .select("*")
      .eq("id", input.planId)
      .single();

    if (planError || !planData) {
      throw new Error("Plan bulunamadi.");
    }
    const plan = mapPlanFromDb(planData);

    // 2. Insert Transfer
    const transferId = createId();
    const createdAt = input.createdAt || new Date().toISOString();

    const transferRow = {
      id: transferId,
      plan_id: input.planId,
      created_at: createdAt,
      meters: input.meters,
      variant_lines: input.variantLines || [],
      destination: input.destination,
      dyehouse_id: input.dyehouseId || null,
      dyehouse_name_snapshot: input.dyehouseNameSnapshot || null,
      note: input.note || null,
    };

    const { data: insertedTransfer, error: transferError } = await supabase
      .from("weaving_transfers")
      .insert(transferRow)
      .select()
      .single();

    if (transferError) throw new Error("Sevk kaydedilemedi: " + transferError.message);

    // 3. Update Plan Variants Shipped Meters
    if (input.variantLines && input.variantLines.length > 0 && plan.variants && plan.variants.length > 0) {
      const variantMap = new Map(plan.variants.map((v) => [v.id, v]));
      input.variantLines.forEach((line) => {
        const v = variantMap.get(line.variantId);
        if (v) {
          v.shippedMeters = (v.shippedMeters || 0) + line.meters;
        }
      });
      const updatedVariants = Array.from(variantMap.values());
      await supabase
        .from("weaving_plans")
        .update({ variants: updatedVariants })
        .eq("id", plan.id);
    }

    // 4. Create Dispatch Document
    const documentDestination = input.destination === "DYEHOUSE" ? "BOYAHANE" : "DEPO";
    const destinationNameSnapshot =
      documentDestination === "BOYAHANE"
        ? input.dyehouseNameSnapshot?.trim() || "Boyahane"
        : "Depo";

    const docRow = {
      id: createId(),
      type: "SEVK",
      created_at: createdAt,
      destination: documentDestination,
      doc_no: input.docNo || ("SVK-" + Date.now() + Math.floor(Math.random() * 100)),
      transfer_id: transferId,
      plan_id: plan.id,
      pattern_id: plan.patternId,
      pattern_no_snapshot: plan.patternNoSnapshot,
      pattern_name_snapshot: plan.patternNameSnapshot,
      destination_name_snapshot: destinationNameSnapshot,
      dyehouse_id: documentDestination === "BOYAHANE" ? (input.dyehouseId || null) : null,
      variant_lines: input.variantLines || [],
      meters_total: input.meters,
      note: input.note || null,
    };

    const { error: docError } = await supabase
      .from("weaving_dispatch_documents")
      .insert(docRow);

    if (docError) {
      console.error("Dispatch doc error:", docError);
    }

    return mapTransferFromDb(insertedTransfer);
  },

  async deleteTransfer(id: string): Promise<void> {
    const supabase = createClient();

    // 1. Fetch transfer to know what to revert
    const { data: transferData } = await supabase
      .from("weaving_transfers")
      .select("*")
      .eq("id", id)
      .single();

    if (!transferData) return;
    const transfer = mapTransferFromDb(transferData);

    // 2. Fetch Plan
    const { data: planData } = await supabase
      .from("weaving_plans")
      .select("*")
      .eq("id", transfer.planId)
      .single();

    // 3. Revert Variants shippedMeters
    if (planData) {
      const plan = mapPlanFromDb(planData);
      if (transfer.variantLines && transfer.variantLines.length > 0 && plan.variants) {
        const variantMap = new Map(plan.variants.map((v) => [v.id, v]));
        transfer.variantLines.forEach((line) => {
          const v = variantMap.get(line.variantId);
          if (v) {
            v.shippedMeters = Math.max(0, (v.shippedMeters || 0) - line.meters);
          }
        });
        await supabase
          .from("weaving_plans")
          .update({ variants: Array.from(variantMap.values()) })
          .eq("id", plan.id);
      }
    }

    // 4. Delete Dispatch Document
    await supabase.from("weaving_dispatch_documents").delete().eq("transfer_id", id);

    // 5. Delete Transfer itself
    const { error } = await supabase.from("weaving_transfers").delete().eq("id", id);
    if (error) throw new Error("Transfer silinemedi: " + error.message);
  },

  async listDispatchDocuments(): Promise<WeavingDispatchDocument[]> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("weaving_dispatch_documents")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("List dispatch documents error:", error);
      throw new Error("Sevk belgeleri yüklenemedi: " + error.message);
    }

    return (data || []).map(mapDispatchDocumentFromDb);
  },

  async listDispatchDocumentsInRange(
    filters: DateRangeFilters & { destination?: "BOYAHANE" | "DEPO" } = {}
  ): Promise<WeavingDispatchDocument[]> {
    const supabase = createClient();
    const rows: DbRecord[] = [];

    for (let from = 0; ; from += WEAVING_PAGE_SIZE) {
      const to = from + WEAVING_PAGE_SIZE - 1;
      let query = supabase
        .from("weaving_dispatch_documents")
        .select("*")
        .order("created_at", { ascending: false })
        .range(from, to);

      if (filters.from) query = query.gte("created_at", new Date(filters.from).toISOString());
      if (filters.to) query = query.lte("created_at", new Date(filters.to).toISOString());
      if (filters.destination) query = query.eq("destination", filters.destination);

      const { data, error } = await query;

      if (error) {
        console.error("List dispatch documents range error:", error);
        throw new Error("Sevk belgeleri yÃ¼klenemedi: " + error.message);
      }

      const chunk = data || [];
      rows.push(...chunk);

      if (chunk.length < WEAVING_PAGE_SIZE) {
        break;
      }
    }

    return rows.map(mapDispatchDocumentFromDb);
  },

  async getDispatchDocument(id: string): Promise<WeavingDispatchDocument | null> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("weaving_dispatch_documents")
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      if (error.code === "PGRST116") return null;
      console.error("Get dispatch document error:", error);
      throw new Error("Sevk belgesi yüklenemedi: " + error.message);
    }

    return data ? mapDispatchDocumentFromDb(data) : null;
  },

  async createDyehouseToWarehouseDispatch(input: {
    sourceJobId: string;
    sourceDispatchDocId: string;
    planId: string;
    patternId: string;
    patternNoSnapshot: string;
    patternNameSnapshot: string;
    dyehouseId: string;
    dyehouseNameSnapshot: string;
    metersTotal: number;
    variantLines?: WeavingDispatchDocumentVariantLine[];
    createdAt?: string;
    note?: string;
    docNo?: string;
  }): Promise<WeavingDispatchDocument> {
    const supabase = createClient();
    const docRow = {
      id: createId(),
      type: "BOYAHANE_TO_DEPO",
      created_at: input.createdAt || new Date().toISOString(),
      destination: "DEPO",
      doc_no: input.docNo || ("BP-" + Date.now() + Math.floor(Math.random() * 100)),
      source_job_id: input.sourceJobId,
      source_dispatch_doc_id: input.sourceDispatchDocId,
      plan_id: input.planId,
      pattern_id: input.patternId,
      pattern_no_snapshot: input.patternNoSnapshot,
      pattern_name_snapshot: input.patternNameSnapshot,
      destination_name_snapshot: "Depo",
      dyehouse_id: input.dyehouseId,
      variant_lines: input.variantLines || [],
      meters_total: input.metersTotal,
      note: input.note || null,
    };

    const { data, error } = await supabase
      .from("weaving_dispatch_documents")
      .insert(docRow)
      .select()
      .single();

    if (error) throw new Error("Boyahane sevk belgesi oluşturulamadı: " + error.message);
    return mapDispatchDocumentFromDb(data);
  },
};
