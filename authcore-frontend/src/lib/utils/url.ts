/**
 * A `returnTo` / `from` value that is safe to navigate to: a same-origin relative path
 * ("/admin/users?page=2"). Absolute URLs, protocol-relative ("//evil.com"), backslash
 * tricks ("/\\evil.com") and anything else return the fallback (open-redirect protection).
 */
export function safeReturnTo(value: unknown, fallback: string): string {
  if (typeof value !== 'string' || value.length === 0 || value.length > 2048) return fallback;
  if (!value.startsWith('/') || value.startsWith('//') || value.startsWith('/\\')) return fallback;
  if ([...value].some((c) => c.charCodeAt(0) < 32)) return fallback;
  try {
    const url = new URL(value, 'http://same.origin');
    if (url.origin !== 'http://same.origin') return fallback;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
}
