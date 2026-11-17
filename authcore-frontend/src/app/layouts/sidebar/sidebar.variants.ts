import { cn, variants } from '@/lib/utils';

/**
 * Sidebar looks (theme appearance.sidebar). "dark" uses the same layout as classic; its
 * colors come from [data-sidebar='dark'] tokens in styles/themes.css.
 */
export const sidebarVariants = variants({
  base: 'flex shrink-0 flex-col overflow-hidden bg-sidebar text-sidebar-foreground transition-[width] duration-200',
  variants: {
    variant: {
      classic: 'border-sidebar-border',
      dark: 'border-sidebar-border',
      minimal: 'border-transparent bg-background',
      compact: 'border-sidebar-border',
      floating: 'm-2 rounded-md border border-sidebar-border shadow-card',
    },
    position: { left: '', right: '' },
  },
  compoundVariants: [
    { variant: 'classic', position: 'left', className: 'border-r' },
    { variant: 'classic', position: 'right', className: 'border-l' },
    { variant: 'dark', position: 'left', className: 'border-r' },
    { variant: 'dark', position: 'right', className: 'border-l' },
    { variant: 'compact', position: 'left', className: 'border-r' },
    { variant: 'compact', position: 'right', className: 'border-l' },
  ],
  defaultVariants: { variant: 'classic', position: 'left' },
});

/** Row density per look. */
export const sidebarItemSize = {
  classic: 'h-8.5 text-sm pointer-coarse:h-11',
  dark: 'h-8.5 text-sm pointer-coarse:h-11',
  minimal: 'h-8.5 text-sm pointer-coarse:h-11',
  floating: 'h-8.5 text-sm pointer-coarse:h-11',
  compact: 'h-7.5 text-[13px] pointer-coarse:h-11',
} as const;

export const sidebarRowClass = (active: boolean) =>
  cn(
    'group/item flex w-full min-w-0 cursor-pointer items-center gap-3 rounded-md px-3 text-left transition-colors outline-none',
    'focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring',
    active
      ? 'bg-sidebar-active font-medium text-sidebar-active-foreground'
      : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
  );
