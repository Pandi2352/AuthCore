import ExcelJS from 'exceljs';

import { parseCsv, uncsvValue } from './csv.util';

/**
 * An uploaded table (CSV or Excel .xlsx) → header names + rows keyed by header. Shared by
 * every import. Headers are trimmed and lower-cased; cells trimmed; empty rows skipped.
 */
export interface TableFile {
  headers: string[];
  /** One object per data row: header → cell text. `rowNumber` is the line in the file (2 = first data row). */
  rows: Array<{ rowNumber: number; values: Record<string, string> }>;
}

export class TableFileError extends Error {}

const XLSX_SIGNATURE = Buffer.from([0x50, 0x4b, 0x03, 0x04]); // "PK.." (zip)

/** Reads the file; throws TableFileError (shown to the user) when it can't. */
export async function readTableFile(
  file: { originalname: string; buffer: Buffer },
  maxRows: number,
): Promise<TableFile> {
  const name = file.originalname.toLowerCase();
  const isXlsx = file.buffer.subarray(0, 4).equals(XLSX_SIGNATURE);
  if (name.endsWith('.xls') && !isXlsx) {
    throw new TableFileError(
      'Old .xls files are not supported: save it as .xlsx or .csv',
    );
  }
  const matrix = isXlsx ? await readXlsx(file.buffer) : readCsv(file.buffer);
  if (matrix.length === 0) {
    throw new TableFileError('The file is empty');
  }
  const headers = (matrix[0] ?? []).map((h) => h.trim().toLowerCase());
  if (headers.every((h) => h === '')) {
    throw new TableFileError('The first row must hold the column names');
  }
  const data = matrix.slice(1);
  if (data.length === 0) {
    throw new TableFileError('The file has column names but no rows');
  }
  if (data.length > maxRows) {
    throw new TableFileError(
      `At most ${String(maxRows)} rows per file (this one has ${String(data.length)})`,
    );
  }
  return {
    headers,
    rows: data.map((cells, index) => ({
      rowNumber: index + 2,
      values: Object.fromEntries(
        headers
          .map(
            (header, col) =>
              [header, uncsvValue((cells[col] ?? '').trim())] as const,
          )
          .filter(([header]) => header !== ''),
      ),
    })),
  };
}

function readCsv(buffer: Buffer): string[][] {
  const text = buffer.toString('utf8');
  if (text.includes('\u0000')) {
    throw new TableFileError('This is not a CSV or Excel (.xlsx) file');
  }
  return parseCsv(text);
}

/** First worksheet; every cell as text (dates as YYYY-MM-DD, formulas as their result). */
async function readXlsx(buffer: Buffer): Promise<string[][]> {
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
  } catch {
    throw new TableFileError('The Excel file could not be read');
  }
  const sheet = workbook.worksheets[0];
  if (!sheet) {
    throw new TableFileError('The Excel file has no sheets');
  }
  const rows: string[][] = [];
  sheet.eachRow({ includeEmpty: false }, (row) => {
    const cells: string[] = [];
    for (let col = 1; col <= row.cellCount; col++) {
      cells.push(cellText(row.getCell(col).value));
    }
    if (cells.some((c) => c.trim() !== '')) {
      rows.push(cells);
    }
  });
  return rows;
}

function cellText(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) {
    return '';
  }
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }
  if (typeof value === 'object') {
    if ('result' in value) {
      return cellText(value.result);
    }
    if ('text' in value) {
      return value.text;
    }
    if ('richText' in value) {
      return value.richText.map((r) => r.text).join('');
    }
    if ('hyperlink' in value) {
      return String(value.hyperlink);
    }
    return '';
  }
  return String(value);
}
