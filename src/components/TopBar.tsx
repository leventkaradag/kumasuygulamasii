import { ArrowLeft, CalendarRange, Home, Search } from "lucide-react";
import { useRouter, usePathname } from "next/navigation";
import { Breadcrumb } from "./Breadcrumb";
import { KpiChips } from "./KpiChips";
import { UserMenu } from "./UserMenu";
import { TOPBAR_KPIS } from "../config/topbarKpis";
import { cn } from "../lib/cn";

type DateRange = {
  from: string;
  to: string;
};

type TopBarProps = {
  routeLabels: Record<string, string>;
  searchValue: string;
  onSearchChange: (value: string) => void;
  dateRange: DateRange;
  onDateRangeChange: (range: DateRange) => void;
};

export function TopBar({
  routeLabels,
  searchValue,
  onSearchChange,
  dateRange,
  onDateRangeChange,
}: TopBarProps) {
  const router = useRouter();
  const pathname = usePathname();

  const handleDateChange = (field: keyof DateRange, value: string) => {
    onDateRangeChange({ ...dateRange, [field]: value });
  };

  return (
    <header className="sticky top-0 z-30 w-full border-b border-black/5 bg-coffee-surface/90 backdrop-blur-sm">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="flex flex-wrap items-center gap-2 py-2 md:gap-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => router.back()}
              className="flex items-center gap-2 rounded-full border border-black/5 bg-white px-3 py-2 text-sm font-semibold text-neutral-800 shadow-[0_4px_12px_rgba(0,0,0,0.06)] transition hover:-translate-y-0.5 hover:shadow-[0_8px_16px_rgba(0,0,0,0.08)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-coffee-primary"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden />
              <span>Geri</span>
            </button>
            <button
              type="button"
              onClick={() => router.push("/")}
              className="flex items-center gap-2 rounded-full border border-black/5 bg-coffee-primary/10 px-3 py-2 text-sm font-semibold text-neutral-900 shadow-[0_4px_12px_rgba(0,0,0,0.06)] transition hover:-translate-y-0.5 hover:shadow-[0_8px_16px_rgba(0,0,0,0.08)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-coffee-primary"
            >
              <Home className="h-4 w-4 text-coffee-primary" aria-hidden />
              <span>Ana Sayfa</span>
            </button>
          </div>

          <div className="min-w-[220px] flex-1">
            <label className="relative block">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
              <input
                type="search"
                name="global-search"
                value={searchValue}
                onChange={(event) => onSearchChange(event.target.value)}
                placeholder="Desen no/adı, top no, müşteri..."
                className={cn(
                  "w-full rounded-xl border border-black/5 bg-white px-10 py-2.5 text-sm text-neutral-900 shadow-[0_6px_14px_rgba(0,0,0,0.06)]",
                  "placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-coffee-primary"
                )}
                aria-label="Genel arama"
              />
            </label>
          </div>

          <div className="flex flex-wrap items-center gap-2 md:gap-3">
            <div className="flex items-center gap-2 rounded-xl border border-black/5 bg-white px-3 py-2 shadow-[0_4px_12px_rgba(0,0,0,0.05)]">
              <CalendarRange className="h-4 w-4 text-coffee-primary" aria-hidden />
              <input
                type="date"
                value={dateRange.from}
                onChange={(event) => handleDateChange("from", event.target.value)}
                className="w-[120px] rounded-lg border border-black/10 bg-white px-2 py-1 text-sm text-neutral-800 focus:border-coffee-primary focus:outline-none focus:ring-1 focus:ring-coffee-primary"
                aria-label="Başlangıç tarihi"
              />
              <span className="text-neutral-400">–</span>
              <input
                type="date"
                value={dateRange.to}
                onChange={(event) => handleDateChange("to", event.target.value)}
                className="w-[120px] rounded-lg border border-black/10 bg-white px-2 py-1 text-sm text-neutral-800 focus:border-coffee-primary focus:outline-none focus:ring-1 focus:ring-coffee-primary"
                aria-label="Bitiş tarihi"
              />
            </div>

            <KpiChips kpis={TOPBAR_KPIS} className="w-full min-w-0 md:w-auto" />
            <UserMenu />
          </div>
        </div>

        <div className="pb-2">
          <Breadcrumb pathname={pathname || "/"} labels={routeLabels} />
        </div>
      </div>
    </header>
  );
}
