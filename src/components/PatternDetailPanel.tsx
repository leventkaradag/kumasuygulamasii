import type { ReactNode } from "react";
import { Image as ImageIcon, ImageOff, Layers, Package, Palette, Sparkles } from "lucide-react";
import { Accordion } from "./Accordion";
import { ImagePicker } from "./ImagePicker";
import type { Pattern } from "../mock/patterns";
import { cn } from "../lib/cn";

type PatternDetailPanelProps = {
  pattern: Pattern | null;
  onSelectDigital: (file?: File) => void;
  onSelectFinal: (file?: File) => void;
};

export function PatternDetailPanel({ pattern, onSelectDigital, onSelectFinal }: PatternDetailPanelProps) {
  if (!pattern) {
    return (
      <div className="rounded-2xl border border-black/5 bg-white/80 p-6 shadow-[0_10px_30px_rgba(0,0,0,0.08)]">
        <div className="flex h-48 flex-col items-center justify-center gap-3 text-neutral-500">
          <ImageOff className="h-8 w-8" aria-hidden />
          <div className="text-sm font-semibold">Desen seçilmedi</div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 rounded-2xl border border-black/5 bg-white/80 p-6 shadow-[0_10px_30px_rgba(0,0,0,0.08)]">
      <div className="grid gap-3 sm:grid-cols-2">
        <ImageCard
          title="Dijital Görsel"
          imageUrl={pattern.digitalImageUrl}
          placeholderIcon={<Sparkles className="h-10 w-10 text-coffee-primary" aria-hidden />}
          onPick={onSelectDigital}
        />
        <ImageCard
          title="Final Görsel"
          imageUrl={pattern.finalImageUrl}
          placeholderIcon={<ImageIcon className="h-10 w-10 text-coffee-primary" aria-hidden />}
          onPick={onSelectFinal}
        />
      </div>

      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-xs uppercase tracking-wide text-neutral-500">Desen</div>
          <div className="text-lg font-semibold text-neutral-900">
            {pattern.patternNo} · {pattern.patternName}
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        <StatCard icon={<Package className="h-4 w-4" />} label="Üretim" value={`${pattern.totalProducedMeters} m`} />
        <StatCard icon={<Package className="h-4 w-4" />} label="Stok" value={`${pattern.stockMeters} m`} />
        <StatCard icon={<Palette className="h-4 w-4" />} label="Boyahane" value={`${pattern.inDyehouseMeters} m`} />
        <StatCard icon={<Layers className="h-4 w-4" />} label="Hatalı" value={`${pattern.defectMeters} m`} />
      </div>

      <Accordion title="Detaylar" defaultOpen={false}>
        <div className="space-y-4">
          <SectionBlock title="Varyantlar">
            <p className="text-sm text-neutral-600">Toplam {pattern.variantsCount} varyant (placeholder)</p>
          </SectionBlock>

          <SectionBlock title="Notlar">
            <textarea
              placeholder="Not ekle (placeholder)"
              className="w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-sm text-neutral-800 shadow-[0_4px_10px_rgba(0,0,0,0.04)] focus:border-coffee-primary focus:outline-none focus:ring-1 focus:ring-coffee-primary"
              rows={3}
            />
          </SectionBlock>

          <SectionBlock title="İşlem Geçmişi">
            <ul className="space-y-2 text-sm text-neutral-700">
              <li className="rounded-lg bg-coffee-surface px-3 py-2">Geçmiş kaydı (placeholder)</li>
              <li className="rounded-lg bg-coffee-surface px-3 py-2">Geçmiş kaydı (placeholder)</li>
              <li className="rounded-lg bg-coffee-surface px-3 py-2">Geçmiş kaydı (placeholder)</li>
            </ul>
          </SectionBlock>
        </div>
      </Accordion>
    </div>
  );
}

type ImageCardProps = {
  title: string;
  imageUrl?: string;
  placeholderIcon: ReactNode;
  onPick: (file?: File) => void;
};

function ImageCard({ title, imageUrl, placeholderIcon, onPick }: ImageCardProps) {
  return (
    <div
      className={cn(
        "relative flex flex-col gap-3 overflow-hidden rounded-xl border border-black/5 bg-white shadow-[0_8px_20px_rgba(0,0,0,0.06)]"
      )}
    >
      <div className="relative" style={{ aspectRatio: "4 / 3" }}>
        {imageUrl ? (
          <img src={imageUrl} alt={title} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-3 bg-coffee-surface text-neutral-500">
            {placeholderIcon}
            <span className="text-sm font-semibold">Fotoğraf yok</span>
          </div>
        )}
      </div>
      <div className="flex items-center justify-between px-3 pb-3">
        <div>
          <div className="text-xs uppercase tracking-wide text-neutral-500">{title}</div>
        </div>
        <ImagePicker onSelect={onPick} />
      </div>
    </div>
  );
}

type StatCardProps = {
  icon: ReactNode;
  label: string;
  value: string;
};

function StatCard({ icon, label, value }: StatCardProps) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-black/5 bg-white px-3 py-3 text-sm shadow-[0_6px_14px_rgba(0,0,0,0.04)]">
      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-coffee-primary/15 text-coffee-primary">
        {icon}
      </span>
      <div>
        <div className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">{label}</div>
        <div className="text-base font-semibold text-neutral-900">{value}</div>
      </div>
    </div>
  );
}

type SectionBlockProps = {
  title: string;
  children: ReactNode;
};

function SectionBlock({ title, children }: SectionBlockProps) {
  return (
    <div className="space-y-1">
      <div className="text-xs font-semibold uppercase tracking-wide text-neutral-500">{title}</div>
      {children}
    </div>
  );
}
