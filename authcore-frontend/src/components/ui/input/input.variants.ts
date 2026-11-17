import { variants } from '@/lib/utils';

/**
 * Shared by Input, Textarea, Select and Combobox triggers so every control looks the same.
 * Focus = theme (primary) border only, no glow ring; invalid = danger border, also while focused.
 */
export const controlVariants = variants({
  base: 'w-full min-w-0 rounded-md text-sm text-foreground transition-colors outline-none placeholder:text-muted-foreground focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60 aria-invalid:border-danger aria-invalid:focus:border-danger aria-invalid:focus-within:border-danger',
  variants: {
    variant: {
      outlined: 'border border-field bg-surface focus:border-primary',
      filled:
        'border border-transparent border-b-field bg-muted focus:border-primary focus:bg-surface',
      underlined:
        'border-x-0 border-t-0 border-b-2 border-field bg-transparent px-0! focus:border-primary',
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
