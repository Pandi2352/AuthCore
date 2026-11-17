import { variants, type VariantProps } from '@/lib/utils';

export const buttonVariants = variants({
  base: 'inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 rounded-md border border-transparent font-medium whitespace-nowrap transition-colors select-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0',
  variants: {
    variant: {
      solid: 'bg-primary text-primary-foreground hover:bg-primary-hover',
      soft: 'bg-primary-soft text-primary-soft-foreground hover:bg-primary-soft/70',
      outline:
        'border-input bg-surface text-foreground hover:bg-accent hover:text-accent-foreground',
      secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary-hover',
      ghost: 'text-foreground hover:bg-accent hover:text-accent-foreground',
      link: 'h-auto! px-0! text-primary underline-offset-4 hover:underline',
      destructive: 'bg-danger text-danger-foreground hover:bg-danger-hover',
    },
    size: {
      sm: 'h-control-sm px-3 text-xs',
      md: 'h-control-md px-4 text-sm',
      lg: 'h-control-lg px-6 text-base',
      icon: 'size-control-md p-0',
      'icon-sm': 'size-control-sm p-0',
      'icon-lg': 'size-control-lg p-0',
    },
    fullWidth: { true: 'w-full', false: '' },
  },
  defaultVariants: { variant: 'solid', size: 'md', fullWidth: 'false' },
});

export type ButtonVariant = NonNullable<VariantProps<typeof buttonVariants>['variant']>;
export type ButtonSize = NonNullable<VariantProps<typeof buttonVariants>['size']>;
