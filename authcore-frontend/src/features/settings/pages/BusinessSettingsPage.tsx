import { CircleCheck, CircleDot, RotateCcw, Save } from 'lucide-react';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useBlocker } from 'react-router-dom';

import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { DateTime } from '@/components/common/DateTime';
import { ErrorState, LoadingState, notifyError, notifySuccess } from '@/components/feedback';
import { PageContainer, PageHeader } from '@/components/page';
import { Alert, Button, Input, Textarea } from '@/components/ui';
import { appConfig } from '@/config';
import { usePermissions } from '@/features/auth';
import { useApiError } from '@/hooks';
import { useFormValidation } from '@/hooks/useFormValidation';
import { isApiError } from '@/lib/api';
import { maxLength, required, type FormRules } from '@/lib/validation';

import { businessSettingsApi } from '../api/business-settings.api';
import { SettingCard } from '../components/appearance/AppearanceParts';
import { BrandAssetField } from '../components/business/BrandAssetField';
import { BrandingPreview } from '../components/business/BrandingPreview';
import { useBusinessSettings } from '../components/business/use-business-settings';
import {
  SITE_DESCRIPTION_MAX,
  SITE_NAME_MAX,
  type BusinessSettings,
  type UpdateBusinessSettingsRequest,
} from '../types/business-settings.types';

const FORM_ID = 'business-identity';

interface IdentityValues {
  siteName: string;
  siteDescription: string;
}

const rules: FormRules<IdentityValues> = {
  siteName: [
    required('Enter the site name'),
    maxLength(SITE_NAME_MAX, `Use at most ${SITE_NAME_MAX} characters`),
  ],
  siteDescription: [
    maxLength(SITE_DESCRIPTION_MAX, `Use at most ${SITE_DESCRIPTION_MAX} characters`),
  ],
};

/** The site's initial in a square: what is shown while no mark is uploaded. */
function InitialMark({ name }: { name: string }) {
  return (
    <span className="flex size-10 items-center justify-center rounded-md bg-primary text-lg font-black text-primary-foreground">
      {name.trim().charAt(0).toUpperCase() || '?'}
    </span>
  );
}

const FallbackCaption = ({ children }: { children: string }) => (
  <span className="rounded-md bg-surface/90 px-1.5 text-xs text-muted-foreground">{children}</span>
);

export function BusinessSettingsPage() {
  const { hasPermission } = usePermissions();
  const settings = useBusinessSettings(true);

  return (
    <PageContainer>
      {settings.status === 'loading' && (
        <>
          <PageHeader
            title="Business settings"
            description="Your site's name, description, logos and favicon."
          />
          <LoadingState variant="cards" label="Loading business settings" />
        </>
      )}
      {settings.status === 'error' && (
        <>
          <PageHeader
            title="Business settings"
            description="Your site's name, description, logos and favicon."
          />
          <ErrorState
            error={settings.error}
            title="Could not load the business settings"
            onRetry={settings.reload}
          />
        </>
      )}
      {settings.status === 'ready' && (
        <BusinessSettingsForm
          data={settings.data}
          canManage={hasPermission('BUSINESS_SETTINGS_MANAGE')}
          onChange={settings.apply}
          onReload={settings.reload}
        />
      )}
    </PageContainer>
  );
}

function BusinessSettingsForm({
  data,
  canManage,
  onChange,
  onReload,
}: {
  data: BusinessSettings;
  canManage: boolean;
  onChange: (settings: BusinessSettings) => void;
  onReload: () => void;
}) {
  const saved: IdentityValues = { siteName: data.siteName, siteDescription: data.siteDescription };
  const [values, setValues] = useState<IdentityValues>(saved);
  const [synced, setSynced] = useState<IdentityValues>(saved);
  const [isSaving, setIsSaving] = useState(false);
  const { error: apiError, setError, fieldError } = useApiError();
  const validation = useFormValidation(values, rules);

  // Server values changed (upload elsewhere on the page, reload): take them over unless the
  // user is editing that field.
  if (synced.siteName !== saved.siteName || synced.siteDescription !== saved.siteDescription) {
    setSynced(saved);
    setValues((current) => ({
      siteName: current.siteName === synced.siteName ? saved.siteName : current.siteName,
      siteDescription:
        current.siteDescription === synced.siteDescription
          ? saved.siteDescription
          : current.siteDescription,
    }));
  }

  const changes = useMemo(() => {
    const next: UpdateBusinessSettingsRequest = {};
    if (values.siteName.trim() !== data.siteName) next.siteName = values.siteName.trim();
    if (values.siteDescription.trim() !== data.siteDescription) {
      next.siteDescription = values.siteDescription.trim();
    }
    return next;
  }, [values, data.siteName, data.siteDescription]);
  const isDirty = Object.keys(changes).length > 0;

  // Leaving with unsaved text: in-app navigation asks, closing the tab warns.
  const blocker = useBlocker(isDirty && !isSaving);
  useEffect(() => {
    if (!isDirty) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [isDirty]);

  const set = (field: keyof IdentityValues, value: string) => {
    setValues((current) => ({ ...current, [field]: value }));
    if (apiError) setError(null);
  };

  const save = async (event?: FormEvent<HTMLFormElement>) => {
    event?.preventDefault();
    if (!canManage || !isDirty || isSaving) return;
    if (!validation.validate(event?.currentTarget)) return;
    setIsSaving(true);
    try {
      const next = await businessSettingsApi.update({ ...changes, version: data.version });
      onChange(next);
      setValues({ siteName: next.siteName, siteDescription: next.siteDescription });
      setSynced({ siteName: next.siteName, siteDescription: next.siteDescription });
      setError(null);
      notifySuccess('Business settings saved', {
        description: 'The new name and description are live everywhere.',
      });
    } catch (err) {
      if (isApiError(err) && err.code === 'VERSION_CONFLICT') {
        notifyError(err, 'Someone else saved changes', {
          action: { label: 'Reload', onClick: onReload },
        });
      } else {
        setError(err, 'Could not save the business settings');
        notifyError(err, 'Could not save the business settings');
      }
    } finally {
      setIsSaving(false);
    }
  };

  // Ctrl / Cmd + S saves.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
        event.preventDefault();
        document
          .getElementById(FORM_ID)
          ?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const discard = () => {
    setValues(saved);
    validation.reset();
    setError(null);
  };

  const logoCount = [data.assets.logo, data.assets.logoMark, data.assets.authLogo].filter(
    Boolean,
  ).length;
  const previewAssets = {
    logo: data.assets.logo?.url ?? null,
    logoMark: data.assets.logoMark?.url ?? null,
    authLogo: data.assets.authLogo?.url ?? null,
    favicon: data.assets.favicon?.url ?? null,
  };
  const name = values.siteName.trim() || data.siteName;

  return (
    <>
      <PageHeader
        title="Business settings"
        description="Your site's name, description, logos and favicon — shown on every page."
        actions={
          <div className="flex items-center gap-2">
            <span
              className={
                isDirty
                  ? 'inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md border border-warning/40 bg-warning-soft px-2.5 text-xs font-medium whitespace-nowrap text-warning-soft-foreground'
                  : 'inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md border border-border bg-muted px-2.5 text-xs font-medium whitespace-nowrap text-muted-foreground'
              }
            >
              {isDirty ? (
                <>
                  <CircleDot className="size-3.5" aria-hidden="true" /> Unsaved changes
                </>
              ) : data.isDefault ? (
                <>
                  <CircleCheck className="size-3.5" aria-hidden="true" /> Project defaults
                </>
              ) : (
                <>
                  <CircleCheck className="size-3.5" aria-hidden="true" />
                  Saved
                  {data.updatedAt && (
                    <span className="hidden sm:inline">
                      · <DateTime value={data.updatedAt} format="relative" />
                    </span>
                  )}
                </>
              )}
            </span>
            {canManage && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  className="shrink-0 whitespace-nowrap"
                  leftIcon={<RotateCcw />}
                  disabled={!isDirty || isSaving}
                  onClick={discard}
                >
                  Discard
                </Button>
                <Button
                  type="submit"
                  form={FORM_ID}
                  size="sm"
                  className="shrink-0 whitespace-nowrap"
                  leftIcon={<Save />}
                  isLoading={isSaving}
                  disabled={!isDirty}
                >
                  Save changes
                </Button>
              </>
            )}
          </div>
        }
      />

      {!canManage && (
        <Alert
          variant="info"
          className="mb-6"
          title="View only"
          message="Changing these settings needs the Manage business settings permission."
        />
      )}

      <div className="@container">
        <div className="grid items-start gap-6 @5xl:grid-cols-[minmax(0,1fr)_minmax(0,26rem)] @7xl:grid-cols-[minmax(0,1fr)_minmax(0,30rem)]">
          <div className="grid min-w-0 gap-6">
            <SettingCard
              title="Site identity"
              description="Shown in the browser tab, the sidebar (without a logo), sign-in pages and search results."
              badge={isDirty ? 'Edited' : 'Saved'}
            >
              <form id={FORM_ID} noValidate onSubmit={save} className="grid gap-5">
                <Input
                  label="Site name"
                  required
                  value={values.siteName}
                  maxLength={SITE_NAME_MAX}
                  disabled={!canManage}
                  placeholder="Enter the name people see in the tab and sidebar"
                  hint={`${values.siteName.length} / ${SITE_NAME_MAX} · e.g. your product or company name`}
                  error={validation.error('siteName') ?? fieldError('siteName')}
                  onChange={(e) => set('siteName', e.target.value)}
                />
                <Textarea
                  label="Site description"
                  value={values.siteDescription}
                  maxLength={SITE_DESCRIPTION_MAX}
                  showCount
                  rows={3}
                  autoResize
                  maxRows={6}
                  disabled={!canManage}
                  placeholder="Describe the site in one or two sentences for search engines and link previews"
                  hint="Search engines show about the first 155 characters."
                  error={validation.error('siteDescription') ?? fieldError('siteDescription')}
                  onChange={(e) => set('siteDescription', e.target.value)}
                />
              </form>
            </SettingCard>

            <SettingCard
              title="Logos"
              description="PNG or WebP with a transparent background looks best in light and dark mode."
              badge={`${logoCount}/3 custom`}
            >
              <BrandAssetField
                slot="logo"
                title="Logo"
                description="Company logo in the expanded sidebar, the navbar on small screens and public pages."
                recommendation="Wide image, about 4 : 1 (e.g. 640 × 160). Shrunk to fit 1024 × 512."
                shape="wide"
                asset={data.assets.logo}
                fallback={
                  <>
                    <span className="flex items-center gap-2">
                      <InitialMark name={name} />
                      <span className="text-sm font-bold text-foreground">{name}</span>
                    </span>
                    <FallbackCaption>Initial and site name</FallbackCaption>
                  </>
                }
                fallbackLabel="The initial and site name"
                canManage={canManage}
                onChange={onChange}
              />
              <BrandAssetField
                slot="logo-mark"
                title="Logo mark"
                description="Square icon in the collapsed sidebar (and next to the name when there is no logo)."
                recommendation="Square image, at least 128 × 128. Placed on a 256 × 256 square."
                shape="square"
                asset={data.assets.logoMark}
                fallback={
                  <>
                    <InitialMark name={name} />
                    <FallbackCaption>Initial</FallbackCaption>
                  </>
                }
                fallbackLabel="The site's initial"
                canManage={canManage}
                onChange={onChange}
              />
              <BrandAssetField
                slot="auth-logo"
                title="Sign-in logo"
                description="Top-left of the sign-in, sign-up and password pages. Optional: the logo is used otherwise."
                recommendation="Same format as the logo; use a different one only if it needs another colour."
                shape="wide"
                asset={data.assets.authLogo}
                fallback={
                  data.assets.logo ? (
                    <>
                      <img
                        src={data.assets.logo.url}
                        alt=""
                        className="max-h-12 max-w-[80%] object-contain opacity-60"
                      />
                      <FallbackCaption>Uses the logo</FallbackCaption>
                    </>
                  ) : (
                    <>
                      <span className="flex items-center gap-2">
                        <InitialMark name={name} />
                        <span className="text-sm font-bold text-foreground">{name}</span>
                      </span>
                      <FallbackCaption>Initial and site name</FallbackCaption>
                    </>
                  )
                }
                fallbackLabel={data.assets.logo ? 'The logo' : 'The initial and site name'}
                canManage={canManage}
                onChange={onChange}
              />
            </SettingCard>

            <SettingCard
              title="Favicon"
              description="The small icon in browser tabs, bookmarks and search results."
              badge={data.assets.favicon ? 'Custom' : 'Default'}
            >
              <BrandAssetField
                slot="favicon"
                title="Favicon"
                description="Shown at 16–32 px: keep it simple, high-contrast, without small text."
                recommendation="Square PNG, at least 64 × 64 (256 × 256 ideal). Placed on a 256 × 256 square."
                shape="square"
                asset={data.assets.favicon}
                fallback={
                  <>
                    <img src={appConfig.favicon} alt="" className="size-10 object-contain" />
                    <FallbackCaption>Default icon</FallbackCaption>
                  </>
                }
                fallbackLabel="The default icon"
                canManage={canManage}
                onChange={onChange}
              />
            </SettingCard>
          </div>

          <aside
            aria-label="Preview"
            className="min-w-0 space-y-6 @5xl:sticky @5xl:top-[calc(var(--navbar-height)+1.5rem)]"
          >
            <BrandingPreview
              siteName={values.siteName}
              siteDescription={values.siteDescription.trim()}
              assets={previewAssets}
            />
          </aside>
        </div>
      </div>

      <ConfirmDialog
        open={blocker.state === 'blocked'}
        onOpenChange={(open) => {
          if (!open && blocker.state === 'blocked') blocker.reset();
        }}
        title="Leave without saving?"
        description="Your changes to the site name or description will be lost."
        confirmText="Leave"
        cancelText="Stay"
        destructive
        onConfirm={() => blocker.proceed?.()}
      />
    </>
  );
}
