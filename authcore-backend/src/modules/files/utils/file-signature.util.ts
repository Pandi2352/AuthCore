import type { DetectedMimeType } from '../constants/file.constants';

const startsWith = (
  buffer: Buffer,
  bytes: readonly number[],
  offset = 0,
): boolean =>
  buffer.length >= offset + bytes.length &&
  bytes.every((byte, i) => buffer[offset + i] === byte);

/**
 * The real type of a file, from its first bytes ("magic numbers"). The client's
 * Content-Type and file name are never trusted. null = not a supported type
 * (this also rejects SVG / HTML, which could run scripts in a browser).
 */
export function detectMimeType(
  buffer: Buffer,
  fileName = '',
): DetectedMimeType | null {
  if (startsWith(buffer, [0xff, 0xd8, 0xff])) {
    return 'image/jpeg';
  }
  if (startsWith(buffer, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return 'image/png';
  }
  if (
    startsWith(buffer, [0x52, 0x49, 0x46, 0x46]) &&
    startsWith(buffer, [0x57, 0x45, 0x42, 0x50], 8)
  ) {
    return 'image/webp';
  }
  if (
    startsWith(buffer, [0x47, 0x49, 0x46, 0x38, 0x37, 0x61]) ||
    startsWith(buffer, [0x47, 0x49, 0x46, 0x38, 0x39, 0x61])
  ) {
    return 'image/gif';
  }
  if (startsWith(buffer, [0x25, 0x50, 0x44, 0x46, 0x2d])) {
    return 'application/pdf';
  }
  const office = detectOfficeOpenXml(buffer);
  if (office) {
    return office;
  }
  if (isPlainText(buffer)) {
    // Text has no signature: the name only picks between the two inert text types.
    return /\.csv$/i.test(fileName) ? 'text/csv' : 'text/plain';
  }
  return null;
}

/**
 * Word / Excel / PowerPoint (2007+): a ZIP whose entries live in word/, xl/ or ppt/.
 * Entry names appear in the local file headers near the start of the archive.
 */
function detectOfficeOpenXml(buffer: Buffer): DetectedMimeType | null {
  if (!startsWith(buffer, [0x50, 0x4b, 0x03, 0x04])) {
    return null;
  }
  const head = buffer.subarray(0, 64 * 1024).toString('latin1');
  if (!head.includes('[Content_Types].xml')) {
    return null;
  }
  if (head.includes('word/')) {
    return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  }
  if (head.includes('xl/')) {
    return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  }
  if (head.includes('ppt/')) {
    return 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
  }
  return null;
}

/** UTF-8 text without NUL / control bytes (tab, CR, LF allowed). */
function isPlainText(buffer: Buffer): boolean {
  const sample = buffer.subarray(0, 8 * 1024);
  if (sample.length === 0) {
    return false;
  }
  for (const byte of sample) {
    if (
      byte === 0 ||
      (byte < 0x20 && byte !== 0x09 && byte !== 0x0a && byte !== 0x0d)
    ) {
      return false;
    }
  }
  try {
    new TextDecoder('utf-8', { fatal: true }).decode(
      sample.subarray(0, lastCompleteChar(sample)),
    );
    return true;
  } catch {
    return false;
  }
}

/** Length without a trailing, cut-off UTF-8 sequence (the sample may end mid-character). */
function lastCompleteChar(sample: Buffer): number {
  const end = sample.length;
  for (let i = 1; i <= 3 && end - i >= 0; i++) {
    const byte = sample[end - i] ?? 0;
    if ((byte & 0xc0) === 0xc0) {
      return end - i;
    }
    if ((byte & 0x80) === 0) {
      return end;
    }
  }
  return end;
}

/** Pages of a PDF (0 for other types or when it can't be told). */
export function countPdfPages(buffer: Buffer): number {
  const text = buffer.toString('latin1');
  // The page tree root carries the total; the largest /Count of a /Pages node is it.
  let max = 0;
  for (const match of text.matchAll(
    /\/Type\s*\/Pages\b[^>]*?\/Count\s+(\d+)|\/Count\s+(\d+)[^>]*?\/Type\s*\/Pages\b/g,
  )) {
    max = Math.max(max, Number(match[1] ?? match[2] ?? 0));
  }
  if (max > 0) {
    return max;
  }
  return (text.match(/\/Type\s*\/Page\b(?!s)/g) ?? []).length;
}

/** Characters never kept in a stored file name (quotes, path / shell specials). */
const UNSAFE_NAME_CHARS = new Set(['"', '<', '>', ':', '|', '?', '*', ';']);

/**
 * A display name safe to store and to put in Content-Disposition: no path,
 * no control characters, no quotes; length-capped; keeps the extension.
 */
export function sanitizeFileName(
  name: string,
  fallbackExtension: string,
  maxLength: number,
): string {
  const base = name.split(/[\\/]/).pop() ?? '';

  const cleaned = Array.from(base)
    .filter((char) => {
      const code = char.charCodeAt(0);
      return code >= 0x20 && code !== 0x7f && !UNSAFE_NAME_CHARS.has(char);
    })
    .join('')
    .replace(/\s+/g, ' ')
    .trim();
  const safe =
    cleaned === '' || /^\.+$/.test(cleaned)
      ? `file.${fallbackExtension}`
      : cleaned;
  if (safe.length <= maxLength) {
    return safe;
  }
  const dot = safe.lastIndexOf('.');
  const extension = dot > 0 ? safe.slice(dot) : '';
  return safe.slice(0, maxLength - extension.length) + extension;
}

/** RFC 5987 Content-Disposition with an ASCII fallback. */
export function contentDisposition(
  type: 'inline' | 'attachment',
  fileName: string,
): string {
  const ascii = fileName.replace(/[^\x20-\x7e]/g, '_');
  return `${type}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;
}
