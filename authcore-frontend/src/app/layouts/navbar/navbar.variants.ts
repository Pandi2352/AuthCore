import { variants } from '@/lib/utils';

/** Navbar looks (theme appearance.navbar). Height / sticky come from layout.config.ts. */
export const navbarVariants = variants({
  base: 'flex h-(--navbar-height) shrink-0 items-center gap-3 px-4 text-navbar-foreground sm:px-6',
  variants: {
    variant: {
      standard: 'border-b border-navbar-border bg-navbar',
      bordered: 'border-b-2 border-navbar-border bg-navbar',
      transparent: 'border-b border-transparent bg-transparent',
      floating: 'mx-2 mt-2 rounded-md border border-navbar-border bg-navbar shadow-card',
      blurred: 'border-b border-navbar-border bg-navbar/75 backdrop-blur-md',
    },
    sticky: { true: 'sticky top-0', false: '' },
  },
  compoundVariants: [{ variant: 'floating', sticky: 'true', className: 'top-2' }],
  defaultVariants: { variant: 'standard', sticky: 'true' },
});
