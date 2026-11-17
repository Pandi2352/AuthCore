import { KeyRound, ShieldAlert, Trash2 } from 'lucide-react';
import React, { useState } from 'react';
import { useLocation } from 'react-router-dom';

import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { ErrorAlert, notifyError } from '@/components/feedback';
import { PageContainer, PageHeader } from '@/components/page';
import { Alert, Button, Card, Input } from '@/components/ui';
import { paths } from '@/config';
import { accountApi } from '@/features/account/api/account.api';
import {
  authApi,
  meetsPasswordRequirements,
  PASSWORD_REQUIREMENTS_MESSAGE,
  PasswordRequirements,
} from '@/features/auth';
import { useApiError } from '@/hooks/useApiError';
import { useFormValidation } from '@/hooks/useFormValidation';
import {
  custom,
  matches,
  maxLength,
  passwordRules,
  required,
  type FormRules,
} from '@/lib/validation';

interface ChangePasswordValues {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

const changePasswordRules: FormRules<ChangePasswordValues> = {
  currentPassword: passwordRules('Enter your current password'),
  newPassword: [
    ...passwordRules('Choose a new password'),
    custom((value) => meetsPasswordRequirements(String(value)), PASSWORD_REQUIREMENTS_MESSAGE),
    custom(
      (value, values) => value !== values.currentPassword,
      'Choose a password different from the current one',
    ),
  ],
  confirmPassword: [
    required('Confirm the new password'),
    matches('newPassword', 'Passwords do not match'),
  ],
};

const deactivateRules: FormRules<{ deactivatePassword: string; deactivateReason: string }> = {
  deactivatePassword: passwordRules('Enter your current password to confirm'),
  deactivateReason: [maxLength(500)],
};

export const SecurityPage: React.FC = () => {
  const location = useLocation();
  const initialAlert = (location.state as { message?: string })?.message || null;

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [isLoading, setIsLoading] = useState(false);
  const { error, fallback: errorFallback, setError, fieldError } = useApiError();
  const [success, setSuccess] = useState<string | null>(null);

  // Deactivate
  const [deactivatePassword, setDeactivatePassword] = useState('');
  const [deactivateReason, setDeactivateReason] = useState('');
  const [isDeactivating, setIsDeactivating] = useState(false);

  const changeForm = useFormValidation(
    { currentPassword, newPassword, confirmPassword },
    changePasswordRules,
  );
  const deactivateForm = useFormValidation(
    { deactivatePassword, deactivateReason },
    deactivateRules,
  );

  const handlePasswordChange = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    if (!changeForm.validate(e.currentTarget)) return;
    setIsLoading(true);

    try {
      const res = await authApi.changePassword({
        currentPassword,
        newPassword,
        confirmPassword,
      });
      setSuccess(
        `Password changed successfully. ${res.revokedSessionCount} other device(s) have been signed out.`,
      );
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      changeForm.reset();
    } catch (err) {
      setError(err, 'Failed to update password.');
    } finally {
      setIsLoading(false);
    }
  };

  const [confirmDeactivate, setConfirmDeactivate] = useState(false);

  const handleDeactivateSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (deactivateForm.validate(e.currentTarget)) setConfirmDeactivate(true);
  };

  const handleDeactivate = async () => {
    setError(null);
    setIsDeactivating(true);

    try {
      await accountApi.deactivateAccount({
        currentPassword: deactivatePassword,
        reason: deactivateReason || undefined,
      });
      window.location.href = paths.auth.login;
    } catch (err) {
      notifyError(err, 'Account deactivation failed.');
    } finally {
      setIsDeactivating(false);
    }
  };

  return (
    <PageContainer width="narrow">
      <PageHeader title="Security" description="Manage your password and account status." />

      {initialAlert && <Alert variant="warning" message={initialAlert} className="mb-4" />}
      <ErrorAlert
        error={error}
        fallback={errorFallback}
        fields={['currentPassword', 'newPassword', 'confirmPassword']}
        onClose={() => setError(null)}
      />
      {success && <Alert variant="success" message={success} onClose={() => setSuccess(null)} />}

      {/* Change Password Card */}
      <Card title="Change Password">
        <form noValidate onSubmit={handlePasswordChange} className="space-y-4">
          <Input
            label="Current Password"
            error={changeForm.error('currentPassword') ?? fieldError('currentPassword')}
            type="password"
            required
            autoComplete="current-password"
            placeholder="Enter your current password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
          />

          <Input
            label="New Password"
            error={changeForm.error('newPassword') ?? fieldError('newPassword')}
            type="password"
            required
            autoComplete="new-password"
            placeholder="Create a new password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
          />

          <Input
            label="Confirm New Password"
            error={changeForm.error('confirmPassword') ?? fieldError('confirmPassword')}
            type="password"
            required
            autoComplete="new-password"
            placeholder="Re-enter the new password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
          />

          <PasswordRequirements password={newPassword} />

          <div className="flex justify-end pt-2">
            <Button type="submit" variant="solid" leftIcon={<KeyRound />} isLoading={isLoading}>
              Update Password
            </Button>
          </div>
        </form>
      </Card>

      {/* Danger Zone */}
      <Card title="Danger Zone" className="border-danger/25 bg-danger-soft/40">
        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-danger" />
            <div>
              <h4 className="text-sm font-semibold text-danger-soft-foreground">
                Deactivate your account
              </h4>
              <p className="mt-0.5 text-xs text-danger">
                Deactivating your account will instantly sign you out from all devices. You can
                recover your account anytime using the account recovery page.
              </p>
            </div>
          </div>

          <form noValidate onSubmit={handleDeactivateSubmit} className="space-y-3 pt-2">
            <Input
              label="Confirm Current Password"
              error={deactivateForm.error('deactivatePassword')}
              autoComplete="current-password"
              type="password"
              required
              placeholder="Enter your current password"
              value={deactivatePassword}
              onChange={(e) => setDeactivatePassword(e.target.value)}
            />
            <Input
              label="Reason (optional)"
              error={deactivateForm.error('deactivateReason')}
              placeholder="Tell us why you are leaving"
              value={deactivateReason}
              onChange={(e) => setDeactivateReason(e.target.value)}
            />
            <div className="flex justify-end">
              <Button
                type="submit"
                variant="destructive"
                size="sm"
                leftIcon={<Trash2 />}
                isLoading={isDeactivating}
              >
                Deactivate Account
              </Button>
            </div>
          </form>
        </div>
      </Card>

      <ConfirmDialog
        open={confirmDeactivate}
        onOpenChange={setConfirmDeactivate}
        title="Deactivate your account?"
        description="You will be signed out on every device. You can reopen the account later from the account recovery page."
        confirmText="Deactivate"
        confirmPhrase="DEACTIVATE"
        destructive
        onConfirm={handleDeactivate}
      />
    </PageContainer>
  );
};
