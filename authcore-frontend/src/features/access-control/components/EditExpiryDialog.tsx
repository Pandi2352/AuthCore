import { useState, type FormEvent } from 'react';

import { notifyError, notifySuccess } from '@/components/feedback';
import {
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
} from '@/components/ui';

import { accessMappingsApi } from '../api/access-mappings.api';
import type { AccessMapping } from '../types/access-control.types';

function toLocalIso(dateStr: string | null): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

export function EditExpiryDialog({
  open,
  mapping,
  onOpenChange,
  onSaved,
}: {
  open: boolean;
  mapping: AccessMapping | null;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        {mapping ? (
          <EditExpiryForm
            key={mapping.id}
            mapping={mapping}
            onClose={() => onOpenChange(false)}
            onSaved={onSaved}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function EditExpiryForm({
  mapping,
  onClose,
  onSaved,
}: {
  mapping: AccessMapping;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [expiresAt, setExpiresAt] = useState(() => toLocalIso(mapping.expiresAt));
  const [isSaving, setIsSaving] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const expDate = expiresAt ? new Date(expiresAt).toISOString() : null;
      await accessMappingsApi.setExpiry(mapping.id, expDate);
      notifySuccess('Assignment expiry updated');
      onSaved();
      onClose();
    } catch (err) {
      notifyError(err, 'Failed to update expiry date');
    } finally {
      setIsSaving(false);
    }
  };

  const handleClear = async () => {
    setIsSaving(true);
    try {
      await accessMappingsApi.setExpiry(mapping.id, null);
      notifySuccess('Assignment is now permanent (no expiration)');
      onSaved();
      onClose();
    } catch (err) {
      notifyError(err, 'Failed to clear expiry date');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <DialogHeader>
        <DialogTitle>Edit Assignment Expiry</DialogTitle>
      </DialogHeader>

      <DialogBody className="space-y-4 py-4">
        <p className="text-sm text-muted-foreground">
          Adjust the expiration schedule for this access assignment.
        </p>

        <div className="space-y-1">
          <label htmlFor="edit-expiry-input" className="text-xs font-medium text-foreground">
            Expiration date and time
          </label>
          <Input
            id="edit-expiry-input"
            type="datetime-local"
            value={expiresAt}
            onChange={(e) => setExpiresAt(e.target.value)}
          />
        </div>
      </DialogBody>

      <DialogFooter className="flex items-center justify-between sm:justify-between">
        {mapping.expiresAt ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-muted-foreground hover:text-foreground"
            onClick={() => void handleClear()}
            disabled={isSaving}
          >
            Make permanent
          </Button>
        ) : (
          <div />
        )}

        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button type="submit" size="sm" isLoading={isSaving}>
            Save expiry
          </Button>
        </div>
      </DialogFooter>
    </form>
  );
}
