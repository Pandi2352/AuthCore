import { ChevronDown } from 'lucide-react';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';

import { DateTime } from '@/components/common/DateTime';
import { ErrorState, LoadingState, notifyError, notifySuccess } from '@/components/feedback';
import {
  Alert,
  Badge,
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  Input,
  Select,
  Switch,
  Textarea,
} from '@/components/ui';
import { paths } from '@/config';
import { useAuth } from '@/features/auth';
import { getFieldErrors, isAbortError } from '@/lib/api';
import { cn } from '@/lib/utils';
import { PERSON_NAME_PATTERN, USERNAME_PATTERN } from '@/lib/validation';

import { adminUsersApi } from '../api/admin-users.api';
import { createUserApi } from '../api/create-user.api';
import {
  SETTABLE_STATUSES,
  type AdminUserDetails,
  type SettableStatus,
} from '../types/admin-user.types';
import type { CreateUserConfig } from '../types/create-user.types';
import {
  countFields,
  fromApiValues,
  toAttributesPatch,
  validateAttributes,
  type AttributeValues,
} from './attribute-values';
import { AttributeFields } from './AttributeFields';
import { fullName, STATUS_LABEL, STATUS_TONE } from './user-labels';

const EMAIL = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/;

interface Profile {
  firstName: string;
  lastName: string;
  username: string;
  email: string;
  isEmailVerified: boolean;
}

const profileOf = (u: AdminUserDetails): Profile => ({
  firstName: u.firstName,
  lastName: u.lastName ?? '',
  username: u.username ?? '',
  email: u.email,
  isEmailVerified: u.isEmailVerified,
});

const isSettable = (status: string): status is SettableStatus =>
  (SETTABLE_STATUSES as readonly string[]).includes(status);

/** Edit a user: profile, email, status and custom fields (one save, several API calls). */
export function EditUserDialog({
  userId,
  open,
  onOpenChange,
  onSaved,
}: {
  userId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const [data, setData] = useState<{
    id: string;
    user: AdminUserDetails;
    config: CreateUserConfig;
  } | null>(null);
  const [failure, setFailure] = useState<{ id: string; attempt: number; error: unknown } | null>(
    null,
  );
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!userId || !open) return;
    const controller = new AbortController();
    const load = async () => {
      try {
        const [user, config] = await Promise.all([
          adminUsersApi.get(userId, controller.signal),
          createUserApi.config(controller.signal),
        ]);
        setData({ id: userId, user, config });
      } catch (error) {
        if (!isAbortError(error)) setFailure({ id: userId, attempt, error });
      }
    };
    void load();
    return () => controller.abort();
  }, [userId, open, attempt]);

  const ready = data && data.id === userId ? data : null;
  const failed = failure && failure.id === userId && failure.attempt === attempt ? failure : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title={ready ? `Edit ${fullName(ready.user)}` : 'Edit user'}
        description={ready?.user.email ?? 'Update the account and profile details.'}
        size="xl"
      >
        {ready ? (
          <EditForm
            key={`${ready.user.id}:${ready.user.updatedAt}`}
            user={ready.user}
            config={ready.config}
            onCancel={() => onOpenChange(false)}
            onSaved={(user) => {
              setData({ ...ready, user });
              onSaved();
              onOpenChange(false);
            }}
          />
        ) : failed ? (
          <DialogBody>
            <ErrorState
              error={failed.error}
              title="Could not load the user"
              onRetry={() => setAttempt((n) => n + 1)}
            />
          </DialogBody>
        ) : (
          <DialogBody>
            <LoadingState label="Loading the user" />
          </DialogBody>
        )}
      </DialogContent>
    </Dialog>
  );
}

function EditForm({
  user,
  config,
  onCancel,
  onSaved,
}: {
  user: AdminUserDetails;
  config: CreateUserConfig;
  onCancel: () => void;
  onSaved: (user: AdminUserDetails) => void;
}) {
  const { user: me } = useAuth();
  const isSelf = me?.id === user.id;
  const initialProfile = useMemo(() => profileOf(user), [user]);
  const initialValues = useMemo(
    () => fromApiValues(config.attributes, user.attributes),
    [config.attributes, user.attributes],
  );
  const [profile, setProfile] = useState(initialProfile);
  const [values, setValues] = useState<AttributeValues>(initialValues);
  const [status, setStatus] = useState<string>(user.status);
  const [reason, setReason] = useState('');
  const [notifyUser, setNotifyUser] = useState(true);
  const [showStandard, setShowStandard] = useState(false);
  const [hasTried, setHasTried] = useState(false);
  const [serverErrors, setServerErrors] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);
  const { coreFields } = config;

  const custom = config.attributes.filter((a) => !a.isSystem);
  const standard = config.attributes.filter((a) => a.isSystem);

  const errors: Record<string, string> = {};
  if (!EMAIL.test(profile.email.trim())) errors.email = 'Enter a valid email address';
  if (!profile.firstName.trim())
    errors.firstName = `Enter the ${coreFields.firstName.label.toLowerCase()}`;
  else if (!PERSON_NAME_PATTERN.test(profile.firstName.trim()))
    errors.firstName = 'Use letters, spaces, apostrophes, dots or hyphens';
  if (profile.lastName.trim() && !PERSON_NAME_PATTERN.test(profile.lastName.trim()))
    errors.lastName = 'Use letters, spaces, apostrophes, dots or hyphens';
  if (coreFields.lastName.isRequired && coreFields.lastName.isEnabled && !profile.lastName.trim())
    errors.lastName = `Enter the ${coreFields.lastName.label.toLowerCase()}`;
  if (profile.username.trim() && !USERNAME_PATTERN.test(profile.username.trim().toLowerCase()))
    errors.username = 'Use 3–30 lowercase letters or numbers (. _ - allowed in the middle)';
  Object.assign(errors, validateAttributes(config.attributes, values));
  const shown = { ...(hasTried ? errors : {}), ...serverErrors };
  const problemCount = Object.keys(errors).length;

  const profileChanges: Parameters<typeof adminUsersApi.update>[1] = {};
  if (profile.firstName.trim() !== initialProfile.firstName)
    profileChanges.firstName = profile.firstName.trim();
  if (profile.lastName.trim() !== initialProfile.lastName)
    profileChanges.lastName = profile.lastName.trim() || null;
  if (profile.username.trim().toLowerCase() !== initialProfile.username)
    profileChanges.username = profile.username.trim().toLowerCase() || null;
  if (profile.email.trim().toLowerCase() !== initialProfile.email)
    profileChanges.email = profile.email.trim().toLowerCase();
  if (profile.isEmailVerified !== initialProfile.isEmailVerified)
    profileChanges.isEmailVerified = profile.isEmailVerified;
  const attributesPatch = toAttributesPatch(config.attributes, values, initialValues);
  const statusChanged = status !== user.status && isSettable(status);
  const isDirty = Object.keys(profileChanges).length > 0 || !!attributesPatch || statusChanged;

  const isStandardOpen =
    showStandard ||
    standard.some((a) =>
      Object.keys(shown).some(
        (key) => key === `attributes.${a.name}` || key.startsWith(`attributes.${a.name}.`),
      ),
    );

  const set = <K extends keyof Profile>(key: K, value: Profile[K]) => {
    setProfile((p) => ({ ...p, [key]: value }));
    if (serverErrors[key]) setServerErrors(({ [key]: _removed, ...rest }) => rest);
  };

  const save = async (event: FormEvent) => {
    event.preventDefault();
    setHasTried(true);
    if (problemCount > 0 || !isDirty || isSaving) return;
    setIsSaving(true);
    const done: string[] = [];
    try {
      let latest = user;
      if (Object.keys(profileChanges).length > 0) {
        latest = await adminUsersApi.update(user.id, profileChanges);
        done.push('profile');
      }
      if (attributesPatch) {
        latest = await adminUsersApi.updateAttributes(user.id, attributesPatch);
        done.push('details');
      }
      if (statusChanged && isSettable(status)) {
        latest = await adminUsersApi.setStatus(user.id, {
          status,
          ...(reason.trim() ? { reason: reason.trim() } : {}),
          notifyUser,
        });
        done.push('status');
      }
      notifySuccess(`${fullName(latest)} updated`, {
        description: `Saved: ${done.join(', ')}.${
          profileChanges.email ? ' The new email is used from the next sign-in.' : ''
        }`,
      });
      onSaved(latest);
    } catch (err) {
      setServerErrors(getFieldErrors(err));
      notifyError(
        err,
        done.length > 0
          ? `Saved ${done.join(', ')}, but the rest failed`
          : 'Could not save the changes',
      );
    } finally {
      setIsSaving(false);
    }
  };

  const statusOptions = [
    ...(isSettable(user.status)
      ? []
      : [{ value: user.status, label: STATUS_LABEL[user.status], disabled: true }]),
    ...SETTABLE_STATUSES.map((value) => ({ value, label: STATUS_LABEL[value] })),
  ];

  return (
    <form noValidate onSubmit={(e) => void save(e)} className="flex min-h-0 flex-1 flex-col">
      <DialogBody className="space-y-5">
        {isSelf && (
          <Alert
            variant="info"
            title="This is your own account"
            message={
              <>
                Change your own details on your{' '}
                <Link to={paths.account.profile} className="font-medium underline">
                  profile page
                </Link>
                .
              </>
            }
          />
        )}

        <dl className="grid grid-cols-2 gap-3 rounded-md bg-muted/60 p-3 text-xs sm:grid-cols-4">
          <div>
            <dt className="text-muted-foreground">Status</dt>
            <dd className="mt-1">
              <Badge size="sm" tone={STATUS_TONE[user.status]}>
                {STATUS_LABEL[user.status]}
              </Badge>
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Last sign-in</dt>
            <dd className="mt-1 font-medium text-foreground">
              {user.lastLoginAt ? <DateTime value={user.lastLoginAt} format="relative" /> : 'Never'}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Active sessions</dt>
            <dd className="mt-1 font-medium text-foreground tabular-nums">
              {user.activeSessionCount}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Groups</dt>
            <dd className="mt-1 truncate font-medium text-foreground">
              {user.groups.length > 0 ? user.groups.map((g) => g.name).join(', ') : 'None'}
            </dd>
          </div>
        </dl>

        <fieldset disabled={isSelf} className="space-y-5">
          <section aria-label="Account" className="space-y-4 rounded-md border border-border p-4">
            <h3 className="text-sm font-semibold text-foreground">Account</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                label={coreFields.firstName.label}
                required
                value={profile.firstName}
                placeholder={`Enter the ${coreFields.firstName.label.toLowerCase()}`}
                error={shown.firstName}
                onChange={(e) => set('firstName', e.target.value)}
              />
              {coreFields.lastName.isEnabled && (
                <Input
                  label={coreFields.lastName.label}
                  required={coreFields.lastName.isRequired}
                  value={profile.lastName}
                  placeholder={`Enter the ${coreFields.lastName.label.toLowerCase()}`}
                  error={shown.lastName}
                  onChange={(e) => set('lastName', e.target.value)}
                />
              )}
              <Input
                label="Email address"
                type="email"
                required
                value={profile.email}
                placeholder="Enter their email address"
                hint="Changing it signs them out everywhere"
                error={shown.email}
                onChange={(e) => set('email', e.target.value)}
              />
              {coreFields.username.isEnabled && (
                <Input
                  label={coreFields.username.label}
                  value={profile.username}
                  placeholder="Choose a username (optional)"
                  error={shown.username}
                  onChange={(e) => set('username', e.target.value.toLowerCase())}
                />
              )}
            </div>
            <Switch
              label="Email is verified"
              hint="Turn off to make them confirm the address again"
              checked={profile.isEmailVerified}
              onCheckedChange={(checked) => set('isEmailVerified', checked)}
            />
          </section>

          <section aria-label="Status" className="space-y-4 rounded-md border border-border p-4">
            <h3 className="text-sm font-semibold text-foreground">Status</h3>
            <Select
              label="Account status"
              value={status}
              options={statusOptions}
              hint={
                status === 'SUSPENDED' || status === 'BANNED' || status === 'INACTIVE'
                  ? 'They are signed out everywhere and cannot sign in.'
                  : undefined
              }
              error={shown.status}
              onValueChange={(next) => next && setStatus(next)}
            />
            {statusChanged && (
              <>
                <Textarea
                  label="Reason"
                  rows={2}
                  maxLength={500}
                  value={reason}
                  placeholder="Explain the change (kept in the audit log, optional)"
                  error={shown.reason}
                  onChange={(e) => setReason(e.target.value)}
                />
                <Switch
                  label="Email the user about this change"
                  checked={notifyUser}
                  onCheckedChange={setNotifyUser}
                />
              </>
            )}
          </section>

          {config.attributes.length > 0 && (
            <section
              aria-label="Profile details"
              className="space-y-4 rounded-md border border-border p-4"
            >
              <h3 className="text-sm font-semibold text-foreground">Profile details</h3>
              {custom.length > 0 && (
                <AttributeFields
                  attributes={custom}
                  values={values}
                  errors={shown}
                  onChange={setValues}
                />
              )}
              {standard.length > 0 && (
                <div className={cn(custom.length > 0 && 'border-t border-border pt-4')}>
                  <button
                    type="button"
                    aria-expanded={isStandardOpen}
                    onClick={() => setShowStandard((v) => !v)}
                    className="flex w-full cursor-pointer items-center justify-between gap-3 rounded-md text-left text-sm font-semibold text-foreground focus-visible:outline-2 focus-visible:outline-ring"
                  >
                    <span>
                      Standard profile fields{' '}
                      <span className="font-normal text-muted-foreground">
                        ({countFields(standard)})
                      </span>
                    </span>
                    <ChevronDown
                      className={cn(
                        'size-4 text-muted-foreground transition-transform',
                        isStandardOpen && 'rotate-180',
                      )}
                      aria-hidden="true"
                    />
                  </button>
                  {isStandardOpen && (
                    <div className="mt-4">
                      <AttributeFields
                        attributes={standard}
                        values={values}
                        errors={shown}
                        onChange={setValues}
                      />
                    </div>
                  )}
                </div>
              )}
            </section>
          )}
        </fieldset>
      </DialogBody>
      <DialogFooter>
        <p className="mr-auto text-xs text-muted-foreground" aria-live="polite">
          {hasTried && problemCount > 0
            ? `${problemCount} ${problemCount === 1 ? 'field needs' : 'fields need'} attention`
            : isDirty
              ? 'Unsaved changes'
              : 'No changes'}
        </p>
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" isLoading={isSaving} disabled={!isDirty || isSelf}>
          Save changes
        </Button>
      </DialogFooter>
    </form>
  );
}
