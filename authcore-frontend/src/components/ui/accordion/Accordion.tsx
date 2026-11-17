import { ChevronDown } from 'lucide-react';
import {
  createContext,
  useContext,
  useId,
  useMemo,
  type HTMLAttributes,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from 'react';

import { useControllableState } from '@/hooks/useControllableState';
import { cn } from '@/lib/utils';

import { nextIndex } from '../primitives/list-navigation';

interface AccordionContextValue {
  isOpen: (value: string) => boolean;
  toggle: (value: string) => void;
}
const AccordionContext = createContext<AccordionContextValue | null>(null);
const NONE: string[] = [];
const ItemContext = createContext<{ value: string; baseId: string; disabled: boolean } | null>(
  null,
);

export interface AccordionProps extends Omit<
  HTMLAttributes<HTMLDivElement>,
  'defaultValue' | 'onChange'
> {
  /** single: one section open at a time; multiple: any number. */
  type?: 'single' | 'multiple';
  value?: string[];
  defaultValue?: string[];
  onValueChange?: (value: string[]) => void;
  /** single mode: allow closing the open section (default true). */
  collapsible?: boolean;
}

/** Disclosure sections (WAI-ARIA accordion): Enter / Space toggle, ↑/↓/Home/End move between headers. */
export function Accordion({
  type = 'single',
  value,
  defaultValue = NONE,
  onValueChange,
  collapsible = true,
  className,
  onKeyDown,
  ...props
}: AccordionProps) {
  const [open, setOpen] = useControllableState({ value, defaultValue, onChange: onValueChange });
  const contextValue = useMemo(
    () => ({
      isOpen: (v: string) => open.includes(v),
      toggle: (item: string) => {
        if (open.includes(item)) {
          if (type === 'single' && !collapsible) return;
          setOpen(open.filter((v) => v !== item));
        } else {
          setOpen(type === 'single' ? [item] : [...open, item]);
        }
      },
    }),
    [open, type, collapsible, setOpen],
  );

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    onKeyDown?.(event);
    const triggers = Array.from(
      event.currentTarget.querySelectorAll<HTMLButtonElement>('[data-accordion-trigger]'),
    );
    const current = triggers.indexOf(document.activeElement as HTMLButtonElement);
    if (current < 0) return;
    const target = nextIndex(
      event.key,
      current,
      triggers.length,
      (i) => triggers[i]?.disabled === true,
    );
    if (target !== null) {
      event.preventDefault();
      triggers[target]?.focus();
    }
  };

  return (
    <AccordionContext.Provider value={contextValue}>
      <div
        className={cn('divide-y divide-border rounded-md border border-border', className)}
        onKeyDown={handleKeyDown}
        {...props}
      />
    </AccordionContext.Provider>
  );
}

export function AccordionItem({
  value,
  disabled = false,
  className,
  ...props
}: { value: string; disabled?: boolean } & HTMLAttributes<HTMLDivElement>) {
  const baseId = useId();
  const itemValue = useMemo(() => ({ value, baseId, disabled }), [value, baseId, disabled]);
  return (
    <ItemContext.Provider value={itemValue}>
      <div className={className} {...props} />
    </ItemContext.Provider>
  );
}

export function AccordionTrigger({
  className,
  children,
  headingLevel = 3,
}: {
  className?: string;
  children: ReactNode;
  /** Heading level wrapping the button (keeps the document outline correct). */
  headingLevel?: 2 | 3 | 4 | 5 | 6;
}) {
  const accordion = useContext(AccordionContext);
  const item = useContext(ItemContext);
  if (!accordion || !item) throw new Error('AccordionTrigger must be inside <AccordionItem>');
  const open = accordion.isOpen(item.value);
  const Heading = `h${headingLevel}` as const;
  return (
    <Heading className="m-0">
      <button
        type="button"
        data-accordion-trigger=""
        id={`${item.baseId}-trigger`}
        aria-expanded={open}
        aria-controls={`${item.baseId}-panel`}
        disabled={item.disabled}
        onClick={() => accordion.toggle(item.value)}
        className={cn(
          'flex w-full cursor-pointer items-center justify-between gap-4 rounded-md px-4 py-3 text-left text-sm font-medium text-foreground transition-colors hover:bg-accent/60 disabled:cursor-not-allowed disabled:opacity-50 pointer-coarse:min-h-11',
          className,
        )}
      >
        {children}
        <ChevronDown
          className={cn(
            'size-4 shrink-0 text-muted-foreground transition-transform',
            open && 'rotate-180',
          )}
          aria-hidden="true"
        />
      </button>
    </Heading>
  );
}

export function AccordionContent({ className, ...props }: HTMLAttributes<HTMLElement>) {
  const accordion = useContext(AccordionContext);
  const item = useContext(ItemContext);
  if (!accordion || !item) throw new Error('AccordionContent must be inside <AccordionItem>');
  const open = accordion.isOpen(item.value);
  return (
    <section
      id={`${item.baseId}-panel`}
      aria-labelledby={`${item.baseId}-trigger`}
      hidden={!open}
      className={cn('px-4 pt-1 pb-4 text-sm text-muted-foreground', className)}
      {...props}
    />
  );
}
