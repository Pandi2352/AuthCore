import { Building2, Lock, Trash2, Upload } from 'lucide-react';
import { useEffect, useState } from 'react';

import { useTheme } from '@/app/theme';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { DateTime } from '@/components/common/DateTime';
import { ErrorState, LoadingState, notifyError, notifySuccess } from '@/components/feedback';
import { Badge, Button, Switch } from '@/components/ui';
import { isAbortError, isApiError } from '@/lib/api';

import { appearanceApi, toOrganization, type OrgAppearanceAdmin } from '../../api/appearance.api';
import { themeValues } from '../../appearance-sync';
import { SettingCard } from './AppearanceParts';
import { LOCK_GROUPS, lockedGroups, type LockGroupId } from './lock-groups';

/**
 * Admin: publish the current look as everyone's default and lock sections. Users can change
 * whatever is not locked; "Reset to default" brings them back to this look.
 */
export function OrganizationAppearanceCard({ canManage }: { canManage: boolean }) {
  const theme = useTheme();
  const { setOrganization } = theme;
  const [nonce, setNonce] = useState(0);
  const [loaded, setLoaded] = useState<{ key: number; org: OrgAppearanceAdmin } | null>(null);
  const [failure, setFailure] = useState<{ key: number; error: unknown } | null>(null);
  const [selection, setSelection] = useState<Set<LockGroupId> | null>(null);
  const [isPublishing, setIsPublishing] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      try {
        setLoaded({ key: nonce, org: await appearanceApi.getOrg(controller.signal) });
      } catch (error) {
        if (!isAbortError(error)) setFailure({ key: nonce, error });
      }
    })();
    return () => controller.abort();
  }, [nonce]);

  const org = loaded?.org ?? null;
  const locks = selection ?? lockedGroups(org?.locked ?? []);
  const lockedKeys: string[] = LOCK_GROUPS.filter((g) => locks.has(g.id)).flatMap((g) => g.keys);
  const isPublished = (org?.version ?? 0) > 0;

  const apply = (next: OrgAppearanceAdmin) => {
    setLoaded({ key: nonce, org: next });
    setSelection(null);
    setOrganization(toOrganization(next));
  };

  const publish = async () => {
    if (!org) return;
    setIsPublishing(true);
    try {
      const next = await appearanceApi.updateOrg({
        ...themeValues(theme),
        locked: lockedKeys,
        version: org.version,
      });
      apply(next);
      notifySuccess('Organization appearance published', {
        description: lockedKeys.length
          ? `${locks.size} section(s) locked for everyone.`
          : 'Everyone starts from this look and can still change it.',
      });
    } catch (err) {
      notifyError(
        err,
        isApiError(err) && err.code === 'VERSION_CONFLICT'
          ? 'Someone else changed it — reloaded'
          : 'Could not publish the organization appearance',
      );
      if (isApiError(err) && err.code === 'VERSION_CONFLICT') setNonce((n) => n + 1);
    } finally {
      setIsPublishing(false);
    }
  };

  const remove = async () => {
    try {
      apply(await appearanceApi.resetOrg());
      notifySuccess('Organization appearance removed', {
        description: 'Everyone follows the built-in defaults again; nothing is locked.',
      });
    } catch (err) {
      notifyError(err, 'Could not remove the organization appearance');
      throw err;
    }
  };

  const toggle = (id: LockGroupId, on: boolean) => {
    const next = new Set(locks);
    if (on) next.add(id);
    else next.delete(id);
    setSelection(next);
  };

  return (
    <SettingCard
      title="Organization appearance"
      description="The look everyone starts from. Design it on this page, then publish it; lock what people may not change."
      badge={isPublished ? 'Published' : 'Not set'}
    >
      {!loaded && failure?.key !== nonce && (
        <LoadingState label="Loading organization appearance" />
      )}
      {!loaded && failure?.key === nonce && (
        <ErrorState
          error={failure.error}
          title="Could not load the organization appearance"
          onRetry={() => setNonce((n) => n + 1)}
          size="compact"
        />
      )}
      {org && (
        <>
          <div className="flex flex-wrap items-center gap-3 rounded-md bg-muted px-3 py-2.5 text-sm">
            <Building2 className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            {isPublished ? (
              <span className="text-foreground">
                Published {org.updatedAt && <DateTime value={org.updatedAt} format="relative" />} ·{' '}
                {org.locked.length
                  ? `${lockedGroups(org.locked).size} section(s) locked`
                  : 'nothing locked'}
              </span>
            ) : (
              <span className="text-muted-foreground">
                Not set — everyone starts from the built-in defaults.
              </span>
            )}
          </div>

          <fieldset disabled={!canManage} className="min-w-0">
            <legend className="mb-2 flex items-center gap-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              <Lock className="size-3.5" aria-hidden="true" /> Lock for everyone
            </legend>
            <div className="grid gap-x-8 gap-y-1 @3xl:grid-cols-2">
              {LOCK_GROUPS.map((group) => (
                <div key={group.id} className="border-b border-border py-2.5">
                  <Switch
                    label={group.label}
                    checked={locks.has(group.id)}
                    onCheckedChange={(on) => toggle(group.id, on)}
                  />
                </div>
              ))}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Locked sections are read-only for everyone, you included — unlock them here to change
              them.
            </p>
          </fieldset>

          {canManage && (
            <div className="flex flex-wrap items-center gap-2 border-t border-border pt-4">
              <ConfirmDialog
                trigger={
                  <Button leftIcon={<Upload />} isLoading={isPublishing}>
                    Publish my current look
                  </Button>
                }
                title="Publish this look for everyone?"
                description={
                  lockedKeys.length
                    ? `Your current look becomes the default, and ${locks.size} section(s) are locked for everyone right away.`
                    : 'Your current look becomes the default. Everyone can still change it for themselves.'
                }
                confirmText="Publish"
                onConfirm={publish}
              />
              {selection && <Badge tone="warning">Lock changes are published with the look</Badge>}
              {isPublished && (
                <ConfirmDialog
                  trigger={
                    <Button
                      variant="ghost"
                      leftIcon={<Trash2 />}
                      className="ml-auto text-danger hover:text-danger"
                    >
                      Remove
                    </Button>
                  }
                  title="Remove the organization appearance?"
                  description="Everyone follows the built-in defaults again and nothing stays locked. Personal looks are kept."
                  confirmText="Remove"
                  destructive
                  onConfirm={remove}
                />
              )}
            </div>
          )}
        </>
      )}
    </SettingCard>
  );
}
