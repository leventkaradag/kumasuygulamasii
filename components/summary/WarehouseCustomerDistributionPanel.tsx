"use client";

import { ArrowUpRight, Droplets, Sparkles, Users2 } from "lucide-react";

import type { WarehouseCustomerDistributionRow } from "@/lib/summary/summaryTypes";
import {
  SummaryEmptyState,
  SummaryKpiCard,
  SummarySectionCard,
} from "@/components/summary/SummaryPrimitives";
import { DonutShareChart } from "@/components/summary/SummaryCharts";
import {
  fmtMetres,
  fmtPercent,
  InsightCard,
  RankedRow,
} from "@/components/summary/WarehousePanelShared";

type WarehouseCustomerDistributionPanelProps = {
  rows: WarehouseCustomerDistributionRow[];
  donutRows: WarehouseCustomerDistributionRow[];
  totalMetres: number;
};

export function WarehouseCustomerDistributionPanel({
  rows,
  donutRows,
  totalMetres,
}: WarehouseCustomerDistributionPanelProps) {
  const leader = rows[0] ?? null;
  const topFiveShare = rows.slice(0, 5).reduce((sum, row) => sum + row.share, 0);
  const averageMetres = rows.length > 0 ? totalMetres / rows.length : 0;

  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
      <div className="grid gap-3 lg:grid-cols-3">
        <SummaryKpiCard
          title="Aktif Musteri"
          value={rows.length.toLocaleString("tr-TR")}
          hint="Secilen donemde sevk gorulen musteri adedi."
          tone="rose"
          icon={Users2}
        />
        <SummaryKpiCard
          title="Lider Pay"
          value={leader ? fmtPercent(leader.share) : "%0"}
          hint="Toplam sevk icerisindeki en baskin musteri payi."
          meta={leader?.customerName ?? "Musteri yok"}
          tone="indigo"
          icon={Sparkles}
        />
        <SummaryKpiCard
          title="Ort. Musteri Hacmi"
          value={fmtMetres(averageMetres)}
          unit="m"
          hint="Musteri basina ortalama sevk hacmi."
          meta={fmtMetres(totalMetres)}
          tone="teal"
          icon={Droplets}
        />
      </div>

      <div className="grid min-h-0 flex-1 gap-4 xl:grid-cols-[minmax(0,1.4fr)_340px]">
        <SummarySectionCard
          title="Sevk Dagilimi"
          description="Dairesel grafik musteri paylarini yuzde olarak gosterir."
          className="min-h-0"
          bodyClassName="min-h-0"
        >
          {rows.length > 0 ? (
            <DonutShareChart rows={donutRows} totalMetres={totalMetres} />
          ) : (
            <SummaryEmptyState
              icon={Users2}
              title="Dagilim verisi yok"
              description="Bu donemde aktif sevk olmadigi icin musteri payi olusturulamadi."
            />
          )}
        </SummarySectionCard>

        <SummarySectionCard
          title="Oncelikli Musteriler"
          description="Top sevk hacmini tasiyan musteri gruplari."
          className="min-h-0"
          bodyClassName="min-h-0 overflow-auto"
        >
          {rows.length > 0 ? (
            <div className="space-y-3">
              <InsightCard
                tone="rose"
                title="Top 5 Konsantrasyon"
                value={fmtPercent(topFiveShare)}
                description="Ilk bes musteri toplam sevkin ne kadarini tasiyor."
              />
              <InsightCard
                tone="indigo"
                title="Toplam Cikis"
                value={`${fmtMetres(totalMetres)} m`}
                description="Musteri dagilimi sadece aktif sevk kayitlarindan hesaplanir."
              />

              <div className="space-y-2">
                {rows.slice(0, 5).map((row) => (
                  <RankedRow
                    key={row.customerKey}
                    label={row.customerName}
                    primaryText={`${fmtPercent(row.share)}`}
                    secondaryText={`${fmtMetres(row.totalMetres)} m • ${row.totalTops} top`}
                    share={row.share}
                    tone="rose"
                  />
                ))}
              </div>
            </div>
          ) : (
            <SummaryEmptyState
              icon={ArrowUpRight}
              title="Liste bos"
              description="Musteri odakli sevk kaydi olusunca burada yogunlasma okumasi belirecek."
            />
          )}
        </SummarySectionCard>
      </div>
    </div>
  );
}
