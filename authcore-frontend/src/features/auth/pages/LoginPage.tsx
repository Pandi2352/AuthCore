import { LogIn } from 'lucide-react';
import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';

import { ErrorAlert } from '@/components/feedback';
import { Button, Card, Checkbox, Field, Input, PasswordInput } from '@/components/ui';
import { appConfig, featuresConfig, paths } from '@/config';
import { useAuth } from '@/features/auth/session/useAuth';
import { useApiError } from '@/hooks/useApiError';
import { ApiError } from '@/lib/api';
import { ERROR_CODES } from '@/lib/constants';
import { safeReturnTo } from '@/lib/utils';

export const LoginPage: React.FC = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const { error, fallback: errorFallback, setError, fieldError } = useApiError();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
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
    <div className="w-full">
      <div className="text-center">
        <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          Sign in to {appConfig.name}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Reusable authentication & access management
        </p>
      </div>

      <div className="mt-8">
        <Card>
          <form onSubmit={handleSubmit} className="space-y-5">
            <ErrorAlert
              error={error}
              fallback={errorFallback}
              fields={['email', 'username', 'password']}
              onClose={() => setError(null)}
            />

            <Input
              label="Email or Username"
              error={fieldError('email') ?? fieldError('username')}
              type="text"
              required
              autoComplete="username"
              placeholder="e.g. jane.doe@example.com"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
            />

            <div className="space-y-1">
              <Field label="Password" required error={fieldError('password')}>
                <PasswordInput
                  autoComplete="current-password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </Field>

              <div className="flex items-center justify-between pt-1">
                <Checkbox
                  label="Remember me (30 days)"
                  checked={rememberMe}
                  onCheckedChange={setRememberMe}
                />

                <Link
                  to={paths.auth.forgotPassword}
                  className="text-sm font-medium text-primary hover:underline"
                >
                  Forgot password?
                </Link>
              </div>
            </div>

            <Button type="submit" fullWidth size="lg" leftIcon={<LogIn />} isLoading={isLoading}>
              Sign in
            </Button>
          </form>

          {featuresConfig.auth.allowRegistration && (
            <div className="mt-6 border-t border-border pt-5 text-center text-sm text-muted-foreground">
              Don't have an account?{' '}
              <Link
                to={paths.auth.register}
                className="font-semibold text-primary hover:text-primary hover:underline"
              >
                Sign up
              </Link>
            </div>
          )}

          {featuresConfig.auth.enableSelfRecovery && (
            <div className="mt-2 text-center text-xs text-muted-foreground">
              Closed or deactivated account?{' '}
              <Link
                to={paths.auth.recovery}
                className="font-medium text-foreground hover:underline"
              >
                Recover account
              </Link>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};
