"use client";

import Link from "next/link";
import { type ReactNode, useEffect, useMemo, useState } from "react";
import { ExternalLink, Search } from "lucide-react";
import Layout from "@/components/Layout";
import { cn } from "@/lib/cn";
import type { DepoTransaction, DepoTransactionLine, DepoTransactionType } from "@/lib/domain/depoTransaction";
import { depoLocalRepo } from "@/lib/repos/depoLocalRepo";
import { depoTransactionsLocalRepo } from "@/lib/repos/depoTransactionsLocalRepo";

type TypeFilter = "ALL" | "SHIPMENT" | "RESERVATION" | "CORRECTION";

type TransactionRow = {
  transaction: DepoTransaction;
  lines: DepoTransactionLine[];
  totals: { totalTops: number; totalMetres: number; patternCount: number };
  patternLabels: string[];
};

const transactionTypeLabel: Record<DepoTransactionType, string> = {
  SHIPMENT: "Sevk",
  RESERVATION: "Rezerv",
  REVERSAL: "Iptal/Geri Al",
  ADJUSTMENT: "Duzeltme",
};

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
  const [transactions, setTransactions] = useState<DepoTransaction[]>([]);
  const [lines, setLines] = useState<DepoTransactionLine[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("ALL");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [detailTransactionId, setDetailTransactionId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState("");

  const refreshData = () => {
    setTransactions(depoTransactionsLocalRepo.listTransactions());
    setLines(depoTransactionsLocalRepo.listLines());
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
      transactions.map((transaction) => {
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

  const normalizedQuery = normalizeSearchToken(searchQuery);
  const fromBoundary = parseBoundary(dateFrom, false);
  const toBoundary = parseBoundary(dateTo, true);

  const filteredRows = useMemo(() => {
    return allRows
      .filter((row) => {
        if (typeFilter === "SHIPMENT" && row.transaction.type !== "SHIPMENT") return false;
        if (typeFilter === "RESERVATION" && row.transaction.type !== "RESERVATION") return false;
        if (
          typeFilter === "CORRECTION" &&
          row.transaction.type !== "REVERSAL" &&
          row.transaction.type !== "ADJUSTMENT"
        ) {
          return false;
        }

        const txTimestamp = toTimestamp(row.transaction.createdAt);
        if (fromBoundary !== undefined && txTimestamp < fromBoundary) return false;
        if (toBoundary !== undefined && txTimestamp > toBoundary) return false;

        if (!normalizedQuery) return true;

        const idToken = normalizedQuery.replace(/\s+/g, "");
        if (row.transaction.id.toLocaleLowerCase("tr-TR").includes(idToken)) return true;

        if (normalizeSearchToken(row.transaction.customerNameSnapshot ?? "").includes(normalizedQuery)) return true;

        const matchesLine = row.lines.some((line) => {
          return (
            normalizeSearchToken(line.patternNoSnapshot).includes(normalizedQuery) ||
            normalizeSearchToken(line.patternNameSnapshot).includes(normalizedQuery) ||
            normalizeSearchToken(line.color).includes(normalizedQuery)
          );
        });

        return matchesLine;
      })
      .sort((a, b) => toTimestamp(b.transaction.createdAt) - toTimestamp(a.transaction.createdAt));
  }, [allRows, typeFilter, fromBoundary, toBoundary, normalizedQuery]);

  const detailRow = useMemo(
    () => allRows.find((row) => row.transaction.id === detailTransactionId) ?? null,
    [allRows, detailTransactionId]
  );

  const handleReverseTransaction = () => {
    if (!detailRow) return;

    const target = detailRow.transaction;
    if (target.status === "REVERSED") return;
    if (target.type !== "SHIPMENT" && target.type !== "RESERVATION") return;

    if (!window.confirm(`${transactionTypeLabel[target.type]} islemini geri almak istiyor musunuz?`)) return;

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
                placeholder="Musteri / Desen / Islem Kodu ara..."
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
              <option value="CORRECTION">Tip: Iptal / Duzeltme</option>
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
                <th className="px-3 py-2 font-semibold">Islem Kodu</th>
                <th className="px-3 py-2 font-semibold">Musteri</th>
                <th className="px-3 py-2 font-semibold">Desen(ler)</th>
                <th className="px-3 py-2 font-semibold">Toplam</th>
                <th className="px-3 py-2 font-semibold">Metre</th>
                <th className="px-3 py-2 font-semibold">Aksiyon</th>
              </tr>
            </thead>
            <tbody className="text-neutral-800">
              {filteredRows.map((row) => {
                const firstPattern = row.patternLabels[0];
                const extraPatternCount = Math.max(0, row.patternLabels.length - 1);
                return (
                  <tr
                    key={row.transaction.id}
                    className={cn(
                      "border-t border-black/5",
                      row.transaction.status === "REVERSED" ? "opacity-60" : ""
                    )}
                  >
                    <td className="px-3 py-2">{formatDateTime(row.transaction.createdAt)}</td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span>{transactionTypeLabel[row.transaction.type]}</span>
                        {row.transaction.status === "REVERSED" ? (
                          <span className="rounded-full border border-rose-500/30 bg-rose-50 px-2 py-0.5 text-[11px] font-semibold text-rose-700">
                            Iptal
                          </span>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-3 py-2 font-mono text-xs">{shortId(row.transaction.id)}</td>
                    <td className="px-3 py-2">{row.transaction.customerNameSnapshot ?? "-"}</td>
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
                    <td className="px-3 py-2">{row.totals.totalTops}</td>
                    <td className="px-3 py-2">{fmt(row.totals.totalMetres)} m</td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setDetailTransactionId(row.transaction.id)}
                          className="rounded border border-black/10 bg-white px-2.5 py-1 text-xs font-semibold text-neutral-700 transition hover:bg-neutral-100"
                        >
                          Detay
                        </button>
                        <Link
                          href={`/depo/islem/${row.transaction.id}/print`}
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
              <div>Tip: {transactionTypeLabel[detailRow.transaction.type]}</div>
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
            {detailRow.transaction.status !== "REVERSED" &&
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
  const widthClass =
    size === "xl" ? "max-w-3xl" : size === "lg" ? "max-w-xl" : "max-w-md";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className={cn("w-full rounded-2xl border border-black/10 bg-white p-5 shadow-2xl", widthClass)}
        onClick={(event) => event.stopPropagation()}
      >
        <h3 className="text-lg font-semibold text-neutral-900">{title}</h3>
        <div className="mt-2">{children}</div>
      </div>
    </div>
  );
}
