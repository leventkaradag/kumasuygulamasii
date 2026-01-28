import type { LucideIcon } from "lucide-react";
import { Repeat2, Truck, Warehouse } from "lucide-react";
import { TOPBAR_KPIS, type KpiIconName, type TopbarKpi } from "../config/topbarKpis";
import { cn } from "../lib/cn";

const KPI_ICON_MAP: Record<KpiIconName, LucideIcon> = {
  yarn: Warehouse,
  truck: Truck,
  repeat: Repeat2,
};

type KpiChipsProps = {
  kpis?: TopbarKpi[];
  className?: string;
};

export function KpiChips({ kpis = TOPBAR_KPIS, className }: KpiChipsProps) {
  return (
    <div
      className={cn(
        "flex items-stretch gap-2 overflow-x-auto pb-1",
        "[-webkit-overflow-scrolling:touch]",
        className
      )}
      aria-label="KPI özetleri"
    >
      {kpis.map((kpi) => {
        const Icon = KPI_ICON_MAP[kpi.icon];
        return (
          <div
            key={kpi.key}
            className="flex shrink-0 items-center gap-2 rounded-full border border-black/5 bg-white/80 px-3 py-2 text-xs shadow-[0_6px_16px_rgba(0,0,0,0.06)] backdrop-blur-sm"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-coffee-primary/15 text-coffee-primary">
              <Icon className="h-4 w-4" aria-hidden />
            </div>
            <div className="leading-tight">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
                {kpi.label}
              </div>
              <div className="text-sm font-semibold text-neutral-900">{kpi.value}</div>
              {kpi.helper ? (
                <div className="text-[11px] text-neutral-500">{kpi.helper}</div>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}
