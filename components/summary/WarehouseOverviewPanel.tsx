"use client";

import { Activity, ArrowDownToLine, ArrowUpRight, Undo2 } from "lucide-react";

import type { WarehouseSummaryData } from "@/lib/summary/summaryTypes";
import {
  SummaryEmptyState,
  SummaryInfoPill,
  SummaryKpiCard,
  SummarySectionCard,
} from "@/components/summary/SummaryPrimitives";
import { TrendBarChart } from "@/components/summary/SummaryCharts";
import {
  fmtMetres,
  fmtPercent,
  InsightCard,
  SnapshotRow,
} from "@/components/summary/WarehousePanelShared";

type WarehouseOverviewPanelProps = {
  data: WarehouseSummaryData;
  periodLabel: string;
  scaleLabel: string;
};

export function WarehouseOverviewPanel({
  data,
  periodLabel,
  scaleLabel,
}: WarehouseOverviewPanelProps) {
  const strongestCustomer = data.customers[0] ?? null;
  const strongestPattern = data.patterns[0] ?? null;
  const peakBucket =
    [...data.trend].sort((left, right) => {
      const totalLeft = left.inboundMetres + left.shippedMetres + left.returnedMetres;
      const totalRight = right.inboundMetres + right.shippedMetres + right.returnedMetres;
      return totalRight - totalLeft;
    })[0] ?? null;
  const returnRate =
    data.totals.shipped.metres > 0 ? data.totals.returned.metres / data.totals.shipped.metres : 0;

  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
      <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-4">
        <SummaryKpiCard
          title="Gelen Metre"
          value={fmtMetres(data.totals.inbound.metres)}
          unit="m"
          hint="Top girislerinden uretilen fiziksel depo artisi."
          meta={`${data.totals.inbound.tops} top`}
          tone="teal"
          icon={ArrowDownToLine}
        />
        <SummaryKpiCard
          title="Sevk Edilen"
          value={fmtMetres(data.totals.shipped.metres)}
          unit="m"
          hint="Secilen donemde aktif sevk olarak kayitli cikislar."
          meta={`${data.totals.shipped.tops} top`}
          tone="indigo"
          icon={ArrowUpRight}
        />
        <SummaryKpiCard
          title="Iade Metre"
          value={fmtMetres(data.totals.returned.metres)}
          unit="m"
          hint="Sevk geri almalariyla depoya geri donen miktar."
          meta={`${data.totals.returned.tops} top`}
          tone="amber"
          icon={Undo2}
        />
        <SummaryKpiCard
          title="Net Hareket"
          value={fmtMetres(data.totals.netMovement.metres)}
          unit="m"
          hint="Gelen + iade - sevk dengesi."
          meta={`${data.totals.netMovement.tops.toLocaleString("tr-TR")} top`}
          tone={data.totals.netMovement.metres >= 0 ? "emerald" : "rose"}
          icon={Activity}
        />
      </div>

      <div className="grid min-h-0 flex-1 gap-4 xl:grid-cols-[minmax(0,1.55fr)_360px]">
        <SummarySectionCard
          title="Ana Trend"
          description={`${periodLabel} boyunca ${scaleLabel.toLocaleLowerCase("tr-TR")} kiriliminda gelen, sevk ve iade hareketleri.`}
          className="min-h-0"
          bodyClassName="min-h-0"
        >
          {data.hasData ? (
            <TrendBarChart data={data.trend} />
          ) : (
            <SummaryEmptyState
              icon={Activity}
              title="Bu aralikta hareket bulunamadi"
              description="Tarih araligini genisleterek veya farkli bir olcek secerek trendi yeniden inceleyebilirsiniz."
            />
          )}
        </SummarySectionCard>

        <div className="grid min-h-0 gap-4 xl:grid-rows-[auto_minmax(0,1fr)]">
          <SummarySectionCard
            title="Operasyon Snapshot"
            description="Secilen donemin one cikan odaklari."
          >
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <SummaryInfoPill label={scaleLabel} tone="slate" />
                <SummaryInfoPill label={periodLabel} tone="cyan" />
              </div>

              <div className="space-y-2 rounded-[22px] border border-black/5 bg-neutral-50/80 p-3">
                <SnapshotRow label="En yogun donem" value={peakBucket?.label ?? "-"} />
                <SnapshotRow
                  label="Lider musteri"
                  value={
                    strongestCustomer
                      ? `${strongestCustomer.customerName} • ${fmtPercent(strongestCustomer.share)}`
                      : "-"
                  }
                />
                <SnapshotRow
                  label="One cikan desen"
                  value={
                    strongestPattern
                      ? `${strongestPattern.patternLabel} • ${fmtMetres(strongestPattern.totalMetres)} m`
                      : "-"
                  }
                />
              </div>
            </div>
          </SummarySectionCard>

          <SummarySectionCard
            title="Hizli Okuma"
            description="Dashboard'u asagi uzatmadan karar vermeyi hizlandiran kisa notlar."
            className="min-h-0"
            bodyClassName="min-h-0 overflow-auto"
          >
            <div className="space-y-3">
              <InsightCard
                tone="teal"
                title="Giris Hacmi"
                value={`${fmtMetres(data.totals.inbound.metres)} m`}
                description="Girisler mevcut depo eklemelerinden turetilir ve donemin depo beslenmesini gosterir."
              />
              <InsightCard
                tone="indigo"
                title="Cikis Baskisi"
                value={`${fmtMetres(data.totals.shipped.metres)} m`}
                description="Aktif sevk kayitlari musterilere cikisi temsil eder."
              />
              <InsightCard
                tone="amber"
                title="Iade Orani"
                value={fmtPercent(returnRate)}
                description="Iade metriği sevke gore okundugunda kalite ve musteri servis sinyalini verir."
              />
            </div>
          </SummarySectionCard>
        </div>
      </div>
    </div>
  );
}
