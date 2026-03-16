import { utils, writeFileXLSX } from "xlsx";
import {
  buildDepoDailyEntryWorksheetRows,
  type DepoDailyEntryReport,
} from "@/lib/summary/depoDailyEntryReport";

export const buildDepoDailyEntryFileName = (reportDate: string) =>
  `depo-giris-cizelgesi-${reportDate}.xlsx`;

export const downloadDepoDailyEntryReportXlsx = (report: DepoDailyEntryReport) => {
  const workbook = utils.book_new();
  const worksheet = utils.aoa_to_sheet(buildDepoDailyEntryWorksheetRows(report));

  worksheet["!cols"] = [
    { wch: 36 },
    { wch: 14 },
    { wch: 18 },
  ];

  utils.book_append_sheet(workbook, worksheet, "Giris Cizelgesi");

  const fileName = buildDepoDailyEntryFileName(report.reportDate);
  writeFileXLSX(workbook, fileName, { compression: true });
  return fileName;
};
