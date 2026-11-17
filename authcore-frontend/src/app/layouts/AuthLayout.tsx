import { Outlet } from 'react-router-dom';

import { Logo } from '@/components/common/Logo';
import { ThemeToggle } from '@/components/common/ThemeToggle';
import { appConfig, layoutConfig } from '@/config';
import { cn } from '@/lib/utils';

const YEAR = new Date().getFullYear();

function LegalLinks() {
  const { privacyUrl, termsUrl } = appConfig.legal;
  const { companyName } = appConfig.branding;
  return (
    <footer className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
      {companyName && (
        <span>
          © {YEAR} {companyName}
        </span>
      )}
      {privacyUrl && (
        <a
          className="cursor-pointer hover:text-foreground"
          href={privacyUrl}
          target="_blank"
          rel="noopener noreferrer"
        >
          Privacy
        </a>
      )}
      {termsUrl && (
        <a
          className="cursor-pointer hover:text-foreground"
          href={termsUrl}
          target="_blank"
          rel="noopener noreferrer"
        >
          Terms
        </a>
      )}
    </footer>
  );
}

/**
 * Sign-in / sign-up pages. layout.config.ts → auth.variant:
 * "centered" (form in the middle) or "split" (brand panel / image + form).
 * A top bar holds the logo (left) and the theme toggle (right); the form is centered below.
 */
export function AuthLayout() {
  const { variant, sideImage } = layoutConfig.auth;

  return (
    <div className="flex min-h-dvh bg-background text-foreground">
      {variant === 'split' && (
        <aside
          aria-hidden={sideImage ? undefined : true}
          className="relative hidden w-1/2 overflow-hidden bg-primary text-primary-foreground lg:flex lg:flex-col lg:justify-between lg:p-12"
        >
          {sideImage ? (
            <img src={sideImage} alt="" className="absolute inset-0 size-full object-cover" />
          ) : (
            <>
              <span className="text-xl font-bold">{appConfig.name}</span>
              <div className="max-w-md space-y-3">
                <p className="text-3xl leading-tight font-bold">{appConfig.description}</p>
                {appConfig.branding.companyName && (
                  <p className="text-sm text-primary-foreground/80">
                    {appConfig.branding.companyName}
                  </p>
                )}
              </div>
            </>
          )}
        </aside>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 shrink-0 items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          {/* Split layout on large screens: the brand panel already shows the name. */}
          <Logo className={cn(variant === 'split' && 'lg:invisible')} />
          <ThemeToggle />
        </header>

        <div className="flex flex-1 flex-col items-center justify-center gap-8 px-4 pt-4 pb-10 sm:px-6">
          <main id="main-content" tabIndex={-1} className="w-full max-w-md outline-none">
            <Outlet />
          </main>
          <LegalLinks />
        </div>
      </div>
    </div>
  );
}
