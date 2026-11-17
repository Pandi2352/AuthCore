import { CheckCircle2, Mail, RefreshCw } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';

import { Alert, Button, Card, Input } from '@/components/ui';
import { paths } from '@/config';
import { authApi } from '@/features/auth/api/auth.api';
import { ApiError } from '@/lib/api';

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
  const [error, setError] = useState<string | null>(null);
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
          setError(err instanceof ApiError ? err.message : 'Invalid or expired verification link.');
        } finally {
          setIsVerifyingLink(false);
        }
      };
      verifyLink();
    }
  }, [tokenParam]);

  // Resend cooldown timer
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !code) return;
    setError(null);
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
      setError(err instanceof ApiError ? err.message : 'Invalid or expired verification code.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResend = async () => {
    if (!email || resendCooldown > 0) return;
    setError(null);
    setIsLoading(true);

    try {
      await authApi.resendEmailVerification({
        email: email.trim().toLowerCase(),
      });
      setSuccess('A new verification code has been dispatched to your email.');
      setResendCooldown(60);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : 'Unable to resend verification code right now.',
      );
    } finally {
      setIsLoading(false);
    }
  };

  if (isVerifyingLink) {
    return (
      <div className="w-full">
        <Card className="space-y-3 p-8 text-center">
          <RefreshCw className="mx-auto h-8 w-8 animate-spin text-primary" />
          <h3 className="text-lg font-bold text-foreground">Verifying your email...</h3>
          <p className="text-sm text-muted-foreground">Please wait a moment.</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-md bg-primary-soft text-primary">
          <Mail className="h-6 w-6" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          Verify your email
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Confirm your email address to access your account
        </p>
      </div>

      <div className="mt-8">
        <Card>
          {error && <Alert variant="danger" message={error} className="mb-4" />}
          {success && <Alert variant="success" message={success} className="mb-4" />}

          {tokenParam && success ? (
            <div className="space-y-4 text-center">
              <CheckCircle2 className="mx-auto h-12 w-12 text-success" />
              <p className="text-sm text-muted-foreground">Your account is ready.</p>
              <Link to={paths.auth.login}>
                <Button variant="solid" className="w-full">
                  Sign In
                </Button>
              </Link>
            </div>
          ) : (
            <form onSubmit={handleVerifyOtp} className="space-y-4">
              <Input
                label="Email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="jane.doe@example.com"
              />

              <Input
                label="6-Digit Verification Code"
                type="text"
                required
                maxLength={8}
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="123456"
                className="text-center font-mono text-lg tracking-widest"
              />

              <Button type="submit" variant="solid" className="w-full py-2.5" isLoading={isLoading}>
                Verify Code
              </Button>

              <div className="flex items-center justify-between pt-2 text-xs">
                <button
                  type="button"
                  onClick={handleResend}
                  disabled={!email || resendCooldown > 0 || isLoading}
                  className="font-semibold text-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {resendCooldown > 0 ? `Resend available in ${resendCooldown}s` : 'Resend code'}
                </button>

                <Link
                  to={paths.auth.login}
                  className="text-muted-foreground hover:text-foreground hover:underline"
                >
                  Back to Sign In
                </Link>
              </div>
            </form>
          )}
        </Card>
      </div>
    </div>
  );
};
