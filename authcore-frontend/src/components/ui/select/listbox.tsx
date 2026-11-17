import { Check } from 'lucide-react';
import { useEffect, useRef, type RefObject } from 'react';

import { cn } from '@/lib/utils';

import { Portal } from '../primitives/Portal';
import { useFloating } from '../primitives/useFloating';
import { optionId, type SelectOption } from './listbox-utils';

interface ListboxPopupProps {
  open: boolean;
  anchorRef: RefObject<HTMLElement | null>;
  listId: string;
  options: Array<SelectOption & { group?: string }>;
  activeIndex: number;
  selectedValues: readonly string[];
  onActiveChange: (index: number) => void;
  onSelect: (index: number) => void;
  emptyText?: string;
  label?: string;
  multiple?: boolean;
  /** Clicks inside count as "inside" for the trigger's outside-click handling. */
  popupRef: RefObject<HTMLDivElement | null>;
}

/** The floating listbox shared by Select and Combobox (focus stays on the trigger / input). */
export function ListboxPopup({
  open,
  anchorRef,
  listId,
  options,
  activeIndex,
  selectedValues,
  onActiveChange,
  onSelect,
  emptyText = 'No options',
  label,
  multiple = false,
  popupRef,
}: ListboxPopupProps) {
  const { style } = useFloating(anchorRef, popupRef, {
    open,
    side: 'bottom',
    align: 'start',
    offset: 4,
    matchWidth: true,
  });
  const listRef = useRef<HTMLDivElement | null>(null);

  // Keep the active option visible while moving with the keyboard.
  useEffect(() => {
    if (!open || activeIndex < 0) return;
    document.getElementById(optionId(listId, activeIndex))?.scrollIntoView({ block: 'nearest' });
  }, [open, activeIndex, listId]);

  if (!open) return null;
  return (
    <Portal>
      <div
        ref={popupRef}
        style={{ ...style, zIndex: 'var(--z-dropdown)' }}
        className="flex max-h-72 flex-col overflow-hidden rounded-md border border-border bg-surface text-sm text-surface-foreground shadow-popover"
        // Keep focus on the trigger / input while clicking options.
        onMouseDown={(event) => event.preventDefault()}
      >
        <div
          ref={listRef}
          id={listId}
          role="listbox"
          aria-label={label}
          aria-multiselectable={multiple || undefined}
          className="overflow-y-auto p-1"
        >
          {options.length === 0 && (
            <div className="px-2 py-6 text-center text-muted-foreground">{emptyText}</div>
          )}
          {options.map((option, index) => {
            const showGroup =
              option.group !== undefined && option.group !== options[index - 1]?.group;
            const selected = selectedValues.includes(option.value);
            return (
              <div key={option.value} role="presentation">
                {showGroup && (
                  <div
                    role="presentation"
                    className="px-2 pt-2 pb-1 text-xs font-semibold text-muted-foreground"
                  >
                    {option.group}
                  </div>
                )}
                <div
                  id={optionId(listId, index)}
                  role="option"
                  tabIndex={-1}
                  aria-selected={selected}
                  aria-disabled={option.disabled || undefined}
                  data-active={index === activeIndex || undefined}
                  onPointerMove={() =>
                    !option.disabled && index !== activeIndex && onActiveChange(index)
                  }
                  onClick={() => !option.disabled && onSelect(index)}
                  className={cn(
                    'relative flex cursor-pointer items-center gap-2 rounded-md py-1.5 pr-8 pl-2 select-none',
                    'data-[active]:bg-accent data-[active]:text-accent-foreground',
                    'aria-disabled:cursor-not-allowed aria-disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0',
                  )}
                >
                  {option.icon}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate">{option.label}</span>
                    {option.description && (
                      <span className="block truncate text-xs text-muted-foreground">
                        {option.description}
                      </span>
                    )}
                  </span>
                  {selected && (
                    <Check className="absolute right-2 text-primary" aria-hidden="true" />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </Portal>
  );
}
