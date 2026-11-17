/**
 * Keyboard helpers shared by menus, listboxes, tabs and accordions.
 */

/** Next index for Arrow / Home / End keys (wraps), skipping disabled items. */
export function nextIndex(
  key: string,
  current: number,
  count: number,
  isDisabled: (index: number) => boolean,
  orientation: 'vertical' | 'horizontal' = 'vertical',
): number | null {
  const prev = orientation === 'vertical' ? 'ArrowUp' : 'ArrowLeft';
  const next = orientation === 'vertical' ? 'ArrowDown' : 'ArrowRight';
  let step: number;
  let start: number;
  if (key === next) {
    step = 1;
    start = current;
  } else if (key === prev) {
    step = -1;
    start = current < 0 ? count : current;
  } else if (key === 'Home') {
    step = 1;
    start = -1;
  } else if (key === 'End') {
    step = -1;
    start = count;
  } else {
    return null;
  }
  for (let i = 1; i <= count; i++) {
    const index = (((start + step * i) % count) + count) % count;
    if (!isDisabled(index)) return index;
  }
  return null;
}

/**
 * Type-to-select: collects typed characters for 500 ms and returns the index of the first
 * enabled item (after the current one) whose label starts with them.
 */
export function createTypeahead() {
  let buffer = '';
  let timer: ReturnType<typeof setTimeout> | undefined;
  return (
    key: string,
    labels: string[],
    current: number,
    isDisabled: (index: number) => boolean,
  ) => {
    if (key.length !== 1 || key === ' ') return null;
    clearTimeout(timer);
    timer = setTimeout(() => {
      buffer = '';
    }, 500);
    buffer += key.toLowerCase();
    const count = labels.length;
    const startAt = buffer.length === 1 ? current + 1 : current;
    for (let i = 0; i < count; i++) {
      const index = (startAt + i + count) % count;
      if (!isDisabled(index) && labels[index]?.toLowerCase().startsWith(buffer)) return index;
    }
    return null;
  };
}
