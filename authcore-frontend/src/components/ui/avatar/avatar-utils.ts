/** "Priya Raman" → "PR"; "ravi@x.com" → "R". */
export function initialsOf(name: string | null | undefined): string {
  if (!name) return '?';
  const parts = name
    .replace(/@.*/, '')
    .trim()
    .split(/[\s._-]+/)
    .filter(Boolean);
  const letters =
    parts.length > 1
      ? `${parts[0]?.[0] ?? ''}${parts[parts.length - 1]?.[0] ?? ''}`
      : (parts[0]?.slice(0, 1) ?? '?');
  return letters.toUpperCase();
}
