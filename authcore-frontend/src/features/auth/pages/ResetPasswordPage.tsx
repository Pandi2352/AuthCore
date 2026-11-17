import { ArrowLeft } from 'lucide-react';
import React, { useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';

import { ErrorAlert } from '@/components/feedback';
import { Alert, Button, Input } from '@/components/ui';
import { paths } from '@/config';
import { authApi } from '@/features/auth/api/auth.api';
import { AuthCard } from '@/features/auth/components/AuthCard';
import {
  meetsPasswordRequirements,
  PASSWORD_REQUIREMENTS_MESSAGE,
} from '@/features/auth/components/password-checks';
import { PasswordRequirements } from '@/features/auth/components/PasswordRequirements';
import { useApiError } from '@/hooks/useApiError';
import { useFormValidation } from '@/hooks/useFormValidation';
import {
  codeRules,
  custom,
  emailRules,
  matches,
  passwordRules,
  required,
  type FormRules,
} from '@/lib/validation';

const codeStepRules: FormRules<{ email: string; code: string }> = {
  email: emailRules(),
  code: codeRules({ min: 6, max: 6 }),
};

const passwordStepRules: FormRules<{ newPassword: string; confirmPassword: string }> = {
  newPassword: [
    ...passwordRules('Choose a new password'),
    custom((value) => meetsPasswordRequirements(String(value)), PASSWORD_REQUIREMENTS_MESSAGE),
  ],
  confirmPassword: [
    required('Confirm the new password'),
    matches('newPassword', 'Passwords do not match'),
  ],
};

export const ResetPasswordPage: React.FC = () => {
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
  const { error, fallback: errorFallback, setError, fieldError } = useApiError();
  const codeStep = useFormValidation({ email, code }, codeStepRules);
  const passwordStep = useFormValidation({ newPassword, confirmPassword }, passwordStepRules);
  const [successMessage, setSuccessMessage] = useState<string | null>(
    (location.state as { message?: string })?.message || null,
  );

  // Step 1: Verify code or Token
  const handleVerifyCode = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    if (!codeStep.validate(e.currentTarget)) return;
    setIsLoading(true);

    try {
      const res = await authApi.verifyResetToken({
        email: email.trim().toLowerCase(),
        code: code.trim(),
      });
      setResetToken(res.resetToken);
      setIsTokenVerified(true);
      setSuccessMessage('Code verified. You can now choose a new password.');
    } catch (err) {
      setError(err, 'Invalid or expired reset code.');
    } finally {
      setIsLoading(false);
    }
  };

  // Step 2: Set New Password
  const handleResetPassword = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    if (!passwordStep.validate(e.currentTarget)) return;
    setIsLoading(true);

    try {
      await authApi.resetPassword({
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
      setError(err, 'Failed to update password.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthCard
      title={isTokenVerified ? 'Set a new password' : 'Check your email'}
      description={
        isTokenVerified
          ? "Almost done — choose a strong password you haven't used before."
          : 'Enter the 6-digit code we sent you to reset your password.'
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
        fields={['email', 'code', 'newPassword', 'confirmPassword']}
        className="mb-4"
      />
      {successMessage && <Alert variant="info" message={successMessage} className="mb-4" />}

      {!isTokenVerified ? (
        <form noValidate onSubmit={handleVerifyCode} className="space-y-4">
          <Input
            label="Email address"
            error={codeStep.error('email') ?? fieldError('email')}
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Enter your registered email"
          />

          <Input
            label="Reset code"
            error={codeStep.error('code') ?? fieldError('code')}
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
            Verify code
          </Button>
        </form>
      ) : (
        <form noValidate onSubmit={handleResetPassword} className="space-y-4">
          <Input
            label="New password"
            error={passwordStep.error('newPassword') ?? fieldError('newPassword')}
            type="password"
            required
            placeholder="Create a new password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
          />

          <Input
            label="Confirm new password"
            error={passwordStep.error('confirmPassword') ?? fieldError('confirmPassword')}
            type="password"
            required
            placeholder="Re-enter the new password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
          />

          <PasswordRequirements password={newPassword} />

          <Button type="submit" fullWidth className="mt-2" isLoading={isLoading}>
            Update password
          </Button>
        </form>
      )}
    </AuthCard>
  );
};
