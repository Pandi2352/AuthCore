import { Check, ChevronRight, Circle } from 'lucide-react';
import {
  createContext,
  forwardRef,
  useCallback,
  useContext,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type HTMLAttributes,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
  type PointerEvent as ReactPointerEvent,
  type Ref,
  type RefObject,
} from 'react';

import { useControllableState } from '@/hooks/useControllableState';
import { cn } from '@/lib/utils';

import { composeRefs } from '../primitives/compose';
import { createTypeahead, nextIndex } from '../primitives/list-navigation';
import { Portal } from '../primitives/Portal';
import { Slot } from '../primitives/Slot';
import { useDismiss } from '../primitives/useDismiss';
import { useFloating, type Align, type Side } from '../primitives/useFloating';

// ---------------------------------------------------------------- contexts

type OpenedWith = 'keyboard' | 'pointer' | 'last';

interface RootContextValue {
  open: boolean;
  setOpen: (open: boolean) => void;
  /** Close every level and give focus back to the trigger. */
  closeAll: () => void;
  triggerRef: RefObject<HTMLElement | null>;
  contentId: string;
  /** Root content + open submenus: clicks inside any of them are not "outside". Returns unregister. */
  registerLayer: (ref: RefObject<HTMLElement | null>) => () => void;
  getLayers: () => Array<RefObject<HTMLElement | null>>;
  /** How the menu was opened: keyboard → focus first item; pointer → focus the menu. */
  setOpenedWith: (how: OpenedWith) => void;
  getOpenedWith: () => OpenedWith;
}
const RootContext = createContext<RootContextValue | null>(null);
const useRoot = () => {
  const ctx = useContext(RootContext);
  if (!ctx) throw new Error('DropdownMenu parts must be inside <DropdownMenu>');
  return ctx;
};

/** Per menu level: which submenu is open. */
interface LevelContextValue {
  openSubId: string | null;
  setOpenSubId: (id: string | null) => void;
}
const LevelContext = createContext<LevelContextValue | null>(null);

interface SubContextValue {
  id: string;
  open: boolean;
  setOpen: (open: boolean) => void;
  contentId: string;
  triggerElement: HTMLElement | null;
  /** Callback ref for the sub trigger element. */
  setTriggerElement: (el: HTMLElement | null) => void;
  setFocusFirstOnOpen: (value: boolean) => void;
  shouldFocusFirst: () => boolean;
}
const SubContext = createContext<SubContextValue | null>(null);

const ITEM_SELECTOR = '[data-menu-item]';

function menuItems(menu: HTMLElement): HTMLElement[] {
  return Array.from(menu.querySelectorAll<HTMLElement>(ITEM_SELECTOR)).filter(
    (el) => el.closest('[role="menu"]') === menu,
  );
}

// ---------------------------------------------------------------- root + trigger

export interface DropdownMenuProps {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: ReactNode;
}

export function DropdownMenu({
  open,
  defaultOpen = false,
  onOpenChange,
  children,
}: DropdownMenuProps) {
  const [isOpen, setOpen] = useControllableState({
    value: open,
    defaultValue: defaultOpen,
    onChange: onOpenChange,
  });
  const triggerRef = useRef<HTMLElement | null>(null);
  const contentId = useId();
  const layersRef = useRef<Array<RefObject<HTMLElement | null>>>([triggerRef]);
  const openedWithRef = useRef<OpenedWith>('pointer');
  const registerLayer = useCallback((ref: RefObject<HTMLElement | null>) => {
    layersRef.current = [...layersRef.current, ref];
    return () => {
      layersRef.current = layersRef.current.filter((r) => r !== ref);
    };
  }, []);
  const getLayers = useCallback(() => layersRef.current, []);
  const setOpenedWith = useCallback((how: OpenedWith) => {
    openedWithRef.current = how;
  }, []);
  const getOpenedWith = useCallback(() => openedWithRef.current, []);
  const closeAll = useCallback(() => {
    setOpen(false);
    triggerRef.current?.focus({ preventScroll: true });
  }, [setOpen]);

  const value = useMemo(
    () => ({
      open: isOpen,
      setOpen,
      closeAll,
      triggerRef,
      contentId,
      registerLayer,
      getLayers,
      setOpenedWith,
      getOpenedWith,
    }),
    [isOpen, setOpen, closeAll, contentId, registerLayer, getLayers, setOpenedWith, getOpenedWith],
  );
  return <RootContext.Provider value={value}>{children}</RootContext.Provider>;
}

export const DropdownMenuTrigger = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement> & { asChild?: boolean }
>(function DropdownMenuTrigger({ asChild, onClick, onKeyDown, ...props }, ref) {
  const { open, setOpen, triggerRef, contentId, setOpenedWith } = useRoot();
  const Comp = asChild ? Slot : 'button';
  return (
    <Comp
      ref={composeRefs(ref, triggerRef as RefObject<HTMLButtonElement | null>)}
      type={asChild ? undefined : 'button'}
      aria-haspopup="menu"
      aria-expanded={open}
      aria-controls={open ? contentId : undefined}
      data-state={open ? 'open' : 'closed'}
      onClick={(event: ReactMouseEvent<HTMLButtonElement>) => {
        onClick?.(event);
        if (event.defaultPrevented) return;
        // detail 0 = activated with the keyboard (Enter / Space)
        setOpenedWith(event.detail === 0 ? 'keyboard' : 'pointer');
        setOpen(!open);
      }}
      onKeyDown={(event: ReactKeyboardEvent<HTMLButtonElement>) => {
        onKeyDown?.(event);
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
          event.preventDefault();
          setOpenedWith(event.key === 'ArrowUp' ? 'last' : 'keyboard');
          setOpen(true);
        }
      }}
      {...props}
    />
  );
});

// ---------------------------------------------------------------- menu surface (shared)

interface MenuSurfaceProps extends HTMLAttributes<HTMLDivElement> {
  surfaceRef: RefObject<HTMLDivElement | null>;
  forwardedRef?: Ref<HTMLDivElement>;
  /** Extra keys for submenus (ArrowLeft / Escape → back to the parent). */
  onBack?: () => void;
}

function MenuSurface({
  surfaceRef,
  forwardedRef,
  onBack,
  className,
  onKeyDown,
  children,
  ...props
}: MenuSurfaceProps) {
  const { closeAll } = useRoot();
  const [openSubId, setOpenSubId] = useState<string | null>(null);
  const typeahead = useMemo(() => createTypeahead(), []);
  const levelValue = useMemo(() => ({ openSubId, setOpenSubId }), [openSubId]);

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    onKeyDown?.(event);
    const menu = surfaceRef.current;
    if (event.defaultPrevented || !menu) return;
    // Keys inside an open submenu are handled by that submenu's surface.
    if ((event.target as HTMLElement).closest('[role="menu"]') !== menu) return;
    const items = menuItems(menu);
    const current = items.indexOf(document.activeElement as HTMLElement);
    const isDisabled = (i: number) => items[i]?.getAttribute('aria-disabled') === 'true';

    if (event.key === 'Tab') {
      event.preventDefault();
      closeAll();
      return;
    }
    if (onBack && (event.key === 'ArrowLeft' || event.key === 'Escape')) {
      event.preventDefault();
      event.stopPropagation();
      onBack();
      return;
    }
    const target =
      nextIndex(event.key, current, items.length, isDisabled) ??
      typeahead(
        event.key,
        items.map((el) => el.textContent?.trim() ?? ''),
        current,
        isDisabled,
      );
    if (target !== null) {
      event.preventDefault();
      items[target]?.focus();
    }
  };

  return (
    <LevelContext.Provider value={levelValue}>
      {/* role="menu" container handles roving focus for its items */}
      {/* oxlint-disable-next-line jsx-a11y/no-noninteractive-element-interactions */}
      <div
        ref={composeRefs(surfaceRef, forwardedRef)}
        role="menu"
        tabIndex={-1}
        aria-orientation="vertical"
        onKeyDown={handleKeyDown}
        className={cn(
          'min-w-48 overflow-y-auto rounded-md border border-border bg-surface p-1 text-sm text-surface-foreground shadow-popover outline-none',
          className,
        )}
        {...props}
      >
        {children}
      </div>
    </LevelContext.Provider>
  );
}

export interface DropdownMenuContentProps extends HTMLAttributes<HTMLDivElement> {
  side?: Side;
  align?: Align;
  sideOffset?: number;
}

export const DropdownMenuContent = forwardRef<HTMLDivElement, DropdownMenuContentProps>(
  function DropdownMenuContent(
    { side = 'bottom', align = 'start', sideOffset = 6, style: styleProp, ...props },
    ref,
  ) {
    const { open, closeAll, triggerRef, contentId, registerLayer, getLayers, getOpenedWith } =
      useRoot();
    const contentRef = useRef<HTMLDivElement | null>(null);
    const { style, placement } = useFloating(triggerRef, contentRef, {
      open,
      side,
      align,
      offset: sideOffset,
    });

    useEffect(() => registerLayer(contentRef), [registerLayer]);
    // Escape / click outside the trigger, the menu and any open submenu → close everything
    useDismiss(open, closeAll, getLayers);

    useEffect(() => {
      if (!open) return;
      const frame = requestAnimationFrame(() => {
        const menu = contentRef.current;
        if (!menu) return;
        const items = menuItems(menu).filter((el) => el.getAttribute('aria-disabled') !== 'true');
        const how = getOpenedWith();
        if (how === 'keyboard') (items[0] ?? menu).focus();
        else if (how === 'last') (items[items.length - 1] ?? menu).focus();
        else menu.focus({ preventScroll: true });
      });
      return () => cancelAnimationFrame(frame);
    }, [open, getOpenedWith]);

    if (!open) return null;
    return (
      <Portal>
        <MenuSurface
          surfaceRef={contentRef}
          forwardedRef={ref}
          id={contentId}
          data-side={placement}
          style={{ ...style, zIndex: 'var(--z-dropdown)', ...styleProp }}
          {...props}
        />
      </Portal>
    );
  },
);

// ---------------------------------------------------------------- items

function useMenuItem({
  disabled,
  onSelect,
  closeOnSelect = true,
}: {
  disabled?: boolean;
  onSelect?: (event: ReactMouseEvent<HTMLElement>) => void;
  closeOnSelect?: boolean;
}) {
  const { closeAll } = useRoot();
  const level = useContext(LevelContext);
  return {
    'data-menu-item': '',
    tabIndex: -1,
    'aria-disabled': disabled || undefined,
    onClick: (event: ReactMouseEvent<HTMLElement>) => {
      if (disabled) {
        event.preventDefault();
        return;
      }
      onSelect?.(event);
      if (!event.defaultPrevented && closeOnSelect) closeAll();
    },
    onKeyDown: (event: ReactKeyboardEvent<HTMLElement>) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        (event.currentTarget as HTMLElement).click();
      }
    },
    onPointerMove: (event: ReactPointerEvent<HTMLElement>) => {
      if (disabled) return;
      if (document.activeElement !== event.currentTarget)
        event.currentTarget.focus({ preventScroll: true });
      level?.setOpenSubId(null);
    },
  };
}

const itemClass =
  'relative flex w-full cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-left outline-none select-none focus:bg-accent focus:text-accent-foreground aria-disabled:cursor-not-allowed aria-disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0';

export interface DropdownMenuItemProps extends Omit<HTMLAttributes<HTMLDivElement>, 'onSelect'> {
  onSelect?: (event: ReactMouseEvent<HTMLElement>) => void;
  disabled?: boolean;
  icon?: ReactNode;
  /** Keyboard shortcut hint, e.g. "⌘K" (display only). */
  shortcut?: string;
  destructive?: boolean;
  /** Keep the menu open after selecting. */
  closeOnSelect?: boolean;
  /** Render the child (e.g. a router <Link>) as the item. */
  asChild?: boolean;
}

export const DropdownMenuItem = forwardRef<HTMLDivElement, DropdownMenuItemProps>(
  function DropdownMenuItem(
    {
      onSelect,
      disabled,
      icon,
      shortcut,
      destructive,
      closeOnSelect,
      asChild,
      className,
      children,
      ...props
    },
    ref,
  ) {
    const itemProps = useMenuItem({ disabled, onSelect, closeOnSelect });
    const classes = cn(
      itemClass,
      destructive && 'text-danger focus:bg-danger-soft focus:text-danger',
      className,
    );
    if (asChild) {
      return (
        <Slot ref={ref} role="menuitem" className={classes} {...itemProps} {...props}>
          {children}
        </Slot>
      );
    }
    return (
      <div ref={ref} role="menuitem" className={classes} {...itemProps} {...props}>
        {icon}
        <span className="flex-1 truncate">{children}</span>
        {shortcut && <DropdownMenuShortcut>{shortcut}</DropdownMenuShortcut>}
      </div>
    );
  },
);

export interface DropdownMenuCheckboxItemProps extends Omit<
  HTMLAttributes<HTMLDivElement>,
  'onSelect'
> {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  shortcut?: string;
  closeOnSelect?: boolean;
}

export function DropdownMenuCheckboxItem({
  checked,
  onCheckedChange,
  disabled,
  shortcut,
  closeOnSelect = false,
  className,
  children,
  ...props
}: DropdownMenuCheckboxItemProps) {
  const itemProps = useMenuItem({
    disabled,
    closeOnSelect,
    onSelect: () => onCheckedChange(!checked),
  });
  return (
    <div
      role="menuitemcheckbox"
      aria-checked={checked}
      className={cn(itemClass, 'pl-8', className)}
      {...itemProps}
      {...props}
    >
      <span className="absolute left-2 flex size-4 items-center justify-center" aria-hidden="true">
        {checked && <Check />}
      </span>
      <span className="flex-1 truncate">{children}</span>
      {shortcut && <DropdownMenuShortcut>{shortcut}</DropdownMenuShortcut>}
    </div>
  );
}

const RadioContext = createContext<{
  value: string;
  onValueChange: (value: string) => void;
} | null>(null);

export function DropdownMenuRadioGroup({
  value,
  onValueChange,
  children,
  ...props
}: { value: string; onValueChange: (value: string) => void } & HTMLAttributes<HTMLDivElement>) {
  const radioValue = useMemo(() => ({ value, onValueChange }), [value, onValueChange]);
  return (
    <RadioContext.Provider value={radioValue}>
      <div role="group" {...props}>
        {children}
      </div>
    </RadioContext.Provider>
  );
}

export function DropdownMenuRadioItem({
  value,
  disabled,
  closeOnSelect = false,
  className,
  children,
  ...props
}: { value: string; disabled?: boolean; closeOnSelect?: boolean } & Omit<
  HTMLAttributes<HTMLDivElement>,
  'onSelect'
>) {
  const group = useContext(RadioContext);
  const checked = group?.value === value;
  const itemProps = useMenuItem({
    disabled,
    closeOnSelect,
    onSelect: () => group?.onValueChange(value),
  });
  return (
    <div
      role="menuitemradio"
      aria-checked={checked}
      className={cn(itemClass, 'pl-8', className)}
      {...itemProps}
      {...props}
    >
      <span className="absolute left-2 flex size-4 items-center justify-center" aria-hidden="true">
        {checked && <Circle className="size-2! fill-current" />}
      </span>
      <span className="flex-1 truncate">{children}</span>
    </div>
  );
}

export function DropdownMenuLabel({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('px-2 py-1.5 text-xs font-semibold text-muted-foreground', className)}
      {...props}
    />
  );
}

export function DropdownMenuSeparator({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div role="separator" className={cn('-mx-1 my-1 h-px bg-border', className)} {...props} />;
}

export function DropdownMenuShortcut({ className, ...props }: HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn('ml-auto pl-4 text-xs tracking-widest text-muted-foreground', className)}
      {...props}
    />
  );
}

// ---------------------------------------------------------------- submenus

export function DropdownMenuSub({ children }: { children: ReactNode }) {
  const level = useContext(LevelContext);
  const id = useId();
  const contentId = useId();
  const [triggerElement, setTriggerElement] = useState<HTMLElement | null>(null);
  const focusFirstRef = useRef(false);
  const setFocusFirstOnOpen = useCallback((value: boolean) => {
    focusFirstRef.current = value;
  }, []);
  const shouldFocusFirst = useCallback(() => focusFirstRef.current, []);
  const open = level?.openSubId === id;
  const setOpen = useCallback(
    (next: boolean) => level?.setOpenSubId(next ? id : null),
    [level, id],
  );
  const subValue = useMemo(
    () => ({
      id,
      open,
      setOpen,
      contentId,
      triggerElement,
      setTriggerElement,
      setFocusFirstOnOpen,
      shouldFocusFirst,
    }),
    [id, open, setOpen, contentId, triggerElement, setFocusFirstOnOpen, shouldFocusFirst],
  );
  return <SubContext.Provider value={subValue}>{children}</SubContext.Provider>;
}

export function DropdownMenuSubTrigger({
  icon,
  disabled,
  className,
  children,
  ...props
}: { icon?: ReactNode; disabled?: boolean } & HTMLAttributes<HTMLDivElement>) {
  const sub = useContext(SubContext);
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(hoverTimer.current), []);
  if (!sub) throw new Error('DropdownMenuSubTrigger must be inside <DropdownMenuSub>');
  const { open, setOpen, contentId, setTriggerElement, setFocusFirstOnOpen } = sub;

  const openWithKeyboard = () => {
    setFocusFirstOnOpen(true);
    setOpen(true);
  };
  return (
    <div
      ref={setTriggerElement}
      role="menuitem"
      tabIndex={-1}
      data-menu-item=""
      aria-haspopup="menu"
      aria-expanded={open}
      aria-controls={open ? contentId : undefined}
      aria-disabled={disabled || undefined}
      data-state={open ? 'open' : 'closed'}
      className={cn(itemClass, 'data-[state=open]:bg-accent', className)}
      onClick={() => !disabled && openWithKeyboard()}
      onKeyDown={(event) => {
        if (disabled) return;
        if (event.key === 'ArrowRight' || event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          event.stopPropagation();
          openWithKeyboard();
        }
      }}
      onPointerMove={(event) => {
        if (disabled) return;
        if (document.activeElement !== event.currentTarget)
          event.currentTarget.focus({ preventScroll: true });
        if (!open) {
          clearTimeout(hoverTimer.current);
          hoverTimer.current = setTimeout(() => {
            setFocusFirstOnOpen(false);
            setOpen(true);
          }, 100);
        }
      }}
      onPointerLeave={() => clearTimeout(hoverTimer.current)}
      {...props}
    >
      {icon}
      <span className="flex-1 truncate">{children}</span>
      <ChevronRight className="ml-auto text-muted-foreground" aria-hidden="true" />
    </div>
  );
}

export function DropdownMenuSubContent({
  className,
  style: styleProp,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  const sub = useContext(SubContext);
  const { registerLayer } = useRoot();
  const contentRef = useRef<HTMLDivElement | null>(null);
  const open = sub?.open ?? false;
  const anchorRef = useRef<HTMLElement | null>(null);
  const triggerElement = sub?.triggerElement ?? null;
  useLayoutEffect(() => {
    anchorRef.current = triggerElement;
  }, [triggerElement]);
  const { style, placement } = useFloating(anchorRef, contentRef, {
    open,
    side: 'right',
    align: 'start',
    offset: 2,
  });

  useEffect(() => {
    if (!open) return;
    const unregister = registerLayer(contentRef);
    const frame = requestAnimationFrame(() => {
      if (sub?.shouldFocusFirst() && contentRef.current) {
        const first = menuItems(contentRef.current).find(
          (el) => el.getAttribute('aria-disabled') !== 'true',
        );
        first?.focus();
      }
    });
    return () => {
      cancelAnimationFrame(frame);
      unregister();
    };
  }, [open, registerLayer, sub]);

  if (!sub || !open) return null;
  return (
    <Portal>
      <MenuSurface
        surfaceRef={contentRef}
        id={sub.contentId}
        data-side={placement}
        onBack={() => {
          sub.setOpen(false);
          sub.triggerElement?.focus();
        }}
        style={{ ...style, zIndex: 'var(--z-dropdown)', ...styleProp }}
        className={className}
        {...props}
      />
    </Portal>
  );
}
