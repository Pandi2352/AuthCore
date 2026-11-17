import { UserPlus } from 'lucide-react';
import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { ErrorAlert } from '@/components/feedback';
import { Button, Input } from '@/components/ui';
import { appConfig, paths } from '@/config';
import { AuthCard } from '@/features/auth/components/AuthCard';
import {
  meetsPasswordRequirements,
  PASSWORD_REQUIREMENTS_MESSAGE,
} from '@/features/auth/components/password-checks';
import { PasswordRequirements } from '@/features/auth/components/PasswordRequirements';
import { useAuth } from '@/features/auth/session/useAuth';
import { useApiError } from '@/hooks/useApiError';
import { useFormValidation } from '@/hooks/useFormValidation';
import { ApiError } from '@/lib/api';
import {
  custom,
  emailRules,
  passwordRules,
  personNameRules,
  usernameRules,
  type FormRules,
} from '@/lib/validation';

interface RegisterValues {
  email: string;
  firstName: string;
  lastName: string;
  username: string;
  password: string;
}

const rules: FormRules<RegisterValues> = {
  firstName: personNameRules('First name', true),
  lastName: personNameRules('Last name', false),
  email: emailRules(),
  username: usernameRules(false),
  password: [
    ...passwordRules('Choose a password'),
    custom((value) => meetsPasswordRequirements(String(value)), PASSWORD_REQUIREMENTS_MESSAGE),
  ],
};

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
  const validation = useFormValidation(formData, rules);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (fieldErrors[name]) {
      setFieldErrors((prev) => ({ ...prev, [name]: '' }));
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setFieldErrors({});
    if (!validation.validate(e.currentTarget)) return;
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
      <AuthCard title="Check your inbox" description={infoMessage}>
        <Button fullWidth asChild>
          <Link to={paths.auth.login}>Back to sign in</Link>
        </Button>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="Create your account"
      description={`Join ${appConfig.name} — it only takes a minute.`}
      footer={
        <p>
          Already have an account?{' '}
          <Link to={paths.auth.login} className="font-semibold text-primary hover:underline">
            Sign in
          </Link>
        </p>
      }
    >
      <form noValidate onSubmit={handleSubmit} className="space-y-4">
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
            placeholder="Enter your first name"
            value={formData.firstName}
            onChange={handleChange}
            error={validation.error('firstName') ?? fieldErrors.firstName}
          />
          <Input
            label="Last name"
            name="lastName"
            placeholder="Enter your last name"
            value={formData.lastName}
            onChange={handleChange}
            error={validation.error('lastName') ?? fieldErrors.lastName}
          />
        </div>

        <Input
          label="Email address"
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder="Enter your email address"
          value={formData.email}
          onChange={handleChange}
          error={validation.error('email') ?? fieldErrors.email}
        />

        <Input
          label="Username (optional)"
          name="username"
          placeholder="Choose a username"
          value={formData.username}
          onChange={handleChange}
          error={validation.error('username') ?? fieldErrors.username}
        />

        <Input
          label="Password"
          name="password"
          type="password"
          required
          autoComplete="new-password"
          placeholder="Create a strong password"
          value={formData.password}
          onChange={handleChange}
          error={validation.error('password') ?? fieldErrors.password}
        />

        <PasswordRequirements password={formData.password} />

        <Button
          type="submit"
          fullWidth
          className="mt-2"
          leftIcon={<UserPlus />}
          isLoading={isLoading}
        >
          Create account
        </Button>
      </form>
    </AuthCard>
  );
};
