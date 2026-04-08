"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  Boxes,
  ClipboardList,
  Factory,
  FileText,
  ImageOff,
  Layers3,
  Package,
  Plus,
  Sparkles,
  TriangleAlert,
  Warehouse,
} from "lucide-react";
import Layout from "../components/Layout";
import { useAuthProfile } from "../components/AuthProfileProvider";
import { cn } from "../lib/cn";
import { getPatternThumbnailSrc } from "../lib/patternImage";
import { getWarehouseMetersTotalFromSupabase } from "../lib/repos/depoSupabaseRepo";
import { depoTransactionsSupabaseRepo } from "../lib/repos/depoTransactionsSupabaseRepo";
import { patternsSupabaseRepo } from "../lib/repos/patternsSupabaseRepo";
import { weavingSupabaseRepo } from "../lib/repos/weavingSupabaseRepo";

const stageLabel = {
  DEPO: "Depo",
  BOYAHANE: "Boyahane",
  DOKUMA: "Dokuma",
};

const dashboardPanelClass =
  "rounded-[26px] border border-[#e4d8cb] bg-[linear-gradient(180deg,rgba(255,251,246,0.96),rgba(248,241,233,0.94))] p-5 shadow-[0_18px_42px_rgba(63,48,38,0.08),inset_0_1px_0_rgba(255,255,255,0.78)]";
const DASHBOARD_REFRESH_INTERVAL_MS = 60_000;

const isToday = (value) => {
  if (!value) return false;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return false;

  const today = new Date();
  return (
    parsed.getFullYear() === today.getFullYear() &&
    parsed.getMonth() === today.getMonth() &&
    parsed.getDate() === today.getDate()
  );
};

const toTimestamp = (value) => {
  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
};

const fmtCount = (value) => Number(value || 0).toLocaleString("tr-TR");
const fmtMeters = (value) => `${Number(value || 0).toLocaleString("tr-TR")} m`;

const formatDateLabel = (value) => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";
  return parsed.toLocaleDateString("tr-TR", {
    day: "2-digit",
    month: "short",
  });
};

const getPatternLabel = (pattern) => `${pattern.fabricCode} - ${pattern.fabricName}`;

const summarizePatterns = (patterns) => {
  if (!patterns.length) return "Kayit yok";
  return patterns
    .slice(0, 2)
    .map((pattern) => pattern.fabricCode)
    .join(" · ");
};

const hasOperationalMeters = (pattern) =>
  (pattern.totalProducedMeters ?? 0) > 0 ||
  (pattern.stockMeters ?? 0) > 0 ||
  (pattern.inDyehouseMeters ?? 0) > 0 ||
  (pattern.defectMeters ?? 0) > 0;

const isOperationallyActivePattern = (pattern) =>
  pattern.archived !== true &&
  (pattern.currentStage !== "DEPO" || hasOperationalMeters(pattern));

const getTodayRange = () => {
  const start = new Date();
  start.setHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setHours(23, 59, 59, 999);

  return {
    from: start.toISOString(),
    to: end.toISOString(),
  };
};

const createDashboardSnapshot = async () => {
  const { from, to } = getTodayRange();
  const [patterns, depotMeters, transactions, progressEntries, dispatchDocuments] = await Promise.all([
    patternsSupabaseRepo.list(),
    getWarehouseMetersTotalFromSupabase(),
    depoTransactionsSupabaseRepo.listAllTransactions({ from, to }),
    weavingSupabaseRepo.listProgressInRange({ from, to }),
    weavingSupabaseRepo.listDispatchDocumentsInRange({ from, to }),
  ]);

  const visibleDepoDocumentTypes = new Set([
    "SHIPMENT",
    "RESERVATION",
    "RETURN",
    "REVERSAL",
    "ADJUSTMENT",
  ]);

  return {
    patterns,
    depotMeters,
    todayTransactionCount: transactions.filter((transaction) => visibleDepoDocumentTypes.has(transaction.type))
      .length,
    todayProgressMeters: progressEntries.reduce((total, entry) => total + entry.meters, 0),
    todayDispatchDocumentCount:
      transactions.filter((transaction) => visibleDepoDocumentTypes.has(transaction.type)).length +
      dispatchDocuments.length,
    todayToDyehouseCount: dispatchDocuments.filter(
      (document) => document.destination === "BOYAHANE"
    ).length,
  };
};

const emptyDashboardSnapshot = () => ({
  patterns: [],
  depotMeters: 0,
  todayTransactionCount: 0,
  todayProgressMeters: 0,
  todayDispatchDocumentCount: 0,
  todayToDyehouseCount: 0,
});

export default function Dashboard() {
  const { displayName, permissions } = useAuthProfile();
  const [snapshot, setSnapshot] = useState(null);
  const [isLoadingDashboard, setIsLoadingDashboard] = useState(true);
  const lastLoadedAtRef = useRef(0);
  const hasSnapshotRef = useRef(false);
  const [loadError, setLoadError] = useState("");
  const resolvedSnapshot = snapshot ?? emptyDashboardSnapshot();

  useEffect(() => {
    let isMounted = true;

    const load = async (background = false) => {
      if (!background && !hasSnapshotRef.current) {
        setIsLoadingDashboard(true);
      }

      try {
        const nextSnapshot = await createDashboardSnapshot();
        if (!isMounted) return;
        setSnapshot(nextSnapshot);
        hasSnapshotRef.current = true;
        setLoadError("");
        lastLoadedAtRef.current = Date.now();
      } catch (error) {
        if (!isMounted) return;
        setLoadError(
          error instanceof Error ? error.message : "Kontrol paneli verileri yuklenemedi."
        );
      } finally {
        if (isMounted) {
          setIsLoadingDashboard(false);
        }
      }
    };

    load(false);

    const refresh = () => {
      if (Date.now() - lastLoadedAtRef.current < DASHBOARD_REFRESH_INTERVAL_MS) return;
      load(true);
    };

    window.addEventListener("focus", refresh);

    return () => {
      isMounted = false;
      window.removeEventListener("focus", refresh);
    };
  }, []);

  const allPatterns = useMemo(
    () => resolvedSnapshot.patterns,
    [resolvedSnapshot.patterns]
  );

  const visiblePatterns = useMemo(
    () => allPatterns.filter((pattern) => pattern.archived !== true),
    [allPatterns]
  );

  const activePatterns = useMemo(
    () => visiblePatterns.filter((pattern) => isOperationallyActivePattern(pattern)),
    [visiblePatterns]
  );

  const boyahanePatternCount = visiblePatterns.filter(
    (pattern) => pattern.currentStage === "BOYAHANE"
  ).length;

  const depotMeters = resolvedSnapshot.depotMeters;

  const todayNewPatterns = useMemo(
    () => visiblePatterns.filter((pattern) => isToday(pattern.createdAt)),
    [visiblePatterns]
  );

  const todayProgressMeters = resolvedSnapshot.todayProgressMeters;
  const todayDispatchDocuments = resolvedSnapshot.todayDispatchDocumentCount;
  const todayToDyehouseCount = resolvedSnapshot.todayToDyehouseCount;
  const showInitialLoading = isLoadingDashboard && snapshot === null;

  const recentPatterns = useMemo(
    () =>
      [...visiblePatterns]
        .sort((a, b) => toTimestamp(b.createdAt) - toTimestamp(a.createdAt))
        .slice(0, 5),
    [visiblePatterns]
  );

  const missingImagePatterns = useMemo(
    () => activePatterns.filter((pattern) => !getPatternThumbnailSrc(pattern)),
    [activePatterns]
  );

  const defectPatterns = useMemo(
    () =>
      activePatterns.filter(
        (pattern) => (pattern.defectMeters ?? 0) > 0
      ),
    [activePatterns]
  );

  const missingMeterPatterns = useMemo(
    () =>
      activePatterns.filter((pattern) => {
        return (
          (pattern.totalProducedMeters ?? 0) <= 0 &&
          (pattern.stockMeters ?? 0) <= 0 &&
          (pattern.inDyehouseMeters ?? 0) <= 0 &&
          (pattern.defectMeters ?? 0) <= 0
        );
      }),
    [activePatterns]
  );

  const reviewPendingPatterns = useMemo(
    () =>
      activePatterns.filter((pattern) => {
        const hasNote = Boolean(pattern.note?.trim());
        const hasVariants = Array.isArray(pattern.variants) && pattern.variants.length > 0;
        return !hasNote || !hasVariants;
      }),
    [activePatterns]
  );

  const kpis = [
    {
      label: "Toplam Desen",
      value: fmtCount(visiblePatterns.length),
      hint: "arsiv haric tum kayitlar",
      icon: Boxes,
    },
    {
      label: "Aktif Desen",
      value: fmtCount(activePatterns.length),
      hint: "operasyonda acik kalanlar",
      icon: Sparkles,
    },
    {
      label: "Boyahanede",
      value: fmtCount(boyahanePatternCount),
      hint: "canli current_stage = BOYAHANE desenleri",
      icon: Factory,
    },
    {
      label: "Depodaki Metre",
      value: fmtMeters(depotMeters),
      hint: "stok + rezerve + iade",
      icon: Warehouse,
    },
  ];

  const movementRows = [
    {
      label: "Bugun eklenen desen",
      value: fmtCount(todayNewPatterns.length),
      detail:
        todayNewPatterns.length > 0
          ? `${summarizePatterns(todayNewPatterns)} eklendi`
          : "Bugun yeni desen kaydi acilmadi.",
      icon: Plus,
    },
    {
      label: "Guncellenen metre",
      value: fmtMeters(todayProgressMeters),
      detail:
        todayProgressMeters > 0
          ? "Canli dokuma ilerleme kayitlarindan toplandi."
          : "Bugun canli dokuma ilerleme girisi gorunmuyor.",
      icon: Layers3,
    },
    {
      label: "Olusturulan belge",
      value: fmtCount(todayDispatchDocuments),
      detail:
        todayDispatchDocuments > 0
          ? "Depo islem belgeleri ve dokuma sevk belgeleri bugun olusturuldu."
          : "Bugune ait yeni belge kaydi yok.",
      icon: FileText,
    },
    {
      label: "Boyahaneye gecen is",
      value: fmtCount(todayToDyehouseCount),
      detail:
        todayToDyehouseCount > 0
          ? "Canli boyahane hedefli sevk belgeleri algilandi."
          : "Bugun boyahaneye yeni cikis gorunmuyor.",
      icon: Factory,
    },
  ];

  const quickActions = [
    {
      label: "Yeni Desen Ekle",
      href: "/desenler",
      description: "Desen kaydi ve gorsel akisini ac.",
      icon: Plus,
      enabled: permissions.patterns.create,
    },
    {
      label: "Dokuma Ekranina Git",
      href: "/dokuma",
      description: "Plan, ilerleme ve sevk adimlarini yonet.",
      icon: Layers3,
      enabled: permissions.modules.dokuma,
    },
    {
      label: "Boyahane Ekranina Git",
      href: "/boyahane",
      description: "Gelen sevkleri ve is emirlerini takip et.",
      icon: Factory,
      enabled: permissions.modules.boyahane,
    },
    {
      label: "Sevk/Rezerv Belgelerine Git",
      href: "/sevk-rezerv",
      description: "Belgeleri, reverseleri ve ciktilari ac.",
      icon: ClipboardList,
      enabled: permissions.modules["sevk-rezerv"],
    },
  ];

  const attentionRows = [
    {
      label: "Gorseli eksik desenler",
      value: fmtCount(missingImagePatterns.length),
      detail:
        missingImagePatterns.length > 0
          ? `${summarizePatterns(missingImagePatterns)} icin gorsel bekleniyor.`
          : "Aktif desenlerde gorsel eksigi gorunmuyor.",
      icon: ImageOff,
      tone: "warning",
    },
    {
      label: "Hatali metriği olanlar",
      value: fmtCount(defectPatterns.length),
      detail:
        defectPatterns.length > 0
          ? "Canli pattern defect_meters alaninda sinyal veren kayitlar gozden gecirilmeli."
          : "Hatali metre sinyali veren kayit yok.",
      icon: TriangleAlert,
      tone: defectPatterns.length > 0 ? "danger" : "calm",
    },
    {
      label: "Aktif ama metre bilgisi eksik",
      value: fmtCount(missingMeterPatterns.length),
      detail:
        missingMeterPatterns.length > 0
          ? "Canli pattern metre alanlari bos kalan aktif desenler gozden gecirilmeli."
          : "Aktif desenlerin canli metre alanlari dolu gorunuyor.",
      icon: Package,
      tone: "warning",
    },
    {
      label: "Kontrol bekleyen kayitlar",
      value: fmtCount(reviewPendingPatterns.length),
      detail:
        reviewPendingPatterns.length > 0
          ? "Varyant veya not eksigi olan kayitlar sirada."
          : "Ek kontrol isteyen ek kayit bulunmuyor.",
      icon: Sparkles,
      tone: "calm",
    },
  ];

  return (
    <Layout
      title="Kontrol Paneli"
      description="Dokuma, boyahane, depo ve sevk sureclerini tek merkezden izleyin."
    >
      <div className="h-full overflow-auto pr-1">
        <div className="space-y-5">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {showInitialLoading
              ? Array.from({ length: 4 }, (_, index) => <KpiCardSkeleton key={index} />)
              : kpis.map((item) => <KpiCard key={item.label} {...item} />)}
          </div>

          {loadError ? (
            <section className={dashboardPanelClass}>
              <EmptyState
                title="Canli veriler yuklenemedi"
                description={loadError}
              />
            </section>
          ) : null}

          <div className="grid gap-4 xl:grid-cols-[1.2fr,0.8fr]">
            <section className={dashboardPanelClass}>
              <SectionHeading
                eyebrow="Gunluk akis"
                title="Bugunku Hareketler"
                description={`${displayName} icin gunun operasyon ozeti.`}
              />
              <div className="mt-4 space-y-3">
                {showInitialLoading
                  ? Array.from({ length: 4 }, (_, index) => <MovementRowSkeleton key={index} />)
                  : movementRows.map((row) => <MovementRow key={row.label} {...row} />)}
              </div>
            </section>

            <section className={dashboardPanelClass}>
              <SectionHeading
                eyebrow="Yonlendirme"
                title="Hizli Islemler"
                description="En sik kullanilan operasyon kapilarina dogrudan gecin."
              />
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {quickActions.map((action) => (
                  <QuickActionCard key={action.label} {...action} />
                ))}
              </div>
            </section>
          </div>

          <div className="grid gap-4 xl:grid-cols-[1.05fr,0.95fr]">
            <section className={dashboardPanelClass}>
              <SectionHeading
                eyebrow="Son kayitlar"
                title="Son Eklenen Desenler"
                description="Olusan en yeni desenleri kisa bir satirda izleyin."
              />
              <div className="mt-4 space-y-3">
                {showInitialLoading ? (
                  Array.from({ length: 5 }, (_, index) => <MovementRowSkeleton key={index} />)
                ) : recentPatterns.length > 0 ? (
                  recentPatterns.map((pattern) => (
                    <RecentPatternRow key={pattern.id} pattern={pattern} />
                  ))
                ) : (
                  <EmptyState
                    title="Henuz desen kaydi yok"
                    description="Yeni desenler eklendikce burada son hareket listesi dolacak."
                  />
                )}
              </div>
            </section>

            <section className={dashboardPanelClass}>
              <SectionHeading
                eyebrow="Operasyon takibi"
                title="Dikkat Gerektirenler"
                description="Eksik veri ve kontrol isteyen kayitlari tek bakista ayiklayin."
              />
              <div className="mt-4 space-y-3">
                {showInitialLoading
                  ? Array.from({ length: 4 }, (_, index) => <AttentionRowSkeleton key={index} />)
                  : attentionRows.map((row) => <AttentionRow key={row.label} {...row} />)}
              </div>
            </section>
          </div>
        </div>
      </div>
    </Layout>
  );
}

function KpiCard({ label, value, hint, icon: Icon }) {
  return (
    <div className="rounded-[24px] border border-[#e2d7cb] bg-[linear-gradient(180deg,rgba(255,252,248,0.98),rgba(247,239,231,0.96))] p-4 shadow-[0_16px_36px_rgba(63,48,38,0.08),inset_0_1px_0_rgba(255,255,255,0.8)]">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-2">
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#7b6758]">
            {label}
          </div>
          <div className="text-[28px] font-semibold tracking-[-0.02em] text-[#2f241d]">
            {value}
          </div>
          <div className="text-xs text-[#8b7564]">{hint}</div>
        </div>
        <span className="flex h-11 w-11 items-center justify-center rounded-2xl border border-[#e0d1c4] bg-white/80 text-[#6f594a] shadow-[0_8px_16px_rgba(63,48,38,0.08)]">
          <Icon className="h-5 w-5" />
        </span>
      </div>
    </div>
  );
}

function KpiCardSkeleton() {
  return (
    <div className="rounded-[24px] border border-[#e2d7cb] bg-[linear-gradient(180deg,rgba(255,252,248,0.98),rgba(247,239,231,0.96))] p-4 shadow-[0_16px_36px_rgba(63,48,38,0.08),inset_0_1px_0_rgba(255,255,255,0.8)]">
      <div className="flex items-start justify-between gap-3">
        <div className="w-full space-y-3">
          <div className="h-3 w-24 animate-pulse rounded-full bg-[#e6d8ca]" />
          <div className="h-8 w-32 animate-pulse rounded-full bg-[#ddcfc1]" />
          <div className="h-3 w-28 animate-pulse rounded-full bg-[#efe4d9]" />
        </div>
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-[#e0d1c4] bg-white/80 shadow-[0_8px_16px_rgba(63,48,38,0.08)]">
          <div className="h-5 w-5 animate-pulse rounded-full bg-[#dccbbb]" />
        </span>
      </div>
    </div>
  );
}

function SectionHeading({ eyebrow, title, description }) {
  return (
    <div className="space-y-1">
      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#7b6758]">
        {eyebrow}
      </div>
      <div className="text-xl font-semibold tracking-[-0.01em] text-[#2f241d]">{title}</div>
      <p className="text-sm text-[#746252]">{description}</p>
    </div>
  );
}

function MovementRow({ label, value, detail, icon: Icon }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-[#e3d7cb] bg-white/72 px-3.5 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.78)]">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#f4ebe2] text-[#6c5748]">
        <Icon className="h-4.5 w-4.5" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold text-[#2f241d]">{label}</div>
        <div className="truncate text-xs text-[#7f6c5d]">{detail}</div>
      </div>
      <div className="shrink-0 text-right">
        <div className="text-base font-semibold text-[#2f241d]">{value}</div>
      </div>
    </div>
  );
}

function MovementRowSkeleton() {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-[#e3d7cb] bg-white/72 px-3.5 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.78)]">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#f4ebe2]">
        <div className="h-4 w-4 animate-pulse rounded-full bg-[#d9c6b5]" />
      </span>
      <div className="min-w-0 flex-1 space-y-2">
        <div className="h-3 w-32 animate-pulse rounded-full bg-[#dfd1c2]" />
        <div className="h-3 w-40 animate-pulse rounded-full bg-[#efe5dc]" />
      </div>
      <div className="h-4 w-14 animate-pulse rounded-full bg-[#ddcfc1]" />
    </div>
  );
}

function QuickActionCard({ label, href, description, icon: Icon, enabled }) {
  const content = (
    <div
      className={cn(
        "group rounded-2xl border border-[#dfd1c4] bg-white/78 p-4 shadow-[0_12px_24px_rgba(63,48,38,0.06),inset_0_1px_0_rgba(255,255,255,0.78)] transition",
        enabled
          ? "hover:-translate-y-0.5 hover:border-[#c9ae96] hover:bg-white"
          : "cursor-not-allowed opacity-60"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#f4ebe2] text-[#6c5748]">
          <Icon className="h-4.5 w-4.5" />
        </span>
        <ArrowRight className="h-4 w-4 text-[#a18b7b] transition group-hover:translate-x-0.5" />
      </div>
      <div className="mt-4 text-sm font-semibold text-[#2f241d]">{label}</div>
      <p className="mt-1 text-xs leading-5 text-[#7f6c5d]">{description}</p>
    </div>
  );

  if (!enabled) {
    return <div aria-disabled>{content}</div>;
  }

  return <Link href={href}>{content}</Link>;
}

function RecentPatternRow({ pattern }) {
  const thumb = getPatternThumbnailSrc(pattern);

  return (
    <div className="flex items-center gap-3 rounded-2xl border border-[#e3d7cb] bg-white/72 px-3.5 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.78)]">
      <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-[#d8c8ba] bg-[#f4ebe2]">
        {thumb ? (
          <img
            src={thumb}
            alt={pattern.fabricName}
            className="h-12 w-12 object-cover"
            loading="lazy"
          />
        ) : (
          <Package className="h-4 w-4 text-[#7a6656]" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold text-[#2f241d]">
          {getPatternLabel(pattern)}
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-[#7f6c5d]">
          <span className="rounded-full border border-[#e2d6ca] bg-[#fbf6f0] px-2 py-0.5 font-semibold text-[#6d5b4f]">
            {stageLabel[pattern.currentStage] ?? pattern.currentStage}
          </span>
          <span>{formatDateLabel(pattern.createdAt)}</span>
        </div>
      </div>
    </div>
  );
}

function AttentionRow({ label, value, detail, icon: Icon, tone }) {
  return (
    <div
      className={cn(
        "rounded-2xl border px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.76)]",
        tone === "danger"
          ? "border-red-200 bg-red-50/80"
          : tone === "warning"
            ? "border-amber-200 bg-amber-50/80"
            : "border-[#e3d7cb] bg-white/72"
      )}
    >
      <div className="flex items-start gap-3">
        <span
          className={cn(
            "mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl",
            tone === "danger"
              ? "bg-red-100 text-red-700"
              : tone === "warning"
                ? "bg-amber-100 text-amber-700"
                : "bg-[#f4ebe2] text-[#6c5748]"
          )}
        >
          <Icon className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm font-semibold text-[#2f241d]">{label}</div>
            <div className="shrink-0 text-sm font-semibold text-[#2f241d]">{value}</div>
          </div>
          <div className="mt-1 text-xs leading-5 text-[#7f6c5d]">{detail}</div>
        </div>
      </div>
    </div>
  );
}

function AttentionRowSkeleton() {
  return (
    <div className="rounded-2xl border border-[#e3d7cb] bg-white/72 px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.76)]">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-[#f4ebe2]">
          <div className="h-4 w-4 animate-pulse rounded-full bg-[#d9c6b5]" />
        </span>
        <div className="min-w-0 flex-1 space-y-2">
          <div className="h-3 w-36 animate-pulse rounded-full bg-[#dfd1c2]" />
          <div className="h-3 w-28 animate-pulse rounded-full bg-[#ddcfc1]" />
          <div className="h-3 w-48 animate-pulse rounded-full bg-[#efe5dc]" />
        </div>
      </div>
    </div>
  );
}

function EmptyState({ title, description }) {
  return (
    <div className="rounded-2xl border border-dashed border-[#d8c9bb] bg-white/65 px-4 py-6 text-center">
      <div className="text-sm font-semibold text-[#2f241d]">{title}</div>
      <p className="mt-2 text-xs leading-5 text-[#7f6c5d]">{description}</p>
    </div>
  );
}
