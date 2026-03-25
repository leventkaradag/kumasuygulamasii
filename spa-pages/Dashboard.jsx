"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
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
import { buildPatternMetricMap } from "../lib/patternMetrics";
import { depoLocalRepo } from "../lib/repos/depoLocalRepo";
import { dyehouseLocalRepo } from "../lib/repos/dyehouseLocalRepo";
import { patternsLocalRepo } from "../lib/repos/patternsLocalRepo";
import { weavingLocalRepo } from "../lib/repos/weavingLocalRepo";

const stageLabel = {
  DEPO: "Depo",
  BOYAHANE: "Boyahane",
  DOKUMA: "Dokuma",
};

const dashboardPanelClass =
  "rounded-[26px] border border-[#e4d8cb] bg-[linear-gradient(180deg,rgba(255,251,246,0.96),rgba(248,241,233,0.94))] p-5 shadow-[0_18px_42px_rgba(63,48,38,0.08),inset_0_1px_0_rgba(255,255,255,0.78)]";

const isPatternDeleted = (pattern) => pattern?.__deleted === true;

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

const createDashboardSnapshot = () => ({
  patterns: patternsLocalRepo.list(),
  rolls: depoLocalRepo.listRolls(),
  jobs: dyehouseLocalRepo.listJobs(),
  dispatchDocuments: weavingLocalRepo.listDispatchDocuments(),
  progressEntries: weavingLocalRepo.listProgress(),
});

const emptyDashboardSnapshot = () => ({
  patterns: [],
  rolls: [],
  jobs: [],
  dispatchDocuments: [],
  progressEntries: [],
});

export default function Dashboard() {
  const { displayName, permissions } = useAuthProfile();
  const [snapshot, setSnapshot] = useState(emptyDashboardSnapshot);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    // Delay slightly to ensure paint happens first, unblocking the main thread
    const timer = setTimeout(() => {
      setSnapshot(createDashboardSnapshot());
      setIsLoaded(true);
    }, 0);

    const refresh = () => {
      setSnapshot(createDashboardSnapshot());
    };

    window.addEventListener("focus", refresh);
    window.addEventListener("storage", refresh);

    return () => {
      clearTimeout(timer);
      window.removeEventListener("focus", refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  const allPatterns = useMemo(
    () => snapshot.patterns.filter((pattern) => !isPatternDeleted(pattern)),
    [snapshot.patterns]
  );

  const activePatterns = useMemo(
    () => allPatterns.filter((pattern) => pattern.archived !== true),
    [allPatterns]
  );

  const patternMetricsMap = useMemo(
    () => buildPatternMetricMap(allPatterns),
    [allPatterns]
  );

  const openDyehouseJobs = useMemo(
    () =>
      snapshot.jobs.filter(
        (job) => job.status === "RECEIVED" || job.status === "IN_PROCESS"
      ),
    [snapshot.jobs]
  );

  const boyahaneFallbackCount = activePatterns.filter(
    (pattern) => pattern.currentStage === "BOYAHANE"
  ).length;

  const depotMeters = useMemo(
    () =>
      snapshot.rolls
        .filter(
          (roll) =>
            roll.status === "IN_STOCK" ||
            roll.status === "RESERVED" ||
            roll.status === "RETURNED"
        )
        .reduce((total, roll) => total + roll.meters, 0),
    [snapshot.rolls]
  );

  const todayNewPatterns = useMemo(
    () => allPatterns.filter((pattern) => isToday(pattern.createdAt)),
    [allPatterns]
  );

  const todayProgressMeters = useMemo(
    () =>
      snapshot.progressEntries
        .filter((entry) => isToday(entry.createdAt))
        .reduce((total, entry) => total + entry.meters, 0),
    [snapshot.progressEntries]
  );

  const todayDispatchDocuments = useMemo(
    () => snapshot.dispatchDocuments.filter((document) => isToday(document.createdAt)),
    [snapshot.dispatchDocuments]
  );

  const todayToDyehouse = useMemo(
    () =>
      snapshot.dispatchDocuments.filter(
        (document) =>
          isToday(document.createdAt) && document.destination === "BOYAHANE"
      ),
    [snapshot.dispatchDocuments]
  );

  const recentPatterns = useMemo(
    () =>
      [...allPatterns]
        .sort((a, b) => toTimestamp(b.createdAt) - toTimestamp(a.createdAt))
        .slice(0, 5),
    [allPatterns]
  );

  const missingImagePatterns = useMemo(
    () => activePatterns.filter((pattern) => !getPatternThumbnailSrc(pattern)),
    [activePatterns]
  );

  const defectPatterns = useMemo(
    () =>
      activePatterns.filter(
        (pattern) => (patternMetricsMap.get(pattern.id)?.defectMeters ?? 0) > 0
      ),
    [activePatterns, patternMetricsMap]
  );

  const missingMeterPatterns = useMemo(
    () =>
      activePatterns.filter((pattern) => {
        const metrics = patternMetricsMap.get(pattern.id);
        if (!metrics) return true;
        return (
          metrics.totalProducedMeters <= 0 &&
          metrics.stockMeters <= 0 &&
          metrics.inDyehouseMeters <= 0 &&
          metrics.defectMeters <= 0
        );
      }),
    [activePatterns, patternMetricsMap]
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
      value: fmtCount(allPatterns.length),
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
      value: fmtCount(openDyehouseJobs.length || boyahaneFallbackCount),
      hint: openDyehouseJobs.length > 0 ? "acik boyahane isi" : "boyahane asamasindaki desen",
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
          ? "Dokuma ilerleme kayitlarindan toplandi."
          : "Bugun dokuma ilerleme girisi gorunmuyor.",
      icon: Layers3,
    },
    {
      label: "Olusturulan belge",
      value: fmtCount(todayDispatchDocuments.length),
      detail:
        todayDispatchDocuments.length > 0
          ? "Sevk ve cikis belgeleri bugun olusturuldu."
          : "Bugune ait yeni belge kaydi yok.",
      icon: FileText,
    },
    {
      label: "Boyahaneye gecen is",
      value: fmtCount(todayToDyehouse.length),
      detail:
        todayToDyehouse.length > 0
          ? "Boyahane hedefli sevk hareketleri algilandi."
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
          ? "Hatali metre ureten kayitlar ayristirilmali."
          : "Hatali metre sinyali veren kayit yok.",
      icon: TriangleAlert,
      tone: defectPatterns.length > 0 ? "danger" : "calm",
    },
    {
      label: "Aktif ama metre bilgisi eksik",
      value: fmtCount(missingMeterPatterns.length),
      detail:
        missingMeterPatterns.length > 0
          ? "Metrik akisi olmayan desenler gozden gecirilmeli."
          : "Aktif desenlerin metre bilgisi dolu gorunuyor.",
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
            {kpis.map((item) => (
              <KpiCard key={item.label} {...item} />
            ))}
          </div>

          <div className="grid gap-4 xl:grid-cols-[1.2fr,0.8fr]">
            <section className={dashboardPanelClass}>
              <SectionHeading
                eyebrow="Gunluk akis"
                title="Bugunku Hareketler"
                description={`${displayName} icin gunun operasyon ozeti.`}
              />
              <div className="mt-4 space-y-3">
                {movementRows.map((row) => (
                  <MovementRow key={row.label} {...row} />
                ))}
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
                {recentPatterns.length > 0 ? (
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
                {attentionRows.map((row) => (
                  <AttentionRow key={row.label} {...row} />
                ))}
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

function EmptyState({ title, description }) {
  return (
    <div className="rounded-2xl border border-dashed border-[#d8c9bb] bg-white/65 px-4 py-6 text-center">
      <div className="text-sm font-semibold text-[#2f241d]">{title}</div>
      <p className="mt-2 text-xs leading-5 text-[#7f6c5d]">{description}</p>
    </div>
  );
}
