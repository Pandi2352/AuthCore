import type { Ref, RefCallback } from 'react';

import { cn } from '@/lib/utils';

/** One ref callback that sets every given ref (object or callback). */
export function composeRefs<T>(...refs: Array<Ref<T> | undefined>): RefCallback<T> {
  return (node) => {
    for (const ref of refs) {
      if (typeof ref === 'function') ref(node);
      else if (ref) (ref as { current: T | null }).current = node;
    }
  };
}

type AnyProps = Record<string, unknown>;

/**
 * Merge props for `asChild`: event handlers are chained (child first, then ours unless the
 * child called preventDefault), className merged, style shallow-merged, the rest: child wins.
 */
export function mergeProps(ours: AnyProps, theirs: AnyProps): AnyProps {
  const result: AnyProps = { ...ours, ...theirs };
  for (const key of Object.keys(ours)) {
    const a = ours[key];
    const b = theirs[key];
    if (/^on[A-Z]/.test(key) && typeof a === 'function' && typeof b === 'function') {
      result[key] = (...args: unknown[]) => {
        (b as (...x: unknown[]) => void)(...args);
        const event = args[0] as { defaultPrevented?: boolean } | undefined;
        if (!event?.defaultPrevented) (a as (...x: unknown[]) => void)(...args);
      };
    } else if (key === 'className') {
      result[key] = cn(a as string, b as string);
    } else if (key === 'style' && typeof a === 'object' && typeof b === 'object') {
      result[key] = { ...(a as object), ...(b as object) };
    }
  }
  return result;
}
