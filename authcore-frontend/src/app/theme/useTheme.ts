import { useContext } from 'react';

import { ThemeContext, type ThemeContextValue } from './theme-context';

/** Current theme and setters. Must be used inside <ThemeProvider>. */
export function useTheme(): ThemeContextValue {
  const value = useContext(ThemeContext);
  if (!value) throw new Error('useTheme() must be used inside <ThemeProvider>');
  return value;
}
