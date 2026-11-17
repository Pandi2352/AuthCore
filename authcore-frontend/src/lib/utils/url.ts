export type QueryValue = string | number | boolean | null | undefined;
export type QueryParams = Record<string, QueryValue | readonly QueryValue[]>;

/**
 * { q: 'ravi', page: 2, tags: ['a', 'b'], empty: '' } → "q=ravi&page=2&tags=a&tags=b".
 * null / undefined / '' are left out; arrays repeat the key.
 */
export function buildQueryString(params: QueryParams): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    const values = Array.isArray(value) ? value : [value];
    for (const item of values) {
      if (item === null || item === undefined || item === '') continue;
      search.append(key, String(item));
    }
  }
  return search.toString();
}

/** Path + query: appendQuery('/users', { page: 2 }) → "/users?page=2" (keeps existing params). */
export function appendQuery(path: string, params: QueryParams): string {
  const [base = '', hash = ''] = path.split('#');
  const [pathname = '', existing = ''] = base.split('?');
  const merged = new URLSearchParams(existing);
  for (const key of Object.keys(params)) merged.delete(key);
  const extra = new URLSearchParams(buildQueryString(params));
  for (const [k, v] of extra) merged.append(k, v);
  const qs = merged.toString();
  return `${pathname}${qs ? `?${qs}` : ''}${hash ? `#${hash}` : ''}`;
}

/** "?q=a&tag=x&tag=y" → { q: 'a', tag: ['x', 'y'] }. */
export function parseQueryString(search: string): Record<string, string | string[]> {
  const result: Record<string, string | string[]> = {};
  for (const [key, value] of new URLSearchParams(
    search.startsWith('?') ? search.slice(1) : search,
  )) {
    const current = result[key];
    if (current === undefined) result[key] = value;
    else result[key] = Array.isArray(current) ? [...current, value] : [current, value];
  }
  return result;
}

/** Absolute http(s) URL (an external link), as opposed to an app path. */
export function isExternalUrl(value: string): boolean {
  return /^https?:\/\//i.test(value);
}

/** Join URL parts without double / missing slashes: joinUrl('/api/v1/', '/users') → "/api/v1/users". */
export function joinUrl(...parts: string[]): string {
  return parts
    .filter((p) => p !== '')
    .map((p, i) => (i === 0 ? p.replace(/\/+$/, '') : p.replace(/^\/+|\/+$/g, '')))
    .join('/');
}

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
