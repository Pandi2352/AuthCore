import { ArrowLeft } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';

import { ErrorAlert } from '@/components/feedback';
import { Alert, Button, Input, Spinner } from '@/components/ui';
import { paths } from '@/config';
import { authApi } from '@/features/auth/api/auth.api';
import { AuthCard } from '@/features/auth/components/AuthCard';
import { useApiError } from '@/hooks/useApiError';
import { useFormValidation } from '@/hooks/useFormValidation';
import { codeRules, emailRules, type FormRules } from '@/lib/validation';

const otpRules: FormRules<{ email: string; code: string }> = {
  email: emailRules(),
  code: codeRules({ min: 6, max: 8 }),
};
const resendRules: FormRules<{ email: string }> = { email: emailRules() };

export const VerifyEmailPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  const tokenParam = searchParams.get('token');
  const emailState = (location.state as { email?: string; message?: string })?.email || '';

  const [email, setEmail] = useState(emailState);
  const [code, setCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isVerifyingLink, setIsVerifyingLink] = useState(false);
  const { error, fallback: errorFallback, setError, fieldError } = useApiError();
  const otpForm = useFormValidation({ email, code }, otpRules);
  const resendForm = useFormValidation({ email }, resendRules);
  const [success, setSuccess] = useState<string | null>(
    (location.state as { message?: string })?.message || null,
  );

  const [resendCooldown, setResendCooldown] = useState(0);

  // Link token verification on mount
  useEffect(() => {
    if (tokenParam) {
      const verifyLink = async () => {
        setIsVerifyingLink(true);
        setError(null);
        try {
          await authApi.verifyEmailLink({ token: tokenParam });
          setSuccess('Email successfully verified! You may now sign in.');
        } catch (err) {
          setError(err, 'Invalid or expired verification link.');
        } finally {
          setIsVerifyingLink(false);
        }
      };
      verifyLink();
    }
  }, [tokenParam, setError]);

  // Resend cooldown timer
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  const handleVerifyOtp = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    if (!otpForm.validate(e.currentTarget)) return;
    setIsLoading(true);

    try {
      await authApi.verifyEmailOtp({
        email: email.trim().toLowerCase(),
        code: code.trim(),
      });
      navigate(paths.auth.login, {
        state: { message: 'Email verified successfully! Please sign in.' },
      });
    } catch (err) {
      setError(err, 'Invalid or expired verification code.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResend = async (e: React.MouseEvent<HTMLButtonElement>) => {
    if (resendCooldown > 0) return;
    setError(null);
    if (!resendForm.validate(e.currentTarget.form)) return;
    setIsLoading(true);

    try {
      await authApi.resendEmailVerification({
        email: email.trim().toLowerCase(),
      });
      setSuccess('A new verification code has been dispatched to your email.');
      setResendCooldown(60);
    } catch (err) {
      setError(err, 'Unable to resend verification code right now.');
    } finally {
      setIsLoading(false);
    }
  };

  if (isVerifyingLink) {
    return (
      <AuthCard title="Verifying your email…" description="Hang tight — this only takes a moment.">
        <div className="flex justify-center text-primary">
          <Spinner size="lg" label="Verifying your email" />
        </div>
      </AuthCard>
    );
  }

  if (tokenParam && success) {
    return (
      <AuthCard
        title="You're all set!"
        description="Your email is verified and your account is ready. Sign in to get started."
      >
        <Button fullWidth asChild>
          <Link to={paths.auth.login}>Continue to sign in</Link>
        </Button>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="Verify your email"
      description="We sent a verification code to your inbox. Enter it below to activate your account."
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
      <form noValidate onSubmit={handleVerifyOtp} className="space-y-4">
        {success && <Alert variant="success" message={success} />}
        <ErrorAlert error={error} fallback={errorFallback} fields={['email', 'code']} />

        <Input
          label="Email address"
          error={otpForm.error('email') ?? resendForm.error('email') ?? fieldError('email')}
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Enter your email address"
        />

        <Input
          label="Verification code"
          error={otpForm.error('code') ?? fieldError('code')}
          type="text"
          required
          maxLength={8}
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="Enter the verification code"
          inputMode="numeric"
          autoComplete="one-time-code"
          className="text-center font-mono text-lg tracking-widest placeholder:font-sans placeholder:text-sm placeholder:tracking-normal"
        />

        <Button type="submit" fullWidth isLoading={isLoading}>
          Verify email
        </Button>

        <p className="text-center text-sm text-muted-foreground">
          Didn't get the code?{' '}
          <button
            type="button"
            onClick={handleResend}
            disabled={resendCooldown > 0 || isLoading}
            className="cursor-pointer font-semibold text-primary hover:underline disabled:cursor-not-allowed disabled:no-underline disabled:opacity-60"
          >
            {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend code'}
          </button>
        </p>
      </form>
    </AuthCard>
  );
};
