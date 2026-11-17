import { Search, X } from 'lucide-react';
import { forwardRef, useEffect, useState, type InputHTMLAttributes } from 'react';

import { Input } from '@/components/ui';
import { useDebouncedCallback } from '@/hooks/useDebounce';

export interface SearchInputProps extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'value' | 'defaultValue' | 'onChange' | 'size' | 'prefix'
> {
  /** Committed value (e.g. from the URL). The field follows it when it changes elsewhere. */
  value: string;
  /** Called `debounceMs` after typing stops, immediately on clear / Enter. */
  onSearch: (value: string) => void;
  debounceMs?: number;
  size?: 'sm' | 'md' | 'lg';
  /** Accessible name when there is no visible label. */
  'aria-label'?: string;
}

/** Debounced, clearable search box (Escape clears, Enter searches right away). */
export const SearchInput = forwardRef<HTMLInputElement, SearchInputProps>(function SearchInput(
  { value, onSearch, debounceMs = 300, size = 'md', placeholder = 'Search…', onKeyDown, ...props },
  ref,
) {
  const [text, setText] = useState(value);
  const [lastValue, setLastValue] = useState(value);
  const debounced = useDebouncedCallback(onSearch, debounceMs);

  // Follow outside changes (back / forward, reset) — adjust state during render, not in an effect.
  if (value !== lastValue) {
    setLastValue(value);
    setText(value);
  }
  useEffect(() => debounced.cancel, [debounced.cancel]);

  const commit = (next: string) => {
    debounced.cancel();
    setText(next);
    onSearch(next);
  };

  return (
    <Input
      ref={ref}
      type="search"
      size={size}
      placeholder={placeholder}
      value={text}
      prefix={<Search aria-hidden="true" />}
      suffix={
        text ? (
          <button
            type="button"
            aria-label="Clear search"
            onClick={() => commit('')}
            className="touch-target -mr-1 inline-flex size-6 cursor-pointer items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-accent-foreground"
          >
            <X className="size-3.5" aria-hidden="true" />
          </button>
        ) : undefined
      }
      onChange={(event) => {
        setText(event.target.value);
        debounced.run(event.target.value);
      }}
      onKeyDown={(event) => {
        onKeyDown?.(event);
        if (event.key === 'Escape' && text) {
          event.preventDefault();
          commit('');
        } else if (event.key === 'Enter') {
          event.preventDefault();
          commit(text);
        }
      }}
      className="[&::-webkit-search-cancel-button]:hidden"
      {...props}
    />
  );
});
