"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";

import { useAuthProfile } from "@/components/AuthProfileProvider";
import Layout from "../components/Layout";
import { cn } from "@/lib/cn";
import type { Dyehouse, DyehouseJob, DyehouseJobStatus, DyehouseLine } from "@/lib/domain/dyehouse";
import type { WeavingDispatchDocument } from "@/lib/domain/weaving";
import { dyehouseLocalRepo } from "@/lib/repos/dyehouseLocalRepo";
import { weavingLocalRepo } from "@/lib/repos/weavingLocalRepo";

type ViewMode = "MIX" | "BY_DYEHOUSE";
type JobTab = "RECEIVED" | "IN_PROCESS" | "FINISHED";

type LineDraft = {
  id: string;
  colorName: string;
  variantCode: string;
  metersPlanned: string;
  inputKg: string;
  outputKg: string;
  wasteKg: string;
  notes: string;
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

const createLineDraft = (line?: DyehouseLine): LineDraft => ({
  id: line?.id ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`,
  colorName: line?.colorName ?? "",
  variantCode: line?.variantCode ?? "",
  metersPlanned:
    typeof line?.metersPlanned === "number" && Number.isFinite(line.metersPlanned)
      ? String(line.metersPlanned)
      : "",
  inputKg:
    typeof line?.inputKg === "number" && Number.isFinite(line.inputKg)
      ? String(line.inputKg)
      : "",
  outputKg:
    typeof line?.outputKg === "number" && Number.isFinite(line.outputKg)
      ? String(line.outputKg)
      : "",
  wasteKg:
    typeof line?.wasteKg === "number" && Number.isFinite(line.wasteKg)
      ? String(line.wasteKg)
      : "",
  notes: line?.notes ?? "",
});

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

export default function Boyahane() {
  const { permissions } = useAuthProfile();
  const [dyehouses, setDyehouses] = useState<Dyehouse[]>([]);
  const [jobs, setJobs] = useState<DyehouseJob[]>([]);
  const [dispatchDocuments, setDispatchDocuments] = useState<WeavingDispatchDocument[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>("MIX");
  const [dyehouseFilter, setDyehouseFilter] = useState("ALL");
  const [query, setQuery] = useState("");
  const [jobTab, setJobTab] = useState<JobTab>("RECEIVED");
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState("");
  const canCreateJobs = permissions.dyehouse.create;

  const refreshData = () => {
    setDyehouses(dyehouseLocalRepo.list());
    setJobs(dyehouseLocalRepo.listJobs());
    setDispatchDocuments(weavingLocalRepo.listDispatchDocuments());
  };

  useEffect(() => {
    refreshData();
  }, []);

  useEffect(() => {
    if (viewMode !== "BY_DYEHOUSE") return;

    if (dyehouses.length === 0) {
      setDyehouseFilter("ALL");
      return;
    }

    if (dyehouseFilter === "ALL") {
      setDyehouseFilter(dyehouses[0].id);
      return;
    }

    if (!dyehouses.some((dyehouse) => dyehouse.id === dyehouseFilter)) {
      setDyehouseFilter(dyehouses[0].id);
    }
  }, [viewMode, dyehouses, dyehouseFilter]);

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

  const inScope = (dyehouseId?: string | null) => {
    if (viewMode === "MIX") {
      if (dyehouseFilter === "ALL") return true;
      return dyehouseId === dyehouseFilter;
    }
    if (dyehouses.length === 0) return true;
    return dyehouseId === dyehouseFilter;
  };

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
    [incomingDispatchDocs, jobsByDispatchDocId, normalizedQuery, dyehouseFilter, viewMode, dyehouses]
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
    [jobs, jobTab, normalizedQuery, dyehouseFilter, viewMode, dyehouses]
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
              value={dyehouseFilter}
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
                  <th className="px-3 py-2 font-semibold">Dagitim (m)</th>
                  <th className="px-3 py-2 font-semibold">Durum</th>
                  <th className="px-3 py-2 font-semibold">Aksiyon</th>
                </tr>
              </thead>
              <tbody className="text-neutral-800">
                {filteredJobs.map((job) => (
                  <tr key={job.id} className="border-t border-black/5">
                    <td className="px-3 py-2">{formatDateTime(job.receivedAt)}</td>
                    <td className="px-3 py-2">{job.dyehouseNameSnapshot}</td>
                    <td className="px-3 py-2">
                      {job.patternCodeSnapshot} - {job.patternNameSnapshot}
                    </td>
                    <td className="px-3 py-2">{fmt(job.inputMetersTotal)}</td>
                    <td className="px-3 py-2">{fmt(sumMeters(job.lines))}</td>
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
                ))}
                {filteredJobs.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-3 py-8 text-center text-sm text-neutral-500">
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
          sourceDispatch={selectedSourceDispatch}
          onClose={() => setSelectedJobId(null)}
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
  sourceDispatch: WeavingDispatchDocument | null;
  onClose: () => void;
  onSaved: (jobId?: string) => void;
};
function JobModal({ job, sourceDispatch, onClose, onSaved }: JobModalProps) {
  const { permissions } = useAuthProfile();
  const [lineDrafts, setLineDrafts] = useState<LineDraft[]>([]);
  const [jobNotes, setJobNotes] = useState("");
  const [isFinishing, setIsFinishing] = useState(false);
  const [allowFinishedEdit, setAllowFinishedEdit] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const canEditBreakdown = permissions.dyehouse.edit;
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

      return {
        id: row.id,
        colorName,
        variantCode: row.variantCode.trim() || undefined,
        metersPlanned: parsePositive(row.metersPlanned, `${colorName} metre`),
        inputKg: parseOptionalNonNegative(row.inputKg, `${colorName} giris kg`),
        outputKg: parseOptionalNonNegative(row.outputKg, `${colorName} cikis kg`),
        wasteKg: parseOptionalNonNegative(row.wasteKg, `${colorName} fire kg`),
        notes: row.notes.trim() || undefined,
      } satisfies DyehouseLine;
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
      const inputKg = parseNonNegative(row.inputKg, `${line.colorName} giris kg`);
      const outputKg = parseNonNegative(row.outputKg, `${line.colorName} cikis kg`);
      const wasteKg = row.wasteKg.trim()
        ? parseNonNegative(row.wasteKg, `${line.colorName} fire kg`)
        : Math.max(0, inputKg - outputKg);
      return {
        ...line,
        inputKg,
        outputKg,
        wasteKg,
        notes: row.notes.trim() || undefined,
      };
    });
  };

  const plannedMetersFromDraft = useMemo(() => {
    return lineDrafts.reduce((sum, row) => {
      const parsed = Number(row.metersPlanned.trim().replace(",", "."));
      if (!Number.isFinite(parsed) || parsed <= 0) return sum;
      return sum + parsed;
    }, 0);
  }, [lineDrafts]);

  const updateLine = (id: string, key: keyof LineDraft, value: string) => {
    setLineDrafts((prev) => prev.map((row) => (row.id === id ? { ...row, [key]: value } : row)));
  };

  const addRow = () => {
    setLineDrafts((prev) => [...prev, createLineDraft()]);
  };

  const removeRow = (id: string) => {
    setLineDrafts((prev) => prev.filter((row) => row.id !== id));
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
          <div>Dagitim Toplami: {fmt(plannedMetersFromDraft)} m</div>
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
                        value={row.metersPlanned}
                        disabled={!rowsEditable}
                        onChange={(event) => updateLine(row.id, "metersPlanned", event.target.value)}
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
                Dagitimi Kaydet
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
                      {lineDrafts.map((row) => (
                        <tr key={`${row.id}-finish`} className="border-t border-black/5">
                          <td className="px-2 py-1.5">{row.colorName || "-"}</td>
                          <td className="px-2 py-1.5">
                            {row.metersPlanned ? fmt(Number(row.metersPlanned) || 0) : "-"}
                          </td>
                          <td className="px-2 py-1.5">
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={row.inputKg}
                              disabled={!finishEditable}
                              onChange={(event) => updateLine(row.id, "inputKg", event.target.value)}
                              className="w-full rounded border border-black/10 bg-white px-2 py-1 text-xs text-neutral-900 focus:outline-none focus:ring-2 focus:ring-coffee-primary disabled:cursor-not-allowed disabled:bg-neutral-100"
                            />
                          </td>
                          <td className="px-2 py-1.5">
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={row.outputKg}
                              disabled={!finishEditable}
                              onChange={(event) => updateLine(row.id, "outputKg", event.target.value)}
                              className="w-full rounded border border-black/10 bg-white px-2 py-1 text-xs text-neutral-900 focus:outline-none focus:ring-2 focus:ring-coffee-primary disabled:cursor-not-allowed disabled:bg-neutral-100"
                            />
                          </td>
                          <td className="px-2 py-1.5">
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={row.wasteKg}
                              disabled={!finishEditable}
                              onChange={(event) => updateLine(row.id, "wasteKg", event.target.value)}
                              className="w-full rounded border border-black/10 bg-white px-2 py-1 text-xs text-neutral-900 focus:outline-none focus:ring-2 focus:ring-coffee-primary disabled:cursor-not-allowed disabled:bg-neutral-100"
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
                      ))}
                    </tbody>
                  </table>
                </div>

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
                Kg ve fire bilgileri sadece "Bitir" adiminda girilir.
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
                  Depo'ya Cikis Belgesi Olustur
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
  const widthClass =
    size === "xl" ? "max-w-5xl" : size === "lg" ? "max-w-2xl" : "max-w-md";

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
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
