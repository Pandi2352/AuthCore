import { useOptionalTheme } from '@/app/theme';
import { layoutConfig } from '@/config';

import { navbarVariants } from './navbar.variants';
import { NavbarLeft } from './NavbarLeft';
import { NavbarRight } from './NavbarRight';

/** Top bar (header landmark): height / sticky from layout.config.ts, look from the theme. */
export function Navbar() {
  const theme = useOptionalTheme();
  return (
    <header
      style={{ zIndex: 'var(--z-navbar)' }}
      className={navbarVariants({
        variant: theme?.appearance.navbar ?? 'standard',
        sticky: layoutConfig.navbar.sticky ? 'true' : 'false',
      })}
    >
      <NavbarLeft />
      <NavbarRight />
    </header>
  );
}
