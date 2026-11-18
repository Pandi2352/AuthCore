import {
  CalendarClock,
  FileText,
  History,
  Power,
  Ruler,
  Save,
  ShieldAlert,
  Type,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { Link, useBlocker, useNavigate, useParams } from 'react-router-dom';

import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { ErrorState, LoadingState, notifyError, notifySuccess } from '@/components/feedback';
import { PageContainer, PageHeader } from '@/components/page';
import { Alert, Badge, Button, Input } from '@/components/ui';
import { paths } from '@/config';
import { usePermissions } from '@/features/auth';
import { getFieldErrors, isAbortError } from '@/lib/api';

import { passwordPolicyApi } from '../api/password-policy.api';
import { NEW_POLICY, rulesOf, validateRules } from '../components/policy-rules';
import { PolicySection, RangeRow, SwitchRow } from '../components/PolicyControls';
import { StrengthCard, SummaryCard, TryPasswordCard } from '../components/PolicyInsights';
import { ReminderDays } from '../components/ReminderDays';
import {
  POLICY_LIMITS as L,
  type PasswordPolicy,
  type PasswordPolicyRules,
} from '../types/password-policy.types';

type Loaded =
  { kind: 'new'; policy: null } | { kind: 'edit'; policy: PasswordPolicy & { id: string } };

/** Create (no :id) or edit a password policy. */
export function PasswordPolicyEditorPage() {
  const { id } = useParams<{ id: string }>();
  const [loaded, setLoaded] = useState<{ id: string | undefined; value: Loaded } | null>(null);
  const [failure, setFailure] = useState<{
    id: string | undefined;
    attempt: number;
    error: unknown;
  } | null>(null);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    if (!id) return;
    const controller = new AbortController();
    const load = async () => {
      try {
        const policy = await passwordPolicyApi.get(id, controller.signal);
        if (policy.id)
          setLoaded({ id, value: { kind: 'edit', policy: { ...policy, id: policy.id } } });
      } catch (error) {
        if (!isAbortError(error)) setFailure({ id, attempt: nonce, error });
      }
    };
    void load();
    return () => controller.abort();
  }, [id, nonce]);

  if (!id) return <PolicyEditor key="new" loaded={{ kind: 'new', policy: null }} />;
  if (loaded?.id === id) return <PolicyEditor key={id} loaded={loaded.value} />;
  return (
    <PageContainer>
      <PageHeader title="Password policy" back={<BackLink />} />
      {failure?.id === id && failure.attempt === nonce ? (
        <ErrorState
          error={failure.error}
          title="Could not load the policy"
          onRetry={() => setNonce((n) => n + 1)}
        />
      ) : (
        <LoadingState label="Loading the policy" />
      )}
    </PageContainer>
  );
}

function BackLink() {
  return (
    <Link to={paths.admin.passwordPolicy} className="cursor-pointer hover:text-foreground">
      All policies
    </Link>
  );
}

/** Deep update helper for one rule group. */
type Group = Exclude<keyof PasswordPolicyRules, 'policyName'>;

function PolicyEditor({ loaded }: { loaded: Loaded }) {
  const navigate = useNavigate();
  const { hasPermission } = usePermissions();
  const canManage = hasPermission('PASSWORD_POLICY_MANAGE');
  const editing = loaded.policy;
  const initial = useMemo(() => (editing ? rulesOf(editing) : rulesOf(NEW_POLICY)), [editing]);
  const [rules, setRules] = useState<PasswordPolicyRules>(initial);
  const [synced, setSynced] = useState(() => JSON.stringify(initial));
  const [serverErrors, setServerErrors] = useState<Record<string, string>>({});
  const [hasTriedSave, setHasTriedSave] = useState(false);
  const [saving, setSaving] = useState<'save' | 'activate' | null>(null);
  const leaving = useRef(false);

  const isDirty = JSON.stringify(rules) !== synced;
  const clientErrors = validateRules(rules);
  // Name errors wait for the first save; cross-field problems show at once.
  const errors: Record<string, string> = {
    ...Object.fromEntries(
      Object.entries(clientErrors).filter(([key]) => hasTriedSave || key !== 'policyName'),
    ),
    ...serverErrors,
  };
  const errorCount = Object.keys(clientErrors).length;

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

  const set = <G extends Group>(group: G, change: Partial<PasswordPolicyRules[G]>) => {
    setRules((current) => ({ ...current, [group]: { ...current[group], ...change } }));
    if (Object.keys(serverErrors).length > 0) setServerErrors({});
  };
  const readOnly = !canManage;

  const save = async (andActivate: boolean, event?: FormEvent) => {
    event?.preventDefault();
    if (readOnly || saving) return;
    setHasTriedSave(true);
    if (errorCount > 0) {
      notifyError(new Error('Fix the highlighted rules first'), 'The policy can’t be saved yet');
      return;
    }
    setSaving(andActivate ? 'activate' : 'save');
    try {
      const body = { ...rules, policyName: rules.policyName.trim() };
      let saved = editing
        ? await passwordPolicyApi.update(editing.id, body)
        : await passwordPolicyApi.create(body);
      if (andActivate && saved.id && !saved.isActive) {
        saved = await passwordPolicyApi.activate(saved.id);
      }
      setSynced(JSON.stringify(rules));
      notifySuccess(
        saved.isActive ? `${saved.policyName} saved and active` : `${saved.policyName} saved`,
        {
          description: saved.isActive
            ? 'New passwords must follow it from now on.'
            : 'It is inactive — activate it from the list when you are ready.',
        },
      );
      leaving.current = true;
      void navigate(paths.admin.passwordPolicy);
    } catch (err) {
      setServerErrors(getFieldErrors(err));
      notifyError(err, 'Could not save the policy');
    } finally {
      setSaving(null);
    }
  };

  const { characterLength: length, complexity, passwordHistory: history } = rules;
  const extra = rules.additionalRules;
  const validity = rules.passwordValidity;
  const isActive = editing?.isActive ?? false;

  return (
    <PageContainer>
      <PageHeader
        back={<BackLink />}
        title={editing ? editing.policyName : 'New password policy'}
        meta={
          editing ? (
            isActive ? (
              <Badge tone="primary" variant="solid">
                Active
              </Badge>
            ) : (
              <Badge tone="neutral">Inactive</Badge>
            )
          ) : undefined
        }
        description={
          isActive
            ? 'This policy is active: saved changes apply to every new password right away.'
            : 'Set the rules, watch the strength on the right, then save. Only one policy is active at a time.'
        }
      />

      <form
        noValidate
        onSubmit={(event) => void save(false, event)}
        className="@container"
        aria-label="Password policy"
      >
        {readOnly && (
          <Alert
            variant="info"
            className="mb-6"
            title="View only"
            message="Changing password policies needs the Manage password policy permission."
          />
        )}
        <div className="grid items-start gap-6 @5xl:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
          <fieldset disabled={readOnly} className="min-w-0 space-y-6">
            <legend className="sr-only">Rules</legend>

            <PolicySection
              title="Policy details"
              description="A name your admins will recognise in the list."
              icon={<FileText />}
            >
              <div className="py-3.5">
                <Input
                  label="Policy name"
                  required
                  maxLength={L.maxNameLength}
                  value={rules.policyName}
                  placeholder="Enter a policy name"
                  error={errors.policyName}
                  onChange={(e) => {
                    setRules((r) => ({ ...r, policyName: e.target.value }));
                    if (serverErrors.policyName) setServerErrors({});
                  }}
                />
              </div>
            </PolicySection>

            <PolicySection
              title="Length"
              description="Longer passwords are the best protection against guessing."
              icon={<Ruler />}
            >
              <RangeRow
                label="Minimum length"
                hint="12 or more is recommended"
                unit="chars"
                value={length.minimum}
                min={L.minLength}
                max={L.maxLength}
                error={errors['characterLength.minimum']}
                onChange={(minimum) =>
                  set('characterLength', {
                    minimum,
                    maximum: Math.max(length.maximum, minimum),
                  })
                }
              />
              <RangeRow
                label="Maximum length"
                hint="Allow long passphrases (64+)"
                unit="chars"
                value={length.maximum}
                min={L.minLength}
                max={L.maxLength}
                error={errors['characterLength.maximum']}
                onChange={(maximum) =>
                  set('characterLength', {
                    maximum,
                    minimum: Math.min(length.minimum, maximum),
                  })
                }
              />
            </PolicySection>

            <PolicySection
              title="Character mix"
              description="Which kinds of characters every password needs."
              icon={<Type />}
            >
              <RangeRow
                label="Minimum digits"
                hint="0–9"
                value={complexity.minimumDigitCount}
                min={0}
                max={L.maxCharacterClassCount}
                onChange={(minimumDigitCount) => set('complexity', { minimumDigitCount })}
              />
              <RangeRow
                label="Minimum special characters"
                hint="! @ # $ % & * …"
                value={complexity.minimumSpecialCharacterCount}
                min={0}
                max={L.maxCharacterClassCount}
                onChange={(minimumSpecialCharacterCount) =>
                  set('complexity', { minimumSpecialCharacterCount })
                }
              />
              <SwitchRow
                label="Require upper and lower case"
                hint="At least one A–Z and one a–z"
                checked={complexity.requireUpperAndLowerCase}
                onChange={(requireUpperAndLowerCase) =>
                  set('complexity', { requireUpperAndLowerCase })
                }
              />
              <RangeRow
                label="Minimum uppercase letters"
                hint="Raise above 1 for a stricter policy"
                value={complexity.minimumUppercaseCount}
                min={0}
                max={L.maxCharacterClassCount}
                onChange={(minimumUppercaseCount) => set('complexity', { minimumUppercaseCount })}
              />
              <RangeRow
                label="Minimum lowercase letters"
                hint="Raise above 1 for a stricter policy"
                value={complexity.minimumLowercaseCount}
                min={0}
                max={L.maxCharacterClassCount}
                error={errors.complexity}
                onChange={(minimumLowercaseCount) => set('complexity', { minimumLowercaseCount })}
              />
            </PolicySection>

            <PolicySection
              title="Password reuse"
              description="Stop people from going back to an old password."
              icon={<History />}
            >
              <SwitchRow
                label="Prevent reuse of previous passwords"
                hint="The new password must differ from earlier ones"
                checked={history.preventReuse}
                onChange={(preventReuse) =>
                  set('passwordHistory', {
                    preventReuse,
                    historyCount: preventReuse ? Math.max(history.historyCount, 1) : 0,
                  })
                }
              />
              <RangeRow
                label="Passwords remembered"
                hint="Earlier passwords checked, besides the current one"
                value={history.historyCount}
                min={history.preventReuse ? 1 : 0}
                max={L.maxHistoryCount}
                disabled={!history.preventReuse}
                error={errors['passwordHistory.historyCount']}
                onChange={(historyCount) => set('passwordHistory', { historyCount })}
              />
              <RangeRow
                label="Minimum password age"
                hint="Hours before a user may change it again (0 = any time)"
                unit="hours"
                value={extra.minimumPasswordAgeHours}
                min={0}
                max={L.maxMinimumAgeHours}
                error={errors['additionalRules.minimumPasswordAgeHours']}
                onChange={(minimumPasswordAgeHours) =>
                  set('additionalRules', { minimumPasswordAgeHours })
                }
              />
            </PolicySection>

            <PolicySection
              title="Extra protection"
              description="Checks that catch weak passwords the rules above let through."
              icon={<ShieldAlert />}
            >
              <SwitchRow
                label="Block common passwords"
                hint="“Password1!”, “Qwerty@123” and other well-known choices"
                checked={extra.blockCommonPasswords}
                onChange={(blockCommonPasswords) =>
                  set('additionalRules', { blockCommonPasswords })
                }
              />
              <SwitchRow
                label="Block breached passwords"
                hint="Checked against Have I Been Pwned"
                info="Only the first 5 characters of the password's SHA-1 hash leave the server (k-anonymity); the password itself is never sent."
                checked={extra.blockCompromisedPasswords}
                onChange={(blockCompromisedPasswords) =>
                  set('additionalRules', { blockCompromisedPasswords })
                }
              />
              <SwitchRow
                label="Block personal details"
                hint="The user's email, username, first or last name"
                checked={extra.preventPersonalInfoInPassword}
                onChange={(preventPersonalInfoInPassword) =>
                  set('additionalRules', { preventPersonalInfoInPassword })
                }
              />
              <SwitchRow
                label="Allow spaces"
                hint="Lets people use passphrases like “correct horse battery”"
                checked={extra.allowWhitespace}
                onChange={(allowWhitespace) => set('additionalRules', { allowWhitespace })}
              />
              <RangeRow
                label="Repeated characters"
                hint="Longest run of one character (0 = no limit)"
                value={extra.maximumRepeatedCharacters}
                min={0}
                max={L.maxRepeatedCharacters}
                error={errors['additionalRules.maximumRepeatedCharacters']}
                onChange={(maximumRepeatedCharacters) =>
                  set('additionalRules', {
                    // 1 would forbid any repeat ("aa"): jump between 0 and 2.
                    maximumRepeatedCharacters:
                      maximumRepeatedCharacters === 1
                        ? extra.maximumRepeatedCharacters === 0
                          ? 2
                          : 0
                        : maximumRepeatedCharacters,
                  })
                }
              />
            </PolicySection>

            <PolicySection
              title="Password expiry"
              description="Ask people to choose a new password after a while."
              icon={<CalendarClock />}
            >
              <SwitchRow
                label="Passwords expire"
                info="Current guidance (NIST SP 800-63B) advises against routine expiry unless a password may be compromised. Turn it on if your organisation requires it."
                hint={
                  validity.enabled
                    ? 'Users must change their password regularly'
                    : 'Passwords never expire'
                }
                checked={validity.enabled}
                onChange={(enabled) => set('passwordValidity', { enabled })}
              />
              {validity.enabled && (
                <>
                  <RangeRow
                    label="Valid for"
                    hint="Days after the password was set"
                    unit="days"
                    value={validity.validityDays}
                    min={1}
                    max={L.maxValidityDays}
                    onChange={(validityDays) => set('passwordValidity', { validityDays })}
                  />
                  <RangeRow
                    label="Grace period"
                    hint="Days sign-in still works after expiry"
                    unit="days"
                    value={validity.gracePeriodDays}
                    min={0}
                    max={L.maxGracePeriodDays}
                    onChange={(gracePeriodDays) => set('passwordValidity', { gracePeriodDays })}
                  />
                  <ReminderDays
                    days={validity.notificationDaysBeforeExpiry}
                    validityDays={validity.validityDays}
                    disabled={readOnly}
                    error={errors['passwordValidity.notificationDaysBeforeExpiry']}
                    onChange={(notificationDaysBeforeExpiry) =>
                      set('passwordValidity', { notificationDaysBeforeExpiry })
                    }
                  />
                  <SwitchRow
                    label="Force a change after expiry"
                    hint="Until then the user can only change the password or sign out"
                    checked={validity.forceChangeOnExpiry}
                    onChange={(forceChangeOnExpiry) =>
                      set('passwordValidity', { forceChangeOnExpiry })
                    }
                  />
                </>
              )}
            </PolicySection>
          </fieldset>

          <aside
            aria-label="Strength and preview"
            className="min-w-0 space-y-6 @5xl:sticky @5xl:top-[calc(var(--navbar-height)+1.5rem)]"
          >
            <StrengthCard rules={rules} />
            <TryPasswordCard rules={rules} />
            <SummaryCard rules={rules} />
          </aside>
        </div>

        {!readOnly && (
          <div className="sticky bottom-0 z-10 -mx-1 mt-6 flex flex-wrap items-center justify-end gap-2 border-t border-border bg-background/95 px-1 py-3 backdrop-blur">
            <p className="mr-auto text-xs text-muted-foreground" aria-live="polite">
              {errorCount > 0 && hasTriedSave
                ? `${errorCount} ${errorCount === 1 ? 'rule needs' : 'rules need'} attention`
                : isDirty
                  ? 'Unsaved changes'
                  : editing
                    ? 'No changes'
                    : 'New policy — not saved yet'}
            </p>
            <Button variant="ghost" size="sm" asChild>
              <Link to={paths.admin.passwordPolicy}>Cancel</Link>
            </Button>
            {!isActive && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                leftIcon={<Power />}
                isLoading={saving === 'activate'}
                disabled={saving !== null}
                onClick={() => void save(true)}
              >
                Save and activate
              </Button>
            )}
            <Button
              type="submit"
              size="sm"
              leftIcon={<Save />}
              isLoading={saving === 'save'}
              disabled={saving !== null || (!!editing && !isDirty)}
            >
              {editing ? 'Save changes' : 'Create policy'}
            </Button>
          </div>
        )}
      </form>

      <ConfirmDialog
        open={blocker.state === 'blocked'}
        onOpenChange={(open) => {
          if (!open && blocker.state === 'blocked') blocker.reset();
        }}
        title="Leave without saving?"
        description="Your changes to this policy will be lost."
        confirmText="Leave"
        cancelText="Stay"
        destructive
        onConfirm={() => blocker.proceed?.()}
      />
    </PageContainer>
  );
}
