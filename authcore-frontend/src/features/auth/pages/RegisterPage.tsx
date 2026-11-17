import { CheckCircle2, UserPlus } from 'lucide-react';
import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { ErrorAlert } from '@/components/feedback';
import { Button, Card, Input } from '@/components/ui';
import { appConfig, paths } from '@/config';
import { PasswordRequirements } from '@/features/auth/components/PasswordRequirements';
import { useAuth } from '@/features/auth/session/useAuth';
import { useApiError } from '@/hooks/useApiError';
import { ApiError } from '@/lib/api';

export const RegisterPage: React.FC = () => {
  const { register } = useAuth();
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    email: '',
    firstName: '',
    lastName: '',
    username: '',
    password: '',
  });

  const [isLoading, setIsLoading] = useState(false);
  const { error, fallback: errorFallback, setError } = useApiError();
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [infoMessage, setInfoMessage] = useState<string | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (fieldErrors[name]) {
      setFieldErrors((prev) => ({ ...prev, [name]: '' }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setFieldErrors({});
    setIsLoading(true);

    try {
      const payload = {
        email: formData.email.trim().toLowerCase(),
        firstName: formData.firstName.trim(),
        lastName: formData.lastName.trim() || undefined,
        username: formData.username.trim() || undefined,
        password: formData.password,
      };

      const res = await register(payload);

      if (res.nextStep === 'VERIFY_EMAIL_OTP') {
        navigate(paths.auth.verifyEmail, {
          state: {
            email: payload.email,
            mode: 'otp',
            message: 'A 6-digit verification code was sent to your email.',
          },
        });
      } else if (res.nextStep === 'VERIFY_EMAIL_LINK') {
        setInfoMessage(
          'Account created! A verification link was sent to your email. Please click it to activate your account.',
        );
      } else if (res.nextStep === 'AWAIT_APPROVAL') {
        setInfoMessage(
          'Registration submitted! An administrator will review and approve your account shortly.',
        );
      } else {
        navigate(paths.auth.login, {
          state: { message: 'Registration successful! You may now sign in.' },
        });
      }
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.errors && err.errors.length > 0) {
          const map: Record<string, string> = {};
          err.errors.forEach((item) => {
            if (item.field) map[item.field] = item.message;
          });
          setFieldErrors(map);
        }
        setError(err);
      } else {
        setError(err, 'Registration failed. Please verify your details and try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  if (infoMessage) {
    return (
      <div className="w-full">
        <div>
          <Card contentClassName="space-y-4 p-8 text-center">
            <CheckCircle2 className="mx-auto h-12 w-12 text-success" />
            <h3 className="text-xl font-bold text-foreground">Check your inbox</h3>
            <p className="text-sm text-muted-foreground">{infoMessage}</p>
            <div className="pt-4">
              <Link to={paths.auth.login}>
                <Button variant="solid" className="w-full">
                  Return to Sign In
                </Button>
              </Link>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="text-center">
        <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          Create your account
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">Join {appConfig.name} today</p>
      </div>

      <div className="mt-8">
        <Card>
          <form onSubmit={handleSubmit} className="space-y-4">
            <ErrorAlert
              error={error}
              fallback={errorFallback}
              fields={['firstName', 'lastName', 'email', 'username', 'password']}
              onClose={() => setError(null)}
            />

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Input
                label="First name"
                name="firstName"
                required
                placeholder="Jane"
                value={formData.firstName}
                onChange={handleChange}
                error={fieldErrors.firstName}
              />
              <Input
                label="Last name"
                name="lastName"
                placeholder="Doe"
                value={formData.lastName}
                onChange={handleChange}
                error={fieldErrors.lastName}
              />
            </div>

            <Input
              label="Email"
              name="email"
              type="email"
              required
              autoComplete="email"
              placeholder="jane.doe@example.com"
              value={formData.email}
              onChange={handleChange}
              error={fieldErrors.email}
            />

            <Input
              label="Username (optional)"
              name="username"
              placeholder="janedoe"
              value={formData.username}
              onChange={handleChange}
              error={fieldErrors.username}
            />

            <Input
              label="Password"
              name="password"
              type="password"
              required
              autoComplete="new-password"
              placeholder="••••••••"
              value={formData.password}
              onChange={handleChange}
              error={fieldErrors.password}
            />

            <PasswordRequirements password={formData.password} />

            <Button
              type="submit"
              fullWidth
              size="lg"
              className="mt-2"
              leftIcon={<UserPlus />}
              isLoading={isLoading}
            >
              Create account
            </Button>
          </form>

          <div className="mt-6 border-t border-border pt-5 text-center text-sm text-muted-foreground">
            Already have an account?{' '}
            <Link
              to={paths.auth.login}
              className="font-semibold text-primary hover:text-primary hover:underline"
            >
              Sign in
            </Link>
          </div>
        </Card>
      </div>
    </div>
  );
};
