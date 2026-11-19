import {
  createContext,
  useContext,
  useId,
  useMemo,
  useRef,
  type ButtonHTMLAttributes,
  type HTMLAttributes,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react';

import { useControllableState } from '@/hooks/useControllableState';
import { cn } from '@/lib/utils';

import { nextIndex } from '../primitives/list-navigation';

interface TabsContextValue {
  value: string;
  setValue: (value: string) => void;
  baseId: string;
  orientation: 'horizontal' | 'vertical';
  variant: 'underline' | 'pills';
  /** Arrow keys select immediately (automatic) or only move focus (manual). */
  activation: 'automatic' | 'manual';
}
const TabsContext = createContext<TabsContextValue | null>(null);
const useTabs = () => {
  const ctx = useContext(TabsContext);
  if (!ctx) throw new Error('Tabs parts must be inside <Tabs>');
  return ctx;
};

export interface TabsProps extends Omit<
  HTMLAttributes<HTMLDivElement>,
  'defaultValue' | 'onChange'
> {
  value?: string;
  defaultValue?: string;
  /** For URL-synced tabs pass the value from useQueryParams and set it here. */
  onValueChange?: (value: string) => void;
  orientation?: 'horizontal' | 'vertical';
  variant?: 'underline' | 'pills';
  activation?: 'automatic' | 'manual';
}

/**
 * Tabs (WAI-ARIA tabs pattern): one tab stop, ←/→ (or ↑/↓ vertical), Home / End.
 * URL-synced: `const [{ tab }, set] = useQueryParams({ tab: 'overview' })` →
 * `<Tabs value={tab} onValueChange={(t) => set({ tab: t })}>`.
 */
export function Tabs({
  value,
  defaultValue = '',
  onValueChange,
  orientation = 'horizontal',
  variant = 'underline',
  activation = 'automatic',
  className,
  ...props
}: TabsProps) {
  const [current, setValue] = useControllableState({
    value,
    defaultValue,
    onChange: onValueChange,
  });
  const baseId = useId();
  const contextValue = useMemo(
    () => ({ value: current, setValue, baseId, orientation, variant, activation }),
    [current, setValue, baseId, orientation, variant, activation],
  );
  return (
    <TabsContext.Provider value={contextValue}>
      <div
        data-orientation={orientation}
        className={cn(orientation === 'vertical' ? 'flex gap-6' : 'flex flex-col gap-4', className)}
        {...props}
      />
    </TabsContext.Provider>
  );
}

export function TabsList({ className, onKeyDown, ...props }: HTMLAttributes<HTMLDivElement>) {
  const { orientation, variant, setValue, activation } = useTabs();
  const listRef = useRef<HTMLDivElement | null>(null);

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    onKeyDown?.(event);
    const tabs = Array.from(
      listRef.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]') ?? [],
    );
    const current = tabs.indexOf(document.activeElement as HTMLButtonElement);
    const target = nextIndex(
      event.key,
      current,
      tabs.length,
      (i) => tabs[i]?.disabled === true,
      orientation,
    );
    if (target === null) return;
    event.preventDefault();
    const tab = tabs[target];
    tab?.focus();
    if (activation === 'automatic' && tab?.dataset.value) setValue(tab.dataset.value);
  };

  return (
    <div
      ref={listRef}
      role="tablist"
      aria-orientation={orientation}
      onKeyDown={handleKeyDown}
      className={cn(
        'flex',
        orientation === 'vertical'
          ? 'w-48 shrink-0 flex-col gap-1'
          : // Sideways scroll only when tabs don't fit; never a vertical scrollbar.
            'scrollbar-slim overflow-x-auto overflow-y-hidden',
        // A light strip with the tabs on it; the active one gets a straight bar underneath.
        variant === 'underline' &&
          orientation === 'horizontal' &&
          'gap-1 rounded-md border-b border-border bg-muted/60 px-2',
        variant === 'pills' && orientation === 'horizontal' && 'gap-1 rounded-md bg-muted p-1',
        className,
      )}
      {...props}
    />
  );
}

export interface TabsTriggerProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  value: string;
}

export function TabsTrigger({ value, className, onClick, ...props }: TabsTriggerProps) {
  const ctx = useTabs();
  const selected = ctx.value === value;
  return (
    <button
      type="button"
      role="tab"
      id={`${ctx.baseId}-tab-${value}`}
      aria-selected={selected}
      aria-controls={`${ctx.baseId}-panel-${value}`}
      tabIndex={selected ? 0 : -1}
      data-value={value}
      data-state={selected ? 'active' : 'inactive'}
      onClick={(event) => {
        onClick?.(event);
        if (!event.defaultPrevented) ctx.setValue(value);
      }}
      className={cn(
        'inline-flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-sm font-medium whitespace-nowrap text-muted-foreground transition-colors hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50 pointer-coarse:min-h-11 [&_svg]:size-4',
        ctx.variant === 'underline' &&
          ctx.orientation === 'horizontal' &&
          'relative rounded-none px-3.5 py-3 after:absolute after:inset-x-2 after:bottom-0 after:h-0.5 after:bg-transparent after:transition-colors data-[state=active]:font-semibold data-[state=active]:text-primary data-[state=active]:after:bg-primary',
        ctx.variant === 'underline' &&
          ctx.orientation === 'vertical' &&
          'justify-start data-[state=active]:bg-primary-soft data-[state=active]:text-primary-soft-foreground',
        ctx.variant === 'pills' &&
          'data-[state=active]:bg-surface data-[state=active]:text-foreground',
        className,
      )}
      {...props}
    />
  );
}

export interface TabsContentProps extends HTMLAttributes<HTMLDivElement> {
  value: string;
  /** Keep the panel mounted (hidden) when inactive, e.g. to preserve form state. */
  forceMount?: boolean;
}

export function TabsContent({ value, forceMount = false, className, ...props }: TabsContentProps) {
  const ctx = useTabs();
  const selected = ctx.value === value;
  if (!selected && !forceMount) return null;
  return (
    <div
      role="tabpanel"
      id={`${ctx.baseId}-panel-${value}`}
      aria-labelledby={`${ctx.baseId}-tab-${value}`}
      hidden={!selected}
      tabIndex={0}
      className={cn(
        'min-w-0 flex-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
        className,
      )}
      {...props}
    />
  );
}
