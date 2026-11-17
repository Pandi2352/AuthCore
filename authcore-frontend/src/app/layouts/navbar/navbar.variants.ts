import { variants } from '@/lib/utils';

/** Navbar looks (theme appearance.navbar). Height / sticky come from layout.config.ts. */
export const navbarVariants = variants({
  base: 'flex h-(--navbar-height) shrink-0 items-center gap-3 px-4 text-navbar-foreground sm:px-6',
  variants: {
    variant: {
      // Same four looks as the sidebar.
      classic: 'border-b border-navbar-border bg-navbar',
      minimal: 'border-b border-transparent bg-transparent',
      floating: 'mx-2 mt-2 rounded-md border border-navbar-border bg-navbar shadow-card',
      // Shorter bar (--navbar-height is reduced for [data-navbar='compact'], styles/appearance.css).
      compact: 'border-b border-navbar-border bg-navbar sm:px-4',
    },
    sticky: { true: 'sticky top-0', false: '' },
  },
  compoundVariants: [{ variant: 'floating', sticky: 'true', className: 'top-2' }],
  defaultVariants: { variant: 'classic', sticky: 'true' },
});
