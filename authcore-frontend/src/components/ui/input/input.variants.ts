import { variants } from '@/lib/utils';

/** Shared by Input, Textarea, Select and Combobox triggers so every control looks the same. */
export const controlVariants = variants({
  base: 'w-full min-w-0 rounded-md text-sm text-foreground transition-colors outline-none placeholder:text-muted-foreground focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60 aria-invalid:border-danger aria-invalid:focus-within:ring-danger/25 aria-invalid:focus:ring-danger/25',
  variants: {
    variant: {
      outlined: 'border border-input bg-surface focus:border-ring focus:ring-2 focus:ring-ring/25',
      filled:
        'border border-transparent bg-muted focus:border-ring focus:bg-surface focus:ring-2 focus:ring-ring/25',
      underlined:
        'border-x-0 border-t-0 border-b-2 border-input bg-transparent px-0! focus:border-ring',
    },
    size: {
      sm: 'h-control-sm px-2.5 text-xs',
      md: 'h-control-md px-3',
      lg: 'h-control-lg px-3.5 text-base',
    },
  },
  defaultVariants: { variant: 'outlined', size: 'md' },
});

export type ControlVariant = 'outlined' | 'filled' | 'underlined';
export type ControlSize = 'sm' | 'md' | 'lg';
