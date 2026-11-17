import { KeyRound } from 'lucide-react';
import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { Alert } from '@/components/common/Alert';
import { Button } from '@/components/common/Button';
import { Card } from '@/components/common/Card';
import { Input } from '@/components/common/Input';
import { paths } from '@/config';
import { ApiError } from '@/lib/api-client';
import { authService } from '@/services/auth.service';

export const ForgotPassword: React.FC = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setError(null);
    setIsLoading(true);

    try {
      await authService.forgotPassword({ email: email.trim().toLowerCase() });
      navigate(paths.auth.resetPassword, {
        state: {
          email: email.trim().toLowerCase(),
          message: 'If an account exists, a reset code has been sent to your email.',
        },
      });
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : 'Unable to process your request. Please try again.',
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col justify-center bg-slate-50 py-12 sm:px-6 lg:px-8">
      <div className="text-center sm:mx-auto sm:w-full sm:max-w-md">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-100 text-indigo-600 shadow-sm">
          <KeyRound className="h-6 w-6" />
        </div>
        <h2 className="mt-4 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
          Reset your password
        </h2>
        <p className="mt-2 text-sm text-slate-500">
          Enter your registered email address and we'll send you recovery instructions
        </p>
      </div>

      <div className="mt-8 px-4 sm:mx-auto sm:w-full sm:max-w-md sm:px-0">
        <Card className="border-slate-200 shadow-lg">
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && <Alert type="error" message={error} onClose={() => setError(null)} />}

            <Input
              label="Email"
              type="email"
              required
              autoComplete="email"
              placeholder="jane.doe@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />

            <Button type="submit" variant="primary" className="w-full py-2.5" isLoading={isLoading}>
              Send Reset Code
            </Button>
          </form>

          <div className="mt-6 border-t border-slate-100 pt-5 text-center text-sm text-slate-600">
            Remember your password?{' '}
            <Link
              to={paths.auth.login}
              className="font-semibold text-indigo-600 hover:text-indigo-500 hover:underline"
            >
              Back to Sign In
            </Link>
          </div>
        </Card>
      </div>
    </div>
  );
};
