import { CheckCircle2, Mail, RefreshCw } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';

import { Alert } from '@/components/common/Alert';
import { Button } from '@/components/common/Button';
import { Card } from '@/components/common/Card';
import { Input } from '@/components/common/Input';
import { ApiError } from '@/lib/api-client';
import { authService } from '@/services/auth.service';

export const VerifyEmail: React.FC = () => {
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
          await authService.verifyEmailLink({ token: tokenParam });
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
      await authService.verifyEmailOtp({
        email: email.trim().toLowerCase(),
        code: code.trim(),
      });
      navigate('/login', {
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
      await authService.resendEmailVerification({
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
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <Card className="w-full max-w-md space-y-3 p-8 text-center">
          <RefreshCw className="mx-auto h-8 w-8 animate-spin text-indigo-600" />
          <h3 className="text-lg font-bold text-slate-900">Verifying your email...</h3>
          <p className="text-sm text-slate-500">Please wait a moment.</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col justify-center bg-slate-50 py-12 sm:px-6 lg:px-8">
      <div className="text-center sm:mx-auto sm:w-full sm:max-w-md">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-100 text-indigo-600 shadow-sm">
          <Mail className="h-6 w-6" />
        </div>
        <h2 className="mt-4 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
          Verify your email
        </h2>
        <p className="mt-2 text-sm text-slate-500">
          Confirm your email address to access your account
        </p>
      </div>

      <div className="mt-8 px-4 sm:mx-auto sm:w-full sm:max-w-md sm:px-0">
        <Card className="border-slate-200 shadow-lg">
          {error && <Alert type="error" message={error} className="mb-4" />}
          {success && <Alert type="success" message={success} className="mb-4" />}

          {tokenParam && success ? (
            <div className="space-y-4 text-center">
              <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-500" />
              <p className="text-sm text-slate-600">Your account is ready.</p>
              <Link to="/login">
                <Button variant="primary" className="w-full">
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

              <Button
                type="submit"
                variant="primary"
                className="w-full py-2.5"
                isLoading={isLoading}
              >
                Verify Code
              </Button>

              <div className="flex items-center justify-between pt-2 text-xs">
                <button
                  type="button"
                  onClick={handleResend}
                  disabled={!email || resendCooldown > 0 || isLoading}
                  className="font-semibold text-indigo-600 hover:text-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {resendCooldown > 0 ? `Resend available in ${resendCooldown}s` : 'Resend code'}
                </button>

                <Link to="/login" className="text-slate-500 hover:text-slate-800 hover:underline">
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
