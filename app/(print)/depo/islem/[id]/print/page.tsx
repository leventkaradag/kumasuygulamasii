"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useMemo } from "react";
import type { DepoTransaction, DepoTransactionLine } from "@/lib/domain/depoTransaction";
import { depoTransactionsLocalRepo } from "@/lib/repos/depoTransactionsLocalRepo";

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

export default function DepoTransactionPrintPage() {
  const params = useParams<{ id: string }>();
  const id = Array.isArray(params?.id) ? params.id[0] : params?.id;

  const bundle = useMemo(
    () => (id ? depoTransactionsLocalRepo.getTransactionWithLines(id) : undefined),
    [id]
  );

  const transaction = useMemo<DepoTransaction | null>(
    () => bundle?.transaction ?? null,
    [bundle]
  );
  const lines = useMemo<DepoTransactionLine[]>(
    () => bundle?.lines ?? [],
    [bundle]
  );

  const groupedByPattern = useMemo(() => {
    const groups = new Map<
      string,
      {
        key: string;
        patternNoSnapshot: string;
        patternNameSnapshot: string;
        lines: DepoTransactionLine[];
        totalTop: number;
        totalMetre: number;
      }
    >();

    lines.forEach((line) => {
      const key = `${line.patternId}|${line.patternNoSnapshot}`;
      if (!groups.has(key)) {
        groups.set(key, {
          key,
          patternNoSnapshot: line.patternNoSnapshot,
          patternNameSnapshot: line.patternNameSnapshot,
          lines: [],
          totalTop: 0,
          totalMetre: 0,
        });
      }

      const group = groups.get(key)!;
      group.lines.push(line);
      group.totalTop += line.topCount;
      group.totalMetre += line.totalMetres;
    });

    return Array.from(groups.values()).sort((a, b) =>
      a.patternNoSnapshot.localeCompare(b.patternNoSnapshot, "tr-TR")
    );
  }, [lines]);

  const totals = useMemo(() => {
    if (!transaction) {
      return {
        totalTops: 0,
        totalMetres: 0,
      };
    }

    if (transaction.totals) {
      return {
        totalTops: transaction.totals.totalTops,
        totalMetres: transaction.totals.totalMetres,
      };
    }

    return lines.reduce(
      (acc, line) => {
        acc.totalTops += line.topCount;
        acc.totalMetres += line.totalMetres;
        return acc;
      },
      { totalTops: 0, totalMetres: 0 }
    );
  }, [transaction, lines]);

  return (
    <div className="min-h-screen bg-neutral-100 p-4 print:bg-white print:p-0">
      <div className="print-actions mx-auto mb-4 flex w-full max-w-4xl items-center justify-between gap-2">
        <Link
          href="/depo"
          className="rounded-lg border border-black/10 bg-white px-3 py-2 text-sm font-semibold text-neutral-700"
        >
          Depo&apos;ya Don
        </Link>
        <button
          type="button"
          onClick={() => window.print()}
          className="rounded-lg bg-coffee-primary px-4 py-2 text-sm font-semibold text-white"
        >
          Yazdir
        </button>
      </div>

      <article className="print-sheet mx-auto w-full max-w-4xl rounded-xl border border-black/10 bg-white p-6 shadow-sm print:max-w-none print:rounded-none print:border-0 print:p-0 print:shadow-none">
        {!transaction ? (
          <div className="rounded-lg border border-dashed border-black/20 p-8 text-center text-sm text-neutral-500">
            Islem kaydi bulunamadi.
          </div>
        ) : (
          <div className="space-y-5">
            <header className="border-b border-black/10 pb-4">
              <h1 className="text-2xl font-bold text-neutral-900">
                {transaction.type === "SHIPMENT" ? "Sevk Fisi" : transaction.type === "RESERVATION" ? "Rezerv Fisi" : "Depo Islem Fisi"}
              </h1>
              <div className="mt-2 space-y-1 text-sm text-neutral-700">
                <div>Islem No: {transaction.id}</div>
                <div>Tarih: {formatDateTime(transaction.createdAt)}</div>
                <div>Musteri: {transaction.customerNameSnapshot ?? "-"}</div>
                <div>Durum: {transaction.status === "REVERSED" ? "Iptal Edildi" : "Aktif"}</div>
              </div>
            </header>

            <section className="space-y-4">
              {groupedByPattern.map((group) => (
                <div key={group.key} className="pattern-block rounded-lg border border-black/10 p-3">
                  <h2 className="text-base font-semibold text-neutral-900">
                    {group.patternNoSnapshot} - {group.patternNameSnapshot}
                  </h2>
                  <div className="mt-2 space-y-1 text-sm text-neutral-700">
                    {group.lines.map((line) => (
                      <div key={line.id}>
                        Renk: {line.color} - {line.topCount} top / {fmt(line.totalMetres)} m
                      </div>
                    ))}
                  </div>
                  <div className="mt-2 text-sm font-semibold text-neutral-900">
                    Blok Toplam: {group.totalTop} top / {fmt(group.totalMetre)} m
                  </div>
                </div>
              ))}
            </section>

            <footer className="border-t border-black/10 pt-3 text-sm font-semibold text-neutral-900">
              Genel Toplam: {totals.totalTops} top / {fmt(totals.totalMetres)} m
            </footer>
          </div>
        )}
      </article>

      <style jsx global>{`
        @media print {
          @page {
            size: A4;
            margin: 12mm;
          }

          .print-actions {
            display: none !important;
          }

          .pattern-block {
            break-inside: avoid;
            page-break-inside: avoid;
          }
        }
      `}</style>
    </div>
  );
}
