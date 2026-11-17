import { useState } from 'react';

/**
 * The value from the previous *different* render value (undefined at first).
 * Implemented with state ("adjust state while rendering"), not a ref read during render,
 * so it is safe with the React Compiler and concurrent rendering.
 *
 *   const previousStatus = usePrevious(status);
 *   if (previousStatus === 'saving' && status === 'idle') …
 */
export function usePrevious<T>(value: T): T | undefined {
  const [state, setState] = useState<{ current: T; previous: T | undefined }>({
    current: value,
    previous: undefined,
  });
  if (!Object.is(state.current, value)) {
    setState({ current: value, previous: state.current });
    return state.current;
  }
  return state.previous;
}
