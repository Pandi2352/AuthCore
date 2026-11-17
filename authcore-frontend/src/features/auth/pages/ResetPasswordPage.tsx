import { Lock } from 'lucide-react';
import React, { useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';

import { PasswordRequirements } from '@/components/auth/PasswordRequirements';
import { Alert } from '@/components/common/Alert';
import { Button } from '@/components/common/Button';
import { Card } from '@/components/common/Card';
import { Input } from '@/components/common/Input';
import { paths } from '@/config';
import { ApiError } from '@/lib/api-client';
import { authService } from '@/services/auth.service';

export const ResetPassword: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  const tokenParam = searchParams.get('token') || '';
  const emailState = (location.state as { email?: string; message?: string })?.email || '';

  const [email, setEmail] = useState(emailState);
  const [code, setCode] = useState('');
  const [resetToken, setResetToken] = useState(tokenParam);
  const [isTokenVerified, setIsTokenVerified] = useState(!!tokenParam);

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(
    (location.state as { message?: string })?.message || null,
  );

  // Step 1: Verify Code or Token
  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const res = await authService.verifyResetToken({
        email: email.trim().toLowerCase(),
        code: code.trim(),
      });
      setResetToken(res.resetToken);
      setIsTokenVerified(true);
      setSuccessMessage('Code verified. You can now choose a new password.');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Invalid or expired reset code.');
    } finally {
      setIsLoading(false);
    }
  };

  // Step 2: Set New Password
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    setError(null);
    setIsLoading(true);

    try {
      await authService.resetPassword({
        resetToken,
        newPassword,
        confirmPassword,
      });
      navigate(paths.auth.login, {
        state: {
          message:
            'Your password has been successfully reset. Please sign in with your new password.',
        },
      });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to update password.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col justify-center bg-background py-12 sm:px-6 lg:px-8">
      <div className="text-center sm:mx-auto sm:w-full sm:max-w-md">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-md bg-primary-soft text-primary">
          <Lock className="h-6 w-6" />
        </div>
        <h2 className="mt-4 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          Set new password
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {isTokenVerified
            ? 'Enter your new strong password'
            : 'Enter the verification code sent to your email'}
        </p>
      </div>

      <div className="mt-8 px-4 sm:mx-auto sm:w-full sm:max-w-md sm:px-0">
        <Card className="border-border">
          {error && <Alert type="error" message={error} className="mb-4" />}
          {successMessage && <Alert type="info" message={successMessage} className="mb-4" />}

          {!isTokenVerified ? (
            <form onSubmit={handleVerifyCode} className="space-y-4">
              <Input
                label="Email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="jane.doe@example.com"
              />

              <Input
                label="Reset Code"
                type="text"
                required
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="6-digit code"
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
            </form>
          ) : (
            <form onSubmit={handleResetPassword} className="space-y-4">
              <Input
                label="New Password"
                type="password"
                required
                placeholder="••••••••"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />

              <Input
                label="Confirm New Password"
                type="password"
                required
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />

              <PasswordRequirements password={newPassword} />

              <Button
                type="submit"
                variant="primary"
                className="mt-2 w-full py-2.5"
                isLoading={isLoading}
              >
                Update Password
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
