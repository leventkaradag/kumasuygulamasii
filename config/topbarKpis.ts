export type KpiKey = "stock_total" | "net_dispatch_month" | "today_in_out";

export type KpiIconName = "yarn" | "truck" | "repeat";

export type TopbarKpi = {
  key: KpiKey;
  label: string;
  value: string;
  helper?: string;
  icon: KpiIconName;
};

export const TOPBAR_KPIS: TopbarKpi[] = [
  { key: "stock_total", label: "Stok", value: "3.460 m", icon: "yarn" },
  {
    key: "net_dispatch_month",
    label: "Net Sevk (Ay)",
    value: "1.280 m",
    helper: "Sevk - İade",
    icon: "truck",
  },
  { key: "today_in_out", label: "Bugün", value: "+180 / -240 m", icon: "repeat" },
];
