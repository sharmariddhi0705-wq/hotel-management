/**
 * CSV export.
 *
 * Values are quoted and internal quotes doubled per RFC 4180. A leading
 * `=`, `+`, `-` or `@` is prefixed with a single quote: spreadsheet software
 * would otherwise treat an exported cell as a formula.
 */

export function escapeCsvValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  let text = String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  if (/["\n\r,]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

export interface CsvColumn<T> {
  header: string;
  value: (row: T) => unknown;
}

export function toCsv<T>(rows: T[], columns: CsvColumn<T>[]): string {
  const head = columns.map((c) => escapeCsvValue(c.header)).join(",");
  const body = rows.map((row) =>
    columns.map((c) => escapeCsvValue(c.value(row))).join(","),
  );
  // Excel needs a BOM to read UTF-8 (currency symbols, accented names).
  return `﻿${[head, ...body].join("\r\n")}\r\n`;
}

export function csvResponse(csv: string, filename: string): Response {
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
