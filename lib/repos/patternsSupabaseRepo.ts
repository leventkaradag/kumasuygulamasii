"use client";

import { createClient } from "@/lib/supabase/client";
import type { Stage } from "@/lib/domain/movement";
import type { Pattern, Variant } from "@/lib/domain/pattern";

// ─── Types ──────────────────────────────────────────────────────────────────

export type PatternMetersTarget = "AUTO" | "URETIM" | "STOK" | "BOYAHANE" | "HATALI";

export type UpsertPatternFromFormPayload = Pick<
  Pattern,
  "fabricCode" | "fabricName" | "weaveType" | "warpCount" | "weftCount" | "totalEnds"
> & {
  currentStage?: Stage;
  tarakEniCm?: number | null;
  color?: string;
  imageDigital?: string | null;
  imageFinal?: string | null;
  metersToAdd?: number;
  metersTarget?: PatternMetersTarget;
};

// ─── DB row type (snake_case) ────────────────────────────────────────────────

type PatternRow = {
  id: string;
  created_at: string;
  fabric_code: string;
  fabric_name: string;
  weave_type: string;
  warp_count: string;
  weft_count: string;
  total_ends: string;
  current_stage: string;
  total_produced_meters: number;
  stock_meters: number;
  defect_meters: number;
  in_dyehouse_meters: number;
  variants: Variant[] | null;
  parti_nos: string[] | null;
  gramaj_gm2: number | null;
  fire_orani: number | null;
  musteri: string | null;
  depo_no: string | null;
  kg: number | null;
  eni_cm: number | null;
  tarak_eni_cm: number | null;
  color: string | null;
  image_digital: string | null;
  image_final: string | null;
  note: string | null;
  archived: boolean | null;
};

// ─── Mappers ─────────────────────────────────────────────────────────────────

function mapDbToPattern(row: PatternRow): Pattern {
  return {
    id: row.id,
    createdAt: row.created_at,
    fabricCode: row.fabric_code,
    fabricName: row.fabric_name,
    weaveType: row.weave_type,
    warpCount: row.warp_count,
    weftCount: row.weft_count,
    totalEnds: row.total_ends,
    currentStage: row.current_stage as Stage,
    totalProducedMeters: row.total_produced_meters ?? 0,
    stockMeters: row.stock_meters ?? 0,
    defectMeters: row.defect_meters ?? 0,
    inDyehouseMeters: row.in_dyehouse_meters ?? 0,
    variants: row.variants ?? [],
    partiNos: row.parti_nos ?? [],
    gramajGm2: row.gramaj_gm2 ?? undefined,
    fireOrani: row.fire_orani ?? undefined,
    musteri: row.musteri ?? undefined,
    depoNo: row.depo_no ?? undefined,
    kg: row.kg ?? undefined,
    eniCm: row.eni_cm ?? undefined,
    tarakEniCm: row.tarak_eni_cm,
    color: row.color ?? undefined,
    imageDigital: row.image_digital,
    imageFinal: row.image_final,
    digitalImageUrl: row.image_digital ?? undefined,
    finalImageUrl: row.image_final ?? undefined,
    note: row.note ?? undefined,
    archived: row.archived ?? false,
  };
}

function mapPatternToDb(pattern: Partial<Pattern>): Partial<PatternRow> {
  const row: Partial<PatternRow> = {};
  if (pattern.id !== undefined) row.id = pattern.id;
  if (pattern.createdAt !== undefined) row.created_at = pattern.createdAt;
  if (pattern.fabricCode !== undefined) row.fabric_code = pattern.fabricCode;
  if (pattern.fabricName !== undefined) row.fabric_name = pattern.fabricName;
  if (pattern.weaveType !== undefined) row.weave_type = pattern.weaveType;
  if (pattern.warpCount !== undefined) row.warp_count = pattern.warpCount;
  if (pattern.weftCount !== undefined) row.weft_count = pattern.weftCount;
  if (pattern.totalEnds !== undefined) row.total_ends = pattern.totalEnds;
  if (pattern.currentStage !== undefined) row.current_stage = pattern.currentStage;
  if (pattern.totalProducedMeters !== undefined) row.total_produced_meters = pattern.totalProducedMeters;
  if (pattern.stockMeters !== undefined) row.stock_meters = pattern.stockMeters;
  if (pattern.defectMeters !== undefined) row.defect_meters = pattern.defectMeters;
  if (pattern.inDyehouseMeters !== undefined) row.in_dyehouse_meters = pattern.inDyehouseMeters;
  if (pattern.variants !== undefined) row.variants = pattern.variants;
  if (pattern.partiNos !== undefined) row.parti_nos = pattern.partiNos;
  if (pattern.gramajGm2 !== undefined) row.gramaj_gm2 = pattern.gramajGm2 ?? null;
  if (pattern.fireOrani !== undefined) row.fire_orani = pattern.fireOrani ?? null;
  if (pattern.musteri !== undefined) row.musteri = pattern.musteri ?? null;
  if (pattern.depoNo !== undefined) row.depo_no = pattern.depoNo ?? null;
  if (pattern.kg !== undefined) row.kg = pattern.kg ?? null;
  if (pattern.eniCm !== undefined) row.eni_cm = pattern.eniCm ?? null;
  if (pattern.tarakEniCm !== undefined) row.tarak_eni_cm = pattern.tarakEniCm ?? null;
  if (pattern.color !== undefined) row.color = pattern.color ?? null;
  if (pattern.imageDigital !== undefined) row.image_digital = pattern.imageDigital ?? null;
  if (pattern.imageFinal !== undefined) row.image_final = pattern.imageFinal ?? null;
  if (pattern.note !== undefined) row.note = pattern.note ?? null;
  if (pattern.archived !== undefined) row.archived = pattern.archived ?? false;
  return row;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function resolveMetersTarget(
  target: PatternMetersTarget,
  stage: Stage
): Exclude<PatternMetersTarget, "AUTO"> {
  if (target !== "AUTO") return target;
  if (stage === "DOKUMA") return "URETIM";
  if (stage === "BOYAHANE") return "BOYAHANE";
  return "STOK";
}

function incrementMeters(
  pattern: Pattern,
  target: Exclude<PatternMetersTarget, "AUTO">,
  metersToAdd: number
): Pattern {
  if (metersToAdd <= 0) return pattern;
  if (target === "URETIM") return { ...pattern, totalProducedMeters: pattern.totalProducedMeters + metersToAdd };
  if (target === "STOK") return { ...pattern, stockMeters: pattern.stockMeters + metersToAdd };
  if (target === "BOYAHANE") return { ...pattern, inDyehouseMeters: pattern.inDyehouseMeters + metersToAdd };
  return { ...pattern, defectMeters: pattern.defectMeters + metersToAdd };
}

// ─── Repository ───────────────────────────────────────────────────────────────

export const patternsSupabaseRepo = {
  /** List all patterns (active + archived) */
  async list(): Promise<Pattern[]> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("patterns")
      .select("*")
      .order("created_at", { ascending: true });

    if (error) throw new Error(`patterns.list: ${error.message}`);
    return (data as PatternRow[]).map(mapDbToPattern);
  },

  /** Get single pattern by ID */
  async get(id: string): Promise<Pattern | null> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("patterns")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error) throw new Error(`patterns.get: ${error.message}`);
    if (!data) return null;
    return mapDbToPattern(data as PatternRow);
  },

  /** Partial update — only specified fields are written */
  async update(id: string, patch: Partial<Pattern>): Promise<Pattern | undefined> {
    const supabase = createClient();
    const dbPatch = mapPatternToDb(patch);

    const { data, error } = await supabase
      .from("patterns")
      .update(dbPatch)
      .eq("id", id)
      .select()
      .maybeSingle();

    if (error) throw new Error(`patterns.update: ${error.message}`);
    if (!data) return undefined;
    return mapDbToPattern(data as PatternRow);
  },

  /** Create or update pattern from the form UI */
  async upsertPatternFromForm(payload: UpsertPatternFromFormPayload): Promise<Pattern> {
    const supabase = createClient();

    const fabricCode = payload.fabricCode.trim();
    const currentStage = payload.currentStage ?? "DEPO";
    const metersToAdd = typeof payload.metersToAdd === "number" && payload.metersToAdd > 0
      ? payload.metersToAdd
      : 0;
    const metersTarget = resolveMetersTarget(payload.metersTarget ?? "AUTO", currentStage);

    // Check for existing pattern by fabricCode
    const { data: existing, error: fetchError } = await supabase
      .from("patterns")
      .select("*")
      .eq("fabric_code", fabricCode)
      .maybeSingle();

    if (fetchError) throw new Error(`patterns.upsert fetch: ${fetchError.message}`);

    let base: Pattern;

    if (existing) {
      base = mapDbToPattern(existing as PatternRow);
    } else {
      // New pattern — id = fabricCode (matches local repo behaviour)
      base = {
        id: fabricCode,
        createdAt: new Date().toISOString(),
        fabricCode,
        fabricName: payload.fabricName.trim(),
        weaveType: payload.weaveType.trim(),
        warpCount: payload.warpCount.trim(),
        weftCount: payload.weftCount.trim(),
        totalEnds: payload.totalEnds.trim(),
        currentStage,
        totalProducedMeters: 0,
        stockMeters: 0,
        defectMeters: 0,
        inDyehouseMeters: 0,
        variants: [],
        partiNos: [],
        tarakEniCm: payload.tarakEniCm ?? null,
        color: payload.color ?? undefined,
        imageDigital: payload.imageDigital ?? null,
        imageFinal: payload.imageFinal ?? null,
        digitalImageUrl: payload.imageDigital ?? undefined,
        finalImageUrl: payload.imageFinal ?? undefined,
      };
    }

    // Apply form fields
    let next: Pattern = {
      ...base,
      fabricCode,
      fabricName: payload.fabricName.trim(),
      weaveType: payload.weaveType.trim(),
      warpCount: payload.warpCount.trim(),
      weftCount: payload.weftCount.trim(),
      totalEnds: payload.totalEnds.trim(),
      currentStage,
    };

    // Apply optional image overrides
    if (payload.imageDigital !== undefined) {
      next = { ...next, imageDigital: payload.imageDigital, digitalImageUrl: payload.imageDigital ?? undefined };
    }
    if (payload.imageFinal !== undefined) {
      next = { ...next, imageFinal: payload.imageFinal, finalImageUrl: payload.imageFinal ?? undefined };
    }

    // Increment meters
    next = incrementMeters(next, metersTarget, metersToAdd);

    const dbRow = mapPatternToDb(next);

    // Check for id collision (different id, same fabric_code conflict)
    if (existing && existing.id !== next.id) {
      // The existing row has a different id; use the existing id to avoid FK chaos
      next = { ...next, id: existing.id };
    }

    const { data: upserted, error: upsertError } = await supabase
      .from("patterns")
      .upsert({ ...dbRow, id: next.id }, { onConflict: "id" })
      .select()
      .maybeSingle();

    if (upsertError) throw new Error(`patterns.upsert write: ${upsertError.message}`);
    if (!upserted) throw new Error("patterns.upsert: no data returned");

    return mapDbToPattern(upserted as PatternRow);
  },

  async archivePattern(id: string): Promise<Pattern | undefined> {
    return this.update(id, { archived: true });
  },

  async restorePattern(id: string): Promise<Pattern | undefined> {
    return this.update(id, { archived: false });
  },

  /** Hard delete — permanent removal */
  async remove(id: string): Promise<boolean> {
    const supabase = createClient();
    const { error } = await supabase.from("patterns").delete().eq("id", id);
    if (error) throw new Error(`patterns.remove: ${error.message}`);
    return true;
  },
};
