import { CheckCircle2, UserPlus } from 'lucide-react';
import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { PasswordRequirements } from '@/components/auth/PasswordRequirements';
import { Alert } from '@/components/common/Alert';
import { Button } from '@/components/common/Button';
import { Card } from '@/components/common/Card';
import { Input } from '@/components/common/Input';
import { appConfig, paths } from '@/config';
import { useAuth } from '@/context/AuthContext';
import { ApiError } from '@/lib/api-client';

export const Register: React.FC = () => {
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
  const [error, setError] = useState<string | null>(null);
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
          err.errors.forEach((fieldError) => {
            if (fieldError.field) map[fieldError.field] = fieldError.message;
          });
          setFieldErrors(map);
        }
        setError(err.message);
      } else {
        setError('Registration failed. Please verify your details and try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  if (infoMessage) {
    return (
      <div className="flex min-h-screen flex-col justify-center bg-slate-50 py-12 sm:px-6 lg:px-8">
        <div className="px-4 sm:mx-auto sm:w-full sm:max-w-md sm:px-0">
          <Card className="space-y-4 p-8 text-center">
            <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-500" />
            <h3 className="text-xl font-bold text-slate-900">Check your inbox</h3>
            <p className="text-sm text-slate-600">{infoMessage}</p>
            <div className="pt-4">
              <Link to={paths.auth.login}>
                <Button variant="primary" className="w-full">
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
    <div className="flex min-h-screen flex-col justify-center bg-slate-50 py-12 sm:px-6 lg:px-8">
      <div className="text-center sm:mx-auto sm:w-full sm:max-w-md">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-600 text-2xl font-black text-white shadow-md">
          {appConfig.name.charAt(0)}
        </div>
        <h2 className="mt-4 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
          Create your account
        </h2>
        <p className="mt-2 text-sm text-slate-500">Join {appConfig.name} today</p>
      </div>

      <div className="mt-8 px-4 sm:mx-auto sm:w-full sm:max-w-md sm:px-0">
        <Card className="border-slate-200 shadow-lg">
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && <Alert type="error" message={error} onClose={() => setError(null)} />}

            <div className="grid grid-cols-2 gap-3">
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
              variant="primary"
              className="mt-2 w-full py-2.5"
              isLoading={isLoading}
            >
              <UserPlus className="mr-2 h-4 w-4" />
              Sign Up
            </Button>
          </form>

          <div className="mt-6 border-t border-slate-100 pt-5 text-center text-sm text-slate-600">
            Already have an account?{' '}
            <Link
              to={paths.auth.login}
              className="font-semibold text-indigo-600 hover:text-indigo-500 hover:underline"
            >
              Sign in
            </Link>
          </div>
        </Card>
      </div>
    </div>
  );
};
