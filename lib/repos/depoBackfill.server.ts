import "server-only"

import type { FabricRollStatus } from "@/lib/domain/depo"
import { createClient } from "@/lib/supabase/server"

type PatternMetersRow = {
  defect_meters: number | null
  id: string
  stock_meters: number | null
}

type FabricRollMeterRow = {
  id: string
  meters: number
  pattern_id: string
  status: string
}

type PatternWarehouseBackfillResult = {
  changedPatternCount: number
  patternCount: number
  rollCount: number
}

const PAGE_SIZE = 1000

const VALID_STATUSES: FabricRollStatus[] = [
  "IN_STOCK",
  "RESERVED",
  "SHIPPED",
  "RETURNED",
  "VOIDED",
  "SCRAP",
]

const STOCK_METER_STATUSES = new Set<FabricRollStatus>([
  "IN_STOCK",
  "RESERVED",
  "RETURNED",
])

const DEFECT_METER_STATUSES = new Set<FabricRollStatus>(["SCRAP"])

const isValidStatus = (value: string): value is FabricRollStatus =>
  VALID_STATUSES.includes(value as FabricRollStatus)

async function listAllPatterns() {
  const supabase = await createClient()
  const rows: PatternMetersRow[] = []

  for (let from = 0; ; from += PAGE_SIZE) {
    const to = from + PAGE_SIZE - 1
    const { data, error } = await supabase
      .from("patterns")
      .select("id, stock_meters, defect_meters")
      .order("id", { ascending: true })
      .range(from, to)
      .returns<PatternMetersRow[]>()

    if (error) {
      throw new Error(`patterns.backfill list patterns: ${error.message}`)
    }

    const chunk = data ?? []
    rows.push(...chunk)

    if (chunk.length < PAGE_SIZE) {
      return rows
    }
  }
}

async function listAllRollMeters() {
  const supabase = await createClient()
  const rows: FabricRollMeterRow[] = []

  for (let from = 0; ; from += PAGE_SIZE) {
    const to = from + PAGE_SIZE - 1
    const { data, error } = await supabase
      .from("fabric_rolls")
      .select("id, pattern_id, meters, status")
      .order("id", { ascending: true })
      .range(from, to)
      .returns<FabricRollMeterRow[]>()

    if (error) {
      throw new Error(`patterns.backfill list rolls: ${error.message}`)
    }

    const chunk = data ?? []
    rows.push(...chunk)

    if (chunk.length < PAGE_SIZE) {
      return rows
    }
  }
}

export async function backfillAllPatternWarehouseMeters(): Promise<PatternWarehouseBackfillResult> {
  const [patternRows, rollRows] = await Promise.all([listAllPatterns(), listAllRollMeters()])
  const supabase = await createClient()

  const totalsByPatternId = new Map<string, { defectMeters: number; stockMeters: number }>()

  patternRows.forEach((row) => {
    totalsByPatternId.set(row.id, { stockMeters: 0, defectMeters: 0 })
  })

  rollRows.forEach((row) => {
    const bucket = totalsByPatternId.get(row.pattern_id)
    if (!bucket) return

    const meters = Number(row.meters)
    if (!Number.isFinite(meters) || meters <= 0) return
    if (!isValidStatus(row.status)) return

    if (STOCK_METER_STATUSES.has(row.status)) {
      bucket.stockMeters += meters
      return
    }

    if (DEFECT_METER_STATUSES.has(row.status)) {
      bucket.defectMeters += meters
    }
  })

  let changedPatternCount = 0

  for (const patternRow of patternRows) {
    const totals = totalsByPatternId.get(patternRow.id) ?? {
      stockMeters: 0,
      defectMeters: 0,
    }

    const nextStockMeters = totals.stockMeters
    const nextDefectMeters = totals.defectMeters
    const currentStockMeters = Number(patternRow.stock_meters ?? 0)
    const currentDefectMeters = Number(patternRow.defect_meters ?? 0)

    if (
      currentStockMeters === nextStockMeters &&
      currentDefectMeters === nextDefectMeters
    ) {
      continue
    }

    const { error } = await supabase
      .from("patterns")
      .update({
        stock_meters: nextStockMeters,
        defect_meters: nextDefectMeters,
      })
      .eq("id", patternRow.id)

    if (error) {
      throw new Error(`patterns.backfill update ${patternRow.id}: ${error.message}`)
    }

    changedPatternCount += 1
  }

  return {
    patternCount: patternRows.length,
    rollCount: rollRows.length,
    changedPatternCount,
  }
}
