import { ChevronDown, X } from 'lucide-react';
import {
  forwardRef,
  useId,
  useMemo,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react';

import { useOptionalTheme } from '@/app/theme';
import { useControllableState } from '@/hooks/useControllableState';
import { cn } from '@/lib/utils';

import { useFieldControlProps } from '../field';
import { controlVariants, type ControlSize, type ControlVariant } from '../input';
import { composeRefs } from '../primitives/compose';
import { createTypeahead, nextIndex } from '../primitives/list-navigation';
import { useDismiss } from '../primitives/useDismiss';
import { ListboxPopup } from './listbox';
import { flattenOptions, optionId, type SelectItems } from './listbox-utils';

export interface SelectProps extends Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  'value' | 'defaultValue' | 'onChange' | 'children'
> {
  options: SelectItems;
  value?: string | null;
  defaultValue?: string | null;
  onValueChange?: (value: string | null) => void;
  placeholder?: string;
  variant?: ControlVariant;
  size?: ControlSize;
  invalid?: boolean;
  /** Show a × button that resets to no value. */
  clearable?: boolean;
  /** Form field name: a hidden input carries the value. */
  name?: string;
  required?: boolean;
  /** Classes for the floating list. */
  emptyText?: string;
}

/**
 * Custom select (no native <select>): a button with role="combobox" and a listbox popup.
 * Keyboard: ↑/↓/Enter/Space open; ↑/↓/Home/End/PageUp/PageDown move; type to jump; Enter /
 * Space choose; Escape / Tab close. While closed, typing or ↑/↓ change the value directly.
 */
export const Select = forwardRef<HTMLButtonElement, SelectProps>(function Select(
  {
    options,
    value,
    defaultValue = null,
    onValueChange,
    placeholder = 'Select…',
    variant,
    size = 'md',
    invalid,
    clearable = false,
    name,
    required,
    emptyText,
    className,
    disabled,
    onKeyDown,
    onBlur,
    ...props
  },
  ref,
) {
  const theme = useOptionalTheme();
  const listId = useId();
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const popupRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [selected, setSelected] = useControllableState<string | null>({
    value,
    defaultValue,
    onChange: onValueChange,
  });
  const flat = useMemo(() => flattenOptions(options), [options]);
  const typeahead = useMemo(() => createTypeahead(), []);
  const { invalid: isInvalid, ...a11y } = useFieldControlProps({
    ...props,
    invalid,
    required,
    disabled,
  });
  const selectedIndex = flat.findIndex((o) => o.value === selected);
  const selectedOption = flat[selectedIndex];
  const isDisabled = (i: number) => flat[i]?.disabled === true;

  const openList = (focus: 'selected' | 'first' | 'last') => {
    if (disabled) return;
    const first = nextIndex('Home', -1, flat.length, isDisabled) ?? -1;
    const last = nextIndex('End', -1, flat.length, isDisabled) ?? -1;
    setActiveIndex(
      focus === 'last' ? last : focus === 'selected' && selectedIndex >= 0 ? selectedIndex : first,
    );
    setOpen(true);
  };
  const close = () => setOpen(false);
  const choose = (index: number) => {
    const option = flat[index];
    if (!option || option.disabled) return;
    setSelected(option.value);
    close();
    triggerRef.current?.focus();
  };

  useDismiss(open, close, [triggerRef, popupRef]);

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>) => {
    onKeyDown?.(event);
    if (event.defaultPrevented || disabled) return;
    const { key } = event;
    if (!open) {
      if (key === 'ArrowDown' || key === 'Enter' || key === ' ') {
        event.preventDefault();
        openList('selected');
      } else if (key === 'ArrowUp') {
        event.preventDefault();
        openList(selectedIndex >= 0 ? 'selected' : 'last');
      } else {
        const match = typeahead(
          key,
          flat.map((o) => o.label),
          selectedIndex,
          isDisabled,
        );
        if (match !== null) setSelected(flat[match]?.value ?? null);
      }
      return;
    }
    if (key === 'Enter' || key === ' ') {
      event.preventDefault();
      if (activeIndex >= 0) choose(activeIndex);
    } else if (key === 'Tab') {
      close();
    } else if (key === 'PageDown' || key === 'PageUp') {
      event.preventDefault();
      const step = key === 'PageDown' ? 10 : -10;
      let target = Math.min(Math.max(activeIndex + step, 0), flat.length - 1);
      while (isDisabled(target) && target > 0 && target < flat.length - 1)
        target += Math.sign(step);
      setActiveIndex(target);
    } else {
      const target =
        nextIndex(key, activeIndex, flat.length, isDisabled) ??
        typeahead(
          key,
          flat.map((o) => o.label),
          activeIndex,
          isDisabled,
        );
      if (target !== null) {
        event.preventDefault();
        setActiveIndex(target);
      }
    }
  };

  const look = variant ?? theme?.appearance.inputs ?? 'outlined';
  return (
    <div className="relative w-full">
      <button
        ref={composeRefs(ref, triggerRef)}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-activedescendant={open && activeIndex >= 0 ? optionId(listId, activeIndex) : undefined}
        aria-required={required || undefined}
        data-placeholder={selectedOption ? undefined : ''}
        onClick={() => (open ? close() : openList('selected'))}
        onKeyDown={handleKeyDown}
        onBlur={onBlur}
        className={cn(
          controlVariants({ variant: look, size }),
          'flex cursor-pointer items-center gap-2 text-left',
          open && 'border-ring ring-2 ring-ring/25',
          clearable && selectedOption && 'pr-14',
          className,
        )}
        {...props}
        {...a11y}
        aria-invalid={isInvalid || undefined}
      >
        {selectedOption?.icon && (
          <span className="shrink-0 [&_svg]:size-4">{selectedOption.icon}</span>
        )}
        <span className={cn('min-w-0 flex-1 truncate', !selectedOption && 'text-muted-foreground')}>
          {selectedOption?.label ?? placeholder}
        </span>
        <ChevronDown
          className={cn(
            'size-4 shrink-0 text-muted-foreground transition-transform',
            open && 'rotate-180',
          )}
          aria-hidden="true"
        />
      </button>
      {clearable && selectedOption && !disabled && (
        <button
          type="button"
          aria-label="Clear selection"
          onClick={() => {
            setSelected(null);
            triggerRef.current?.focus();
          }}
          className="absolute top-1/2 right-8 inline-flex size-6 -translate-y-1/2 cursor-pointer items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-accent-foreground"
        >
          <X className="size-3.5" aria-hidden="true" />
        </button>
      )}
      {name && <input type="hidden" name={name} value={selected ?? ''} />}
      <ListboxPopup
        open={open}
        anchorRef={triggerRef}
        popupRef={popupRef}
        listId={listId}
        options={flat}
        activeIndex={activeIndex}
        selectedValues={selected === null ? [] : [selected]}
        onActiveChange={setActiveIndex}
        onSelect={choose}
        emptyText={emptyText}
        label={typeof props['aria-label'] === 'string' ? props['aria-label'] : undefined}
      />
    </div>
  );
});
