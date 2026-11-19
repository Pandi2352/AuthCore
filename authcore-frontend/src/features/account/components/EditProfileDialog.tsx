import { Save } from 'lucide-react';
import { useState, type FormEvent } from 'react';

import {
  AttributeFields,
  fromApiValues,
  toAttributesPatch,
  validateAttributes,
  type AttributeValues,
} from '@/components/attributes';
import { notifyError, notifySuccess } from '@/components/feedback';
import { Button, Dialog, DialogBody, DialogContent, DialogFooter, Input } from '@/components/ui';
import { useAuth, type UserProfileDetails } from '@/features/auth';
import { getFieldErrors } from '@/lib/api';

import { accountApi } from '../api/account.api';
import type { ProfileFormAttribute } from '../types/account.types';
import { editableAttributes } from './profile-completion';

const NAME_PATTERN = /^[\p{L}\p{M}][\p{L}\p{M}' .-]*$/u;
const USERNAME_PATTERN = /^[a-z0-9](?:[a-z0-9._-]{1,28}[a-z0-9])?$/;

/** Profile → Edit: name, username and the profile fields, in a centered popup. */
export function EditProfileDialog({
  open,
  profile,
  form,
  onOpenChange,
  onSaved,
}: {
  open: boolean;
  profile: UserProfileDetails;
  form: ProfileFormAttribute[];
  onOpenChange: (open: boolean) => void;
  onSaved: (profile: UserProfileDetails) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title="Edit profile"
        description="Your name, username and personal details. Your email and password are changed separately."
        size="xl"
      >
        {open && (
          <EditForm
            profile={profile}
            form={form}
            onClose={() => onOpenChange(false)}
            onSaved={onSaved}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function EditForm({
  profile,
  form,
  onClose,
  onSaved,
}: {
  profile: UserProfileDetails;
  form: ProfileFormAttribute[];
  onClose: () => void;
  onSaved: (profile: UserProfileDetails) => void;
}) {
  const { updateUser } = useAuth();
  const attributes = editableAttributes(form);
  const [firstName, setFirstName] = useState(profile.firstName);
  const [lastName, setLastName] = useState(profile.lastName ?? '');
  const [username, setUsername] = useState(profile.username ?? '');
  const [initialValues] = useState<AttributeValues>(() =>
    fromApiValues(attributes, profile.attributes ?? {}),
  );
  const [values, setValues] = useState<AttributeValues>(initialValues);
  const [hasTried, setHasTried] = useState(false);
  const [serverErrors, setServerErrors] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);

  const errors: Record<string, string> = {
    ...validateAttributes(attributes, values),
  };
  if (!firstName.trim()) errors.firstName = 'Enter your first name';
  else if (!NAME_PATTERN.test(firstName.trim())) errors.firstName = 'Use letters only';
  if (lastName.trim() && !NAME_PATTERN.test(lastName.trim())) errors.lastName = 'Use letters only';
  if (username.trim() && !USERNAME_PATTERN.test(username.trim()))
    errors.username = '3–30 lowercase letters or numbers; . _ - only in the middle';
  const shown = { ...(hasTried ? errors : {}), ...serverErrors };

  const save = async (event: FormEvent) => {
    event.preventDefault();
    setHasTried(true);
    if (Object.keys(errors).length > 0 || isSaving) return;
    setIsSaving(true);
    try {
      const core = {
        firstName: firstName.trim(),
        lastName: lastName.trim() || null,
        username: username.trim() || null,
      };
      const coreChanged =
        core.firstName !== profile.firstName ||
        core.lastName !== (profile.lastName ?? null) ||
        core.username !== (profile.username ?? null);
      let next: UserProfileDetails = profile;
      if (coreChanged) {
        const user = await accountApi.updateProfile(core);
        updateUser(user);
        next = { ...next, ...user };
      }
      const patch = toAttributesPatch(attributes, values, initialValues);
      if (patch) next = await accountApi.updateAttributes(patch);
      if (!coreChanged && !patch) {
        onClose();
        return;
      }
      notifySuccess('Profile saved');
      onSaved(next);
      onClose();
    } catch (err) {
      setServerErrors(getFieldErrors(err));
      notifyError(err, 'Could not save your profile');
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
      <DialogBody className="space-y-6 py-4">
        <section aria-label="Name" className="grid gap-4 sm:grid-cols-3">
          <Input
            label="First name"
            required
            maxLength={50}
            value={firstName}
            placeholder="Enter your first name"
            error={shown.firstName}
            onChange={(e) => setFirstName(e.target.value)}
          />
          <Input
            label="Last name"
            maxLength={50}
            value={lastName}
            placeholder="Enter your last name"
            error={shown.lastName}
            onChange={(e) => setLastName(e.target.value)}
          />
          <Input
            label="Username"
            maxLength={30}
            value={username}
            placeholder="Choose a username"
            hint="You can sign in with it or your email"
            error={shown.username}
            onChange={(e) => setUsername(e.target.value.toLowerCase())}
          />
        </section>
        {attributes.length > 0 && (
          <section aria-label="Personal details" className="border-t border-border pt-5">
            <h3 className="mb-3 text-sm font-semibold text-foreground">Personal details</h3>
            <AttributeFields
              attributes={attributes}
              values={values}
              errors={shown}
              onChange={(next) => {
                setValues(next);
                if (Object.keys(serverErrors).length > 0) setServerErrors({});
              }}
            />
          </section>
        )}
      </DialogBody>
      <DialogFooter>
        <Button type="button" variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" leftIcon={<Save />} isLoading={isSaving}>
          Save changes
        </Button>
      </DialogFooter>
    </form>
  );
}
