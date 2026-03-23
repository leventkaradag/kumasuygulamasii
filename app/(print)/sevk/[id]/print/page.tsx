"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useMemo, useEffect, useState } from "react";
import type { WeavingDispatchDocumentVariantLine, WeavingDispatchDocument } from "@/lib/domain/weaving";
import { weavingSupabaseRepo } from "@/lib/repos/weavingSupabaseRepo";

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

export default function DispatchPrintPage() {
  const params = useParams<{ id: string }>();
  const id = Array.isArray(params?.id) ? params.id[0] : params?.id;

  const [document, setDocument] = useState<WeavingDispatchDocument | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) {
      setIsLoading(false);
      return;
    }
    weavingSupabaseRepo
      .getDispatchDocument(id)
      .then(setDocument)
      .catch((err) => setError(err.message))
      .finally(() => setIsLoading(false));
  }, [id]);

  const lines = useMemo<WeavingDispatchDocumentVariantLine[]>(() => {
    if (!document) return [];
    if (document.variantLines && document.variantLines.length > 0) {
      return document.variantLines;
    }
    return [
      {
        variantCodeSnapshot: "-",
        colorNameSnapshot: "-",
        meters: document.metersTotal,
      },
    ];
  }, [document]);

  const heading =
    document?.type === "BOYAHANE_TO_DEPO"
      ? "Boyahane -> Depo Cikis Belgesi"
      : document?.destination === "BOYAHANE"
        ? "Boyahane Sevk Irsaliyesi"
        : "Depo Sevk Irsaliyesi";

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-neutral-100 p-8 text-sm text-neutral-500">
        Belge yukleniyor...
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-neutral-100 p-8">
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-700">
          Hata: {error}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-100 p-4 print:bg-white print:p-0">
      <div className="print-actions mx-auto mb-4 flex w-full max-w-4xl items-center justify-between gap-2">
        <Link
          href="/sevk-rezerv"
          className="rounded-lg border border-black/10 bg-white px-3 py-2 text-sm font-semibold text-neutral-700"
        >
          Sevk/Rezerv&apos;e Don
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
        {!document ? (
          <div className="rounded-lg border border-dashed border-black/20 p-8 text-center text-sm text-neutral-500">
            Sevk belgesi bulunamadi.
          </div>
        ) : (
          <div className="space-y-5">
            <header className="border-b border-black/10 pb-4">
              <h1 className="text-2xl font-bold text-neutral-900">{heading}</h1>
              <div className="mt-3 space-y-1 text-sm text-neutral-700">
                <div>
                  <span className="inline-block w-28 font-semibold text-neutral-600">Belge No:</span>
                  <span className="font-mono text-xs text-neutral-800">{document.docNo}</span>
                </div>
                <div>
                  <span className="inline-block w-28 font-semibold text-neutral-600">Tarih:</span>
                  <span>{formatDateTime(document.createdAt)}</span>
                </div>
                <div>
                  <span className="inline-block w-28 font-semibold text-neutral-600">Hedef:</span>
                  <span>
                    {document.destination === "BOYAHANE" ? "Boyahane" : "Depo"} -{" "}
                    {document.destinationNameSnapshot}
                  </span>
                </div>
              </div>
            </header>

            <section className="overflow-auto rounded-lg border border-black/10 bg-white">
              <table className="w-full text-left text-sm">
                <thead className="bg-neutral-50 text-neutral-600">
                  <tr>
                    <th className="px-3 py-2 font-semibold">Desen</th>
                    <th className="px-3 py-2 font-semibold">Varyant Kodu</th>
                    <th className="px-3 py-2 font-semibold">Renk</th>
                    <th className="px-3 py-2 font-semibold">Metre</th>
                  </tr>
                </thead>
                <tbody className="text-neutral-800">
                  {lines.map((line, index) => (
                    <tr key={`${document.id}-${index}`} className="border-t border-black/5">
                      <td className="px-3 py-2">
                        {document.patternNoSnapshot} - {document.patternNameSnapshot}
                      </td>
                      <td className="px-3 py-2">{line.variantCodeSnapshot?.trim() || "-"}</td>
                      <td className="px-3 py-2">{line.colorNameSnapshot}</td>
                      <td className="px-3 py-2">{fmt(line.meters)} m</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>

            <footer className="space-y-2 border-t border-black/10 pt-3 text-sm font-semibold text-neutral-900">
              <div>Alt Toplam: {fmt(document.metersTotal)} m</div>
              {document.note ? <div className="font-normal text-neutral-700">Not: {document.note}</div> : null}
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

          .print-sheet {
            display: block !important;
          }
        }
      `}</style>
    </div>
  );
}
