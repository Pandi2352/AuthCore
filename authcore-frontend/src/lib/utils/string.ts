/**
 * Shorten to `max` characters with an ellipsis. `position: 'middle'` keeps both ends
 * (file names, ids): "very-long-file-…-final.pdf".
 */
export function truncate(text: string, max: number, position: 'end' | 'middle' = 'end'): string {
  if (max <= 0) return '';
  const chars = Array.from(text); // keeps emoji / surrogate pairs whole
  if (chars.length <= max) return text;
  if (max === 1) return '…';
  if (position === 'middle') {
    const keep = max - 1;
    const head = Math.ceil(keep / 2);
    return `${chars.slice(0, head).join('')}…${chars.slice(chars.length - (keep - head)).join('')}`;
  }
  return `${chars
    .slice(0, max - 1)
    .join('')
    .trimEnd()}…`;
}

/** "Priya Raman" → "PR", "ravi@example.com" → "R", "" → "?". */
export function initials(name: string | null | undefined, max = 2): string {
  if (!name?.trim()) return '?';
  const parts = name
    .replace(/@.*/, '')
    .trim()
    .split(/[\s._-]+/)
    .filter(Boolean);
  const letters =
    parts.length > 1
      ? [parts[0], parts[parts.length - 1]].map((p) => Array.from(p ?? '')[0] ?? '')
      : [Array.from(parts[0] ?? '?')[0] ?? '?'];
  return letters.slice(0, max).join('').toUpperCase();
}

/** "Hello, Wörld! 2026" → "hello-world-2026" (URL / file / slug safe ASCII). */
export function slugify(text: string, maxLength = 80): string {
  return text
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '') // accents
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, maxLength)
    .replace(/-+$/g, '');
}

/** "hello world" → "Hello world". */
export const capitalize = (text: string): string =>
  text ? text.charAt(0).toUpperCase() + text.slice(1) : text;

/** "PENDING_VERIFICATION" / "pendingVerification" → "Pending verification". */
export function humanize(text: string): string {
  const spaced = text
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .trim()
    .toLowerCase();
  return capitalize(spaced);
}

/** "  a   b \n c " → "a b c". */
export const collapseWhitespace = (text: string): string => text.replace(/\s+/g, ' ').trim();

/** Mask all but the last `visible` characters: "4111111111111111" → "••••••••••••1111". */
export function mask(text: string, visible = 4, char = '•'): string {
  const chars = Array.from(text);
  if (chars.length <= visible) return text;
  return char.repeat(chars.length - visible) + chars.slice(-visible).join('');
}

/** "p***@example.com" — for showing which address an email went to. */
export function maskEmail(email: string): string {
  const [user = '', domain] = email.split('@');
  if (!domain) return mask(email);
  const first = Array.from(user)[0] ?? '';
  return `${first}${'*'.repeat(Math.max(1, Array.from(user).length - 1))}@${domain}`;
}
