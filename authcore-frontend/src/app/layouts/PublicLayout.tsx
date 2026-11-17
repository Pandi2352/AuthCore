import { Link, Outlet } from 'react-router-dom';

import { Logo } from '@/components/common/Logo';
import { ThemeToggle } from '@/components/common/ThemeToggle';
import { Button } from '@/components/ui';
import { appConfig, featuresConfig, paths } from '@/config';

import { SkipLink } from './components/SkipLink';

const YEAR = new Date().getFullYear();

/** Public pages (landing, about, pricing …): header + footer. Optional per project. */
export function PublicLayout() {
  const { companyName, supportEmail } = appConfig.branding;
  const { privacyUrl, termsUrl } = appConfig.legal;
  return (
    <div className="flex min-h-dvh flex-col bg-background text-foreground">
      <SkipLink />
      <header
        className="sticky top-0 border-b border-border bg-navbar/90 backdrop-blur"
        style={{ zIndex: 'var(--z-navbar)' }}
      >
        <div className="mx-auto flex h-(--navbar-height) max-w-(--content-max-width) items-center justify-between gap-4 px-4 sm:px-6">
          <Link
            to={paths.root}
            aria-label={`${appConfig.name} home`}
            className="cursor-pointer rounded-md"
          >
            <Logo />
          </Link>
          <nav aria-label="Account" className="flex items-center gap-2">
            <ThemeToggle />
            <Button variant="ghost" asChild>
              <Link to={paths.auth.login}>Sign in</Link>
            </Button>
            {featuresConfig.auth.allowRegistration && (
              <Button asChild>
                <Link to={paths.auth.register}>Get started</Link>
              </Button>
            )}
          </nav>
        </div>
      </header>
      <main id="main-content" tabIndex={-1} className="flex-1 outline-none">
        <Outlet />
      </main>
      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-(--content-max-width) flex-col items-center justify-between gap-3 px-4 py-6 text-sm text-muted-foreground sm:flex-row sm:px-6">
          <span>
            © {YEAR} {companyName ?? appConfig.name}
          </span>
          <div className="flex gap-4">
            {privacyUrl && (
              <a className="cursor-pointer hover:text-foreground" href={privacyUrl}>
                Privacy
              </a>
            )}
            {termsUrl && (
              <a className="cursor-pointer hover:text-foreground" href={termsUrl}>
                Terms
              </a>
            )}
            {supportEmail && (
              <a className="cursor-pointer hover:text-foreground" href={`mailto:${supportEmail}`}>
                Support
              </a>
            )}
          </div>
        </div>
      </footer>
    </div>
  );
}
