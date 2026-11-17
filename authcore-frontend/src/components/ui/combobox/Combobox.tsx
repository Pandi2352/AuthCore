import { ChevronDown, Search, X } from 'lucide-react';
import {
  forwardRef,
  useId,
  useMemo,
  useRef,
  useState,
  type InputHTMLAttributes,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react';

import { useOptionalTheme } from '@/app/theme';
import { useControllableState } from '@/hooks/useControllableState';
import { cn } from '@/lib/utils';

import { FieldShell, resolveInvalid, useFieldControlProps, type FieldShellProps } from '../field';
import { controlVariants, type ControlSize, type ControlVariant } from '../input';
import { composeRefs } from '../primitives/compose';
import { nextIndex } from '../primitives/list-navigation';
import { useDismiss } from '../primitives/useDismiss';
import { ListboxPopup } from '../select/listbox';
import { flattenOptions, optionId, type SelectItems } from '../select/listbox-utils';

export interface ComboboxProps
  extends
    Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'defaultValue' | 'onChange' | 'size'>,
    FieldShellProps {
  options: SelectItems;
  value?: string | null;
  defaultValue?: string | null;
  onValueChange?: (value: string | null) => void;
  /** Called while typing (e.g. to load options from the server). */
  onSearchChange?: (query: string) => void;
  /** Filter locally (default true). Set false when the parent filters / loads options. */
  filterLocally?: boolean;
  variant?: ControlVariant;
  size?: ControlSize;
  invalid?: boolean;
  emptyText?: string;
  name?: string;
}

/**
 * Searchable select: type to filter, ↑/↓ to move, Enter to choose, Escape to close
 * (a second Escape clears the text). Leaving the field restores the chosen label.
 */
const BareCombobox = forwardRef<
  HTMLInputElement,
  Omit<ComboboxProps, 'label' | 'hint' | 'error' | 'fieldClassName'>
>(function BareCombobox(
  {
    options,
    value,
    defaultValue = null,
    onValueChange,
    onSearchChange,
    filterLocally = true,
    variant,
    size = 'md',
    invalid,
    emptyText = 'No results',
    name,
    placeholder = 'Search…',
    className,
    disabled,
    onBlur,
    onClick,
    ...props
  },
  ref,
) {
  const theme = useOptionalTheme();
  const listId = useId();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const popupRef = useRef<HTMLDivElement | null>(null);
  const all = useMemo(() => flattenOptions(options), [options]);
  const [selected, setSelected] = useControllableState<string | null>({
    value,
    defaultValue,
    onChange: onValueChange,
  });
  const selectedLabel = all.find((o) => o.value === selected)?.label ?? '';
  const [query, setQuery] = useState<string | null>(null); // null = showing the selected label
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const { invalid: isInvalid, ...a11y } = useFieldControlProps({ ...props, invalid, disabled });

  const visible = useMemo(() => {
    if (!filterLocally || !query) return all;
    const q = query.trim().toLowerCase();
    return all.filter(
      (o) => o.label.toLowerCase().includes(q) || o.description?.toLowerCase().includes(q),
    );
  }, [all, query, filterLocally]);
  const isDisabled = (i: number) => visible[i]?.disabled === true;

  const close = () => {
    setOpen(false);
    setQuery(null);
    setActiveIndex(-1);
  };
  const choose = (index: number) => {
    const option = visible[index];
    if (!option || option.disabled) return;
    setSelected(option.value);
    close();
  };
  useDismiss(open, close, [wrapperRef, popupRef]);

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    props.onKeyDown?.(event);
    if (event.defaultPrevented) return;
    const { key } = event;
    if (key === 'ArrowDown' || key === 'ArrowUp') {
      event.preventDefault();
      if (!open) {
        setOpen(true);
        setActiveIndex(
          nextIndex(key === 'ArrowUp' ? 'End' : 'Home', -1, visible.length, isDisabled) ?? -1,
        );
        return;
      }
      setActiveIndex(nextIndex(key, activeIndex, visible.length, isDisabled) ?? activeIndex);
    } else if ((key === 'Home' || key === 'End') && open && event.ctrlKey) {
      event.preventDefault();
      setActiveIndex(nextIndex(key, activeIndex, visible.length, isDisabled) ?? activeIndex);
    } else if (key === 'Enter' && open) {
      event.preventDefault();
      if (activeIndex >= 0) choose(activeIndex);
    } else if (key === 'Escape') {
      if (open) return; // useDismiss closes
      if (query) setQuery(null);
    } else if (key === 'Tab' && open) {
      close();
    }
  };

  const look = variant ?? theme?.appearance.inputs ?? 'outlined';
  return (
    <div
      ref={wrapperRef}
      aria-invalid={isInvalid || undefined}
      className={cn(
        controlVariants({ variant: look, size }),
        'flex items-center gap-2 focus-within:border-primary',
        disabled && 'cursor-not-allowed opacity-60',
        className,
      )}
    >
      <Search className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      <input
        {...props}
        ref={composeRefs(ref, inputRef)}
        type="text"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-activedescendant={open && activeIndex >= 0 ? optionId(listId, activeIndex) : undefined}
        autoComplete="off"
        placeholder={placeholder}
        value={query ?? selectedLabel}
        onChange={(event) => {
          setQuery(event.target.value);
          onSearchChange?.(event.target.value);
          setOpen(true);
          setActiveIndex(0);
        }}
        onClick={(event) => {
          onClick?.(event);
          if (!event.defaultPrevented && !open) setOpen(true);
        }}
        onBlur={(event) => {
          onBlur?.(event);
          if (!popupRef.current?.contains(event.relatedTarget as Node | null)) setQuery(null);
        }}
        className="h-full min-w-0 flex-1 cursor-text bg-transparent outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed"
        {...a11y}
        onKeyDown={handleKeyDown}
      />
      {selected !== null && !disabled && (
        <button
          type="button"
          aria-label="Clear selection"
          onClick={() => {
            setSelected(null);
            setQuery(null);
            inputRef.current?.focus();
          }}
          className="touch-target inline-flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-accent-foreground"
        >
          <X className="size-3.5" aria-hidden="true" />
        </button>
      )}
      <button
        type="button"
        tabIndex={-1}
        aria-label={open ? 'Close options' : 'Show options'}
        disabled={disabled}
        onClick={() => {
          if (open) close();
          else {
            setOpen(true);
            inputRef.current?.focus();
          }
        }}
        className="inline-flex shrink-0 cursor-pointer text-muted-foreground disabled:cursor-not-allowed"
      >
        <ChevronDown
          className={cn('size-4 transition-transform', open && 'rotate-180')}
          aria-hidden="true"
        />
      </button>
      {name && <input type="hidden" name={name} value={selected ?? ''} />}
      <ListboxPopup
        open={open}
        anchorRef={wrapperRef}
        popupRef={popupRef}
        listId={listId}
        options={visible}
        activeIndex={activeIndex}
        selectedValues={selected === null ? [] : [selected]}
        onActiveChange={setActiveIndex}
        onSelect={choose}
        emptyText={emptyText}
      />
    </div>
  );
});

/**
 * Combobox with the shared field props: pass label / hint / error / required from the
 * parent for a complete field. Native props and events (onBlur, onFocus, onKeyDown, onClick,
 * ref …) are forwarded and run before the built-in behavior.
 */
export const Combobox = forwardRef<HTMLInputElement, ComboboxProps>(function Combobox(
  { label, hint, error, fieldClassName, invalid, ...props },
  ref,
) {
  return (
    <FieldShell
      label={label}
      hint={hint}
      error={error}
      required={props.required}
      disabled={props.disabled}
      id={props.id}
      fieldClassName={fieldClassName}
    >
      <BareCombobox ref={ref} invalid={resolveInvalid(invalid, error)} {...props} />
    </FieldShell>
  );
});
