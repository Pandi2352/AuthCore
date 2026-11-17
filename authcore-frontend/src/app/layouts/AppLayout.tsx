import { useEffect, useRef } from 'react';
import { Outlet, useLocation } from 'react-router-dom';

import { layoutConfig } from '@/config';
import { cn } from '@/lib/utils';

import { CommandMenuProvider } from './command-menu/CommandMenuProvider';
import { MainContent } from './components/MainContent';
import { RouteAccessBoundary } from './components/RouteAccessBoundary';
import { SkipLink } from './components/SkipLink';
import { Navbar } from './navbar';
import { Sidebar, SidebarMobile, SidebarProvider, useSidebar } from './sidebar';

/**
 * Signed-in shell: sidebar + navbar + main content.
 * - sidebar.behavior "fixed": the shell fills the screen (100dvh); sidebar and content scroll
 *   independently. "sticky": the page scrolls and the sidebar sticks to the top.
 * - Below the mobile breakpoint the sidebar is a drawer (navbar menu button).
 */
export function AppLayout() {
  return (
    <SidebarProvider>
      <CommandMenuProvider>
        <SkipLink />
        <AppShell />
      </CommandMenuProvider>
    </SidebarProvider>
  );
}

function AppShell() {
  const { isDesktop } = useSidebar();
  const { sidebar, navbar } = layoutConfig;
  const isFixed = sidebar.behavior === 'fixed';
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const { pathname, hash } = useLocation();

  // The content column is the scroll container in fixed mode: start new pages at the top.
  const scrolledFor = useRef(pathname);
  useEffect(() => {
    if (scrolledFor.current === pathname) return;
    scrolledFor.current = pathname;
    if (isFixed && !hash) scrollRef.current?.scrollTo({ top: 0 });
  }, [pathname, hash, isFixed]);

  return (
    <div
      className={cn(
        'flex w-full overflow-x-clip bg-background text-foreground',
        isFixed ? 'h-dvh overflow-hidden' : 'min-h-dvh',
        sidebar.position === 'right' && 'flex-row-reverse',
      )}
    >
      {sidebar.enabled && (isDesktop ? <Sidebar /> : <SidebarMobile />)}
      <div
        ref={scrollRef}
        className={cn('flex min-w-0 flex-1 flex-col', isFixed && 'scrollbar-thin overflow-y-auto')}
      >
        {navbar.enabled && <Navbar />}
        <MainContent>
          <RouteAccessBoundary>
            <Outlet />
          </RouteAccessBoundary>
        </MainContent>
      </div>
    </div>
  );
}
