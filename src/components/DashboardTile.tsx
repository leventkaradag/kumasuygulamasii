import type { ReactNode } from "react";
import Link from "next/link";
import { cn } from "../lib/cn";

type DashboardTileProps = {
  title: string;
  to?: string;
  icon?: ReactNode;
  disabled?: boolean;
  badge?: string;
  className?: string;
};

const baseTileClasses =
  "relative block rounded-[16px] bg-white p-5 shadow-[0_6px_12px_rgba(0,0,0,0.12)] transition";
const interactiveClasses =
  "hover:-translate-y-0.5 hover:shadow-[0_10px_16px_rgba(0,0,0,0.14)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-coffee-primary";
const disabledClasses = "cursor-not-allowed opacity-60 pointer-events-none";

const TileContent = ({ icon, title, badge }: { icon?: ReactNode; title: string; badge?: string }) => (
  <div className="flex h-[180px] flex-col items-center justify-center text-center">
    {badge ? (
      <span className="absolute right-4 top-4 rounded-full bg-coffee-surface px-3 py-1 text-xs font-semibold text-neutral-700 shadow">
        {badge}
      </span>
    ) : null}
    <div className="text-[48px] text-coffee-accent">{icon}</div>
    <div className="mt-[14px] text-lg font-semibold text-neutral-900">{title}</div>
  </div>
);

export function DashboardTile({ title, to = "#", icon, disabled, badge, className }: DashboardTileProps) {
  if (disabled) {
    return (
      <div className={cn(baseTileClasses, disabledClasses, className)} aria-disabled>
        <TileContent icon={icon} title={title} badge={badge} />
      </div>
    );
  }

  return (
    <Link href={to} className={cn(baseTileClasses, interactiveClasses, className)}>
      <TileContent icon={icon} title={title} badge={badge} />
    </Link>
  );
}
