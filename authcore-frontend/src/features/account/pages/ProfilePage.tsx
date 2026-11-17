import { Camera, Trash2, User as UserIcon } from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';

import { PageContainer, PageHeader } from '@/components/page';
import { Alert, Button, Card, Input } from '@/components/ui';
import { accountApi } from '@/features/account/api/account.api';
import { useAuth } from '@/features/auth';
import { ApiError } from '@/lib/api';

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
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    let isActive = true;
    const load = async () => {
      try {
        const data = await accountApi.getProfile();
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
      setError(err instanceof ApiError ? err.message : 'Failed to update profile');
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
      await accountApi.uploadAvatar(file);
      setSuccess('Profile picture updated successfully');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to upload profile picture');
    } finally {
      setIsAvatarLoading(false);
    }
  };

  const handleDeleteAvatar = async () => {
    setError(null);
    setSuccess(null);
    setIsAvatarLoading(true);

    try {
      await accountApi.deleteAvatar();
      setSuccess('Profile picture removed');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to delete profile picture');
    } finally {
      setIsAvatarLoading(false);
    }
  };

  return (
    <PageContainer width="narrow">
      <PageHeader title="Profile" description="Your name, photo and contact details." />

      {error && <Alert variant="danger" message={error} onClose={() => setError(null)} />}
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
              required
              value={formData.firstName}
              onChange={(e) => setFormData((prev) => ({ ...prev, firstName: e.target.value }))}
            />
            <Input
              label="Last name"
              value={formData.lastName}
              onChange={(e) => setFormData((prev) => ({ ...prev, lastName: e.target.value }))}
            />
          </div>

          <Input
            label="Username"
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
