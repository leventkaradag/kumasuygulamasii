"use client";

import { printHtmlInHiddenFrame } from "@/lib/dyehouseOrderPrint";

export type CustomerOrderPrintRow = {
  sequence: number;
  colorName: string;
  colorCode?: string;
  variantDescription?: string;
  topCount?: number;
  meters?: number;
  status?: string;
  note?: string;
};

export type CustomerOrderPrintBlock = {
  sequence: number;
  patternCode?: string;
  patternName?: string;
  rows: CustomerOrderPrintRow[];
};

export type CustomerOrderPrintPayload = {
  customerName: string;
  orderDate: string;
  orderTitle?: string;
  generalNote?: string;
  patternBlocks: CustomerOrderPrintBlock[];
  companyTitle?: string;
};

const fmt = (value: number) => value.toLocaleString("tr-TR", { maximumFractionDigits: 2 });

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

export const buildCustomerOrderPrintHtml = (payload: CustomerOrderPrintPayload) => {
  const companyTitle = escapeHtml(payload.companyTitle?.trim() || "KUMASCI TEKSTIL");
  const customerName = escapeHtml(payload.customerName.trim() || "Musteri");
  const orderTitle = escapeHtml(payload.orderTitle?.trim() || "Musteri Siparisi");
  const orderDate = escapeHtml(payload.orderDate);

  const blockHtml = payload.patternBlocks
    .map((block) => {
      const blockTitle = [block.patternCode, block.patternName].filter(Boolean).join(" / ");
      const rowHtml = block.rows
        .map(
          (row) => `
            <tr>
              <td>${row.sequence}</td>
              <td>${escapeHtml(row.colorName)}</td>
              <td>${escapeHtml(row.colorCode || "-")}</td>
              <td>${escapeHtml(row.variantDescription || "-")}</td>
              <td>${row.topCount ?? "-"}</td>
              <td>${row.meters ? fmt(row.meters) : "-"}</td>
              <td>${escapeHtml(row.status || "-")}</td>
              <td>${escapeHtml(row.note || "-")}</td>
            </tr>
          `
        )
        .join("");

      return `
        <section class="pattern-block">
          <div class="pattern-header">
            <div class="pattern-kicker">Desen ${block.sequence}</div>
            <div class="pattern-title">${escapeHtml(blockTitle || `Desen ${block.sequence}`)}</div>
          </div>
          <table>
            <thead>
              <tr>
                <th>Sira</th>
                <th>Renk</th>
                <th>Renk Kodu</th>
                <th>Varyant / Aciklama</th>
                <th>Top</th>
                <th>Metre</th>
                <th>Durum</th>
                <th>Not</th>
              </tr>
            </thead>
            <tbody>${rowHtml}</tbody>
          </table>
        </section>
      `;
    })
    .join("");

  const noteBlock = payload.generalNote?.trim()
    ? `<div class="notes"><div class="label">Genel Not</div><div>${escapeHtml(
        payload.generalNote
      )}</div></div>`
    : "";

  return `
    <!doctype html>
    <html lang="tr">
      <head>
        <meta charset="utf-8" />
        <title>${orderTitle}</title>
        <style>
          @page { size: A4; margin: 14mm; }
          * { box-sizing: border-box; }
          body {
            margin: 0;
            color: #2c2620;
            font-family: Arial, sans-serif;
            background: white;
          }
          .sheet {
            display: flex;
            flex-direction: column;
            gap: 18px;
          }
          .topbar {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            gap: 20px;
            border-bottom: 2px solid #dcc4a4;
            padding-bottom: 12px;
          }
          .brand {
            font-size: 24px;
            font-weight: 700;
            letter-spacing: 0.08em;
          }
          .sheet-title {
            margin-top: 8px;
            font-size: 18px;
            font-weight: 700;
          }
          .subtitle {
            margin-top: 6px;
            font-size: 14px;
            color: #6b5b49;
          }
          .datebox {
            min-width: 140px;
            padding: 10px 12px;
            border: 1px solid #dcc4a4;
            border-radius: 12px;
            background: #faf4eb;
            font-size: 14px;
            text-align: right;
          }
          .pattern-block {
            display: flex;
            flex-direction: column;
            gap: 10px;
          }
          .pattern-header {
            border: 1px solid #dcc4a4;
            border-radius: 12px;
            padding: 10px 12px;
            background: #faf7f1;
          }
          .pattern-kicker,
          .label {
            font-size: 11px;
            text-transform: uppercase;
            letter-spacing: 0.12em;
            color: #7a6b58;
          }
          .pattern-title {
            margin-top: 4px;
            font-size: 16px;
            font-weight: 700;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            font-size: 12px;
          }
          th, td {
            border: 1px solid #d7c3aa;
            padding: 8px 9px;
            vertical-align: top;
          }
          th {
            background: #f5ebdc;
            text-align: left;
            font-size: 11px;
            text-transform: uppercase;
            letter-spacing: 0.05em;
          }
          .notes {
            border: 1px solid #dcc4a4;
            border-radius: 12px;
            padding: 12px;
            min-height: 90px;
            background: #fffdf8;
            white-space: pre-wrap;
            font-size: 13px;
            line-height: 1.5;
          }
        </style>
      </head>
      <body>
        <div class="sheet">
          <div class="topbar">
            <div>
              <div class="brand">${companyTitle}</div>
              <div class="sheet-title">${orderTitle}</div>
              <div class="subtitle">${customerName}</div>
            </div>
            <div class="datebox">
              <div>Tarih</div>
              <strong>${orderDate}</strong>
            </div>
          </div>
          ${blockHtml}
          ${noteBlock}
        </div>
      </body>
    </html>
  `;
};

export const printCustomerOrderHtml = async (html: string) =>
  printHtmlInHiddenFrame(html, "customer-order");
