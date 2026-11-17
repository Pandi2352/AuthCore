import { useOptionalTheme } from '@/app/theme';
import { layoutConfig } from '@/config';

import { navbarVariants } from './navbar.variants';
import { NavbarCenter } from './NavbarCenter';
import { NavbarLeft } from './NavbarLeft';
import { NavbarRight } from './NavbarRight';

/**
 * Top bar (header landmark): left (sidebar toggle, logo, breadcrumbs), center (search),
 * right (actions from layout.config.ts). Height / sticky from layout.config.ts, look from
 * the theme (classic, minimal, floating, compact — the same looks as the sidebar).
 */
export function Navbar() {
  const theme = useOptionalTheme();
  const navbarStyle = theme?.appearance.navbar ?? 'classic';
  return (
    <header
      data-app-navbar=""
      style={{ zIndex: 'var(--z-navbar)' }}
      className={navbarVariants({
        variant: navbarStyle,
        sticky: layoutConfig.navbar.sticky ? 'true' : 'false',
      })}
    >
      <NavbarLeft />
      <NavbarCenter />
      <NavbarRight />
    </header>
  );
}
