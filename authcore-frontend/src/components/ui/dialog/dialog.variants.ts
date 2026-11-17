import { variants } from '@/lib/utils';

export const dialogPanelVariants = variants({
  base: 'fixed flex flex-col border border-border bg-surface text-surface-foreground shadow-popover outline-none',
  variants: {
    placement: {
      center:
        'top-1/2 left-1/2 max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/2 rounded-md',
      right: 'inset-y-0 right-0 h-dvh w-full max-w-[calc(100vw-3rem)] border-y-0 border-r-0',
      left: 'inset-y-0 left-0 h-dvh w-full max-w-[calc(100vw-3rem)] border-y-0 border-l-0',
      top: 'inset-x-0 top-0 max-h-[85dvh] w-full border-x-0 border-t-0',
      bottom: 'inset-x-0 bottom-0 max-h-[85dvh] w-full rounded-md border-x-0 border-b-0',
    },
    size: { sm: '', md: '', lg: '', xl: '', full: '' },
  },
  compoundVariants: [
    { placement: 'center', size: 'sm', className: 'sm:max-w-sm' },
    { placement: 'center', size: 'md', className: 'sm:max-w-lg' },
    { placement: 'center', size: 'lg', className: 'sm:max-w-2xl' },
    { placement: 'center', size: 'xl', className: 'sm:max-w-4xl' },
    {
      placement: 'center',
      size: 'full',
      className: 'h-[calc(100dvh-2rem)] sm:max-w-[calc(100vw-2rem)]',
    },
    { placement: 'right', size: 'sm', className: 'sm:max-w-xs' },
    { placement: 'right', size: 'md', className: 'sm:max-w-sm' },
    { placement: 'right', size: 'lg', className: 'sm:max-w-lg' },
    { placement: 'right', size: 'xl', className: 'sm:max-w-2xl' },
    { placement: 'left', size: 'sm', className: 'sm:max-w-xs' },
    { placement: 'left', size: 'md', className: 'sm:max-w-sm' },
    { placement: 'left', size: 'lg', className: 'sm:max-w-lg' },
    { placement: 'left', size: 'xl', className: 'sm:max-w-2xl' },
  ],
  defaultVariants: { placement: 'center', size: 'md' },
});
