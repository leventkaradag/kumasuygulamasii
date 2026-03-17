"use client";

import Link from "next/link";
import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ExternalLink, Search } from "lucide-react";
import { useAuthProfile } from "@/components/AuthProfileProvider";
import Layout from "@/components/Layout";
import { cn } from "@/lib/cn";
import type { DepoTransaction, DepoTransactionLine, DepoTransactionType } from "@/lib/domain/depoTransaction";
import { depoLocalRepo } from "@/lib/repos/depoLocalRepo";
import { depoTransactionsLocalRepo } from "@/lib/repos/depoTransactionsLocalRepo";
import type { WeavingDispatchDocument } from "@/lib/domain/weaving";
import { weavingLocalRepo } from "@/lib/repos/weavingLocalRepo";
import { useModalFocusTrap } from "@/lib/useModalFocusTrap";

type TypeFilter =
  | "ALL"
  | "SHIPMENT"
  | "RESERVATION"
  | "RETURN"
  | "CORRECTION"
  | "WEAVING_DISPATCH";

type TransactionRow = {
  transaction: DepoTransaction;
  lines: DepoTransactionLine[];
  totals: { totalTops: number; totalMetres: number; patternCount: number };
  patternLabels: string[];
};

type DispatchDocumentRow = {
  document: WeavingDispatchDocument;
  patternLabel: string;
  totalRows: number;
};

type ListRow =
  | { kind: "DEPO"; createdAt: string; data: TransactionRow }
  | { kind: "DISPATCH"; createdAt: string; data: DispatchDocumentRow };

const transactionTypeLabelMap: Record<DepoTransactionType, string> = {
  ENTRY: "Depo Giris",
  SHIPMENT: "Sevk",
  RESERVATION: "Rezerv",
  RETURN: "Iade",
  REVERSAL: "Geri Alındı",
  ADJUSTMENT: "Düzeltme",
};

const getTransactionTypeLabel = (type: DepoTransactionType) => transactionTypeLabelMap[type];

const fmt = (n: number) => n.toLocaleString("tr-TR", { maximumFractionDigits: 2 });

const normalizeSearchToken = (value: string) =>
  value.trim().toLocaleLowerCase("tr-TR").replace(/\s+/g, " ");

const parseBoundary = (value: string, endOfDay: boolean) => {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const source = /^\d{4}-\d{2}-\d{2}$/.test(trimmed)
    ? `${trimmed}T${endOfDay ? "23:59:59.999" : "00:00:00.000"}`
    : trimmed;
  const parsed = new Date(source);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed.getTime();
};

const toTimestamp = (value: string) => {
  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
};

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

const shortId = (id: string) => (id.length <= 8 ? id : `${id.slice(0, 8)}...`);

const calculateTotalsFromLines = (lines: DepoTransactionLine[]) => {
  const patternIds = new Set<string>();
  let totalTops = 0;
  let totalMetres = 0;

  lines.forEach((line) => {
    patternIds.add(line.patternId);
    totalTops += line.topCount;
    totalMetres += line.totalMetres;
  });

  return {
    totalTops,
    totalMetres,
    patternCount: patternIds.size,
  };
};

const buildPatternLabels = (lines: DepoTransactionLine[]) => {
  const labels = Array.from(
    new Set(lines.map((line) => `${line.patternNoSnapshot} - ${line.patternNameSnapshot}`))
  );
  return labels.sort((a, b) => a.localeCompare(b, "tr-TR"));
};

export default function SevkRezervBelgeleriPage() {
  const { permissions } = useAuthProfile();
  const [transactions, setTransactions] = useState<DepoTransaction[]>([]);
  const [lines, setLines] = useState<DepoTransactionLine[]>([]);
  const [dispatchDocuments, setDispatchDocuments] = useState<WeavingDispatchDocument[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("ALL");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [detailTransactionId, setDetailTransactionId] = useState<string | null>(null);
  const [detailDispatchDocumentId, setDetailDispatchDocumentId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState("");
  const canReverseTransactions =
    permissions.dispatch.edit ||
    permissions.dispatch.delete ||
    permissions.reservation.edit ||
    permissions.reservation.delete;

  const refreshData = () => {
    setTransactions(depoTransactionsLocalRepo.listTransactions());
    setLines(depoTransactionsLocalRepo.listLines());
    setDispatchDocuments(weavingLocalRepo.listDispatchDocuments());
  };

  useEffect(() => {
    refreshData();
  }, []);

  const linesByTransactionId = useMemo(() => {
    const map = new Map<string, DepoTransactionLine[]>();
    lines.forEach((line) => {
      if (!map.has(line.transactionId)) {
        map.set(line.transactionId, []);
      }
      map.get(line.transactionId)!.push(line);
    });
    return map;
  }, [lines]);

  const allRows = useMemo<TransactionRow[]>(
    () =>
      transactions
        .filter((transaction) => transaction.type !== "ENTRY")
        .map((transaction) => {
        const txLines = linesByTransactionId.get(transaction.id) ?? [];
        const totals = transaction.totals ?? calculateTotalsFromLines(txLines);
        return {
          transaction,
          lines: txLines,
          totals,
          patternLabels: buildPatternLabels(txLines),
        };
      }),
    [transactions, linesByTransactionId]
  );

  const dispatchRows = useMemo<DispatchDocumentRow[]>(
    () =>
      dispatchDocuments.map((document) => ({
        document,
        patternLabel: `${document.patternNoSnapshot} - ${document.patternNameSnapshot}`,
        totalRows: document.variantLines?.length ?? 1,
      })),
    [dispatchDocuments]
  );

  const allListRows = useMemo<ListRow[]>(
    () => [
      ...allRows.map((row) => ({
        kind: "DEPO" as const,
        createdAt: row.transaction.createdAt,
        data: row,
      })),
      ...dispatchRows.map((row) => ({
        kind: "DISPATCH" as const,
        createdAt: row.document.createdAt,
        data: row,
      })),
    ],
    [allRows, dispatchRows]
  );

  const normalizedQuery = normalizeSearchToken(searchQuery);
  const fromBoundary = parseBoundary(dateFrom, false);
  const toBoundary = parseBoundary(dateTo, true);

  const filteredRows = useMemo(() => {
    return allListRows
      .filter((row) => {
        if (typeFilter === "WEAVING_DISPATCH" && row.kind !== "DISPATCH") return false;
        if (row.kind === "DEPO") {
          if (typeFilter === "SHIPMENT" && row.data.transaction.type !== "SHIPMENT") return false;
          if (typeFilter === "RESERVATION" && row.data.transaction.type !== "RESERVATION") return false;
          if (typeFilter === "RETURN" && row.data.transaction.type !== "RETURN") return false;
          if (
            typeFilter === "CORRECTION" &&
            row.data.transaction.type !== "REVERSAL" &&
            row.data.transaction.type !== "ADJUSTMENT"
          ) {
            return false;
          }
        } else if (typeFilter !== "ALL" && typeFilter !== "WEAVING_DISPATCH") {
          return false;
        }

        const txTimestamp = toTimestamp(row.createdAt);
        if (fromBoundary !== undefined && txTimestamp < fromBoundary) return false;
        if (toBoundary !== undefined && txTimestamp > toBoundary) return false;

        if (!normalizedQuery) return true;

        if (row.kind === "DEPO") {
          const idToken = normalizedQuery.replace(/\s+/g, "");
          if (row.data.transaction.id.toLocaleLowerCase("tr-TR").includes(idToken)) return true;

          if (normalizeSearchToken(row.data.transaction.customerNameSnapshot ?? "").includes(normalizedQuery)) {
            return true;
          }

          return row.data.lines.some((line) => {
            return (
              normalizeSearchToken(line.patternNoSnapshot).includes(normalizedQuery) ||
              normalizeSearchToken(line.patternNameSnapshot).includes(normalizedQuery) ||
              normalizeSearchToken(line.color).includes(normalizedQuery)
            );
          });
        }

        const document = row.data.document;
        if (normalizeSearchToken(document.docNo).includes(normalizedQuery)) return true;
        if (normalizeSearchToken(document.destinationNameSnapshot).includes(normalizedQuery)) return true;
        if (normalizeSearchToken(document.patternNoSnapshot).includes(normalizedQuery)) return true;
        if (normalizeSearchToken(document.patternNameSnapshot).includes(normalizedQuery)) return true;
        if (normalizeSearchToken(document.note ?? "").includes(normalizedQuery)) return true;
        return (document.variantLines ?? []).some((line) => {
          return (
            normalizeSearchToken(line.colorNameSnapshot).includes(normalizedQuery) ||
            normalizeSearchToken(line.variantCodeSnapshot ?? "").includes(normalizedQuery)
          );
        });
      })
      .sort((a, b) => toTimestamp(b.createdAt) - toTimestamp(a.createdAt));
  }, [allListRows, typeFilter, fromBoundary, toBoundary, normalizedQuery]);

  const detailRow = useMemo(
    () => allRows.find((row) => row.transaction.id === detailTransactionId) ?? null,
    [allRows, detailTransactionId]
  );

  const detailDispatchDocument = useMemo(
    () => dispatchDocuments.find((document) => document.id === detailDispatchDocumentId) ?? null,
    [dispatchDocuments, detailDispatchDocumentId]
  );

  const handleReverseTransaction = () => {
    if (!canReverseTransactions) return;
    if (!detailRow) return;

    const target = detailRow.transaction;
    if (target.status === "REVERSED") return;
    if (target.type !== "SHIPMENT" && target.type !== "RESERVATION") return;

    if (!window.confirm(`${getTransactionTypeLabel(target.type)} islemini geri almak istiyor musunuz?`)) return;

    try {
      const createdAt = new Date().toISOString();
      const reversalLines: Array<Omit<DepoTransactionLine, "id" | "transactionId">> = [];
      let failedCount = 0;

      detailRow.lines.forEach((line) => {
        const candidateRollIds = [...(line.rollIds ?? [])];
        const successRollIds: string[] = [];

        candidateRollIds.forEach((rollId) => {
          const updated =
            target.type === "SHIPMENT"
              ? depoLocalRepo.returnRoll(rollId, createdAt)
              : depoLocalRepo.unreserveRoll(rollId);

          if (updated) successRollIds.push(rollId);
          else failedCount += 1;
        });

        if (successRollIds.length > 0) {
          reversalLines.push({
            patternId: line.patternId,
            patternNoSnapshot: line.patternNoSnapshot,
            patternNameSnapshot: line.patternNameSnapshot,
            color: line.color,
            metrePerTop: line.metrePerTop,
            topCount: successRollIds.length,
            totalMetres: successRollIds.length * line.metrePerTop,
            rollIds: successRollIds,
          });
        }
      });

      if (reversalLines.length === 0) {
        throw new Error("Geri alinabilecek satir bulunamadi.");
      }

      const reversalTransaction = depoTransactionsLocalRepo.createTransaction({
        type: "REVERSAL",
        createdAt,
        customerId: target.customerId,
        customerNameSnapshot: target.customerNameSnapshot,
        note: `Geri alma: ${target.id}`,
        targetTransactionId: target.id,
        lines: reversalLines,
      });

      depoTransactionsLocalRepo.markTransactionReversed(target.id, reversalTransaction.id, createdAt);
      setFeedback(failedCount > 0 ? `${failedCount} top geri alinamadi.` : "Islem geri alindi.");
      refreshData();
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Geri alma basarisiz");
    }
  };

  return (
    <Layout title="Sevk/Rezerv Belgeleri">
      <div className="flex h-full min-h-0 flex-col gap-4">
        <div className="rounded-xl border border-black/10 bg-white p-4">
          <div className="grid gap-3 lg:grid-cols-[2fr,1fr,1fr,1fr]">
            <label className="relative block">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
              <input
                type="search"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Musteri / Boyahane / Desen / Belge No ara..."
                className="w-full rounded-lg border border-black/10 bg-white px-10 py-2 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-coffee-primary"
              />
            </label>
            <select
              value={typeFilter}
              onChange={(event) => setTypeFilter(event.target.value as TypeFilter)}
              className="rounded-lg border border-black/10 bg-white px-3 py-2 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-coffee-primary"
            >
              <option value="ALL">Tip: Tumu</option>
              <option value="SHIPMENT">Tip: Sevk</option>
              <option value="RESERVATION">Tip: Rezerv</option>
              <option value="RETURN">Tip: Iade</option>
              <option value="CORRECTION">Tip: İptal / Düzeltme</option>
              <option value="WEAVING_DISPATCH">Tip: Dokuma/Boyahane Sevk Belgeleri</option>
            </select>
            <input
              type="date"
              value={dateFrom}
              onChange={(event) => setDateFrom(event.target.value)}
              className="rounded-lg border border-black/10 bg-white px-3 py-2 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-coffee-primary"
            />
            <input
              type="date"
              value={dateTo}
              onChange={(event) => setDateTo(event.target.value)}
              className="rounded-lg border border-black/10 bg-white px-3 py-2 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-coffee-primary"
            />
          </div>
        </div>

        {feedback ? (
          <p className="rounded-lg border border-black/10 bg-white px-3 py-2 text-sm font-medium text-neutral-700">
            {feedback}
          </p>
        ) : null}

        <div className="min-h-0 flex-1 overflow-auto rounded-xl border border-black/10 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 bg-neutral-50 text-neutral-600">
              <tr>
                <th className="px-3 py-2 font-semibold">Tarih</th>
                <th className="px-3 py-2 font-semibold">Tip</th>
                <th className="px-3 py-2 font-semibold">Belge / Islem Kodu</th>
                <th className="px-3 py-2 font-semibold">Hedef / Musteri</th>
                <th className="px-3 py-2 font-semibold">Desen(ler)</th>
                <th className="px-3 py-2 font-semibold">Toplam Satir/Top</th>
                <th className="px-3 py-2 font-semibold">Metre</th>
                <th className="px-3 py-2 font-semibold">Aksiyon</th>
              </tr>
            </thead>
            <tbody className="text-neutral-800">
              {filteredRows.map((row) => {
                if (row.kind === "DEPO") {
                  const txRow = row.data;
                  const firstPattern = txRow.patternLabels[0];
                  const extraPatternCount = Math.max(0, txRow.patternLabels.length - 1);
                  return (
                    <tr
                      key={txRow.transaction.id}
                      className={cn(
                        "border-t border-black/5",
                        txRow.transaction.status === "REVERSED" ? "opacity-60" : ""
                      )}
                    >
                      <td className="px-3 py-2">{formatDateTime(txRow.transaction.createdAt)}</td>
                      <td className="px-3 py-2">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span>{getTransactionTypeLabel(txRow.transaction.type)}</span>
                          {txRow.transaction.status === "REVERSED" ? (
                            <span className="rounded-full border border-rose-500/30 bg-rose-50 px-2 py-0.5 text-[11px] font-semibold text-rose-700">
                              Iptal
                            </span>
                          ) : null}
                        </div>
                      </td>
                      <td className="px-3 py-2 font-mono text-xs">{shortId(txRow.transaction.id)}</td>
                      <td className="px-3 py-2">{txRow.transaction.customerNameSnapshot ?? "-"}</td>
                      <td className="px-3 py-2">
                        {firstPattern ? (
                          <span>
                            {firstPattern}
                            {extraPatternCount > 0 ? ` +${extraPatternCount}` : ""}
                          </span>
                        ) : (
                          "-"
                        )}
                      </td>
                      <td className="px-3 py-2">{txRow.totals.totalTops}</td>
                      <td className="px-3 py-2">{fmt(txRow.totals.totalMetres)} m</td>
                      <td className="px-3 py-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setDetailDispatchDocumentId(null);
                              setDetailTransactionId(txRow.transaction.id);
                            }}
                            className="rounded border border-black/10 bg-white px-2.5 py-1 text-xs font-semibold text-neutral-700 transition hover:bg-neutral-100"
                          >
                            Detay
                          </button>
                          <Link
                            href={`/depo/islem/${txRow.transaction.id}/print`}
                            target="_blank"
                            className="inline-flex items-center gap-1 rounded border border-sky-500/30 bg-sky-50 px-2.5 py-1 text-xs font-semibold text-sky-700 transition hover:bg-sky-100"
                          >
                            Yazdir
                            <ExternalLink className="h-3.5 w-3.5" />
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                }

                const dispatchRow = row.data;
                return (
                  <tr key={dispatchRow.document.id} className="border-t border-black/5">
                    <td className="px-3 py-2">{formatDateTime(dispatchRow.document.createdAt)}</td>
                    <td className="px-3 py-2">
                      <span className="inline-flex rounded-full border border-sky-500/30 bg-sky-50 px-2 py-0.5 text-[11px] font-semibold text-sky-700">
                        {dispatchRow.document.type === "BOYAHANE_TO_DEPO"
                          ? "Boyahane -> Depo Belgesi"
                          : "Dokuma Sevk Belgesi"}
                      </span>
                    </td>
                    <td className="px-3 py-2 font-mono text-xs">{dispatchRow.document.docNo}</td>
                    <td className="px-3 py-2">
                      {dispatchRow.document.destination === "BOYAHANE"
                        ? `Boyahane: ${dispatchRow.document.destinationNameSnapshot}`
                        : `Depo: ${dispatchRow.document.destinationNameSnapshot}`}
                    </td>
                    <td className="px-3 py-2">{dispatchRow.patternLabel}</td>
                    <td className="px-3 py-2">{dispatchRow.totalRows}</td>
                    <td className="px-3 py-2">{fmt(dispatchRow.document.metersTotal)} m</td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setDetailTransactionId(null);
                            setDetailDispatchDocumentId(dispatchRow.document.id);
                          }}
                          className="rounded border border-black/10 bg-white px-2.5 py-1 text-xs font-semibold text-neutral-700 transition hover:bg-neutral-100"
                        >
                          Detay
                        </button>
                        <Link
                          href={`/sevk/${dispatchRow.document.id}/print`}
                          target="_blank"
                          className="inline-flex items-center gap-1 rounded border border-sky-500/30 bg-sky-50 px-2.5 py-1 text-xs font-semibold text-sky-700 transition hover:bg-sky-100"
                        >
                          Yazdir
                          <ExternalLink className="h-3.5 w-3.5" />
                        </Link>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-3 py-8 text-center text-sm text-neutral-500">
                    Filtreye uygun belge bulunamadi.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      {detailRow ? (
        <Modal title="Islem Detayi" onClose={() => setDetailTransactionId(null)} size="xl">
          <div className="space-y-3 text-sm">
            <div className="rounded-lg border border-black/10 bg-neutral-50 px-3 py-2 text-neutral-700">
              <div>Islem Kodu: {detailRow.transaction.id}</div>
              <div>Tarih: {formatDateTime(detailRow.transaction.createdAt)}</div>
              <div>Tip: {getTransactionTypeLabel(detailRow.transaction.type)}</div>
              <div>Musteri: {detailRow.transaction.customerNameSnapshot ?? "-"}</div>
              <div>Durum: {detailRow.transaction.status === "REVERSED" ? "Iptal" : "Aktif"}</div>
            </div>

            <div className="overflow-auto rounded-lg border border-black/10 bg-white">
              <table className="w-full text-left text-xs">
                <thead className="bg-neutral-50 text-neutral-600">
                  <tr>
                    <th className="px-2 py-1.5 font-semibold">Desen No - Adi</th>
                    <th className="px-2 py-1.5 font-semibold">Renk</th>
                    <th className="px-2 py-1.5 font-semibold">Top</th>
                    <th className="px-2 py-1.5 font-semibold">Metre</th>
                  </tr>
                </thead>
                <tbody className="text-neutral-700">
                  {detailRow.lines.map((line) => (
                    <tr key={line.id} className="border-t border-black/5">
                      <td className="px-2 py-1.5">{line.patternNoSnapshot} - {line.patternNameSnapshot}</td>
                      <td className="px-2 py-1.5">{line.color}</td>
                      <td className="px-2 py-1.5">{line.topCount}</td>
                      <td className="px-2 py-1.5">{fmt(line.totalMetres)} m</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="rounded-lg border border-black/10 bg-neutral-50 px-3 py-2 text-sm font-semibold text-neutral-900">
              Genel Toplam: {detailRow.totals.totalTops} top / {fmt(detailRow.totals.totalMetres)} m
            </div>
          </div>

          <div className="mt-4 flex flex-wrap justify-end gap-2">
            <Link
              href={`/depo/islem/${detailRow.transaction.id}/print`}
              target="_blank"
              className="inline-flex items-center gap-1 rounded-lg border border-sky-500/30 bg-sky-50 px-3 py-2 text-sm font-semibold text-sky-700 transition hover:bg-sky-100"
            >
              Yazdir
              <ExternalLink className="h-4 w-4" />
            </Link>
            {canReverseTransactions &&
            detailRow.transaction.status !== "REVERSED" &&
            (detailRow.transaction.type === "SHIPMENT" || detailRow.transaction.type === "RESERVATION") ? (
              <button
                type="button"
                onClick={handleReverseTransaction}
                className="rounded-lg border border-rose-500/40 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-100"
              >
                Iptal Et / Geri Al
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => setDetailTransactionId(null)}
              className="rounded-lg border border-black/10 bg-white px-3 py-2 text-sm font-semibold text-neutral-700 transition hover:bg-neutral-100"
            >
              Kapat
            </button>
          </div>
        </Modal>
      ) : null}

      {detailDispatchDocument ? (
        <Modal
          title={
            detailDispatchDocument.type === "BOYAHANE_TO_DEPO"
              ? "Boyahane -> Depo Cikis Belgesi"
              : "Dokuma Sevk Belgesi"
          }
          onClose={() => setDetailDispatchDocumentId(null)}
          size="xl"
        >
          <div className="space-y-3 text-sm">
            <div className="rounded-lg border border-black/10 bg-neutral-50 px-3 py-2 text-neutral-700">
              <div>Belge No: {detailDispatchDocument.docNo}</div>
              <div>Tarih: {formatDateTime(detailDispatchDocument.createdAt)}</div>
              <div>
                Hedef:{" "}
                {detailDispatchDocument.destination === "BOYAHANE"
                  ? `Boyahane - ${detailDispatchDocument.destinationNameSnapshot}`
                  : `Depo - ${detailDispatchDocument.destinationNameSnapshot}`}
              </div>
              <div>
                Desen: {detailDispatchDocument.patternNoSnapshot} - {detailDispatchDocument.patternNameSnapshot}
              </div>
            </div>

            <div className="overflow-auto rounded-lg border border-black/10 bg-white">
              <table className="w-full text-left text-xs">
                <thead className="bg-neutral-50 text-neutral-600">
                  <tr>
                    <th className="px-2 py-1.5 font-semibold">Desen</th>
                    <th className="px-2 py-1.5 font-semibold">Varyant Kodu</th>
                    <th className="px-2 py-1.5 font-semibold">Renk</th>
                    <th className="px-2 py-1.5 font-semibold">Metre</th>
                  </tr>
                </thead>
                <tbody className="text-neutral-700">
                  {(detailDispatchDocument.variantLines && detailDispatchDocument.variantLines.length > 0
                    ? detailDispatchDocument.variantLines
                    : [
                        {
                          variantCodeSnapshot: "-",
                          colorNameSnapshot: "-",
                          meters: detailDispatchDocument.metersTotal,
                        },
                      ]
                  ).map((line, index) => (
                    <tr key={`${detailDispatchDocument.id}-${index}`} className="border-t border-black/5">
                      <td className="px-2 py-1.5">
                        {detailDispatchDocument.patternNoSnapshot} - {detailDispatchDocument.patternNameSnapshot}
                      </td>
                      <td className="px-2 py-1.5">{line.variantCodeSnapshot?.trim() || "-"}</td>
                      <td className="px-2 py-1.5">{line.colorNameSnapshot}</td>
                      <td className="px-2 py-1.5">{fmt(line.meters)} m</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="rounded-lg border border-black/10 bg-neutral-50 px-3 py-2 text-sm font-semibold text-neutral-900">
              Genel Toplam: {fmt(detailDispatchDocument.metersTotal)} m
            </div>
            {detailDispatchDocument.note ? (
              <div className="rounded-lg border border-black/10 bg-white px-3 py-2 text-sm text-neutral-700">
                Not: {detailDispatchDocument.note}
              </div>
            ) : null}
          </div>

          <div className="mt-4 flex flex-wrap justify-end gap-2">
            <Link
              href={`/sevk/${detailDispatchDocument.id}/print`}
              target="_blank"
              className="inline-flex items-center gap-1 rounded-lg border border-sky-500/30 bg-sky-50 px-3 py-2 text-sm font-semibold text-sky-700 transition hover:bg-sky-100"
            >
              Yazdir
              <ExternalLink className="h-4 w-4" />
            </Link>
            <button
              type="button"
              onClick={() => setDetailDispatchDocumentId(null)}
              className="rounded-lg border border-black/10 bg-white px-3 py-2 text-sm font-semibold text-neutral-700 transition hover:bg-neutral-100"
            >
              Kapat
            </button>
          </div>
        </Modal>
      ) : null}
    </Layout>
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
    size === "xl" ? "max-w-3xl" : size === "lg" ? "max-w-xl" : "max-w-md";

  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [mounted]);

  useModalFocusTrap({ enabled: mounted, containerRef: dialogRef });

  if (!mounted) return null;

  return createPortal(
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
          "w-full max-h-[85vh] overflow-hidden rounded-2xl border border-black/10 bg-white shadow-2xl",
          widthClass
        )}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="max-h-[85vh] overflow-y-auto p-5">
          <h3 className="text-lg font-semibold text-neutral-900">{title}</h3>
          <div className="mt-2">{children}</div>
        </div>
      </div>
    </div>,
    document.body
  );
}
