import { Download, KeyRound, MailCheck, Send, ShieldAlert } from 'lucide-react';
import { useState, type FormEvent } from 'react';

import { notifyError, notifySuccess } from '@/components/feedback';
import {
  Alert,
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  Input,
} from '@/components/ui';
import { paths } from '@/config';
import {
  authApi,
  meetsPasswordRequirements,
  PASSWORD_REQUIREMENTS_MESSAGE,
  PasswordRequirements,
  useAuth,
} from '@/features/auth';
import { getFieldErrors } from '@/lib/api';

import { accountApi } from '../api/account.api';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// ---------------------------------------------------------------- password

/** Security → Change password (also opened automatically when a new password is required). */
export function ChangePasswordDialog({
  open,
  onOpenChange,
  reason,
}: DialogProps & { reason?: string | null }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title="Change password"
        description="Other devices are signed out after the change."
        size="md"
      >
        {open && <PasswordForm reason={reason} onClose={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  );
}

function PasswordForm({ reason, onClose }: { reason?: string | null; onClose: () => void }) {
  const { user, updateUser, refreshEffectiveAccess } = useAuth();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [hasTried, setHasTried] = useState(false);
  const [serverErrors, setServerErrors] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);

  const errors: Record<string, string> = {};
  if (!current) errors.currentPassword = 'Enter your current password';
  if (!next) errors.newPassword = 'Choose a new password';
  else if (!meetsPasswordRequirements(next)) errors.newPassword = PASSWORD_REQUIREMENTS_MESSAGE;
  else if (next === current)
    errors.newPassword = 'Choose a password different from the current one';
  if (!confirm) errors.confirmPassword = 'Confirm the new password';
  else if (confirm !== next) errors.confirmPassword = 'Passwords do not match';
  const shown = { ...(hasTried ? errors : {}), ...serverErrors };

  const save = async (event: FormEvent) => {
    event.preventDefault();
    setHasTried(true);
    if (Object.keys(errors).length > 0 || isSaving) return;
    setIsSaving(true);
    try {
      const res = await authApi.changePassword({
        currentPassword: current,
        newPassword: next,
        confirmPassword: confirm,
      });
      notifySuccess('Password changed', {
        description: `${res.revokedSessionCount} other device(s) were signed out.`,
      });
      // The server cleared the requirement: unlock the other pages and load the user's access.
      if (user?.mustChangePassword) {
        updateUser({ mustChangePassword: false });
        void refreshEffectiveAccess();
      }
      updateUser({ passwordChangedAt: new Date().toISOString() });
      onClose();
    } catch (err) {
      setServerErrors(getFieldErrors(err));
      notifyError(err, 'Could not change the password');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form
      noValidate
      onSubmit={(e) => void save(e)}
      // A column, so the body scrolls inside the popup and the buttons stay visible.
      className="flex min-h-0 flex-1 flex-col"
    >
      <DialogBody className="space-y-4 py-4">
        {reason && <Alert variant="warning" message={reason} />}
        <Input
          label="Current password"
          type="password"
          required
          autoComplete="current-password"
          value={current}
          placeholder="Enter your current password"
          error={shown.currentPassword}
          onChange={(e) => setCurrent(e.target.value)}
        />
        <Input
          label="New password"
          type="password"
          required
          autoComplete="new-password"
          value={next}
          placeholder="Create a new password"
          error={shown.newPassword}
          onChange={(e) => setNext(e.target.value)}
        />
        <Input
          label="Confirm new password"
          type="password"
          required
          autoComplete="new-password"
          value={confirm}
          placeholder="Re-enter the new password"
          error={shown.confirmPassword}
          onChange={(e) => setConfirm(e.target.value)}
        />
        <PasswordRequirements password={next} />
      </DialogBody>
      <DialogFooter>
        <Button type="button" variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" leftIcon={<KeyRound />} isLoading={isSaving}>
          Update password
        </Button>
      </DialogFooter>
    </form>
  );
}

// ---------------------------------------------------------------- email

/** Contact → Change email: new address + password, then the code sent to it. */
export function ChangeEmailDialog({ open, onOpenChange }: DialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title="Change email address"
        description="We send a code to the new address; the change applies once you enter it."
        size="md"
      >
        {open && <EmailForm onClose={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  );
}

function EmailForm({ onClose }: { onClose: () => void }) {
  const { updateUser } = useAuth();
  const [step, setStep] = useState<'request' | 'confirm'>('request');
  const [newEmail, setNewEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [hasTried, setHasTried] = useState(false);
  const [serverErrors, setServerErrors] = useState<Record<string, string>>({});
  const [isBusy, setIsBusy] = useState(false);

  const errors: Record<string, string> = {};
  if (step === 'request') {
    if (!EMAIL_PATTERN.test(newEmail.trim())) errors.newEmail = 'Enter a valid email address';
    if (!password) errors.currentPassword = 'Enter your current password';
  } else if (!code.trim()) {
    errors.code = 'Enter the code from the email';
  }
  const shown = { ...(hasTried ? errors : {}), ...serverErrors };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setHasTried(true);
    if (Object.keys(errors).length > 0 || isBusy) return;
    setIsBusy(true);
    setServerErrors({});
    try {
      if (step === 'request') {
        await accountApi.requestEmailChange({
          newEmail: newEmail.trim(),
          currentPassword: password,
        });
        notifySuccess(`Code sent to ${newEmail.trim()}`);
        setStep('confirm');
        setHasTried(false);
      } else {
        const user = await accountApi.confirmEmailChange({ code: code.trim() });
        updateUser(user);
        notifySuccess('Email address changed');
        onClose();
      }
    } catch (err) {
      setServerErrors(getFieldErrors(err));
      notifyError(
        err,
        step === 'request' ? 'Could not send the code' : 'Could not change the email',
      );
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <form
      noValidate
      onSubmit={(e) => void submit(e)}
      // A column, so the body scrolls inside the popup and the buttons stay visible.
      className="flex min-h-0 flex-1 flex-col"
    >
      <DialogBody className="space-y-4 py-4">
        {step === 'request' ? (
          <>
            <Input
              label="New email address"
              type="email"
              required
              autoComplete="email"
              value={newEmail}
              placeholder="Enter the new email address"
              error={shown.newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
            />
            <Input
              label="Current password"
              type="password"
              required
              autoComplete="current-password"
              value={password}
              placeholder="Enter your current password"
              error={shown.currentPassword}
              onChange={(e) => setPassword(e.target.value)}
            />
          </>
        ) : (
          <>
            <Alert variant="info" message={`We emailed a code to ${newEmail.trim()}.`} />
            <Input
              label="Code"
              required
              autoComplete="one-time-code"
              value={code}
              placeholder="Enter the code from the email"
              error={shown.code}
              className="font-mono"
              onChange={(e) => setCode(e.target.value)}
            />
          </>
        )}
      </DialogBody>
      <DialogFooter>
        <Button type="button" variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button
          type="submit"
          leftIcon={step === 'request' ? <Send /> : <MailCheck />}
          isLoading={isBusy}
        >
          {step === 'request' ? 'Send code' : 'Confirm'}
        </Button>
      </DialogFooter>
    </form>
  );
}

// ---------------------------------------------------------------- password-confirmed actions

/** Download my data / deactivate my account: both ask for the current password. */
export function AccountActionDialog({
  open,
  onOpenChange,
  action,
}: DialogProps & { action: 'export' | 'deactivate' }) {
  const isDeactivate = action === 'deactivate';
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title={isDeactivate ? 'Deactivate your account?' : 'Download my data'}
        description={
          isDeactivate
            ? 'You are signed out on every device. You can reopen the account later from the account recovery page.'
            : 'A JSON file with your profile, preferences and activity.'
        }
        size="md"
      >
        {open && <ActionForm action={action} onClose={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  );
}

function ActionForm({ action, onClose }: { action: 'export' | 'deactivate'; onClose: () => void }) {
  const isDeactivate = action === 'deactivate';
  const [password, setPassword] = useState('');
  const [reason, setReason] = useState('');
  const [phrase, setPhrase] = useState('');
  const [hasTried, setHasTried] = useState(false);
  const [isBusy, setIsBusy] = useState(false);

  const errors: Record<string, string> = {};
  if (!password) errors.password = 'Enter your current password to confirm';
  if (isDeactivate && phrase !== 'DEACTIVATE') errors.phrase = 'Type DEACTIVATE to confirm';
  const shown = hasTried ? errors : {};

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setHasTried(true);
    if (Object.keys(errors).length > 0 || isBusy) return;
    setIsBusy(true);
    try {
      if (isDeactivate) {
        await accountApi.deactivateAccount({
          currentPassword: password,
          reason: reason.trim() || undefined,
        });
        window.location.href = paths.auth.login;
        return;
      }
      await accountApi.exportData(password);
      notifySuccess('Your data was downloaded');
      onClose();
    } catch (err) {
      notifyError(
        err,
        isDeactivate ? 'Could not deactivate the account' : 'Could not download your data',
      );
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <form
      noValidate
      onSubmit={(e) => void submit(e)}
      // A column, so the body scrolls inside the popup and the buttons stay visible.
      className="flex min-h-0 flex-1 flex-col"
    >
      <DialogBody className="space-y-4 py-4">
        {isDeactivate && (
          <Alert
            variant="danger"
            icon={<ShieldAlert />}
            message="Deactivating signs you out everywhere right away."
          />
        )}
        <Input
          label="Current password"
          type="password"
          required
          autoComplete="current-password"
          value={password}
          placeholder="Enter your current password"
          error={shown.password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {isDeactivate && (
          <>
            <Input
              label="Reason (optional)"
              maxLength={500}
              value={reason}
              placeholder="Tell us why you are leaving (optional)"
              onChange={(e) => setReason(e.target.value)}
            />
            <Input
              label="Type DEACTIVATE to confirm"
              required
              value={phrase}
              placeholder="Type DEACTIVATE"
              error={shown.phrase}
              className="font-mono"
              onChange={(e) => setPhrase(e.target.value)}
            />
          </>
        )}
      </DialogBody>
      <DialogFooter>
        <Button type="button" variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button
          type="submit"
          variant={isDeactivate ? 'destructive' : 'solid'}
          leftIcon={isDeactivate ? <ShieldAlert /> : <Download />}
          isLoading={isBusy}
        >
          {isDeactivate ? 'Deactivate account' : 'Download'}
        </Button>
      </DialogFooter>
    </form>
  );
}
