import { RotateCcw } from 'lucide-react';
import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { Alert } from '@/components/common/Alert';
import { Button } from '@/components/common/Button';
import { Card } from '@/components/common/Card';
import { Input } from '@/components/common/Input';
import { paths } from '@/config';
import { ApiError } from '@/lib/api-client';
import { accountService } from '@/services/account.service';

export const AccountRecovery: React.FC = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState<'request' | 'confirm'>('request');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const handleRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setError(null);
    setIsLoading(true);

    try {
      await accountService.requestRecovery({ email: email.trim().toLowerCase() });
      setMessage(
        'If your account is eligible for self-recovery, a verification code has been dispatched.',
      );
      setStep('confirm');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Recovery request failed.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !code) return;
    setError(null);
    setIsLoading(true);

    try {
      await accountService.confirmRecovery({
        email: email.trim().toLowerCase(),
        code: code.trim(),
      });
      navigate(paths.auth.login, {
        state: {
          message: 'Your account has been reactivated successfully! Please sign in.',
        },
      });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Invalid or expired recovery code.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col justify-center bg-background py-12 sm:px-6 lg:px-8">
      <div className="text-center sm:mx-auto sm:w-full sm:max-w-md">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-md bg-primary-soft text-primary">
          <RotateCcw className="h-6 w-6" />
        </div>
        <h2 className="mt-4 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          Account Recovery
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Restore an account you previously deactivated or marked for deletion
        </p>
      </div>

      <div className="mt-8 px-4 sm:mx-auto sm:w-full sm:max-w-md sm:px-0">
        <Card className="border-border">
          {error && <Alert type="error" message={error} className="mb-4" />}
          {message && <Alert type="info" message={message} className="mb-4" />}

          {step === 'request' ? (
            <form onSubmit={handleRequest} className="space-y-4">
              <Input
                label="Registered Email"
                type="email"
                required
                placeholder="jane.doe@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />

              <Button
                type="submit"
                variant="primary"
                className="w-full py-2.5"
                isLoading={isLoading}
              >
                Send Recovery Code
              </Button>
            </form>
          ) : (
            <form onSubmit={handleConfirm} className="space-y-4">
              <Input
                label="Registered Email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />

              <Input
                label="6-Digit Recovery Code"
                type="text"
                required
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
                Reactivate Account
              </Button>
            </form>
          )}

          <div className="mt-6 border-t border-border pt-5 text-center text-sm text-muted-foreground">
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
