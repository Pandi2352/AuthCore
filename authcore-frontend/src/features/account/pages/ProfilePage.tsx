import { Camera, Trash2, User as UserIcon } from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';

import { ErrorAlert, notifyError, notifySuccess } from '@/components/feedback';
import { PageContainer, PageHeader } from '@/components/page';
import { Alert, Button, Card, Input, Progress } from '@/components/ui';
import { accountApi } from '@/features/account/api/account.api';
import { useAuth } from '@/features/auth';
import { useApiError } from '@/hooks/useApiError';

export const ProfilePage: React.FC = () => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const { user, updateUser } = useAuth();

  const [formData, setFormData] = useState({
    firstName: user?.firstName || '',
    lastName: user?.lastName || '',
    username: user?.username || '',
  });

  const [isLoading, setIsLoading] = useState(false);
  const [isAvatarLoading, setIsAvatarLoading] = useState(false);
  const [uploadPercent, setUploadPercent] = useState<number | null>(null);
  const { error, fallback: errorFallback, setError, fieldError } = useApiError();
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    let isActive = true;
    const controller = new AbortController();
    const load = async () => {
      try {
        const data = await accountApi.getProfile(controller.signal);
        if (isActive) {
          setFormData({
            firstName: data.firstName || '',
            lastName: data.lastName || '',
            username: data.username || '',
          });
        }
      } catch {
        // The form stays empty; the user can still type and save.
      }
    };
    void load();
    return () => {
      isActive = false;
      controller.abort();
    };
  }, []);

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setIsLoading(true);

    try {
      const updated = await accountApi.updateProfile({
        firstName: formData.firstName.trim(),
        lastName: formData.lastName.trim() || null,
        username: formData.username.trim() || null,
      });
      updateUser(updated);
      setSuccess('Profile updated successfully');
    } catch (err) {
      setError(err, 'Failed to update profile');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    setSuccess(null);
    setIsAvatarLoading(true);

    try {
      setUploadPercent(0);
      await accountApi.uploadAvatar(file, { onProgress: (p) => setUploadPercent(p.percent) });
      notifySuccess('Profile picture updated');
    } catch (err) {
      notifyError(err, 'Failed to upload profile picture');
    } finally {
      setIsAvatarLoading(false);
      setUploadPercent(null);
      e.target.value = '';
    }
  };

  const handleDeleteAvatar = async () => {
    setError(null);
    setSuccess(null);
    setIsAvatarLoading(true);

    try {
      await accountApi.deleteAvatar();
      notifySuccess('Profile picture removed');
    } catch (err) {
      notifyError(err, 'Failed to delete profile picture');
    } finally {
      setIsAvatarLoading(false);
    }
  };

  return (
    <PageContainer width="narrow">
      <PageHeader title="Profile" description="Your name, photo and contact details." />

      <ErrorAlert
        error={error}
        fallback={errorFallback}
        fields={['firstName', 'lastName', 'username']}
        onClose={() => setError(null)}
      />
      {success && <Alert variant="success" message={success} onClose={() => setSuccess(null)} />}

      {/* Avatar Card */}
      <Card title="Profile Picture">
        <div className="flex flex-col items-center gap-6 sm:flex-row">
          <div className="relative flex h-24 w-24 items-center justify-center overflow-hidden rounded-full border-2 border-primary/25 bg-muted text-muted-foreground">
            <UserIcon className="h-12 w-12" />
          </div>

          <div className="space-y-2 text-center sm:text-left">
            <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="sr-only"
                tabIndex={-1}
                aria-hidden="true"
                onChange={handleAvatarChange}
                disabled={isAvatarLoading}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                isLoading={isAvatarLoading}
                onClick={() => fileInputRef.current?.click()}
              >
                <Camera className="mr-1.5 h-4 w-4" />
                Upload new picture
              </Button>

              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleDeleteAvatar}
                disabled={isAvatarLoading}
              >
                <Trash2 className="mr-1.5 h-4 w-4 text-danger" />
                Remove
              </Button>
            </div>
            {uploadPercent !== null && (
              <Progress
                value={uploadPercent}
                label="Uploading profile picture"
                showValue
                size="sm"
                className="max-w-xs"
              />
            )}
            <p className="text-xs text-muted-foreground">
              JPEG, PNG or WebP, up to 2MB. Square crop recommended.
            </p>
          </div>
        </div>
      </Card>

      {/* Basic Details Form */}
      <Card title="Personal Information">
        <form onSubmit={handleProfileSubmit} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              label="First name"
              error={fieldError('firstName')}
              required
              value={formData.firstName}
              onChange={(e) => setFormData((prev) => ({ ...prev, firstName: e.target.value }))}
            />
            <Input
              label="Last name"
              error={fieldError('lastName')}
              value={formData.lastName}
              onChange={(e) => setFormData((prev) => ({ ...prev, lastName: e.target.value }))}
            />
          </div>

          <Input
            label="Username"
            error={fieldError('username')}
            value={formData.username}
            onChange={(e) => setFormData((prev) => ({ ...prev, username: e.target.value }))}
            hint="Lowercase letters, numbers, and dashes or dots"
          />

          <Input
            label="Email address"
            type="email"
            disabled
            value={user?.email || ''}
            hint="To change your email address, request an email change workflow"
          />

          <div className="flex justify-end pt-2">
            <Button type="submit" variant="solid" isLoading={isLoading}>
              Save Changes
            </Button>
          </div>
        </form>
      </Card>
    </PageContainer>
  );
};
