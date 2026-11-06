import ExcelJS from "exceljs";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

const NAVY = "FF0F2A4A";
const ROW = "FFF4F8FC";
const LINE = "FFE2E8F0";
const MUTED = "FF64748B";

function workbookCtor() {
  return ExcelJS.Workbook || ExcelJS.default?.Workbook;
}

function saveBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function sheetName(title) {
  const name = String(title || "Report")
    .replace(/[:\\/?*[\]]/g, " ")
    .trim();
  return (name || "Report").slice(0, 31);
}

function pdfText(value) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Number.isInteger(value) ? value.toLocaleString() : String(value);
  }
  if (value == null) return "";
  return String(value);
}

export function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;
  const source = String(text || "").replace(/^\uFEFF/, "");
  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    if (quoted) {
      if (char === '"') {
        if (source[index + 1] === '"') {
          cell += '"';
          index += 1;
        } else {
          quoted = false;
        }
      } else {
        cell += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      row.push(cell);
      cell = "";
    } else if (char === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else if (char !== "\r") {
      cell += char;
    }
  }
  if (cell.length || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((line) => line.some((value) => String(value).trim() !== ""));
}

function prettyHeader(key) {
  return String(key || "")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export function sheetFromCsv({ filename, title, subtitle, csv }) {
  const parsed = parseCsv(csv);
  if (!parsed.length) {
    return {
      filename,
      title,
      subtitle,
      headers: ["Message"],
      rows: [["No rows for these filters."]],
    };
  }
  const rawHeaders = parsed[0];
  const cameraIndex = rawHeaders.findIndex(
    (header) => header.trim().toLowerCase() === "camera_id"
  );
  const headers = rawHeaders.map((header) => prettyHeader(header));
  const rows = parsed.slice(1).map((line) => {
    const cells = headers.map((_, index) => line[index] ?? "");
    if (cameraIndex >= 0 && String(cells[cameraIndex]).trim() === "") {
      cells[cameraIndex] = "Unassigned";
    }
    return cells;
  });
  return { filename, title, subtitle, headers, rows };
}

export async function downloadExcelReport({ filename, title, subtitle, headers, rows }) {
  const Workbook = workbookCtor();
  if (!Workbook) throw new Error("Excel export is unavailable");
  const workbook = new Workbook();
  workbook.creator = "Isarva Nethra";
  workbook.created = new Date();
  const sheet = workbook.addWorksheet(sheetName(title), {
    views: [{ state: "frozen", ySplit: 4, showGridLines: false }],
    pageSetup: {
      orientation: headers.length > 5 ? "landscape" : "portrait",
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      paperSize: 9,
    },
  });
  sheet.headerFooter.oddFooter = "&LIsarva Nethra&C&A&RPage &P of &N";

  const width = Math.max(headers.length, 1);
  sheet.mergeCells(1, 1, 1, width);
  const titleCell = sheet.getCell(1, 1);
  titleCell.value = title;
  titleCell.font = { name: "Calibri", bold: true, size: 16, color: { argb: NAVY } };
  titleCell.alignment = { vertical: "middle" };
  sheet.getRow(1).height = 24;

  sheet.mergeCells(2, 1, 2, width);
  const subtitleCell = sheet.getCell(2, 1);
  subtitleCell.value = subtitle || "";
  subtitleCell.font = { name: "Calibri", size: 11, color: { argb: MUTED } };
  sheet.getRow(2).height = 18;
  sheet.getRow(3).height = 8;

  const headerRow = sheet.getRow(4);
  headers.forEach((header, index) => {
    const cell = headerRow.getCell(index + 1);
    cell.value = header;
    cell.font = { name: "Calibri", bold: true, size: 11, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: NAVY } };
    cell.alignment = { vertical: "middle", horizontal: "left" };
    cell.border = {
      bottom: { style: "thin", color: { argb: NAVY } },
    };
  });
  headerRow.height = 22;

  rows.forEach((row, rowIndex) => {
    const excelRow = sheet.getRow(5 + rowIndex);
    excelRow.height = 18;
    headers.forEach((_, columnIndex) => {
      const value = row[columnIndex] ?? "";
      const cell = excelRow.getCell(columnIndex + 1);
      const numeric = typeof value === "number" && Number.isFinite(value);
      cell.value = numeric ? value : value == null ? "" : String(value);
      cell.font = { name: "Calibri", size: 11, color: { argb: "FF0F172A" } };
      cell.alignment = {
        vertical: "middle",
        horizontal: numeric ? "right" : "left",
        wrapText: true,
      };
      if (numeric) cell.numFmt = Number.isInteger(value) ? "#,##0" : "#,##0.##";
      if (rowIndex % 2 === 1) {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: ROW } };
      }
      cell.border = { bottom: { style: "thin", color: { argb: LINE } } };
    });
  });

  sheet.autoFilter = {
    from: { row: 4, column: 1 },
    to: { row: 4, column: width },
  };
  sheet.columns.forEach((column, index) => {
    const header = String(headers[index] || "");
    let size = header.length;
    rows.forEach((row) => {
      size = Math.max(size, pdfText(row[index]).length);
    });
    column.width = Math.min(42, Math.max(12, size + 2));
  });

  const buffer = await workbook.xlsx.writeBuffer();
  saveBlob(
    new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }),
    `${filename}.xlsx`
  );
}

export async function downloadPdfReport({ filename, title, subtitle, headers, rows }) {
  const landscape = headers.length > 5;
  const doc = new jsPDF({
    orientation: landscape ? "landscape" : "portrait",
    unit: "pt",
    format: "a4",
  });
  doc.setProperties({
    title,
    subject: subtitle || title,
    creator: "Isarva Nethra",
  });
  const pageWidth = doc.internal.pageSize.getWidth();
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(15, 42, 74);
  doc.text(title, 36, 40);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(100, 116, 139);
  const subtitleLines = doc.splitTextToSize(subtitle || "", pageWidth - 72);
  if (subtitleLines.length) doc.text(subtitleLines, 36, 58);

  autoTable(doc, {
    startY: 58 + subtitleLines.length * 14 + 8,
    head: [headers],
    body: rows.map((row) => headers.map((_, index) => pdfText(row[index]))),
    theme: "plain",
    styles: {
      font: "helvetica",
      fontSize: landscape ? 8 : 9,
      cellPadding: 6,
      textColor: [15, 23, 42],
      lineColor: [226, 232, 240],
      lineWidth: 0.4,
      overflow: "linebreak",
      valign: "middle",
    },
    headStyles: {
      fillColor: [15, 42, 74],
      textColor: 255,
      fontStyle: "bold",
      fontSize: landscape ? 8 : 9,
    },
    alternateRowStyles: { fillColor: [244, 248, 252] },
    margin: { left: 36, right: 36, top: 36, bottom: 36 },
  });

  const total = doc.getNumberOfPages();
  for (let page = 1; page <= total; page += 1) {
    doc.setPage(page);
    const height = doc.internal.pageSize.getHeight();
    const width = doc.internal.pageSize.getWidth();
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text("Isarva Nethra", 36, height - 18);
    doc.text(title, width / 2, height - 18, { align: "center" });
    doc.text(`Page ${page} of ${total}`, width - 36, height - 18, { align: "right" });
  }

  doc.save(`${filename}.pdf`);
}
