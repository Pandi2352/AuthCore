import { ArrowLeft } from 'lucide-react';
import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { ErrorAlert } from '@/components/feedback';
import { Alert, Button, Input } from '@/components/ui';
import { paths } from '@/config';
import { authApi } from '@/features/auth/api/auth.api';
import { AuthCard } from '@/features/auth/components/AuthCard';
import { useApiError } from '@/hooks/useApiError';
import { useFormValidation } from '@/hooks/useFormValidation';
import { codeRules, emailRules, type FormRules } from '@/lib/validation';

const requestRules: FormRules<{ email: string }> = { email: emailRules() };
const confirmRules: FormRules<{ email: string; code: string }> = {
  email: emailRules(),
  code: codeRules({ min: 6, max: 6 }),
};

export const AccountRecoveryPage: React.FC = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState<'request' | 'confirm'>('request');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { error, fallback: errorFallback, setError, fieldError } = useApiError();
  const requestStep = useFormValidation({ email }, requestRules);
  const confirmStep = useFormValidation({ email, code }, confirmRules);
  const [message, setMessage] = useState<string | null>(null);

  const handleRequest = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    if (!requestStep.validate(e.currentTarget)) return;
    setIsLoading(true);

    try {
      await authApi.requestRecovery({ email: email.trim().toLowerCase() });
      setMessage(
        'If your account is eligible for self-recovery, a verification code has been dispatched.',
      );
      setStep('confirm');
    } catch (err) {
      setError(err, 'Recovery request failed.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirm = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    if (!confirmStep.validate(e.currentTarget)) return;
    setIsLoading(true);

    try {
      await authApi.confirmRecovery({
        email: email.trim().toLowerCase(),
        code: code.trim(),
      });
      navigate(paths.auth.login, {
        state: {
          message: 'Your account has been reactivated successfully! Please sign in.',
        },
      });
    } catch (err) {
      setError(err, 'Invalid or expired recovery code.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthCard
      title={step === 'request' ? 'Recover your account' : 'Enter your recovery code'}
      description={
        step === 'request'
          ? 'Closed or deactivated your account? We can bring it back — just confirm your email.'
          : 'We sent a 6-digit code to your email. Enter it to reactivate your account.'
      }
      footer={
        <p>
          <Link
            to={paths.auth.login}
            className="inline-flex items-center gap-1.5 font-semibold text-primary hover:underline"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            Back to sign in
          </Link>
        </p>
      }
    >
      <ErrorAlert
        error={error}
        fallback={errorFallback}
        fields={['email', 'code']}
        className="mb-4"
      />
      {message && <Alert variant="info" message={message} className="mb-4" />}

      {step === 'request' ? (
        <form noValidate onSubmit={handleRequest} className="space-y-4">
          <Input
            label="Email address"
            error={requestStep.error('email') ?? fieldError('email')}
            type="email"
            required
            placeholder="Enter your registered email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />

          <Button type="submit" fullWidth isLoading={isLoading}>
            Send recovery code
          </Button>
        </form>
      ) : (
        <form noValidate onSubmit={handleConfirm} className="space-y-4">
          <Input
            label="Email address"
            error={confirmStep.error('email') ?? fieldError('email')}
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />

          <Input
            label="Recovery code"
            error={confirmStep.error('code') ?? fieldError('code')}
            type="text"
            required
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="Enter the 6-digit code"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            className="text-center font-mono text-lg tracking-widest placeholder:font-sans placeholder:text-sm placeholder:tracking-normal"
          />

          <Button type="submit" fullWidth isLoading={isLoading}>
            Reactivate account
          </Button>
        </form>
      )}
    </AuthCard>
  );
};
