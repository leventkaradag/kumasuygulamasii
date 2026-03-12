"use client";

import { cn } from "@/lib/cn";
import { SummarySectionCard, summaryToneConfig } from "@/components/summary/SummaryPrimitives";
import {
  InsightCard,
  PlaceholderSurface,
} from "@/components/summary/WarehousePanelShared";

type SummaryPlaceholderModuleProps = {
  module: "DYEHOUSE" | "WEAVING";
};

const placeholderModuleCopy = {
  DYEHOUSE: {
    title: "Boyahane Ozeti",
    description:
      "Ayni summary mimarisi icinde boyahane KPI'lari, termin ve proses dagilimlari icin alan hazirlaniyor.",
    cards: [
      { title: "Boyahaneye Giren", hint: "giren metre" },
      { title: "Islemde Olan", hint: "aktif partiler" },
      { title: "Tamamlanan", hint: "cikis alan metre" },
      { title: "Ort. Termin", hint: "gun bazli izleme" },
    ],
  },
  WEAVING: {
    title: "Dokuma Ozeti",
    description:
      "Dokuma modulu ileride aktif desen yogunlugu, uretim ritmi ve fire sinyalleriyle buradan okunacak.",
    cards: [
      { title: "Dokunan Metre", hint: "donemsel uretim" },
      { title: "Aktif Desen", hint: "calisan planlar" },
      { title: "Yogunluk", hint: "gunluk ritim" },
      { title: "Fire Ozetleri", hint: "kalite sinyali" },
    ],
  },
} as const;

export function SummaryPlaceholderModule({
  module,
}: SummaryPlaceholderModuleProps) {
  const copy = placeholderModuleCopy[module];

  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
      <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-4">
        {copy.cards.map((card, index) => (
          <div
            key={card.title}
            className={cn(
              "rounded-[24px] border p-4 shadow-[0_14px_34px_rgba(15,23,42,0.05)]",
              index % 4 === 0
                ? summaryToneConfig.teal.cardClassName
                : index % 4 === 1
                  ? summaryToneConfig.indigo.cardClassName
                  : index % 4 === 2
                    ? summaryToneConfig.amber.cardClassName
                    : summaryToneConfig.rose.cardClassName
            )}
          >
            <div className="text-xs uppercase tracking-[0.22em] text-neutral-500">{card.title}</div>
            <div className="mt-3 text-2xl font-semibold text-neutral-900">Taslak</div>
            <div className="mt-2 text-sm text-neutral-600">{card.hint}</div>
          </div>
        ))}
      </div>

      <div className="grid min-h-0 flex-1 gap-4 xl:grid-cols-[minmax(0,1.35fr)_360px]">
        <SummarySectionCard
          title={copy.title}
          description={copy.description}
          className="min-h-0"
          bodyClassName="min-h-0"
        >
          <div className="grid h-full min-h-[320px] gap-4 md:grid-cols-2">
            <PlaceholderSurface title="KPI Katmani" />
            <PlaceholderSurface title="Ana Trend / Termin Grafigi" />
            <PlaceholderSurface title="Analiz Panelleri" />
            <PlaceholderSurface title="Operasyon Notlari" />
          </div>
        </SummarySectionCard>

        <SummarySectionCard
          title="Yol Haritasi"
          description="Bu modul ayni kontrol paneli hissini koruyacak sekilde doldurulacak."
          className="min-h-0"
          bodyClassName="min-h-0 overflow-auto"
        >
          <div className="space-y-3">
            <InsightCard
              tone="teal"
              title="Hazir Olan"
              value="Mimari"
              description="Modul switch, panel sahnesi ve KPI alanlari summary sistemiyle ortaklasti."
            />
            <InsightCard
              tone="indigo"
              title="Sonraki Adim"
              value="Veri Esleme"
              description="Mevcut repo/domain katmanlari bu moduller icin baglandiginda ayni arayuz uzerinde canlanacak."
            />
            <InsightCard
              tone="amber"
              title="UI Hedefi"
              value="Tek Sahne"
              description="Uzun dashboard yerine sekmeli, kontrollu ve ferah bir operasyon paneli cizgisi korunuyor."
            />
          </div>
        </SummarySectionCard>
      </div>
    </div>
  );
}
