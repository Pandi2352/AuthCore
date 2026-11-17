/** Page numbers to show: 1 … 4 5 [6] 7 8 … 20 */
export function pageRange(
  page: number,
  pageCount: number,
  siblings = 1,
): Array<number | 'ellipsis'> {
  const total = siblings * 2 + 5;
  if (pageCount <= total) return Array.from({ length: pageCount }, (_, i) => i + 1);
  const left = Math.max(page - siblings, 2);
  const right = Math.min(page + siblings, pageCount - 1);
  const showLeftDots = left > 3;
  const showRightDots = right < pageCount - 2;
  const range: Array<number | 'ellipsis'> = [1];
  if (showLeftDots) range.push('ellipsis');
  else for (let i = 2; i < left; i++) range.push(i);
  for (let i = left; i <= right; i++) range.push(i);
  if (showRightDots) range.push('ellipsis');
  else for (let i = right + 1; i < pageCount; i++) range.push(i);
  range.push(pageCount);
  return range;
}
