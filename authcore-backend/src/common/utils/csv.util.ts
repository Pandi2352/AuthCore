/**
 * CSV for every export / import (reports, bulk user templates and results, …).
 * Writing quotes every cell and defuses spreadsheet formulas; reading follows RFC 4180
 * (quoted fields, "" escapes, commas and line breaks inside quotes, \r\n or \n).
 */

/** Byte-order mark: lets Excel open UTF-8 CSV with accents intact. */
const BOM = String.fromCharCode(0xfeff);

/** Excel / Sheets run cells starting with these as formulas: prefix them (CSV injection). */
const FORMULA_START = /^[=+\-@\t\r]/;

/** One cell: quoted, formulas defused; arrays joined with "; ", objects as JSON, dates ISO. */
export function csvCell(value: unknown): string {
  let text: string;
  if (value === null || value === undefined) {
    text = '';
  } else if (Array.isArray(value)) {
    text = value
      .map((v) => (typeof v === 'object' ? JSON.stringify(v) : String(v)))
      .join('; ');
  } else if (value instanceof Date) {
    text = value.toISOString();
  } else if (typeof value === 'object') {
    text = JSON.stringify(value);
  } else if (typeof value === 'string') {
    text = value;
  } else if (typeof value === 'number' || typeof value === 'boolean') {
    text = String(value);
  } else {
    text = '';
  }
  if (FORMULA_START.test(text)) {
    text = `'${text}`;
  }
  return `"${text.replaceAll('"', '""')}"`;
}

/** A whole file: header row + data rows, \r\n line ends, UTF-8 BOM so Excel reads accents. */
export function toCsv(
  header: readonly string[],
  rows: readonly unknown[][],
): string {
  const lines = [
    header.map(csvCell).join(','),
    ...rows.map((row) => row.map(csvCell).join(',')),
  ];
  return `${BOM}${lines.join('\r\n')}\r\n`;
}

/** Text → rows of cells (no header handling). A leading BOM and blank lines are ignored. */
export function parseCsv(text: string): string[][] {
  const source = text.startsWith(BOM) ? text.slice(1) : text;
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let isInQuotes = false;
  for (let i = 0; i < source.length; i++) {
    const ch = source.charAt(i);
    if (isInQuotes) {
      if (ch === '"') {
        if (source[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          isInQuotes = false;
        }
      } else {
        cell += ch;
      }
      continue;
    }
    if (ch === '"') {
      isInQuotes = true;
    } else if (ch === ',') {
      row.push(cell);
      cell = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && source[i + 1] === '\n') {
        i++;
      }
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += ch;
    }
  }
  if (cell !== '' || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ''));
}

/**
 * Undo `csvCell`'s formula guard on the way back in: a cell we exported as "'=…" (or one a
 * person typed that way) is read as "=…" only when that quote was ours; other values stay.
 */
export function uncsvValue(text: string): string {
  return text.length > 1 &&
    text.startsWith("'") &&
    FORMULA_START.test(text.slice(1))
    ? text.slice(1)
    : text;
}
