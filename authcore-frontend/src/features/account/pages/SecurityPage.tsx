import { KeyRound, ShieldAlert, Trash2 } from 'lucide-react';
import React, { useState } from 'react';
import { useLocation } from 'react-router-dom';

import { Alert, Button, Card, Input } from '@/components/ui';
import { paths } from '@/config';
import { accountApi } from '@/features/account/api/account.api';
import { authApi, PasswordRequirements } from '@/features/auth';
import { ApiError } from '@/lib/api';

export const SecurityPage: React.FC = () => {
  const location = useLocation();
  const initialAlert = (location.state as { message?: string })?.message || null;

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Deactivate
  const [deactivatePassword, setDeactivatePassword] = useState('');
  const [deactivateReason, setDeactivateReason] = useState('');
  const [isDeactivating, setIsDeactivating] = useState(false);

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setError('New passwords do not match');
      return;
    }
    setError(null);
    setSuccess(null);
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
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to update password.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeactivate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deactivatePassword) return;
    setError(null);
    setIsDeactivating(true);

    try {
      await accountApi.deactivateAccount({
        currentPassword: deactivatePassword,
        reason: deactivateReason || undefined,
      });
      window.location.href = paths.auth.login;
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Account deactivation failed.');
    } finally {
      setIsDeactivating(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Security & Credentials</h1>
        <p className="text-sm text-muted-foreground">
          Manage your password, authentication policies, and account status
        </p>
      </div>

      {initialAlert && <Alert variant="warning" message={initialAlert} className="mb-4" />}
      {error && <Alert variant="danger" message={error} onClose={() => setError(null)} />}
      {success && <Alert variant="success" message={success} onClose={() => setSuccess(null)} />}

      {/* Change Password Card */}
      <Card title="Change Password">
        <form onSubmit={handlePasswordChange} className="space-y-4">
          <Input
            label="Current Password"
            type="password"
            required
            autoComplete="current-password"
            placeholder="••••••••"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
          />

          <Input
            label="New Password"
            type="password"
            required
            autoComplete="new-password"
            placeholder="••••••••"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
          />

          <Input
            label="Confirm New Password"
            type="password"
            required
            autoComplete="new-password"
            placeholder="••••••••"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
          />

          <PasswordRequirements password={newPassword} />

          <div className="flex justify-end pt-2">
            <Button type="submit" variant="solid" isLoading={isLoading}>
              <KeyRound className="mr-2 h-4 w-4" />
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

          <form onSubmit={handleDeactivate} className="space-y-3 pt-2">
            <Input
              label="Confirm Current Password"
              type="password"
              required
              placeholder="••••••••"
              value={deactivatePassword}
              onChange={(e) => setDeactivatePassword(e.target.value)}
            />
            <Input
              label="Reason (optional)"
              placeholder="e.g. Taking a break"
              value={deactivateReason}
              onChange={(e) => setDeactivateReason(e.target.value)}
            />
            <div className="flex justify-end">
              <Button type="submit" variant="destructive" size="sm" isLoading={isDeactivating}>
                <Trash2 className="mr-1.5 h-4 w-4" />
                Deactivate Account
              </Button>
            </div>
          </form>
        </div>
      </Card>
    </div>
  );
};
