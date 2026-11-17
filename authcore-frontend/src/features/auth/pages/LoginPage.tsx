import { LogIn } from 'lucide-react';
import React, { useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';

import { ErrorAlert } from '@/components/feedback';
import { Alert, Button, Checkbox, Field, Input, PasswordInput } from '@/components/ui';
import { appConfig, featuresConfig, paths } from '@/config';
import { AuthCard } from '@/features/auth/components/AuthCard';
import { useAuth } from '@/features/auth/session/useAuth';
import { useApiError } from '@/hooks/useApiError';
import { useFormValidation } from '@/hooks/useFormValidation';
import { ApiError } from '@/lib/api';
import { ERROR_CODES } from '@/lib/constants';
import { safeReturnTo } from '@/lib/utils';
import { email, emailRules, passwordRules, required, type FormRules } from '@/lib/validation';

const allowsUsername = featuresConfig.auth.loginIdentifiers.includes('username');
const identifierLabel = allowsUsername ? 'Email or username' : 'Email';

interface LoginValues {
  identifier: string;
  password: string;
}

const rules: FormRules<LoginValues> = {
  // With usernames allowed, only a value containing @ must be a valid email.
  identifier: allowsUsername
    ? [
        required('Enter your email or username'),
        (value, values) => (values.identifier.includes('@') ? email()(value, values) : undefined),
      ]
    : emailRules('Enter your email address'),
  password: passwordRules(),
};

export const LoginPage: React.FC = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const location = useLocation();
  // Message from the page that sent the user here ("Password reset — please sign in").
  const [notice, setNotice] = useState<string | null>(
    (location.state as { message?: string } | null)?.message ?? null,
  );

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const { error, fallback: errorFallback, setError, fieldError } = useApiError();
  const validation = useFormValidation({ identifier, password }, rules);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    if (!validation.validate(e.currentTarget)) return;
    setIsLoading(true);

    try {
      const isEmail = identifier.includes('@');
      const payload = isEmail
        ? { email: identifier.trim().toLowerCase(), password, rememberMe }
        : { username: identifier.trim().toLowerCase(), password, rememberMe };

      const res = await login(payload);

      if (res.isPasswordChangeRequired || res.user.mustChangePassword) {
        navigate(paths.account.security, {
          state: { message: 'You must change your password before continuing.' },
        });
      } else {
        navigate(safeReturnTo(searchParams.get('returnTo'), paths.dashboard), { replace: true });
      }
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.code === ERROR_CODES.AUTH_EMAIL_NOT_VERIFIED) {
          navigate(paths.auth.verifyEmail, {
            state: { email: identifier.trim().toLowerCase() },
          });
          return;
        }
        setError(err);
      } else {
        setError(err, 'Unable to sign in. Please check your credentials and try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthCard
      title="Welcome back"
      description={`Sign in to your ${appConfig.name} account to continue.`}
      footer={
        <>
          {featuresConfig.auth.allowRegistration && (
            <p>
              New to {appConfig.name}?{' '}
              <Link to={paths.auth.register} className="font-semibold text-primary hover:underline">
                Create an account
              </Link>
            </p>
          )}
          {featuresConfig.auth.enableSelfRecovery && (
            <p className="text-xs">
              Closed or deactivated your account?{' '}
              <Link
                to={paths.auth.recovery}
                className="font-medium text-foreground hover:underline"
              >
                Recover it
              </Link>
            </p>
          )}
        </>
      }
    >
      <form noValidate onSubmit={handleSubmit} className="space-y-5">
        {notice && !error && (
          <Alert variant="success" message={notice} onClose={() => setNotice(null)} />
        )}
        <ErrorAlert
          error={error}
          fallback={errorFallback}
          fields={['email', 'username', 'password']}
          onClose={() => setError(null)}
        />

        <Input
          label={identifierLabel}
          error={validation.error('identifier') ?? fieldError('email') ?? fieldError('username')}
          type="text"
          required
          autoComplete="username"
          placeholder={allowsUsername ? 'Enter your email or username' : 'Enter your email address'}
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value)}
        />

        <div className="space-y-3">
          <Field
            label="Password"
            required
            error={validation.error('password') ?? fieldError('password')}
          >
            <PasswordInput
              autoComplete="current-password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </Field>

          <div className="flex items-center justify-between gap-3">
            {featuresConfig.auth.enableRememberMe ? (
              <Checkbox
                label="Keep me signed in"
                hint="For 30 days on this device"
                checked={rememberMe}
                onCheckedChange={setRememberMe}
              />
            ) : (
              <span />
            )}
            <Link
              to={paths.auth.forgotPassword}
              className="shrink-0 self-start text-sm font-medium text-primary hover:underline"
            >
              Forgot password?
            </Link>
          </div>
        </div>

        <Button type="submit" fullWidth leftIcon={<LogIn />} isLoading={isLoading}>
          Sign in
        </Button>
      </form>
    </AuthCard>
  );
};
