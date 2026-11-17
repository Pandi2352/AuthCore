/**
 * Small helpers for the API transports (fetch client, XHR upload, download).
 */

/** Id for X-Request-Id (accepted by the backend: [A-Za-z0-9._:-]{1,128}). */
export function createRequestId(): string {
  const cryptoApi = globalThis.crypto;
  if (cryptoApi?.randomUUID) return cryptoApi.randomUUID();
  // Non-secure contexts (http on a LAN IP) have no randomUUID.
  const bytes = new Uint8Array(16);
  if (cryptoApi?.getRandomValues) cryptoApi.getRandomValues(bytes);
  else for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

/** Retry-After: seconds ("120") or an HTTP date → seconds from now (undefined if absent / invalid). */
export function parseRetryAfter(
  value: string | null,
  now: number = Date.now(),
): number | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (/^\d+$/.test(trimmed)) return Number(trimmed);
  const date = Date.parse(trimmed);
  if (Number.isNaN(date)) return undefined;
  return Math.max(0, Math.ceil((date - now) / 1000));
}

/** One AbortSignal that fires when any of the given ones does (+ cleanup of listeners). */
export function linkSignals(signals: ReadonlyArray<AbortSignal | undefined>): {
  signal: AbortSignal;
  cleanup: () => void;
} {
  const present = signals.filter((s): s is AbortSignal => s !== undefined);
  const controller = new AbortController();
  const aborted = present.find((s) => s.aborted);
  if (aborted) {
    controller.abort(aborted.reason);
    return { signal: controller.signal, cleanup: () => undefined };
  }
  const onAbort = (event: Event) => controller.abort((event.target as AbortSignal).reason);
  for (const s of present) s.addEventListener('abort', onAbort, { once: true });
  return {
    signal: controller.signal,
    cleanup: () => {
      for (const s of present) s.removeEventListener('abort', onAbort);
    },
  };
}

/**
 * File name from Content-Disposition: RFC 5987 `filename*=UTF-8''na%C3%AFve.pdf` wins over
 * `filename="report.pdf"`. Path parts and control characters are stripped.
 */
export function filenameFromContentDisposition(header: string | null): string | null {
  if (!header) return null;
  let name: string | null = null;
  const extended = /filename\*\s*=\s*([^']*)'[^']*'([^;]+)/i.exec(header);
  if (extended?.[2]) {
    try {
      name = decodeURIComponent(extended[2].trim().replace(/^"|"$/g, ''));
    } catch {
      name = null;
    }
  }
  if (!name) {
    const plain = /filename\s*=\s*("([^"]*)"|[^;]+)/i.exec(header);
    name = (plain?.[2] ?? plain?.[1] ?? '').trim() || null;
  }
  if (!name) return null;
  const safe = name
    .split(/[\\/]/)
    .pop()
    ?.split('')
    .filter((c) => c.charCodeAt(0) >= 32)
    .join('')
    .trim();
  return safe || null;
}
