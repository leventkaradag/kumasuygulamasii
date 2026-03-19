export type DyehouseOrderPrintRow = {
  sequence: number;
  colorName: string;
  variantDescription?: string;
  topCount?: number;
  rawMeters?: number;
  status?: string;
  description?: string;
};

export type DyehouseOrderPrintBlock = {
  sequence: number;
  patternCode?: string;
  patternName?: string;
  rows: DyehouseOrderPrintRow[];
};

export type DyehouseOrderPrintPayload = {
  title: string;
  companyTitle: string;
  attentionLine?: string;
  orderDate: string;
  patternBlocks: DyehouseOrderPrintBlock[];
  details: {
    patternCode?: string;
    content?: string;
    rawWidth?: string;
    rawWeight?: string;
    finishedWidth?: string;
    processNo?: string;
    extraNote?: string;
    generalNote?: string;
  };
};

const fmt = (value: number) => value.toLocaleString("tr-TR", { maximumFractionDigits: 2 });

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

export const buildDyehouseOrderPrintHtml = (payload: DyehouseOrderPrintPayload) => {
  const title = escapeHtml(payload.title.trim() || "Boyahane Siparisi");
  const companyTitle = escapeHtml(payload.companyTitle.trim() || "KUMASCI TEKSTIL");
  const attentionLine = escapeHtml(payload.attentionLine?.trim() || "Dikkatine");
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
              <td>${escapeHtml(row.variantDescription || "-")}</td>
              <td>${row.topCount ?? "-"}</td>
              <td>${row.rawMeters ? fmt(row.rawMeters) : "-"}</td>
              <td>${escapeHtml(row.status || "-")}</td>
              <td>${escapeHtml(row.description || "-")}</td>
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
                <th>Aciklama</th>
                <th>Top</th>
                <th>Ham Mt</th>
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

  const detailRows = ([
    ["Genel Referans", payload.details.patternCode],
    ["Icerik", payload.details.content],
    ["Ham En", payload.details.rawWidth],
    ["Ham Gramaj", payload.details.rawWeight],
    ["Mamul En", payload.details.finishedWidth],
    ["Proses No", payload.details.processNo],
    ["Ekstra Not", payload.details.extraNote],
  ] as Array<[string, string | undefined]>)
    .filter(([, value]) => value?.trim())
    .map(
      ([label, value]) => `
        <div class="detail-item">
          <div class="detail-label">${escapeHtml(label)}</div>
          <div class="detail-value">${escapeHtml(value ?? "")}</div>
        </div>
      `
    )
    .join("");

  const noteBlock = payload.details.generalNote?.trim()
    ? `<div class="notes"><div class="detail-label">Aciklama</div><div>${escapeHtml(payload.details.generalNote)}</div></div>`
    : "";

  return `
    <!doctype html>
    <html lang="tr">
      <head>
        <meta charset="utf-8" />
        <title>${title}</title>
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
            gap: 20px;
            align-items: flex-start;
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
          .pattern-kicker {
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
          .details {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 10px;
          }
          .detail-item {
            border: 1px solid #dcc4a4;
            border-radius: 12px;
            padding: 10px 12px;
            background: #faf7f1;
          }
          .detail-label {
            font-size: 11px;
            text-transform: uppercase;
            letter-spacing: 0.08em;
            color: #7a6b58;
            margin-bottom: 6px;
          }
          .detail-value {
            font-size: 14px;
            font-weight: 600;
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
              <div class="sheet-title">${title}</div>
              <div class="subtitle">${attentionLine}</div>
            </div>
            <div class="datebox">
              <div>Tarih</div>
              <strong>${orderDate}</strong>
            </div>
          </div>
          ${blockHtml}
          ${detailRows ? `<div class="details">${detailRows}</div>` : ""}
          ${noteBlock}
        </div>
      </body>
    </html>
  `;
};

export const printDyehouseOrderHtml = async (html: string) => {
  if (typeof window === "undefined") {
    throw new Error("Yazdirma sadece tarayicida kullanilabilir.");
  }

  const existingFrame = document.querySelector<HTMLIFrameElement>('iframe[data-print-frame="dyehouse-order"]');
  existingFrame?.remove();

  await new Promise<void>((resolve) => {
    const iframe = document.createElement("iframe");
    iframe.setAttribute("data-print-frame", "dyehouse-order");
    iframe.setAttribute("title", "dyehouse-order-print");
    iframe.style.position = "fixed";
    iframe.style.right = "0";
    iframe.style.bottom = "0";
    iframe.style.width = "1px";
    iframe.style.height = "1px";
    iframe.style.opacity = "0";
    iframe.style.pointerEvents = "none";
    iframe.style.border = "0";
    iframe.style.visibility = "hidden";
    document.body.appendChild(iframe);

    const frameWindow = iframe.contentWindow;
    if (!frameWindow) {
      iframe.remove();
      throw new Error("Yazdirma iframe'i olusturulamadi.");
    }

    const triggerPrint = () => {
      iframe.onload = null;
      frameWindow.focus();
      window.setTimeout(() => {
        frameWindow.print();
        resolve();
      }, 180);
    };

    iframe.onload = () => {
      window.setTimeout(triggerPrint, 120);
    };

    const doc = frameWindow.document;
    doc.open();
    doc.write(html);
    doc.close();

    window.setTimeout(triggerPrint, 600);

    window.setTimeout(() => {
      iframe.remove();
    }, 3000);
  });
};
