import {
  BellRing,
  CalendarClock,
  Gauge,
  History,
  Layers,
  Plus,
  Ruler,
  ShieldBan,
  ShieldCheck,
  Type,
} from 'lucide-react';
import { memo, useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { StatCard } from '@/components/common/StatCard';
import { ErrorState, LoadingState } from '@/components/feedback';
import { PageContainer, PageHeader } from '@/components/page';
import { Alert, Button } from '@/components/ui';
import { paths } from '@/config';
import { usePermissions } from '@/features/auth';
import { isAbortError } from '@/lib/api';

import { passwordPolicyApi } from '../api/password-policy.api';
import { PoliciesTable } from '../components/PoliciesTable';
import { caseCount, policyStrength, ruleSentences } from '../components/policy-rules';
import { StrengthGauge } from '../components/PolicyControls';
import type { PasswordPolicy } from '../types/password-policy.types';

interface Loaded {
  key: number;
  active: PasswordPolicy;
  policies: Array<PasswordPolicy & { id: string }>;
}

const hasId = (policy: PasswordPolicy): policy is PasswordPolicy & { id: string } =>
  policy.id !== null;

/** The active policy at a glance (same light cards as the other pages). */
const PolicyStatCards = memo(function PolicyStatCards({
  active,
  saved,
}: {
  active: PasswordPolicy;
  saved: number;
}) {
  const strength = policyStrength(active);
  const c = active.complexity;
  const characterRules = [
    caseCount(active, 'upper') > 0,
    caseCount(active, 'lower') > 0,
    c.minimumDigitCount > 0,
    c.minimumSpecialCharacterCount > 0,
  ].filter(Boolean).length;
  const blocked = [
    active.additionalRules.blockCommonPasswords,
    active.additionalRules.blockCompromisedPasswords,
  ].filter(Boolean).length;
  const v = active.passwordValidity;
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <StatCard
        tone="primary"
        pattern="rings"
        icon={Layers}
        label="Saved policies"
        value={saved}
        hint="Exactly one is active"
      />
      <StatCard
        tone={
          strength.level === 'strong' ? 'success' : strength.level === 'weak' ? 'danger' : 'warning'
        }
        pattern="waves"
        icon={Gauge}
        label="Active policy strength"
        value={`${strength.score} / 100`}
        hint={strength.label}
      />
      <StatCard
        tone="info"
        pattern="grid"
        icon={Ruler}
        label="Minimum length"
        value={`${active.characterLength.minimum} characters`}
        hint={`At most ${active.characterLength.maximum}`}
      />
      <StatCard
        tone="violet"
        pattern="sparkles"
        icon={Type}
        label="Character rules"
        value={characterRules === 0 ? 'None' : `${characterRules} of 4`}
        hint="Upper, lower, digit, symbol"
      />
      <StatCard
        tone="cyan"
        pattern="dots"
        icon={History}
        label="Password reuse"
        value={
          active.passwordHistory.preventReuse
            ? `Last ${active.passwordHistory.historyCount + 1} blocked`
            : 'Allowed'
        }
        hint="Earlier passwords"
      />
      <StatCard
        tone="danger"
        pattern="stripes"
        icon={ShieldBan}
        label="Blocked lists"
        value={
          blocked === 2
            ? 'Common + breached'
            : blocked === 1
              ? active.additionalRules.blockCommonPasswords
                ? 'Common'
                : 'Breached'
              : 'Off'
        }
        hint="Known-bad passwords refused"
      />
      <StatCard
        tone="warning"
        pattern="bars"
        icon={CalendarClock}
        label="Password expiry"
        value={v.enabled ? `${v.validityDays} days` : 'Never'}
        hint={v.enabled ? `${v.gracePeriodDays} days grace` : 'Passwords don’t expire'}
      />
      <StatCard
        tone="success"
        pattern="bubbles"
        icon={BellRing}
        label="Expiry reminders"
        value={
          v.enabled && v.notificationDaysBeforeExpiry.length > 0
            ? `${v.notificationDaysBeforeExpiry.length} emails`
            : 'None'
        }
        hint={
          v.enabled && v.notificationDaysBeforeExpiry.length > 0
            ? `${v.notificationDaysBeforeExpiry.toSorted((a, b) => b - a).join(', ')} days before`
            : 'No reminder emails'
        }
      />
    </div>
  );
});

/** Every password policy; exactly one is active (Administration → Security settings). */
export function PasswordPoliciesPage() {
  const { hasPermission } = usePermissions();
  const canManage = hasPermission('PASSWORD_POLICY_MANAGE');
  const [nonce, setNonce] = useState(0);
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [failure, setFailure] = useState<{ key: number; error: unknown } | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const load = async () => {
      try {
        const [active, policies] = await Promise.all([
          passwordPolicyApi.active(controller.signal),
          passwordPolicyApi.list(controller.signal),
        ]);
        setLoaded({ key: nonce, active, policies: policies.filter(hasId) });
      } catch (error) {
        if (!isAbortError(error)) setFailure({ key: nonce, error });
      }
    };
    void load();
    return () => controller.abort();
  }, [nonce]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);
  const isFirstLoad = !loaded && failure?.key !== nonce;
  const active = loaded?.active ?? null;
  const strength = active ? policyStrength(active) : null;

  return (
    <PageContainer>
      <PageHeader
        title="Password policy"
        description="The rules every new password must follow. Keep several policies; exactly one is active."
        actions={
          canManage && (
            <Button size="toolbar" leftIcon={<Plus />} asChild>
              <Link to={paths.admin.passwordPolicyNew}>New policy</Link>
            </Button>
          )
        }
      />

      {isFirstLoad && <LoadingState variant="cards" label="Loading password policies" />}
      {!loaded && failure?.key === nonce && (
        <ErrorState
          error={failure.error}
          title="Could not load the password policies"
          onRetry={reload}
        />
      )}

      {loaded && active && strength && (
        <>
          {!canManage && (
            <Alert
              variant="info"
              title="View only"
              message="Changing password policies needs the Manage password policy permission."
            />
          )}

          <PolicyStatCards active={active} saved={loaded.policies.length} />

          <section
            aria-label="Active policy"
            className="flex flex-col gap-6 overflow-hidden rounded-md border border-l-4 border-primary/30 border-l-primary bg-linear-to-br from-primary-soft to-surface p-card md:flex-row md:items-center"
          >
            <div className="flex justify-center">
              <StrengthGauge strength={strength} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold tracking-wide text-primary-soft-foreground uppercase">
                Active policy
              </p>
              <p className="truncate text-xl font-semibold text-foreground">
                {active.isDefault ? 'Built-in default' : active.policyName}
              </p>
              <p className="text-sm text-muted-foreground">
                {active.isDefault
                  ? 'No policy is saved yet, so these built-in rules apply.'
                  : 'New passwords (sign-up, reset, change) must follow these rules.'}
              </p>
              <ul className="mt-3 grid gap-x-6 gap-y-1.5 text-sm text-foreground sm:grid-cols-2">
                {ruleSentences(active).map((rule) => (
                  <li key={rule} className="flex items-start gap-2">
                    <ShieldCheck
                      className="mt-0.5 size-4 shrink-0 text-primary"
                      aria-hidden="true"
                    />
                    <span>{rule}</span>
                  </li>
                ))}
              </ul>
            </div>
            {active.id && (
              <Button
                variant="outline"
                size="toolbar"
                className="self-start bg-surface md:self-center"
                asChild
              >
                <Link to={paths.admin.passwordPolicyEdit(active.id)}>
                  {canManage ? 'Edit active policy' : 'View'}
                </Link>
              </Button>
            )}
          </section>

          <PoliciesTable policies={loaded.policies} canManage={canManage} onChanged={reload} />
        </>
      )}
    </PageContainer>
  );
}
