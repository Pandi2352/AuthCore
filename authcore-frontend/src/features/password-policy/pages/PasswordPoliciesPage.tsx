import { Plus, RefreshCw, ShieldCheck } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { EmptyState, ErrorState, LoadingState } from '@/components/feedback';
import { PageContainer, PageHeader } from '@/components/page';
import { Alert, Button } from '@/components/ui';
import { paths } from '@/config';
import { usePermissions } from '@/features/auth';
import { isAbortError } from '@/lib/api';

import { passwordPolicyApi } from '../api/password-policy.api';
import { policyStrength, ruleSentences } from '../components/policy-rules';
import { PolicyCard } from '../components/PolicyCard';
import { StrengthGauge } from '../components/PolicyControls';
import type { PasswordPolicy } from '../types/password-policy.types';

interface Loaded {
  key: number;
  active: PasswordPolicy;
  policies: Array<PasswordPolicy & { id: string }>;
}

const hasId = (policy: PasswordPolicy): policy is PasswordPolicy & { id: string } =>
  policy.id !== null;

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
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="shrink-0 whitespace-nowrap"
              leftIcon={<RefreshCw />}
              onClick={reload}
            >
              Refresh
            </Button>
            {canManage && (
              <Button size="sm" className="shrink-0 whitespace-nowrap" leftIcon={<Plus />} asChild>
                <Link to={paths.admin.passwordPolicyNew}>New policy</Link>
              </Button>
            )}
          </div>
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
        <div className="space-y-6">
          {!canManage && (
            <Alert
              variant="info"
              title="View only"
              message="Changing password policies needs the Manage password policy permission."
            />
          )}

          <section
            aria-label="Active policy"
            className="flex flex-col gap-6 rounded-md border border-primary/40 bg-primary-soft p-card md:flex-row md:items-center"
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
              <Button variant="outline" size="sm" className="self-start md:self-center" asChild>
                <Link to={paths.admin.passwordPolicyEdit(active.id)}>
                  {canManage ? 'Edit active policy' : 'View'}
                </Link>
              </Button>
            )}
          </section>

          <section aria-label="All policies">
            <h2 className="mb-3 text-base font-semibold text-foreground">
              All policies <span className="text-muted-foreground">({loaded.policies.length})</span>
            </h2>
            {loaded.policies.length === 0 ? (
              <div className="rounded-md border border-dashed border-field bg-surface p-card">
                <EmptyState
                  icon={<ShieldCheck />}
                  title="No saved policies yet"
                  description="Create a policy to choose your own rules. The first one you activate replaces the built-in default."
                  action={
                    canManage ? (
                      <Button size="sm" leftIcon={<Plus />} asChild>
                        <Link to={paths.admin.passwordPolicyNew}>Create a policy</Link>
                      </Button>
                    ) : undefined
                  }
                />
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {loaded.policies.map((policy) => (
                  <PolicyCard
                    key={policy.id}
                    policy={policy}
                    canManage={canManage}
                    onChanged={reload}
                  />
                ))}
                {canManage && (
                  <Link
                    to={paths.admin.passwordPolicyNew}
                    className="flex min-h-52 cursor-pointer flex-col items-center justify-center gap-2 rounded-md border border-dashed border-field bg-surface p-card text-center transition-colors hover:border-primary hover:bg-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                  >
                    <span className="flex size-10 items-center justify-center rounded-full bg-primary-soft text-primary-soft-foreground">
                      <Plus className="size-5" aria-hidden="true" />
                    </span>
                    <span className="text-sm font-semibold text-foreground">New policy</span>
                    <span className="max-w-60 text-xs text-muted-foreground">
                      Start from the recommended rules, then adjust them
                    </span>
                  </Link>
                )}
              </div>
            )}
          </section>
        </div>
      )}
    </PageContainer>
  );
}
