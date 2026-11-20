import {
  CheckCircle2,
  ChevronDown,
  Circle,
  CircleAlert,
  ClipboardList,
  KeyRound,
  Loader2,
  MailPlus,
  Settings2,
  ShieldCheck,
  Sparkles,
  UserPlus,
  UserRound,
  Users,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { Link, useBlocker, useNavigate } from 'react-router-dom';

import {
  AttributeFields,
  countFields,
  emptyValues,
  toAttributesPayload,
  validateAttributes,
  type AttributeValues,
} from '@/components/attributes';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { CopyButton } from '@/components/common/CopyButton';
import { SectionCard } from '@/components/common/SectionCard';
import { ErrorState, LoadingState, notifyError, notifySuccess } from '@/components/feedback';
import { PageContainer, PageHeader } from '@/components/page';
import { Button, Checkbox, Input, Switch } from '@/components/ui';
import { paths } from '@/config';
import { getFieldErrors, isAbortError } from '@/lib/api';
import { cn } from '@/lib/utils';
import { PERSON_NAME_PATTERN, USERNAME_PATTERN } from '@/lib/validation';

import { createUserApi } from '../api/create-user.api';
import { passwordChecks } from '../components/password-rules';
import type { CreateUserConfig, GroupOption } from '../types/create-user.types';

const EMAIL = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/;

function nameProblem(value: string, label: string, isRequired: boolean): string | null {
  if (!value.trim()) return isRequired ? `Enter the ${label.toLowerCase()}` : null;
  if (!PERSON_NAME_PATTERN.test(value.trim()))
    return `${label} can only contain letters, spaces, ' . and -`;
  return null;
}

interface AccountValues {
  email: string;
  firstName: string;
  lastName: string;
  username: string;
  password: string;
  mustChangePassword: boolean;
  isEmailVerified: boolean;
  sendWelcomeEmail: boolean;
  groupIds: string[];
}

type Check = 'idle' | 'checking' | 'free' | 'taken';

/** Debounced "already taken" check for one field. */
function useAvailability(field: 'email' | 'username', value: string, isValid: boolean): Check {
  const [state, setState] = useState<{ value: string; check: Check }>({ value: '', check: 'idle' });
  useEffect(() => {
    if (!isValid) return;
    const controller = new AbortController();
    const run = async () => {
      try {
        const result = await createUserApi.availability({ [field]: value }, controller.signal);
        const isFree = field === 'email' ? result.isEmailAvailable : result.isUsernameAvailable;
        setState({ value, check: isFree ? 'free' : 'taken' });
      } catch (error) {
        if (!isAbortError(error)) setState({ value, check: 'idle' });
      }
    };
    const timer = window.setTimeout(() => void run(), 500);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [field, value, isValid]);
  if (!isValid) return 'idle';
  return state.value === value ? state.check : 'checking';
}

function AvailabilityHint({ check, what }: { check: Check; what: string }) {
  if (check === 'checking')
    return (
      <span className="inline-flex items-center gap-1 text-muted-foreground">
        <Loader2 className="size-3 animate-spin" aria-hidden="true" /> Checking…
      </span>
    );
  if (check === 'free')
    return (
      <span className="inline-flex items-center gap-1 text-success">
        <CheckCircle2 className="size-3" aria-hidden="true" /> This {what} is available
      </span>
    );
  return null;
}

/** Users → Create user: fields come from GET /admin/users/create-config. */
export function CreateUserPage() {
  const [nonce, setNonce] = useState(0);
  const [config, setConfig] = useState<CreateUserConfig | null>(null);
  const [failure, setFailure] = useState<{ key: number; error: unknown } | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const load = async () => {
      try {
        setConfig(await createUserApi.config(controller.signal));
      } catch (error) {
        if (!isAbortError(error)) setFailure({ key: nonce, error });
      }
    };
    void load();
    return () => controller.abort();
  }, [nonce]);

  if (config) return <CreateUserForm config={config} />;
  return (
    <PageContainer>
      <PageHeader title="Create user" />
      {failure?.key === nonce ? (
        <ErrorState
          error={failure.error}
          title="Could not load the form"
          onRetry={() => setNonce((n) => n + 1)}
        />
      ) : (
        <LoadingState label="Loading the form" />
      )}
    </PageContainer>
  );
}

function CreateUserForm({ config }: { config: CreateUserConfig }) {
  const navigate = useNavigate();
  const initialAccount = useMemo<AccountValues>(
    () => ({
      email: '',
      firstName: '',
      lastName: '',
      username: '',
      password: '',
      mustChangePassword: config.defaults.mustChangePassword,
      isEmailVerified: config.defaults.isEmailVerified,
      sendWelcomeEmail: config.defaults.sendWelcomeEmail,
      groupIds: [],
    }),
    [config],
  );
  const initialAttributes = useMemo(() => emptyValues(config.attributes), [config]);
  const [account, setAccount] = useState<AccountValues>(initialAccount);
  const [attributes, setAttributes] = useState<AttributeValues>(initialAttributes);
  const [groups, setGroups] = useState<GroupOption[] | null>(null);
  const [hasTried, setHasTried] = useState(false);
  const [serverErrors, setServerErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<'open' | 'another' | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showStandard, setShowStandard] = useState(false);
  const leaving = useRef(false);
  const { coreFields } = config;

  useEffect(() => {
    if (!config.canAssignGroups) return;
    const controller = new AbortController();
    const load = async () => {
      try {
        setGroups(await createUserApi.groups(controller.signal));
      } catch (error) {
        if (!isAbortError(error)) setGroups(null);
      }
    };
    void load();
    return () => controller.abort();
  }, [config.canAssignGroups]);

  const email = account.email.trim().toLowerCase();
  const username = account.username.trim().toLowerCase();
  const emailCheck = useAvailability('email', email, EMAIL.test(email));
  const usernameCheck = useAvailability(
    'username',
    username,
    coreFields.username.isEnabled && USERNAME_PATTERN.test(username),
  );

  const checks = passwordChecks(config.passwordRequirements, account.password);

  // ---- validation
  const clientErrors: Record<string, string> = {};
  if (!EMAIL.test(email)) clientErrors.email = 'Enter a valid email address';
  else if (emailCheck === 'taken') clientErrors.email = 'An account with this email already exists';
  const firstNameProblem = nameProblem(account.firstName, coreFields.firstName.label, true);
  if (firstNameProblem) clientErrors.firstName = firstNameProblem;
  if (coreFields.lastName.isEnabled) {
    const p = nameProblem(
      account.lastName,
      coreFields.lastName.label,
      coreFields.lastName.isRequired,
    );
    if (p) clientErrors.lastName = p;
  }
  if (coreFields.username.isEnabled) {
    if (!username && coreFields.username.isRequired) clientErrors.username = 'Enter a username';
    else if (username && !USERNAME_PATTERN.test(username))
      clientErrors.username = 'Use 3–30 lowercase letters or numbers (. _ - allowed in the middle)';
    else if (usernameCheck === 'taken') clientErrors.username = 'This username is already taken';
  }
  if (!account.password) clientErrors.password = 'Set an initial password';
  else if (checks.some((c) => !c.isMet))
    clientErrors.password = 'The password doesn’t meet the rules below';
  Object.assign(clientErrors, validateAttributes(config.attributes, attributes));

  // "Taken" shows at once; the rest after the first submit.
  const errors: Record<string, string> = {
    ...Object.fromEntries(
      Object.entries(clientErrors).filter(([, message]) => hasTried || message.includes('already')),
    ),
    ...serverErrors,
  };
  const problemCount = Object.keys(clientErrors).length;

  const isDirty =
    JSON.stringify(account) !== JSON.stringify(initialAccount) ||
    JSON.stringify(attributes) !== JSON.stringify(initialAttributes);
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      isDirty && !leaving.current && currentLocation.pathname !== nextLocation.pathname,
  );
  useEffect(() => {
    if (!isDirty) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [isDirty]);

  const set = <K extends keyof AccountValues>(key: K, value: AccountValues[K]) => {
    setAccount((a) => ({ ...a, [key]: value }));
    if (serverErrors[key]) setServerErrors(({ [key]: _removed, ...rest }) => rest);
  };

  const generate = async () => {
    setIsGenerating(true);
    try {
      const { password } = await createUserApi.generatePassword(
        Math.max(16, config.passwordRequirements.minimumLength),
      );
      set('password', password);
      setShowPassword(true);
      notifySuccess('Strong password generated', {
        description: 'Copy it now and share it with the user securely — it is never emailed.',
      });
    } catch (err) {
      notifyError(err, 'Could not generate a password');
    } finally {
      setIsGenerating(false);
    }
  };

  const submit = async (mode: 'open' | 'another', event?: FormEvent) => {
    event?.preventDefault();
    if (saving) return;
    setHasTried(true);
    if (problemCount > 0) {
      notifyError(
        new Error(
          `${problemCount} ${problemCount === 1 ? 'field needs' : 'fields need'} attention`,
        ),
        'Check the form',
      );
      return;
    }
    setSaving(mode);
    try {
      const created = await createUserApi.create({
        email,
        firstName: account.firstName.trim(),
        ...(coreFields.lastName.isEnabled && account.lastName.trim()
          ? { lastName: account.lastName.trim() }
          : {}),
        ...(coreFields.username.isEnabled && username ? { username } : {}),
        password: account.password,
        mustChangePassword: account.mustChangePassword,
        isEmailVerified: account.isEmailVerified,
        sendWelcomeEmail: account.sendWelcomeEmail,
        ...(account.groupIds.length > 0 ? { groupIds: account.groupIds } : {}),
        attributes: toAttributesPayload(config.attributes, attributes),
      });
      notifySuccess(`${created.firstName} ${created.lastName ?? ''}`.trim() + ' was created', {
        description: [
          account.sendWelcomeEmail ? 'A welcome email is on its way.' : 'No email was sent.',
          account.mustChangePassword ? 'They choose a new password at first sign-in.' : '',
        ]
          .filter(Boolean)
          .join(' '),
      });
      if (mode === 'another') {
        setAccount(initialAccount);
        setAttributes(initialAttributes);
        setHasTried(false);
        setShowPassword(false);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else {
        leaving.current = true;
        void navigate(paths.admin.userDetail(created.id));
      }
    } catch (err) {
      setServerErrors(getFieldErrors(err));
      notifyError(err, 'Could not create the user');
    } finally {
      setSaving(null);
    }
  };

  const customAttributes = config.attributes.filter((a) => !a.isSystem);
  const standardAttributes = config.attributes.filter((a) => a.isSystem);
  const customCount = countFields(customAttributes);
  // Opened by hand, or forced open while one of them has a problem (or is required).
  const isStandardOpen =
    showStandard ||
    standardAttributes.some(
      (a) =>
        a.isRequired ||
        Object.keys(errors).some(
          (key) => key === `attributes.${a.name}` || key.startsWith(`attributes.${a.name}.`),
        ),
    );
  const changeAttributes = (next: AttributeValues) => {
    setAttributes(next);
    if (Object.keys(serverErrors).some((k) => k.startsWith('attributes'))) setServerErrors({});
  };
  const metCount = checks.filter((c) => c.isMet).length;

  return (
    <PageContainer>
      <PageHeader
        title="Create user"
        description="Add an account directly with an initial password. To let people set their own password, invite them instead."
        actions={
          <Button variant="outline" size="toolbar" leftIcon={<MailPlus />} asChild>
            <Link to={paths.admin.invites}>Invite instead</Link>
          </Button>
        }
      />

      <form noValidate onSubmit={(e) => void submit('open', e)} className="@container">
        <div className="grid items-start gap-6 @5xl:grid-cols-[minmax(0,1fr)_minmax(0,20rem)]">
          <div className="min-w-0 space-y-6">
            <SectionCard
              title="Account"
              description="How the user signs in."
              icon={<UserRound />}
              tone="primary"
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <Input
                  label="Email address"
                  type="email"
                  required
                  autoComplete="off"
                  value={account.email}
                  placeholder="Enter their email address"
                  hint={<AvailabilityHint check={emailCheck} what="email" />}
                  error={errors.email}
                  className="sm:col-span-2"
                  wrapperClassName="sm:col-span-2"
                  onChange={(e) => set('email', e.target.value)}
                />
                <Input
                  label={coreFields.firstName.label}
                  required
                  autoComplete="off"
                  maxLength={coreFields.firstName.maxLength ?? 50}
                  value={account.firstName}
                  placeholder={`Enter the ${coreFields.firstName.label.toLowerCase()}`}
                  error={errors.firstName}
                  onChange={(e) => set('firstName', e.target.value)}
                />
                {coreFields.lastName.isEnabled && (
                  <Input
                    label={coreFields.lastName.label}
                    required={coreFields.lastName.isRequired}
                    autoComplete="off"
                    maxLength={coreFields.lastName.maxLength ?? 50}
                    value={account.lastName}
                    placeholder={`Enter the ${coreFields.lastName.label.toLowerCase()}`}
                    error={errors.lastName}
                    onChange={(e) => set('lastName', e.target.value)}
                  />
                )}
                {coreFields.username.isEnabled && (
                  <Input
                    label={coreFields.username.label}
                    required={coreFields.username.isRequired}
                    autoComplete="off"
                    maxLength={30}
                    value={account.username}
                    placeholder={
                      coreFields.username.isRequired
                        ? 'Choose a username'
                        : 'Choose a username (optional)'
                    }
                    hint={
                      usernameCheck === 'idle' ? (
                        'They can sign in with it or their email'
                      ) : (
                        <AvailabilityHint check={usernameCheck} what="username" />
                      )
                    }
                    error={errors.username}
                    onChange={(e) => set('username', e.target.value.toLowerCase())}
                  />
                )}
              </div>
            </SectionCard>

            <SectionCard
              title="Initial password"
              description="Share it with the user securely; it is never emailed."
              icon={<KeyRound />}
              tone="warning"
            >
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
                <Input
                  label="Password"
                  required
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  value={account.password}
                  placeholder="Create a password or generate one"
                  error={errors.password}
                  className="font-mono"
                  wrapperClassName="flex-1"
                  suffix={
                    account.password ? (
                      <CopyButton value={account.password} label="Copy the password" size="sm" />
                    ) : undefined
                  }
                  onChange={(e) => set('password', e.target.value)}
                />
                <Button
                  type="button"
                  variant="outline"
                  leftIcon={<Sparkles />}
                  isLoading={isGenerating}
                  className="shrink-0 sm:mt-6"
                  onClick={() => void generate()}
                >
                  Generate
                </Button>
              </div>
              <ul className="mt-3 grid gap-x-4 gap-y-1 sm:grid-cols-2" aria-live="polite">
                {checks.map((check) => (
                  <li
                    key={check.label}
                    className={cn(
                      'flex items-center gap-1.5 text-xs',
                      check.isMet ? 'text-success' : 'text-muted-foreground',
                    )}
                  >
                    {check.isMet ? (
                      <CheckCircle2 className="size-3.5 shrink-0" aria-hidden="true" />
                    ) : (
                      <Circle className="size-3.5 shrink-0" aria-hidden="true" />
                    )}
                    {check.label}
                  </li>
                ))}
              </ul>
              <div className="mt-4 border-t border-border pt-4">
                <Switch
                  label="Ask for a new password at first sign-in"
                  hint="Recommended: only the user then knows their password"
                  checked={account.mustChangePassword}
                  onCheckedChange={(checked) => set('mustChangePassword', checked)}
                />
              </div>
            </SectionCard>

            {config.attributes.length > 0 && (
              <SectionCard
                title="Profile details"
                description={
                  customAttributes.length > 0
                    ? `${customCount} custom ${customCount === 1 ? 'field' : 'fields'} from Security settings → Schemas.`
                    : 'Fields from Security settings → Schemas.'
                }
                icon={<ShieldCheck />}
                tone="violet"
              >
                {customAttributes.length > 0 && (
                  <AttributeFields
                    attributes={customAttributes}
                    values={attributes}
                    errors={errors}
                    onChange={changeAttributes}
                  />
                )}
                {standardAttributes.length > 0 && (
                  <div
                    className={cn(
                      customAttributes.length > 0 && 'mt-5 border-t border-border pt-4',
                    )}
                  >
                    <button
                      type="button"
                      aria-expanded={isStandardOpen}
                      onClick={() => setShowStandard((open) => !open)}
                      className="flex w-full cursor-pointer items-center justify-between gap-3 rounded-md text-left focus-visible:outline-2 focus-visible:outline-ring"
                    >
                      <span>
                        <span className="block text-sm font-semibold text-foreground">
                          Standard profile fields{' '}
                          <span className="font-normal text-muted-foreground">
                            ({countFields(standardAttributes)})
                          </span>
                        </span>
                        <span className="block text-xs text-muted-foreground">
                          Middle name, phone, birth date, address and other OpenID Connect fields —
                          optional
                        </span>
                      </span>
                      <ChevronDown
                        className={cn(
                          'size-4 shrink-0 text-muted-foreground transition-transform',
                          isStandardOpen && 'rotate-180',
                        )}
                        aria-hidden="true"
                      />
                    </button>
                    {isStandardOpen && (
                      <div className="mt-4">
                        <AttributeFields
                          attributes={standardAttributes}
                          values={attributes}
                          errors={errors}
                          onChange={changeAttributes}
                        />
                      </div>
                    )}
                  </div>
                )}
              </SectionCard>
            )}

            {config.canAssignGroups && groups !== null && (
              <SectionCard
                title="Groups"
                description="Groups decide what the user can do. You can only grant access you have yourself."
                icon={<Users />}
                tone="success"
              >
                {groups.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No groups yet.</p>
                ) : (
                  <div className="grid max-h-72 gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
                    {groups.map((group) => {
                      const isOn = account.groupIds.includes(group.id);
                      return (
                        <div
                          key={group.id}
                          className={cn(
                            'rounded-md border px-3 py-2.5 transition-colors',
                            isOn ? 'border-success/50 bg-success-soft/40' : 'border-border',
                          )}
                        >
                          <Checkbox
                            label={group.label}
                            checked={isOn}
                            onCheckedChange={(checked) =>
                              set(
                                'groupIds',
                                checked
                                  ? [...account.groupIds, group.id]
                                  : account.groupIds.filter((id) => id !== group.id),
                              )
                            }
                          />
                        </div>
                      );
                    })}
                  </div>
                )}
                {errors.groupIds && (
                  <p role="alert" className="mt-2 text-xs font-medium text-danger">
                    {errors.groupIds}
                  </p>
                )}
              </SectionCard>
            )}
          </div>

          <aside
            aria-label="Summary"
            className="min-w-0 space-y-6 @5xl:sticky @5xl:top-[calc(var(--navbar-height)+1.5rem)]"
          >
            <SectionCard title="Options" icon={<Settings2 />} tone="cyan">
              <div className="space-y-4">
                <Switch
                  label="Email is verified"
                  hint="You vouch for the address; no verification email is sent"
                  checked={account.isEmailVerified}
                  onCheckedChange={(checked) => set('isEmailVerified', checked)}
                />
                <Switch
                  label="Send a welcome email"
                  hint="Tells them the account exists (never includes the password)"
                  checked={account.sendWelcomeEmail}
                  onCheckedChange={(checked) => set('sendWelcomeEmail', checked)}
                />
              </div>
            </SectionCard>
            <SectionCard title="Summary" icon={<ClipboardList />} tone="info">
              <dl className="space-y-2 text-xs">
                {[
                  ['Email', email || '—'],
                  ['Name', `${account.firstName} ${account.lastName}`.trim() || '—'],
                  ['Password', `${metCount}/${checks.length} rules met`],
                  [
                    'Groups',
                    account.groupIds.length > 0 ? String(account.groupIds.length) : 'None',
                  ],
                  ['Status', 'Active right away'],
                ].map(([term, detail]) => (
                  <div key={term} className="flex justify-between gap-3">
                    <dt className="text-muted-foreground">{term}</dt>
                    <dd className="truncate text-right font-medium text-foreground">{detail}</dd>
                  </div>
                ))}
              </dl>
              {hasTried && problemCount > 0 && (
                <p className="mt-3 flex items-center gap-1.5 rounded-md bg-danger-soft px-2.5 py-2 text-xs text-danger-soft-foreground">
                  <CircleAlert className="size-3.5 shrink-0" aria-hidden="true" />
                  {problemCount} {problemCount === 1 ? 'field needs' : 'fields need'} attention
                </p>
              )}
            </SectionCard>
          </aside>
        </div>

        <div className="sticky bottom-0 z-10 -mx-1 mt-6 flex flex-wrap items-center justify-end gap-2 border-t border-border bg-background/95 px-1 py-3 backdrop-blur">
          <Button variant="ghost" size="toolbar" asChild>
            <Link to={paths.admin.users}>Cancel</Link>
          </Button>
          <Button
            type="button"
            variant="outline"
            size="toolbar"
            isLoading={saving === 'another'}
            disabled={saving !== null}
            onClick={() => void submit('another')}
          >
            Create and add another
          </Button>
          <Button
            type="submit"
            size="toolbar"
            leftIcon={<UserPlus />}
            isLoading={saving === 'open'}
            disabled={saving !== null}
          >
            Create user
          </Button>
        </div>
      </form>

      <ConfirmDialog
        open={blocker.state === 'blocked'}
        onOpenChange={(open) => {
          if (!open && blocker.state === 'blocked') blocker.reset();
        }}
        title="Leave without creating the user?"
        description="What you entered will be lost."
        confirmText="Leave"
        cancelText="Stay"
        destructive
        onConfirm={() => blocker.proceed?.()}
      />
    </PageContainer>
  );
}
