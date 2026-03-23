"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";

import { useAuthProfile } from "@/components/AuthProfileProvider";
import Layout from "../components/Layout";
import { cn } from "@/lib/cn";
import {
  calculateJobTotals,
  calculateLineWasteKg,
  type Dyehouse,
  type DyehouseJob,
  type DyehouseJobStatus,
  type DyehouseLine,
  type DyehouseProgressEntry,
} from "@/lib/domain/dyehouse";
import type { WeavingDispatchDocument } from "@/lib/domain/weaving";
import { dyehouseLocalRepo } from "@/lib/repos/dyehouseLocalRepo";
import { weavingLocalRepo } from "@/lib/repos/weavingLocalRepo";
import { useModalFocusTrap } from "@/lib/useModalFocusTrap";
import {
  WORKFLOW_PROGRESS_EPSILON,
  calculateProgressTotalMeters,
  nowDateTimeLocal,
  toIsoFromDateTimeLocal,
  toPositiveIntInput,
  toPositiveNumberInput,
} from "@/lib/workflowProgress";

type ViewMode = "MIX" | "BY_DYEHOUSE";
type JobTab = "RECEIVED" | "IN_PROCESS" | "FINISHED";

type LineDraft = {
  id: string;
  colorName: string;
  variantCode: string;
  incomingQuantityMeters: string;
  incomingQuantityKg: string;
  rawKg: string;
  cleanKg: string;
  notes: string;
};

type JobProgressTotals = {
  targetMeters: number;
  processedMeters: number;
  remainingMeters: number;
  remainingInputMeters: number;
};

const JOB_TABS: JobTab[] = ["RECEIVED", "IN_PROCESS", "FINISHED"];

const statusLabelMap: Record<DyehouseJobStatus, string> = {
  RECEIVED: "Alindi",
  IN_PROCESS: "Islemde",
  FINISHED: "Bitti",
  CANCELLED: "Iptal",
};

const statusClassMap: Record<DyehouseJobStatus, string> = {
  RECEIVED: "border-amber-500/30 bg-amber-50 text-amber-700",
  IN_PROCESS: "border-sky-500/30 bg-sky-50 text-sky-700",
  FINISHED: "border-emerald-500/30 bg-emerald-50 text-emerald-700",
  CANCELLED: "border-rose-500/30 bg-rose-50 text-rose-700",
};

const fmt = (n: number) => n.toLocaleString("tr-TR", { maximumFractionDigits: 2 });

const formatDateTime = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("tr-TR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const normalizeSearchToken = (value: string) =>
  value.trim().toLocaleLowerCase("tr-TR").replace(/\s+/g, " ");

const toTimestamp = (value: string) => {
  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
};

const sumMeters = (lines: DyehouseLine[]) =>
  lines.reduce((sum, line) => sum + line.metersPlanned, 0);

const parseDraftKg = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const parsed = Number(trimmed.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : undefined;
};

const computeWasteKg = (inputKg: string, outputKg: string) => {
  const parsedInput = parseDraftKg(inputKg);
  const parsedOutput = parseDraftKg(outputKg);
  if (parsedInput === undefined || parsedOutput === undefined) return undefined;
  return parsedInput - parsedOutput;
};

const createLineDraft = (line?: DyehouseLine): LineDraft => ({
  id: line?.id ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`,
  colorName: line?.color ?? line?.colorName ?? "",
  variantCode: line?.variantCode ?? line?.variantName ?? "",
  incomingQuantityMeters:
    typeof line?.incomingQuantityMeters === "number" && Number.isFinite(line.incomingQuantityMeters)
      ? String(line.incomingQuantityMeters)
      : typeof line?.metersPlanned === "number" && Number.isFinite(line.metersPlanned)
      ? String(line.metersPlanned)
      : "",
  incomingQuantityKg:
    typeof line?.incomingQuantityKg === "number" && Number.isFinite(line.incomingQuantityKg)
      ? String(line.incomingQuantityKg)
      : "",
  rawKg:
    typeof line?.rawKg === "number" && Number.isFinite(line.rawKg)
      ? String(line.rawKg)
      : typeof line?.inputKg === "number" && Number.isFinite(line.inputKg)
      ? String(line.inputKg)
      : "",
  cleanKg:
    typeof line?.cleanKg === "number" && Number.isFinite(line.cleanKg)
      ? String(line.cleanKg)
      : typeof line?.outputKg === "number" && Number.isFinite(line.outputKg)
      ? String(line.outputKg)
      : "",
  notes: line?.note ?? line?.notes ?? "",
});

const getJobTargetMeters = (job: DyehouseJob) => {
  const totals = calculateJobTotals(job);
  return totals.totalIncomingMeters > 0 ? totals.totalIncomingMeters : job.inputMetersTotal;
};

const buildJobProgressTotals = (
  job: DyehouseJob,
  progressEntries: DyehouseProgressEntry[]
): JobProgressTotals => {
  const processedMeters = progressEntries.reduce((sum, entry) => sum + (entry.quantityMeters ?? entry.meters), 0);
  const targetMeters = getJobTargetMeters(job);
  return {
    targetMeters,
    processedMeters,
    remainingMeters: targetMeters - processedMeters,
    remainingInputMeters: job.inputMetersTotal - processedMeters,
  };
};

const formatRemainingMeters = (meters: number) =>
  meters >= 0 ? `${fmt(meters)} m` : `Asim +${fmt(Math.abs(meters))} m`;

const getProgressAmountText = (
  entry: Pick<DyehouseProgressEntry, "meters" | "quantityMeters" | "quantityKg" | "color" | "processType">
) => {
  const m = entry.quantityMeters ?? entry.meters;
  const parts = [];
  if (entry.processType) parts.push(entry.processType);
  if (entry.color) parts.push(entry.color);
  if (entry.quantityKg) parts.push(`${fmt(entry.quantityKg)} kg`);
  parts.push(`${fmt(m)} m`);
  return parts.join(" - ");
};

function StatusBadge({ status }: { status: DyehouseJobStatus }) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold",
        statusClassMap[status]
      )}
    >
      {statusLabelMap[status]}
    </span>
  );
}

type MetricCardProps = {
  title: string;
  value: string;
  tone?: "neutral" | "danger";
};

function MetricCard({ title, value, tone = "neutral" }: MetricCardProps) {
  return (
    <div
      className={cn(
        "rounded-lg border px-3 py-3",
        tone === "danger" ? "border-rose-500/20 bg-rose-50" : "border-black/10 bg-neutral-50"
      )}
    >
      <div className="text-xs font-semibold uppercase tracking-wide text-neutral-500">{title}</div>
      <div
        className={cn(
          "mt-1 text-lg font-semibold",
          tone === "danger" ? "text-rose-700" : "text-neutral-900"
        )}
      >
        {value}
      </div>
    </div>
  );
}

export default function Boyahane() {
  const { permissions } = useAuthProfile();
  const [dyehouses, setDyehouses] = useState<Dyehouse[]>(() => dyehouseLocalRepo.list());
  const [jobs, setJobs] = useState<DyehouseJob[]>(() => dyehouseLocalRepo.listJobs());
  const [progressEntries, setProgressEntries] = useState<DyehouseProgressEntry[]>(() =>
    dyehouseLocalRepo.listProgress()
  );
  const [dispatchDocuments, setDispatchDocuments] = useState<WeavingDispatchDocument[]>(() =>
    weavingLocalRepo.listDispatchDocuments()
  );
  const [viewMode, setViewMode] = useState<ViewMode>("MIX");
  const [dyehouseFilter, setDyehouseFilter] = useState("ALL");
  const [query, setQuery] = useState("");
  const [jobTab, setJobTab] = useState<JobTab>("RECEIVED");
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState("");
  const canCreateJobs = permissions.dyehouse.create;

  const refreshProgress = () => {
    setProgressEntries(dyehouseLocalRepo.listProgress());
  };

  const refreshData = () => {
    setDyehouses(dyehouseLocalRepo.list());
    setJobs(dyehouseLocalRepo.listJobs());
    refreshProgress();
    setDispatchDocuments(weavingLocalRepo.listDispatchDocuments());
  };

  const effectiveDyehouseFilter = useMemo(() => {
    if (dyehouses.length === 0) return "ALL";
    if (viewMode === "MIX") {
      if (dyehouseFilter === "ALL") return "ALL";
      return dyehouses.some((dyehouse) => dyehouse.id === dyehouseFilter)
        ? dyehouseFilter
        : "ALL";
    }
    if (dyehouses.some((dyehouse) => dyehouse.id === dyehouseFilter)) {
      return dyehouseFilter;
    }
    return dyehouses[0].id;
  }, [dyehouseFilter, dyehouses, viewMode]);

  const selectedJob = useMemo(
    () => (selectedJobId ? jobs.find((job) => job.id === selectedJobId) ?? null : null),
    [jobs, selectedJobId]
  );

  const selectedSourceDispatch = useMemo(() => {
    if (!selectedJob) return null;
    return dispatchDocuments.find((document) => document.id === selectedJob.sourceDispatchDocId) ?? null;
  }, [dispatchDocuments, selectedJob]);

  const jobsByDispatchDocId = useMemo(
    () => new Map(jobs.map((job) => [job.sourceDispatchDocId, job] as const)),
    [jobs]
  );

  const incomingDispatchDocs = useMemo(
    () =>
      dispatchDocuments.filter(
        (document) => document.destination === "BOYAHANE" && document.type === "SEVK"
      ),
    [dispatchDocuments]
  );

  const normalizedQuery = normalizeSearchToken(query);

  const inScope = useCallback(
    (dyehouseId?: string | null) => {
      if (viewMode === "MIX") {
        if (effectiveDyehouseFilter === "ALL") return true;
        return dyehouseId === effectiveDyehouseFilter;
      }
      if (dyehouses.length === 0) return true;
      return dyehouseId === effectiveDyehouseFilter;
    },
    [dyehouses.length, effectiveDyehouseFilter, viewMode]
  );

  const filteredIncomingDocs = useMemo(
    () =>
      [...incomingDispatchDocs]
        .filter((document) => {
          const linkedJob = jobsByDispatchDocId.get(document.id);
          const targetDyehouseId = linkedJob?.dyehouseId ?? document.dyehouseId ?? null;
          if (!inScope(targetDyehouseId)) return false;

          if (!normalizedQuery) return true;
          const code = normalizeSearchToken(document.patternNoSnapshot);
          const name = normalizeSearchToken(document.patternNameSnapshot);
          return code.includes(normalizedQuery) || name.includes(normalizedQuery);
        })
        .sort((a, b) => toTimestamp(b.createdAt) - toTimestamp(a.createdAt)),
    [incomingDispatchDocs, jobsByDispatchDocId, normalizedQuery, inScope]
  );

  const filteredJobs = useMemo(
    () =>
      [...jobs]
        .filter((job) => job.status === jobTab)
        .filter((job) => inScope(job.dyehouseId))
        .filter((job) => {
          if (!normalizedQuery) return true;
          const code = normalizeSearchToken(job.patternCodeSnapshot);
          const name = normalizeSearchToken(job.patternNameSnapshot);
          return code.includes(normalizedQuery) || name.includes(normalizedQuery);
        })
        .sort((a, b) => toTimestamp(b.receivedAt) - toTimestamp(a.receivedAt)),
    [jobs, jobTab, normalizedQuery, inScope]
  );

  const jobsForSummary = useMemo(
    () =>
      [...jobs]
        .filter((job) => inScope(job.dyehouseId))
        .filter((job) => {
          if (!normalizedQuery) return true;
          const code = normalizeSearchToken(job.patternCodeSnapshot);
          const name = normalizeSearchToken(job.patternNameSnapshot);
          return code.includes(normalizedQuery) || name.includes(normalizedQuery);
        })
        .sort((a, b) => toTimestamp(b.receivedAt) - toTimestamp(a.receivedAt)),
    [jobs, normalizedQuery, inScope]
  );

  const progressEntriesByJobId = useMemo(() => {
    const next = new Map<string, DyehouseProgressEntry[]>();
    progressEntries.forEach((entry) => {
      const bucket = next.get(entry.jobId);
      if (bucket) {
        bucket.push(entry);
        return;
      }
      next.set(entry.jobId, [entry]);
    });
    return next;
  }, [progressEntries]);

  const jobProgressTotalsById = useMemo(() => {
    return new Map(
      jobs.map((job) => [
        job.id,
        buildJobProgressTotals(job, progressEntriesByJobId.get(job.id) ?? []),
      ] as const)
    );
  }, [jobs, progressEntriesByJobId]);

  const selectedJobProgressEntries = useMemo(
    () => (selectedJobId ? progressEntriesByJobId.get(selectedJobId) ?? [] : []),
    [progressEntriesByJobId, selectedJobId]
  );

  const summaryTotals = useMemo(
    () =>
      jobsForSummary.reduce(
        (totals, job) => {
          const progressTotals =
            jobProgressTotalsById.get(job.id) ??
            buildJobProgressTotals(job, progressEntriesByJobId.get(job.id) ?? []);
          return {
            jobCount: totals.jobCount + 1,
            targetMeters: totals.targetMeters + progressTotals.targetMeters,
            processedMeters: totals.processedMeters + progressTotals.processedMeters,
            remainingMeters: totals.remainingMeters + progressTotals.remainingMeters,
          };
        },
        {
          jobCount: 0,
          targetMeters: 0,
          processedMeters: 0,
          remainingMeters: 0,
        }
      ),
    [jobProgressTotalsById, jobsForSummary, progressEntriesByJobId]
  );

  const jobsByStatus = useMemo(() => {
    const totals: Record<JobTab, number> = {
      RECEIVED: 0,
      IN_PROCESS: 0,
      FINISHED: 0,
    };
    jobs.forEach((job) => {
      if (job.status in totals) {
        totals[job.status as JobTab] += 1;
      }
    });
    return totals;
  }, [jobs]);

  const handleCreateOrOpenJob = (document: WeavingDispatchDocument) => {
    try {
      const existing = jobsByDispatchDocId.get(document.id);
      if (existing) {
        setSelectedJobId(existing.id);
        return;
      }

      if (!canCreateJobs) {
        setFeedback("Bu hesap yeni boyahane is emri olusturamaz.");
        return;
      }

      const created = dyehouseLocalRepo.createFromDispatch(document);
      refreshData();
      setSelectedJobId(created.id);
      setFeedback("Is emri olusturuldu.");
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Is emri olusturulamadi.");
    }
  };

  return (
    <Layout title="Boyahane">
      <div className="flex h-full min-h-0 flex-col gap-4">
        <section className="rounded-xl border border-black/10 bg-white p-4">
          <div className="grid gap-2 lg:grid-cols-[auto_auto_220px_minmax(0,1fr)]">
            <div className="inline-flex rounded-lg border border-black/10 bg-neutral-50 p-1">
              <button
                type="button"
                onClick={() => setViewMode("MIX")}
                className={cn(
                  "rounded-md px-3 py-1.5 text-xs font-semibold transition",
                  viewMode === "MIX"
                    ? "bg-white text-neutral-900 shadow-sm"
                    : "text-neutral-600 hover:text-neutral-900"
                )}
              >
                Mix Akis
              </button>
              <button
                type="button"
                onClick={() => setViewMode("BY_DYEHOUSE")}
                className={cn(
                  "rounded-md px-3 py-1.5 text-xs font-semibold transition",
                  viewMode === "BY_DYEHOUSE"
                    ? "bg-white text-neutral-900 shadow-sm"
                    : "text-neutral-600 hover:text-neutral-900"
                )}
              >
                Boyahane Bazli
              </button>
            </div>

            <select
              value={effectiveDyehouseFilter}
              onChange={(event) => setDyehouseFilter(event.target.value)}
              className="rounded-lg border border-black/10 bg-white px-3 py-2 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-coffee-primary"
            >
              {viewMode === "MIX" ? <option value="ALL">Tum Boyahaneler</option> : null}
              {dyehouses.map((dyehouse) => (
                <option key={dyehouse.id} value={dyehouse.id}>
                  {dyehouse.name}
                </option>
              ))}
              {dyehouses.length === 0 ? <option value="ALL">Boyahane kaydi yok</option> : null}
            </select>

            <div className="rounded-lg border border-black/10 bg-neutral-50 px-3 py-2 text-sm text-neutral-700">
              Is Emri: <span className="font-semibold">{jobs.length}</span>
            </div>

            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Desen kodu/adi ara..."
              className="w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-coffee-primary"
            />
          </div>

          <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-4">
            <MetricCard title="Kapsamdaki Is" value={`${summaryTotals.jobCount}`} />
            <MetricCard title="Toplam Hedef (m)" value={fmt(summaryTotals.targetMeters)} />
            <MetricCard title="Toplam Islenen (m)" value={fmt(summaryTotals.processedMeters)} />
            <MetricCard
              title="Kalan / Asim"
              value={formatRemainingMeters(summaryTotals.remainingMeters)}
              tone={summaryTotals.remainingMeters < 0 ? "danger" : "neutral"}
            />
          </div>
        </section>

        {feedback ? (
          <p className="rounded-lg border border-black/10 bg-white px-3 py-2 text-sm text-neutral-700">
            {feedback}
          </p>
        ) : null}

        <section className="rounded-xl border border-black/10 bg-white p-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="text-lg font-semibold text-neutral-900">Gelen Boyahane Sevk Belgeleri</h2>
            <span className="rounded-full border border-black/10 bg-neutral-50 px-2.5 py-1 text-xs font-semibold text-neutral-700">
              {filteredIncomingDocs.length} belge
            </span>
          </div>

          <div className="max-h-[230px] overflow-auto rounded-lg border border-black/10">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 z-10 bg-neutral-50 text-neutral-600">
                <tr>
                  <th className="px-3 py-2 font-semibold">Tarih</th>
                  <th className="px-3 py-2 font-semibold">Belge No</th>
                  <th className="px-3 py-2 font-semibold">Boyahane</th>
                  <th className="px-3 py-2 font-semibold">Desen</th>
                  <th className="px-3 py-2 font-semibold">Metre</th>
                  <th className="px-3 py-2 font-semibold">Durum</th>
                  <th className="px-3 py-2 font-semibold">Aksiyon</th>
                </tr>
              </thead>
              <tbody className="text-neutral-800">
                {filteredIncomingDocs.map((document) => {
                  const linkedJob = jobsByDispatchDocId.get(document.id) ?? null;
                  return (
                    <tr key={document.id} className="border-t border-black/5">
                      <td className="px-3 py-2">{formatDateTime(document.createdAt)}</td>
                      <td className="px-3 py-2 font-mono text-xs">{document.docNo}</td>
                      <td className="px-3 py-2">{document.destinationNameSnapshot}</td>
                      <td className="px-3 py-2">
                        {document.patternNoSnapshot} - {document.patternNameSnapshot}
                      </td>
                      <td className="px-3 py-2">{fmt(document.metersTotal)} m</td>
                      <td className="px-3 py-2">
                        {linkedJob ? (
                          <StatusBadge status={linkedJob.status} />
                        ) : (
                          <span className="text-xs text-neutral-500">Is emri bekliyor</span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <button
                          type="button"
                          onClick={() => handleCreateOrOpenJob(document)}
                          disabled={!linkedJob && !canCreateJobs}
                          className="rounded border border-black/10 bg-white px-2.5 py-1 text-xs font-semibold text-neutral-700 transition hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          {linkedJob ? "Isi Ac" : "Is Emri Ac"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {filteredIncomingDocs.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-3 py-8 text-center text-sm text-neutral-500">
                      Uygun gelen boyahane sevk belgesi bulunamadi.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>

        <section className="min-h-0 flex-1 rounded-xl border border-black/10 bg-white p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-semibold text-neutral-900">Boyahane Is Emirleri</h2>
            <div className="inline-flex rounded-lg border border-black/10 bg-neutral-50 p-1">
              {JOB_TABS.map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setJobTab(tab)}
                  className={cn(
                    "rounded-md px-3 py-1.5 text-xs font-semibold transition",
                    jobTab === tab
                      ? "bg-white text-neutral-900 shadow-sm"
                      : "text-neutral-600 hover:text-neutral-900"
                  )}
                >
                  {statusLabelMap[tab]} ({jobsByStatus[tab]})
                </button>
              ))}
            </div>
          </div>

          <div className="max-h-[38vh] overflow-auto rounded-lg border border-black/10">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 z-10 bg-neutral-50 text-neutral-600">
                <tr>
                  <th className="px-3 py-2 font-semibold">Alim</th>
                  <th className="px-3 py-2 font-semibold">Boyahane</th>
                  <th className="px-3 py-2 font-semibold">Desen</th>
                  <th className="px-3 py-2 font-semibold">Giris (m)</th>
                  <th className="px-3 py-2 font-semibold">Hedef (m)</th>
                  <th className="px-3 py-2 font-semibold">Islenen (m)</th>
                  <th className="px-3 py-2 font-semibold">Kalan / Asim</th>
                  <th className="px-3 py-2 font-semibold">Durum</th>
                  <th className="px-3 py-2 font-semibold">Aksiyon</th>
                </tr>
              </thead>
              <tbody className="text-neutral-800">
                {filteredJobs.map((job) => {
                  const progressTotals =
                    jobProgressTotalsById.get(job.id) ??
                    buildJobProgressTotals(job, progressEntriesByJobId.get(job.id) ?? []);

                  return (
                    <tr key={job.id} className="border-t border-black/5">
                      <td className="px-3 py-2">{formatDateTime(job.receivedAt)}</td>
                      <td className="px-3 py-2">{job.dyehouseNameSnapshot}</td>
                      <td className="px-3 py-2">
                        {job.patternCodeSnapshot} - {job.patternNameSnapshot}
                      </td>
                      <td className="px-3 py-2">{fmt(job.inputMetersTotal)}</td>
                      <td className="px-3 py-2">{fmt(progressTotals.targetMeters)}</td>
                      <td className="px-3 py-2">{fmt(progressTotals.processedMeters)}</td>
                      <td
                        className={cn(
                          "px-3 py-2",
                          progressTotals.remainingMeters < 0 ? "font-semibold text-rose-700" : ""
                        )}
                      >
                        {formatRemainingMeters(progressTotals.remainingMeters)}
                      </td>
                      <td className="px-3 py-2">
                        <StatusBadge status={job.status} />
                      </td>
                      <td className="px-3 py-2">
                        <button
                          type="button"
                          onClick={() => setSelectedJobId(job.id)}
                          className="rounded border border-black/10 bg-white px-2.5 py-1 text-xs font-semibold text-neutral-700 transition hover:bg-neutral-100"
                        >
                          Detay
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {filteredJobs.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-3 py-8 text-center text-sm text-neutral-500">
                      Secili filtreye uygun is emri yok.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {selectedJob ? (
        <JobModal
          job={selectedJob}
          progressEntries={selectedJobProgressEntries}
          sourceDispatch={selectedSourceDispatch}
          onClose={() => setSelectedJobId(null)}
          onProgressChanged={refreshProgress}
          onSaved={(jobId) => {
            refreshData();
            if (jobId) setSelectedJobId(jobId);
          }}
        />
      ) : null}
    </Layout>
  );
}

type JobModalProps = {
  job: DyehouseJob;
  progressEntries: DyehouseProgressEntry[];
  sourceDispatch: WeavingDispatchDocument | null;
  onClose: () => void;
  onProgressChanged: () => void;
  onSaved: (jobId?: string) => void;
};
function JobModal({
  job,
  progressEntries,
  sourceDispatch,
  onClose,
  onProgressChanged,
  onSaved,
}: JobModalProps) {
  const { permissions } = useAuthProfile();
  const [lineDrafts, setLineDrafts] = useState<LineDraft[]>([]);
  const [jobNotes, setJobNotes] = useState("");
  const [progressDateTime, setProgressDateTime] = useState(nowDateTimeLocal());
  const [progressProcessType, setProgressProcessType] = useState("");
  const [progressColor, setProgressColor] = useState("");
  const [progressKgInput, setProgressKgInput] = useState("");
  const [progressMetersInput, setProgressMetersInput] = useState("");
  const [progressNote, setProgressNote] = useState("");
  const [progressError, setProgressError] = useState("");
  const [isFinishing, setIsFinishing] = useState(false);
  const [allowFinishedEdit, setAllowFinishedEdit] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const progressMetersInputRef = useRef<HTMLInputElement | null>(null);
  const canEditBreakdown = permissions.dyehouse.edit;
  const canEditProgress = permissions.dyehouse.edit;
  const canAdvanceDyehouse = permissions.dyehouse.advance;
  const canDeleteJob = permissions.dyehouse.delete;
  const canCreateDepotDispatch = permissions.dispatch.create;

  useEffect(() => {
    setLineDrafts(job.lines.map((line) => createLineDraft(line)));
    setJobNotes(job.notes ?? "");
    setIsFinishing(false);
    setAllowFinishedEdit(false);
    setError("");
    setSuccess("");
  }, [job]);

  useEffect(() => {
    setProgressDateTime(nowDateTimeLocal());
    setProgressProcessType("");
    setProgressColor("");
    setProgressKgInput("");
    setProgressMetersInput("");
    setProgressNote("");
    setProgressError("");
  }, [job.id]);

  const outputDocument = useMemo(
    () =>
      job.outputDispatchDocId
        ? weavingLocalRepo.getDispatchDocument(job.outputDispatchDocId) ?? null
        : null,
    [job.outputDispatchDocId]
  );

  const rowsEditable = canEditBreakdown && (job.status !== "FINISHED" || allowFinishedEdit);
  const finishEditable =
    canAdvanceDyehouse && ((job.status === "IN_PROCESS" && isFinishing) || allowFinishedEdit);

  const parsePositive = (value: string, label: string) => {
    const parsed = Number(value.trim().replace(",", "."));
    if (!Number.isFinite(parsed) || parsed <= 0) {
      throw new Error(`${label} 0'dan buyuk olmali.`);
    }
    return parsed;
  };

  const parseNonNegative = (value: string, label: string) => {
    const parsed = Number(value.trim().replace(",", "."));
    if (!Number.isFinite(parsed) || parsed < 0) {
      throw new Error(`${label} negatif olamaz.`);
    }
    return parsed;
  };

  const parseOptionalNonNegative = (value: string, label: string) => {
    const trimmed = value.trim();
    if (!trimmed) return undefined;
    return parseNonNegative(trimmed, label);
  };

  const buildBreakdownLines = (): DyehouseLine[] => {
    if (lineDrafts.length === 0) {
      throw new Error("En az bir satir girmelisiniz.");
    }

    const lines = lineDrafts.map((row) => {
      const colorName = row.colorName.trim();
      if (!colorName) throw new Error("Renk zorunlu.");
      
      const baseLine = job.lines.find(l => l.id === row.id) || {} as Partial<DyehouseLine>;

      return {
        ...baseLine,
        id: row.id,
        colorName,
        color: colorName,
        variantCode: row.variantCode.trim() || undefined,
        variantName: row.variantCode.trim() || undefined,
        metersPlanned: parsePositive(row.incomingQuantityMeters, `${colorName} metre`),
        incomingQuantityMeters: parsePositive(row.incomingQuantityMeters, `${colorName} metre`),
        inputKg: parseOptionalNonNegative(row.rawKg, `${colorName} ham kg`),
        rawKg: parseOptionalNonNegative(row.rawKg, `${colorName} ham kg`),
        outputKg: parseOptionalNonNegative(row.cleanKg, `${colorName} temiz kg`),
        cleanKg: parseOptionalNonNegative(row.cleanKg, `${colorName} temiz kg`),
        notes: row.notes.trim() || undefined,
        note: row.notes.trim() || undefined,
      } as DyehouseLine;
    });

    if (sumMeters(lines) - job.inputMetersTotal > 1e-6) {
      throw new Error("Renk metre toplami, giris metresinden buyuk olamaz.");
    }

    return lines;
  };

  const buildFinishedLines = (): DyehouseLine[] => {
    const base = buildBreakdownLines();
    return base.map((line, index) => {
      const row = lineDrafts[index];
      const rawKg = parseNonNegative(row.rawKg, `${line.colorName} ham kg`);
      const cleanKg = parseNonNegative(row.cleanKg, `${line.colorName} temiz kg`);
      const wasteKg = rawKg - cleanKg;
      return {
        ...line,
        inputKg: rawKg,
        rawKg,
        outputKg: cleanKg,
        cleanKg,
        wasteKg,
        notes: row.notes.trim() || undefined,
        note: row.notes.trim() || undefined,
      } as DyehouseLine;
    });
  };

  const plannedMetersFromDraft = useMemo(() => {
    return lineDrafts.reduce((sum, row) => {
      const parsed = Number(row.incomingQuantityMeters.trim().replace(",", "."));
      if (!Number.isFinite(parsed) || parsed <= 0) return sum;
      return sum + parsed;
    }, 0);
  }, [lineDrafts]);

  const progressCalculatedTotal = useMemo(() => {
    const parsed = Number(progressMetersInput.replace(",", "."));
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
  }, [progressMetersInput]);

  const progressTotals = useMemo(() => {
    return buildJobProgressTotals(job, progressEntries);
  }, [job, progressEntries]);

  const progressWarnings = useMemo(() => {
    if (progressCalculatedTotal <= 0) return [];

    const nextProcessedMeters = progressTotals.processedMeters + progressCalculatedTotal;
    const warnings: string[] = [];

    if (nextProcessedMeters - progressTotals.targetMeters > WORKFLOW_PROGRESS_EPSILON) {
      warnings.push("Bu giris is hedef metresini asiyor.");
    }

    if (
      progressTotals.remainingInputMeters - progressCalculatedTotal < -WORKFLOW_PROGRESS_EPSILON &&
      Math.abs(job.inputMetersTotal - progressTotals.targetMeters) > WORKFLOW_PROGRESS_EPSILON
    ) {
      warnings.push("Bu giris kaynak giris metresini de asiyor olabilir.");
    }

    return warnings;
  }, [job.inputMetersTotal, progressCalculatedTotal, progressTotals]);

  const finishWarnings = useMemo(
    () =>
      lineDrafts.flatMap((row) => {
        const wasteKg = computeWasteKg(row.rawKg, row.cleanKg);
        if (wasteKg === undefined || wasteKg >= 0) return [];
        return [`${row.colorName || "Satir"} icin Temiz Kg, Ham Kg'dan buyuk.`];
      }),
    [lineDrafts]
  );

  const updateLine = (id: string, key: keyof LineDraft, value: string) => {
    setLineDrafts((prev) => prev.map((row) => (row.id === id ? { ...row, [key]: value } : row)));
  };

  const addRow = () => {
    setLineDrafts((prev) => [...prev, createLineDraft()]);
  };

  const removeRow = (id: string) => {
    setLineDrafts((prev) => prev.filter((row) => row.id !== id));
  };

  const focusProgressMetersInput = () => {
    const input = progressMetersInputRef.current;
    if (!input) return;
    requestAnimationFrame(() => {
      input.focus();
      input.select();
    });
  };

  const saveProgress = () => {
    if (!canEditProgress) return;

    try {
      const meters = toPositiveNumberInput(progressMetersInput, "Metre");
      const createdAt = toIsoFromDateTimeLocal(progressDateTime, "Tarih / Saat");
      const quantityKg = progressKgInput.trim() ? Number(progressKgInput.replace(",", ".")) : undefined;

      dyehouseLocalRepo.addProgressEntry(job.id, {
        createdAt,
        processType: progressProcessType.trim() || undefined,
        color: progressColor.trim() || undefined,
        quantityKg: Number.isFinite(quantityKg) ? quantityKg : undefined,
        quantityMeters: meters,
        meters, // fallback for legacy
        note: progressNote.trim() || undefined,
      });

      setProgressProcessType("");
      setProgressColor("");
      setProgressKgInput("");
      setProgressMetersInput("");
      setProgressNote("");
      setProgressError("");
      setSuccess("Ilerleme kaydedildi.");
      setError("");
      onProgressChanged();
      focusProgressMetersInput();
    } catch (saveError) {
      setSuccess("");
      setProgressError(saveError instanceof Error ? saveError.message : "Ilerleme kaydedilemedi.");
    }
  };

  const deleteProgress = (progressId: string) => {
    if (!canEditProgress) return;
    dyehouseLocalRepo.removeProgressEntry(job.id, progressId);
    setProgressError("");
    setSuccess("Ilerleme silindi.");
    setError("");
    onProgressChanged();
    focusProgressMetersInput();
  };

  const handleProgressMetersKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== "Enter" || event.nativeEvent.isComposing) return;
    event.preventDefault();
    saveProgress();
  };

  const saveBreakdown = () => {
    if (!canEditBreakdown) return;
    try {
      const lines = buildBreakdownLines();
      dyehouseLocalRepo.updateJob(job.id, {
        lines,
        notes: jobNotes.trim() || undefined,
      });
      setError("");
      setSuccess("Dagitim kaydedildi.");
      onSaved(job.id);
    } catch (saveError) {
      setSuccess("");
      setError(saveError instanceof Error ? saveError.message : "Dagitim kaydedilemedi.");
    }
  };

  const startProcess = () => {
    if (!canAdvanceDyehouse) return;
    try {
      const lines = buildBreakdownLines();
      dyehouseLocalRepo.updateJob(job.id, {
        status: "IN_PROCESS",
        lines,
        notes: jobNotes.trim() || undefined,
      });
      setError("");
      setSuccess("Is emri isleme alindi.");
      onSaved(job.id);
    } catch (saveError) {
      setSuccess("");
      setError(saveError instanceof Error ? saveError.message : "Durum guncellenemedi.");
    }
  };

  const finishJob = () => {
    if (!canAdvanceDyehouse) return;
    try {
      const lines = buildFinishedLines();
      dyehouseLocalRepo.updateJob(job.id, {
        status: "FINISHED",
        lines,
        notes: jobNotes.trim() || undefined,
        finishedAt: new Date().toISOString(),
      });
      setIsFinishing(false);
      setAllowFinishedEdit(false);
      setError("");
      setSuccess("Is emri tamamlandi.");
      onSaved(job.id);
    } catch (finishError) {
      setSuccess("");
      setError(finishError instanceof Error ? finishError.message : "Bitirme kaydi yapilamadi.");
    }
  };

  const createDepotDispatch = () => {
    if (!canCreateDepotDispatch) return;
    try {
      if (job.status !== "FINISHED") {
        throw new Error("Depo cikis belgesi sadece biten is emrinden olusturulabilir.");
      }
      if (job.outputDispatchDocId) {
        setSuccess("Bu is emri icin cikis belgesi zaten olusturulmus.");
        return;
      }
      if (!sourceDispatch) {
        throw new Error("Kaynak dokuma sevk belgesi bulunamadi.");
      }
      if (job.lines.length === 0) {
        throw new Error("Satir olmadan cikis belgesi olusturulamaz.");
      }

      const document = weavingLocalRepo.createDyehouseToWarehouseDispatchDocument({
        sourceJobId: job.id,
        sourceDispatchDocId: job.sourceDispatchDocId,
        createdAt: new Date().toISOString(),
        planId: sourceDispatch.planId,
        patternId: job.patternId,
        patternNoSnapshot: job.patternCodeSnapshot,
        patternNameSnapshot: job.patternNameSnapshot,
        lines: job.lines.map((line) => ({
          colorNameSnapshot: line.colorName,
          variantCodeSnapshot: line.variantCode,
          meters: line.metersPlanned,
        })),
        note: jobNotes.trim() || undefined,
      });

      dyehouseLocalRepo.updateJob(job.id, {
        outputDispatchDocId: document.id,
      });

      setError("");
      setSuccess("Depo cikis belgesi olusturuldu.");
      onSaved(job.id);
    } catch (dispatchError) {
      setSuccess("");
      setError(dispatchError instanceof Error ? dispatchError.message : "Belge olusturulamadi.");
    }
  };

  const deleteJob = () => {
    if (!canDeleteJob) return;
    if (!window.confirm("Bu is emri silinsin mi?")) return;
    dyehouseLocalRepo.deleteJob(job.id);
    onSaved();
    onClose();
  };

  return (
    <Modal title="Boyahane Is Emri Detayi" onClose={onClose} size="xl">
      <div className="space-y-3">
        <div className="rounded-lg border border-black/10 bg-neutral-50 px-3 py-2 text-sm text-neutral-700">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="font-semibold text-neutral-900">
              {job.patternCodeSnapshot} - {job.patternNameSnapshot}
            </div>
            <StatusBadge status={job.status} />
          </div>
          <div className="mt-1">Boyahane: {job.dyehouseNameSnapshot}</div>
          <div>Giris Metre: {fmt(job.inputMetersTotal)} m</div>
          <div>Hedef Metre: {fmt(progressTotals.targetMeters)} m</div>
          <div>Islenen: {fmt(progressTotals.processedMeters)} m</div>
          <div>Kalan / Asim: {formatRemainingMeters(progressTotals.remainingMeters)}</div>
          <div>Alim: {formatDateTime(job.receivedAt)}</div>
          {job.finishedAt ? <div>Bitis: {formatDateTime(job.finishedAt)}</div> : null}
          {sourceDispatch ? (
            <div className="mt-1 text-xs">
              Kaynak Belge: <span className="font-mono">{sourceDispatch.docNo}</span>
            </div>
          ) : null}
        </div>

        <div className="space-y-2 rounded-lg border border-black/10 bg-white p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
              Ilerleme Gir
            </div>
            <div className="rounded-full border border-black/10 bg-neutral-50 px-2.5 py-1 text-[11px] font-semibold text-neutral-700">
              Toplam Islenen: {fmt(progressTotals.processedMeters)} m
            </div>
          </div>

          <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_120px_120px_90px_100px]">
            <label className="space-y-1 text-xs text-neutral-700">
              <span>Tarih / Saat</span>
              <input
                type="datetime-local"
                value={progressDateTime}
                disabled={!canEditProgress}
                onChange={(event) => setProgressDateTime(event.target.value)}
                className="w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-coffee-primary disabled:cursor-not-allowed disabled:bg-neutral-100"
              />
            </label>

            <label className="space-y-1 text-xs text-neutral-700">
              <span>Islem Tipi</span>
              <input
                type="text"
                value={progressProcessType}
                disabled={!canEditProgress}
                onChange={(event) => setProgressProcessType(event.target.value)}
                placeholder="Örn: Yıkama"
                className="w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-coffee-primary disabled:cursor-not-allowed disabled:bg-neutral-100"
              />
            </label>

            <label className="space-y-1 text-xs text-neutral-700">
              <span>Renk</span>
              <input
                type="text"
                value={progressColor}
                disabled={!canEditProgress}
                onChange={(event) => setProgressColor(event.target.value)}
                placeholder="Örn: Siyah"
                className="w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-coffee-primary disabled:cursor-not-allowed disabled:bg-neutral-100"
              />
            </label>

            <label className="space-y-1 text-xs text-neutral-700">
              <span>Kg</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={progressKgInput}
                disabled={!canEditProgress}
                onChange={(event) => setProgressKgInput(event.target.value)}
                placeholder="0"
                className="w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-coffee-primary disabled:cursor-not-allowed disabled:bg-neutral-100"
              />
            </label>

            <label className="space-y-1 text-xs text-neutral-700">
              <span>Metre</span>
              <input
                ref={progressMetersInputRef}
                type="number"
                min="0"
                step="0.01"
                value={progressMetersInput}
                disabled={!canEditProgress}
                onChange={(event) => setProgressMetersInput(event.target.value)}
                onKeyDown={handleProgressMetersKeyDown}
                placeholder="0"
                className="w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-coffee-primary disabled:cursor-not-allowed disabled:bg-neutral-100"
              />
            </label>
          </div>

          <input
            type="text"
            value={progressNote}
            disabled={!canEditProgress}
            onChange={(event) => setProgressNote(event.target.value)}
            placeholder="Not (opsiyonel)"
            className="w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-coffee-primary disabled:cursor-not-allowed disabled:bg-neutral-100"
          />

          <div className="rounded-lg border border-black/10 bg-neutral-50 px-3 py-2 text-xs text-neutral-700">
            Hedef: {fmt(progressTotals.targetMeters)} m / Islenen: {fmt(progressTotals.processedMeters)} m / Kalan / Asim:{" "}
            {formatRemainingMeters(progressTotals.remainingMeters)}
          </div>

          {progressWarnings.length > 0 ? (
            <div className="rounded-lg border border-rose-500/30 bg-rose-50 px-3 py-3 text-sm text-rose-800">
              <div className="flex items-start gap-2">
                <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-rose-100 font-semibold text-rose-700">
                  !
                </span>
                <div className="space-y-1">
                  <div className="font-medium">Hedef asimi uyarisi var; kayit yine alinacak.</div>
                  {progressWarnings.map((warning) => (
                    <div key={warning} className="text-xs text-rose-700">
                      {warning}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : null}

          <div className="rounded-lg border border-black/10 bg-white p-2">
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">
              Son 5 Ilerleme
            </div>
            <div className="space-y-1 text-xs text-neutral-700">
              {progressEntries.slice(0, 5).map((entry) => (
                <div key={entry.id} className="flex items-center justify-between gap-2">
                  <span>
                    {formatDateTime(entry.createdAt)}
                    {" - "}
                    {getProgressAmountText(entry)}
                    {entry.note ? ` (${entry.note})` : ""}
                  </span>
                  {canEditProgress ? (
                    <button
                      type="button"
                      onClick={() => deleteProgress(entry.id)}
                      className="rounded border border-rose-500/30 bg-rose-50 px-1.5 py-0.5 text-[11px] font-semibold text-rose-700 transition hover:bg-rose-100"
                    >
                      Sil
                    </button>
                  ) : null}
                </div>
              ))}
              {progressEntries.length === 0 ? <div>Kayit yok.</div> : null}
            </div>
          </div>

          {progressError ? <p className="text-xs font-medium text-rose-600">{progressError}</p> : null}

          {canEditProgress ? (
            <div className="flex justify-end">
              <button
                type="button"
                onClick={saveProgress}
                className="rounded-lg bg-coffee-primary px-3 py-2 text-xs font-semibold text-white transition hover:brightness-95"
              >
                Kaydet
              </button>
            </div>
          ) : null}
        </div>

        <div className="space-y-2 rounded-lg border border-black/10 bg-white p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
              Renk Dagitimi
            </div>
            <div className="flex flex-wrap gap-2">
              {canEditBreakdown && job.status === "FINISHED" && !allowFinishedEdit ? (
                <button
                  type="button"
                  onClick={() => setAllowFinishedEdit(true)}
                  className="rounded border border-black/10 bg-white px-2.5 py-1 text-xs font-semibold text-neutral-700 transition hover:bg-neutral-100"
                >
                  Duzelt
                </button>
              ) : null}
              {rowsEditable ? (
                <button
                  type="button"
                  onClick={addRow}
                  className="rounded border border-black/10 bg-white px-2.5 py-1 text-xs font-semibold text-neutral-700 transition hover:bg-neutral-100"
                >
                  + Satir Ekle
                </button>
              ) : null}
            </div>
          </div>

          <div className="max-h-[230px] overflow-auto rounded-lg border border-black/10">
            <table className="w-full text-left text-xs text-neutral-700">
              <thead className="sticky top-0 bg-neutral-50 text-neutral-600">
                <tr>
                  <th className="px-2 py-1.5 font-semibold">Renk</th>
                  <th className="px-2 py-1.5 font-semibold">Varyant Kodu</th>
                  <th className="px-2 py-1.5 font-semibold">Metre</th>
                  <th className="px-2 py-1.5 font-semibold">Aksiyon</th>
                </tr>
              </thead>
              <tbody>
                {lineDrafts.map((row) => (
                  <tr key={row.id} className="border-t border-black/5">
                    <td className="px-2 py-1.5">
                      <input
                        type="text"
                        value={row.colorName}
                        disabled={!rowsEditable}
                        onChange={(event) => updateLine(row.id, "colorName", event.target.value)}
                        className="w-full rounded border border-black/10 bg-white px-2 py-1 text-xs text-neutral-900 focus:outline-none focus:ring-2 focus:ring-coffee-primary disabled:cursor-not-allowed disabled:bg-neutral-100"
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <input
                        type="text"
                        value={row.variantCode}
                        disabled={!rowsEditable}
                        onChange={(event) => updateLine(row.id, "variantCode", event.target.value)}
                        className="w-full rounded border border-black/10 bg-white px-2 py-1 text-xs text-neutral-900 focus:outline-none focus:ring-2 focus:ring-coffee-primary disabled:cursor-not-allowed disabled:bg-neutral-100"
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={row.incomingQuantityMeters}
                        disabled={!rowsEditable}
                        onChange={(event) => updateLine(row.id, "incomingQuantityMeters", event.target.value)}
                        className="w-full rounded border border-black/10 bg-white px-2 py-1 text-xs text-neutral-900 focus:outline-none focus:ring-2 focus:ring-coffee-primary disabled:cursor-not-allowed disabled:bg-neutral-100"
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <button
                        type="button"
                        onClick={() => removeRow(row.id)}
                        disabled={!rowsEditable}
                        className="rounded border border-rose-500/30 bg-rose-50 px-2 py-1 text-[11px] font-semibold text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        Sil
                      </button>
                    </td>
                  </tr>
                ))}
                {lineDrafts.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-2 py-6 text-center text-xs text-neutral-500">
                      Henuz renk dagitimi yok.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>

          <div className="rounded-lg border border-black/10 bg-neutral-50 px-3 py-2 text-xs text-neutral-700">
            Giris: {fmt(job.inputMetersTotal)} m / Dagitim: {fmt(plannedMetersFromDraft)} m
          </div>

          <textarea
            value={jobNotes}
            onChange={(event) => setJobNotes(event.target.value)}
            disabled={!rowsEditable}
            rows={2}
            placeholder="Is emri notu (opsiyonel)"
            className="w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-xs text-neutral-900 focus:outline-none focus:ring-2 focus:ring-coffee-primary disabled:cursor-not-allowed disabled:bg-neutral-100"
          />

          {rowsEditable ? (
            <div className="flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={saveBreakdown}
                className="rounded-lg border border-black/10 bg-white px-3 py-2 text-xs font-semibold text-neutral-700 transition hover:bg-neutral-100"
              >
                Kaydet
              </button>
              {job.status === "RECEIVED" ? (
                <button
                  type="button"
                  onClick={startProcess}
                  className="rounded-lg border border-sky-500/30 bg-sky-50 px-3 py-2 text-xs font-semibold text-sky-700 transition hover:bg-sky-100"
                >
                  Isleme Al
                </button>
              ) : null}
            </div>
          ) : null}
        </div>

        {(job.status === "IN_PROCESS" || job.status === "FINISHED") ? (
          <div className="space-y-2 rounded-lg border border-black/10 bg-white p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                Kapanis Kg / Fire
              </div>
              {canAdvanceDyehouse && job.status === "IN_PROCESS" && !isFinishing ? (
                <button
                  type="button"
                  onClick={() => setIsFinishing(true)}
                  className="rounded-lg border border-emerald-500/30 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100"
                >
                  Bitir
                </button>
              ) : null}
            </div>

            {isFinishing || job.status === "FINISHED" ? (
              <>
                <div className="max-h-[240px] overflow-auto rounded-lg border border-black/10">
                  <table className="w-full text-left text-xs text-neutral-700">
                    <thead className="sticky top-0 bg-neutral-50 text-neutral-600">
                      <tr>
                        <th className="px-2 py-1.5 font-semibold">Renk</th>
                        <th className="px-2 py-1.5 font-semibold">Metre</th>
                        <th className="px-2 py-1.5 font-semibold">Giris Kg</th>
                        <th className="px-2 py-1.5 font-semibold">Cikis Kg</th>
                        <th className="px-2 py-1.5 font-semibold">Fire Kg</th>
                        <th className="px-2 py-1.5 font-semibold">Not</th>
                      </tr>
                    </thead>
                    <tbody>
                      {lineDrafts.map((row) => {
                        const computedWasteKg = computeWasteKg(row.rawKg, row.cleanKg);
                        const wasteDisplay =
                          computedWasteKg !== undefined
                            ? fmt(computedWasteKg)
                            : "";
                        const hasWasteWarning =
                          computedWasteKg !== undefined && computedWasteKg < 0;

                        return (
                          <tr key={`${row.id}-finish`} className="border-t border-black/5">
                            <td className="px-2 py-1.5">{row.colorName || "-"}</td>
                            <td className="px-2 py-1.5">
                              {row.incomingQuantityMeters ? fmt(Number(row.incomingQuantityMeters) || 0) : "-"}
                            </td>
                            <td className="px-2 py-1.5">
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={row.rawKg}
                                disabled={!finishEditable}
                                onChange={(event) => updateLine(row.id, "rawKg", event.target.value)}
                                className="w-full rounded border border-black/10 bg-white px-2 py-1 text-xs text-neutral-900 focus:outline-none focus:ring-2 focus:ring-coffee-primary disabled:cursor-not-allowed disabled:bg-neutral-100"
                              />
                            </td>
                            <td className="px-2 py-1.5">
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={row.cleanKg}
                                disabled={!finishEditable}
                                onChange={(event) => updateLine(row.id, "cleanKg", event.target.value)}
                                className="w-full rounded border border-black/10 bg-white px-2 py-1 text-xs text-neutral-900 focus:outline-none focus:ring-2 focus:ring-coffee-primary disabled:cursor-not-allowed disabled:bg-neutral-100"
                              />
                            </td>
                            <td className="px-2 py-1.5">
                              <input
                                type="text"
                                readOnly
                                value={wasteDisplay}
                                className={cn(
                                  "w-full rounded border px-2 py-1 text-xs focus:outline-none",
                                  hasWasteWarning
                                    ? "border-rose-500/30 bg-rose-50 text-rose-700"
                                    : "border-black/10 bg-neutral-50 text-neutral-700"
                                )}
                              />
                            </td>
                            <td className="px-2 py-1.5">
                              <input
                                type="text"
                                value={row.notes}
                                disabled={!finishEditable}
                                onChange={(event) => updateLine(row.id, "notes", event.target.value)}
                                className="w-full rounded border border-black/10 bg-white px-2 py-1 text-xs text-neutral-900 focus:outline-none focus:ring-2 focus:ring-coffee-primary disabled:cursor-not-allowed disabled:bg-neutral-100"
                              />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {finishWarnings.length > 0 ? (
                  <div className="rounded-lg border border-rose-500/30 bg-rose-50 px-3 py-3 text-sm text-rose-800">
                    <div className="flex items-start gap-2">
                      <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-rose-100 font-semibold text-rose-700">
                        !
                      </span>
                      <div className="space-y-1">
                        <div className="font-medium">Fire sonucu negatif gorunuyor.</div>
                        {finishWarnings.map((warning) => (
                          <div key={warning} className="text-xs text-rose-700">
                            {warning}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : null}

                {finishEditable ? (
                  <div className="flex flex-wrap justify-end gap-2">
                    {job.status === "IN_PROCESS" ? (
                      <button
                        type="button"
                        onClick={() => setIsFinishing(false)}
                        className="rounded-lg border border-black/10 bg-white px-3 py-2 text-xs font-semibold text-neutral-700 transition hover:bg-neutral-100"
                      >
                        Vazgec
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={finishJob}
                      className="rounded-lg bg-coffee-primary px-3 py-2 text-xs font-semibold text-white transition hover:brightness-95"
                    >
                      {job.status === "IN_PROCESS" ? "Bitir ve Kaydet" : "Duzeltmeyi Kaydet"}
                    </button>
                  </div>
                ) : null}
              </>
            ) : (
              <p className="rounded-lg border border-black/10 bg-neutral-50 px-3 py-2 text-xs text-neutral-600">
                Kg ve fire bilgileri sadece Bitir adiminda girilir.
              </p>
            )}
          </div>
        ) : null}

        {job.status === "FINISHED" ? (
          <div className="space-y-2 rounded-lg border border-black/10 bg-white p-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
              Depo Cikis Belgesi
            </div>

            {job.outputDispatchDocId && outputDocument ? (
              <div className="rounded-lg border border-emerald-500/30 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
                Belge olustu: <span className="font-mono">{outputDocument.docNo}</span>
              </div>
            ) : (
              <p className="rounded-lg border border-black/10 bg-neutral-50 px-3 py-2 text-xs text-neutral-600">
                Bu is emri icin henuz Depo cikis belgesi olusturulmadi.
              </p>
            )}

            <div className="flex flex-wrap justify-end gap-2">
              {job.outputDispatchDocId ? (
                <Link
                  href={`/boyahane/sevk/${job.outputDispatchDocId}/print`}
                  target="_blank"
                  className="rounded-lg border border-sky-500/30 bg-sky-50 px-3 py-2 text-xs font-semibold text-sky-700 transition hover:bg-sky-100"
                >
                  Belgeyi Yazdir
                </Link>
              ) : canCreateDepotDispatch ? (
                <button
                  type="button"
                  onClick={createDepotDispatch}
                  className="rounded-lg border border-emerald-500/30 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100"
                >
                  Depoya Cikis Belgesi Olustur
                </button>
              ) : null}
            </div>
          </div>
        ) : null}

        {success ? <p className="text-xs font-medium text-emerald-700">{success}</p> : null}
        {error ? <p className="text-xs font-medium text-rose-600">{error}</p> : null}

        <div className="flex flex-wrap justify-end gap-2 pt-1">
          {canDeleteJob ? (
            <button
              type="button"
              onClick={deleteJob}
              className="rounded-lg border border-rose-500/30 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 transition hover:bg-rose-100"
            >
              Is Emrini Sil
            </button>
          ) : null}
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-black/10 bg-white px-3 py-2 text-xs font-semibold text-neutral-700 transition hover:bg-neutral-100"
          >
            Kapat
          </button>
        </div>
      </div>
    </Modal>
  );
}

type ModalProps = {
  title: string;
  children: ReactNode;
  onClose: () => void;
  size?: "md" | "lg" | "xl";
};

function Modal({ title, children, onClose, size = "md" }: ModalProps) {
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const widthClass =
    size === "xl" ? "max-w-5xl" : size === "lg" ? "max-w-2xl" : "max-w-md";

  useModalFocusTrap({ containerRef: dialogRef });

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className={cn(
          "max-h-[88vh] w-full overflow-hidden rounded-2xl border border-black/10 bg-white shadow-2xl",
          widthClass
        )}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="max-h-[88vh] overflow-auto p-5">
          <h3 className="text-lg font-semibold text-neutral-900">{title}</h3>
          <div className="mt-3">{children}</div>
        </div>
      </div>
    </div>
  );
}
