import { ArrowLeft, CircleAlert, MailCheck } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';

import { DateTime } from '@/components/common/DateTime';
import { ErrorAlert, LoadingState, notifySuccess } from '@/components/feedback';
import { Alert, Button, Input } from '@/components/ui';
import { paths } from '@/config';
import { authApi } from '@/features/auth/api/auth.api';
import { AuthCard } from '@/features/auth/components/AuthCard';
import {
  meetsPasswordRequirements,
  PASSWORD_REQUIREMENTS_MESSAGE,
} from '@/features/auth/components/password-checks';
import { PasswordRequirements } from '@/features/auth/components/PasswordRequirements';
import type { InviteInfo } from '@/features/auth/types/auth.types';
import { useApiError } from '@/hooks/useApiError';
import { useFormValidation } from '@/hooks/useFormValidation';
import {
  custom,
  matches,
  passwordRules,
  personNameRules,
  required,
  usernameRules,
  type FormRules,
} from '@/lib/validation';

interface Values {
  firstName: string;
  lastName: string;
  username: string;
  password: string;
  confirmPassword: string;
}

const rules: FormRules<Values> = {
  firstName: personNameRules('First name', true),
  lastName: personNameRules('Last name', false),
  username: usernameRules(false),
  password: [
    ...passwordRules('Choose a password'),
    custom((value) => meetsPasswordRequirements(String(value)), PASSWORD_REQUIREMENTS_MESSAGE),
  ],
  confirmPassword: [
    required('Confirm the password'),
    matches('password', 'Passwords do not match'),
  ],
};

const NOT_ACCEPTABLE: Record<InviteInfo['status'], string> = {
  PENDING: 'This invite can no longer be used.',
  ACCEPTED: 'This invite was already used. Sign in with the account you created.',
  REVOKED: 'This invite was withdrawn. Ask the person who invited you for a new one.',
  EXPIRED: 'This invite has expired. Ask the person who invited you to send it again.',
};

/** /accept-invite?token=… — the link from the invite email. */
export function AcceptInvitePage() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  // Read once, then drop it from the address bar (history, screenshots, referrers).
  const [token] = useState(() => params.get('token') ?? '');
  const [info, setInfo] = useState<InviteInfo | null>(null);
  const [loadError, setLoadError] = useState<unknown>(null);
  const [values, setValues] = useState<Values>({
    firstName: '',
    lastName: '',
    username: '',
    password: '',
    confirmPassword: '',
  });
  const [isSaving, setIsSaving] = useState(false);
  const { error, fallback, setError, fieldError } = useApiError();
  const form = useFormValidation(values, rules);

  useEffect(() => {
    if (params.has('token')) setParams({}, { replace: true });
  }, [params, setParams]);

  useEffect(() => {
    if (!token) return;
    let isCancelled = false;
    const load = async () => {
      try {
        const result = await authApi.inviteInfo(token);
        if (isCancelled) return;
        setInfo(result);
        setValues((v) => ({
          ...v,
          firstName: result.firstName ?? '',
          lastName: result.lastName ?? '',
        }));
      } catch (err) {
        if (!isCancelled) setLoadError(err);
      }
    };
    void load();
    return () => {
      isCancelled = true;
    };
  }, [token]);

  const set = (field: keyof Values, value: string) => setValues((v) => ({ ...v, [field]: value }));

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    if (!form.validate(event.currentTarget)) return;
    setIsSaving(true);
    try {
      const result = await authApi.acceptInvite({
        token,
        password: values.password,
        confirmPassword: values.confirmPassword,
        firstName: values.firstName.trim(),
        lastName: values.lastName.trim() || undefined,
        username: values.username.trim().toLowerCase() || undefined,
      });
      notifySuccess('Your account is ready', {
        description:
          result.groupsJoined > 0
            ? `You were added to ${result.groupsJoined} group${result.groupsJoined === 1 ? '' : 's'}. Sign in to continue.`
            : 'Sign in with your email and new password.',
      });
      void navigate(paths.auth.login, {
        state: { email: info?.email, message: 'Invitation accepted. You can sign in now.' },
      });
    } catch (err) {
      setError(err, 'Could not accept the invite.');
    } finally {
      setIsSaving(false);
    }
  };

  const backToSignIn = (
    <p>
      <Link
        to={paths.auth.login}
        className="inline-flex items-center gap-1.5 font-semibold text-primary hover:underline"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        Back to sign in
      </Link>
    </p>
  );

  if (!token || loadError) {
    return (
      <AuthCard
        title="This link doesn’t work"
        description="The invite link is incomplete, already used or no longer valid."
        footer={backToSignIn}
      >
        <Alert
          variant="danger"
          icon={<CircleAlert />}
          message="Open the link from your most recent invite email, or ask the person who invited you to send a new one."
        />
      </AuthCard>
    );
  }

  if (!info) {
    return (
      <AuthCard title="Checking your invite" footer={backToSignIn}>
        <LoadingState label="Checking your invite" />
      </AuthCard>
    );
  }

  if (!info.isAcceptable) {
    return (
      <AuthCard title="This invite can’t be used" description={info.email} footer={backToSignIn}>
        <Alert variant="warning" message={NOT_ACCEPTABLE[info.status]} />
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title={`Join ${info.appName}`}
      description={`${info.invitedByName} invited you. Set up your account to get started.`}
      footer={backToSignIn}
    >
      <div className="mb-4 flex items-center gap-3 rounded-md border border-border bg-muted px-3 py-2.5">
        <MailCheck className="size-5 shrink-0 text-primary" aria-hidden="true" />
        <div className="min-w-0 text-sm">
          <p className="truncate font-medium text-foreground">{info.email}</p>
          <p className="text-xs text-muted-foreground">
            Invite expires <DateTime value={info.expiresAt} format="relative" />
          </p>
        </div>
      </div>

      <ErrorAlert
        error={error}
        fallback={fallback}
        fields={['firstName', 'lastName', 'username', 'password', 'confirmPassword']}
        className="mb-4"
      />

      <form noValidate onSubmit={(e) => void submit(e)} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="First name"
            required
            autoComplete="given-name"
            value={values.firstName}
            placeholder="Enter your first name"
            error={form.error('firstName') ?? fieldError('firstName')}
            onChange={(e) => set('firstName', e.target.value)}
          />
          <Input
            label="Last name"
            autoComplete="family-name"
            value={values.lastName}
            placeholder="Enter your last name"
            error={form.error('lastName') ?? fieldError('lastName')}
            onChange={(e) => set('lastName', e.target.value)}
          />
        </div>
        <Input
          label="Username"
          autoComplete="username"
          value={values.username}
          placeholder="Choose a username (optional)"
          hint="You can sign in with it or your email"
          error={form.error('username') ?? fieldError('username')}
          onChange={(e) => set('username', e.target.value)}
        />
        <Input
          label="Password"
          type="password"
          required
          autoComplete="new-password"
          value={values.password}
          placeholder="Create a password"
          error={form.error('password') ?? fieldError('password')}
          onChange={(e) => set('password', e.target.value)}
        />
        <Input
          label="Confirm password"
          type="password"
          required
          autoComplete="new-password"
          value={values.confirmPassword}
          placeholder="Re-enter the password"
          error={form.error('confirmPassword') ?? fieldError('confirmPassword')}
          onChange={(e) => set('confirmPassword', e.target.value)}
        />
        <PasswordRequirements password={values.password} />
        <Button type="submit" fullWidth isLoading={isSaving}>
          Create my account
        </Button>
      </form>
    </AuthCard>
  );
}
