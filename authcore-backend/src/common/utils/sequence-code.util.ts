/**
 * Next code in a numbered series, e.g. ROLE-01, ROLE-02 … (any prefix: GRP, INV …).
 * Looks at the codes already used and returns one past the highest number, zero-padded to
 * `pad` digits (more digits when the series outgrows them). Codes that do not follow the
 * pattern are ignored.
 *
 *   nextSequenceCode('ROLE', ['ROLE-01', 'ROLE-07', 'HR_MANAGER']) // 'ROLE-08'
 */
export function nextSequenceCode(
  prefix: string,
  existing: Iterable<string>,
  pad = 2,
  separator = '-',
): string {
  const escaped = `${prefix}${separator}`.replace(
    /[.*+?^${}()|[\]\\]/g,
    '\\$&',
  );
  const pattern = new RegExp(`^${escaped}(\\d+)$`, 'i');
  let highest = 0;
  for (const code of existing) {
    const match = pattern.exec(code);
    if (match?.[1]) {
      highest = Math.max(highest, Number(match[1]));
    }
  }
  return `${prefix}${separator}${String(highest + 1).padStart(pad, '0')}`;
}

/** "Finance Team" → "FINANCE_TEAM" (codes for user-entered labels). */
export function toCodeValue(label: string, maxLength = 40): string {
  return label
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/^[^A-Z]+/, '')
    .slice(0, maxLength);
}
