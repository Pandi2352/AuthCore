import { CornerDownLeft, Search } from 'lucide-react';
import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react';

import { cn } from '@/lib/utils';

import { Dialog, DialogContent } from '../dialog';
import { Kbd } from '../kbd';
import { filterCommandGroups, type CommandGroup } from './command-filter';

export interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groups: readonly CommandGroup[];
  placeholder?: string;
  emptyText?: string;
  /** Accessible name of the dialog. */
  label?: string;
}

/**
 * Command menu / global search (own implementation, no library): a dialog with a search
 * box (role="combobox") and a grouped listbox. ↑/↓ move, Home / End jump, Enter runs the
 * command, Escape closes; focus returns to where it was.
 */
export function CommandPalette({
  open,
  onOpenChange,
  groups,
  placeholder = 'Search pages and actions…',
  emptyText = 'No results',
  label = 'Command menu',
}: CommandPaletteProps) {
  const listId = useId();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const visible = useMemo(() => filterCommandGroups(groups, query), [groups, query]);
  const flat = useMemo(() => visible.flatMap((g) => g.items), [visible]);
  /** Index of each group's first item in `flat`. */
  const offsets = useMemo(
    () => visible.map((_group, gi) => visible.slice(0, gi).reduce((n, g) => n + g.items.length, 0)),
    [visible],
  );
  const optionId = (index: number) => `${listId}-${index}`;

  // Keep the highlighted option in view.
  useEffect(() => {
    if (open) document.getElementById(`${listId}-${active}`)?.scrollIntoView({ block: 'nearest' });
  }, [open, active, listId]);

  const close = () => {
    onOpenChange(false);
    setQuery('');
    setActive(0);
  };
  const run = (index: number) => {
    const item = flat[index];
    if (!item || item.disabled) return;
    close();
    // After the dialog is gone (focus restored), so navigation / focus changes win.
    requestAnimationFrame(() => item.onSelect());
  };
  const move = (from: number, step: number) => {
    for (let i = 1; i <= flat.length; i++) {
      const next = (((from + step * i) % flat.length) + flat.length) % flat.length;
      if (!flat[next]?.disabled) return next;
    }
    return from;
  };

  const onKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (flat.length === 0) return;
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      setActive(move(active, event.key === 'ArrowDown' ? 1 : -1));
    } else if (event.key === 'Home' && event.ctrlKey) {
      event.preventDefault();
      setActive(move(-1, 1));
    } else if (event.key === 'End' && event.ctrlKey) {
      event.preventDefault();
      setActive(move(flat.length, -1));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      run(active);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? onOpenChange(true) : close())}>
      <DialogContent
        aria-label={label}
        hideClose
        size="lg"
        mobileLayout="dialog"
        initialFocus={inputRef}
        className="top-[12vh] max-h-[min(36rem,76dvh)] translate-y-0 overflow-hidden"
      >
        <div className="flex items-center gap-3 border-b border-border px-4">
          <Search className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <input
            ref={inputRef}
            type="text"
            role="combobox"
            aria-expanded="true"
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={flat.length ? optionId(active) : undefined}
            aria-label={label}
            autoComplete="off"
            spellCheck={false}
            placeholder={placeholder}
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setActive(0);
            }}
            onKeyDown={onKeyDown}
            className="h-14 min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
          />
          <Kbd>Esc</Kbd>
        </div>

        <div
          id={listId}
          role="listbox"
          aria-label={label}
          className="min-h-0 flex-1 scrollbar-slim overflow-y-auto p-2"
        >
          {flat.length === 0 && (
            <p className="px-2 py-10 text-center text-sm text-muted-foreground">{emptyText}</p>
          )}
          {visible.map((group, groupIndex) => (
            <div
              key={group.id}
              role="group"
              aria-labelledby={`${listId}-${group.id}`}
              className="pb-2"
            >
              <div
                id={`${listId}-${group.id}`}
                className="px-2 pt-2 pb-1 text-xs font-semibold text-muted-foreground"
              >
                {group.heading}
              </div>
              {group.items.map((item, itemIndex) => {
                const i = (offsets[groupIndex] ?? 0) + itemIndex;
                return (
                  <div
                    key={item.id}
                    id={optionId(i)}
                    role="option"
                    tabIndex={-1}
                    aria-selected={i === active}
                    aria-disabled={item.disabled || undefined}
                    data-active={i === active || undefined}
                    onPointerMove={() => i !== active && !item.disabled && setActive(i)}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => run(i)}
                    className={cn(
                      'flex cursor-pointer items-center gap-3 rounded-md px-2 py-2 text-sm text-foreground select-none pointer-coarse:py-3',
                      'data-[active]:bg-accent data-[active]:text-accent-foreground',
                      'aria-disabled:cursor-not-allowed aria-disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0',
                    )}
                  >
                    <span className="text-muted-foreground">{item.icon}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate">{item.label}</span>
                      {item.description && (
                        <span className="block truncate text-xs text-muted-foreground">
                          {item.description}
                        </span>
                      )}
                    </span>
                    {item.badge && (
                      <span className="rounded-md bg-muted px-1.5 text-[11px] text-muted-foreground">
                        {item.badge}
                      </span>
                    )}
                    {item.shortcut && <Kbd>{item.shortcut}</Kbd>}
                    {i === active && (
                      <CornerDownLeft
                        className="size-3.5 text-muted-foreground"
                        aria-hidden="true"
                      />
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        <div className="flex items-center gap-4 border-t border-border px-4 py-2 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <Kbd>↑</Kbd>
            <Kbd>↓</Kbd> to navigate
          </span>
          <span className="inline-flex items-center gap-1">
            <Kbd>↵</Kbd> to open
          </span>
          <span className="inline-flex items-center gap-1">
            <Kbd>Esc</Kbd> to close
          </span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
