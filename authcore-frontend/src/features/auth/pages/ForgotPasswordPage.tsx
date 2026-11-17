import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { ErrorAlert } from '@/components/feedback';
import { Button, Input } from '@/components/ui';
import { paths } from '@/config';
import { authApi } from '@/features/auth/api/auth.api';
import { AuthCard } from '@/features/auth/components/AuthCard';
import { useApiError } from '@/hooks/useApiError';
import { useFormValidation } from '@/hooks/useFormValidation';
import { emailRules, type FormRules } from '@/lib/validation';

const rules: FormRules<{ email: string }> = { email: emailRules() };

export const ForgotPasswordPage: React.FC = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { error, fallback: errorFallback, setError, fieldError } = useApiError();
  const validation = useFormValidation({ email }, rules);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    if (!validation.validate(e.currentTarget)) return;
    setIsLoading(true);

    try {
      await authApi.forgotPassword({ email: email.trim().toLowerCase() });
      navigate(paths.auth.resetPassword, {
        state: {
          email: email.trim().toLowerCase(),
          message: 'If an account exists, a reset code has been sent to your email.',
        },
      });
    } catch (err) {
      setError(err, 'Unable to process your request. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthCard
      title="Forgot your password?"
      description="No worries — enter your email and we'll send you a code to reset it."
      footer={
        <p>
          Remembered it?{' '}
          <Link to={paths.auth.login} className="font-semibold text-primary hover:underline">
            Back to sign in
          </Link>
        </p>
      }
    >
      <form noValidate onSubmit={handleSubmit} className="space-y-4">
        <ErrorAlert
          error={error}
          fallback={errorFallback}
          fields={['email']}
          onClose={() => setError(null)}
        />

        <Input
          label="Email address"
          error={validation.error('email') ?? fieldError('email')}
          type="email"
          required
          autoComplete="email"
          placeholder="Enter your registered email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <Button type="submit" fullWidth isLoading={isLoading}>
          Send reset code
        </Button>
      </form>
    </AuthCard>
  );
};
