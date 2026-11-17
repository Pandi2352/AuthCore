import { KeyRound } from 'lucide-react';
import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { Alert, Button, Card, Input } from '@/components/ui';
import { paths } from '@/config';
import { authApi } from '@/features/auth/api/auth.api';
import { ApiError } from '@/lib/api';

export const ForgotPasswordPage: React.FC = () => {
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
      await authApi.forgotPassword({ email: email.trim().toLowerCase() });
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
    <div className="w-full">
      <div className="text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-md bg-primary-soft text-primary">
          <KeyRound className="h-6 w-6" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          Reset your password
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Enter your registered email address and we'll send you recovery instructions
        </p>
      </div>

      <div className="mt-8">
        <Card>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && <Alert variant="danger" message={error} onClose={() => setError(null)} />}

            <Input
              label="Email"
              type="email"
              required
              autoComplete="email"
              placeholder="jane.doe@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />

            <Button type="submit" variant="solid" className="w-full py-2.5" isLoading={isLoading}>
              Send Reset Code
            </Button>
          </form>

          <div className="mt-6 border-t border-border pt-5 text-center text-sm text-muted-foreground">
            Remember your password?{' '}
            <Link
              to={paths.auth.login}
              className="font-semibold text-primary hover:text-primary hover:underline"
            >
              Back to Sign In
            </Link>
          </div>
        </Card>
      </div>
    </div>
  );
};
