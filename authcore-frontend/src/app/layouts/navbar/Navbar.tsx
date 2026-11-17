import { useOptionalTheme } from '@/app/theme';
import { layoutConfig } from '@/config';

import { navbarVariants } from './navbar.variants';
import { NavbarCenter } from './NavbarCenter';
import { NavbarLeft } from './NavbarLeft';
import { NavbarRight } from './NavbarRight';

/**
 * Top bar (header landmark): left (sidebar toggle, logo, breadcrumbs), center (search),
 * right (actions from layout.config.ts). Height / sticky from layout.config.ts, look from
 * the theme (standard, transparent, bordered, floating, blurred).
 */
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
      <NavbarCenter />
      <NavbarRight />
    </header>
  );
}
