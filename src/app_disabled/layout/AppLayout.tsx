import type { ReactNode } from "react";
import { useState } from "react";
import { TopBar } from "../../components/TopBar";
import { QuickFab } from "../../components/QuickFab";

type AppLayoutProps = {
  children: ReactNode;
  routeLabels: Record<string, string>;
};

type DateRange = {
  from: string;
  to: string;
};

export function AppLayout({ children, routeLabels }: AppLayoutProps) {
  const [searchValue, setSearchValue] = useState("");
  const [dateRange, setDateRange] = useState<DateRange>({ from: "", to: "" });

  return (
    <div className="min-h-screen bg-coffee-surface text-neutral-900">
      <TopBar
        routeLabels={routeLabels}
        searchValue={searchValue}
        onSearchChange={setSearchValue}
        dateRange={dateRange}
        onDateRangeChange={setDateRange}
      />
      <main className="mx-auto max-w-6xl px-6 py-6">{children}</main>
      <QuickFab />
    </div>
  );
}
