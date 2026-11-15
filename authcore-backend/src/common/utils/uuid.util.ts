import { randomBytes, randomUUID } from 'node:crypto';

/** Any RFC 9562 UUID (versions 1–8), any case. */
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const UUID_V7_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Generates a UUID v7 (RFC 9562): 48-bit Unix timestamp in milliseconds
 * followed by 74 random bits. Lowercase, 36 characters.
 *
 * This is the default id for every document and entity. v7 ids sort by
 * creation time, so MongoDB inserts stay at the end of the `_id` index
 * (random v4 ids scatter writes across the index and slow down at scale).
 *
 * The creation time can be read from a v7 id. Use generateRandomUuid() where
 * that must stay hidden, and never use any UUID as a secret or token.
 */
export function generateUuid(timestampMs: number = Date.now()): string {
  const bytes = randomBytes(16);
  bytes.writeUIntBE(timestampMs, 0, 6);
  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x70; // version 7
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80; // RFC 9562 variant
  const hex = bytes.toString('hex');
  return (
    `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-` +
    `${hex.slice(16, 20)}-${hex.slice(20)}`
  );
}

/** Random UUID v4. Use only when the id must not reveal its creation time. */
export function generateRandomUuid(): string {
  return randomUUID();
}

/** True for any valid UUID string (versions 1–8, any case). */
export function isValidUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_PATTERN.test(value);
}

/** True for a valid UUID v7 string. */
export function isUuidV7(value: unknown): value is string {
  return typeof value === 'string' && UUID_V7_PATTERN.test(value);
}

/** Creation time embedded in a UUID v7, or null if the value isn't one. */
export function getUuidV7Date(value: string): Date | null {
  if (!isUuidV7(value)) {
    return null;
  }
  const timestampHex = value.slice(0, 8) + value.slice(9, 13);
  return new Date(Number.parseInt(timestampHex, 16));
}
