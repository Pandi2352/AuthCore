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
export function detectMimeType(buffer: Buffer): DetectedMimeType | null {
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
  return null;
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
