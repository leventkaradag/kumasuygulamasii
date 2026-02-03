import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { cn } from "../lib/cn";

type BreadcrumbProps = {
  pathname: string;
  labels: Record<string, string>;
  className?: string;
};

type Crumb = { label: string; to: string };

const formatSegment = (segment: string) =>
  segment
    .replace(/-/g, " ")
    .replace(/\b\w/g, (char) => char.toLocaleUpperCase("tr-TR"));

const buildCrumbs = (pathname: string, labels: Record<string, string>): Crumb[] => {
  const root: Crumb = { label: labels["/"] ?? "Ana Sayfa", to: "/" };
  const segments = pathname.split("/").filter(Boolean);

  if (segments.length === 0) {
    return [root];
  }

  const crumbs: Crumb[] = [root];
  let currentPath = "";

  segments.forEach((segment) => {
    currentPath += `/${segment}`;
    const label = labels[currentPath] ?? formatSegment(segment);
    crumbs.push({ label, to: currentPath });
  });

  return crumbs;
};

export function Breadcrumb({ pathname, labels, className }: BreadcrumbProps) {
  const crumbs = buildCrumbs(pathname, labels);

  return (
    <nav
      aria-label="Yol haritası"
      className={cn("flex flex-wrap items-center gap-1 text-xs sm:text-sm text-neutral-600", className)}
    >
      {crumbs.map((crumb, index) => {
        const isLast = index === crumbs.length - 1;
        return (
          <div key={crumb.to} className="flex items-center gap-1 max-w-full">
            {isLast ? (
              <span className="max-w-[16ch] truncate font-semibold text-neutral-800 sm:max-w-none">
                {crumb.label}
              </span>
            ) : (
              <Link
                href={crumb.to}
                className="max-w-[14ch] truncate text-neutral-600 transition hover:text-neutral-900"
              >
                {crumb.label}
              </Link>
            )}
            {!isLast && <ChevronRight className="h-3.5 w-3.5 text-neutral-400" aria-hidden />}
          </div>
        );
      })}
    </nav>
  );
}
