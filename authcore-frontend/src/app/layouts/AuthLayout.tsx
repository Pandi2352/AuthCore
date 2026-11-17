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
 * "centered" (card in the middle) or "split" (brand panel / image + form).
 */
export function AuthLayout() {
  const { variant, sideImage } = layoutConfig.auth;
  const form = (
    <div className="flex w-full flex-col items-center gap-8">
      <Logo className={cn(variant === 'split' && 'lg:hidden')} />
      <main id="main-content" tabIndex={-1} className="w-full max-w-md outline-none">
        <Outlet />
      </main>
      <LegalLinks />
    </div>
  );

  return (
    <div className="relative flex min-h-dvh bg-background text-foreground">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>
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
      <div className="flex flex-1 items-center justify-center px-4 py-12 sm:px-6">{form}</div>
    </div>
  );
}
