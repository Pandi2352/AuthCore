import { ArrowLeft, CheckCircle2, CircleAlert, ExternalLink, PlugZap } from 'lucide-react';
import { useState, type FormEvent } from 'react';

import { notifyError, notifySuccess } from '@/components/feedback';
import {
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  Input,
  PasswordInput,
  Switch,
} from '@/components/ui';
import { useApiError } from '@/hooks';
import { cn } from '@/lib/utils';

import { storageApi } from '../../api/storage.api';
import type {
  StorageConfig,
  StorageField,
  StorageFormValues,
  StorageProvider,
  StorageTestResult,
} from '../../types/storage.types';
import { ProviderLogo } from './StorageVisuals';

interface StorageFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  providers: StorageProvider[];
  /** null = add a new storage. */
  editing: StorageConfig | null;
  onSaved: (config: StorageConfig, isNew: boolean) => void;
}

const initialValues = (
  provider: StorageProvider,
  editing: StorageConfig | null,
): StorageFormValues => ({
  name: editing?.name ?? '',
  settings: Object.fromEntries(
    provider.fields
      .filter((f) => !f.secret)
      .map((f) => [
        f.key,
        editing?.settings[f.key] ?? f.defaultValue ?? (f.type === 'boolean' ? false : ''),
      ]),
  ),
  secrets: Object.fromEntries(provider.fields.filter((f) => f.secret).map((f) => [f.key, ''])),
});

/** Client checks (the API checks again): required, format. */
function validate(
  provider: StorageProvider,
  values: StorageFormValues,
  editing: StorageConfig | null,
): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!values.name.trim()) errors.name = 'Enter a name for this storage';
  for (const field of provider.fields) {
    if (field.type === 'boolean') continue;
    const value = field.secret ? values.secrets[field.key] : values.settings[field.key];
    const text = typeof value === 'string' ? value.trim() : '';
    const savedSecret = field.secret && editing?.secrets[field.key]?.isSet;
    if (!text) {
      if (field.required && !savedSecret)
        errors[field.key] = `Enter the ${field.label.toLowerCase()}`;
    } else if (field.pattern && !new RegExp(field.pattern).test(text)) {
      errors[field.key] = field.formatHint ?? `${field.label} has an invalid format`;
    }
  }
  return errors;
}

/** Add or edit a storage: pick a provider, fill its fields, test, save. */
export function StorageFormDialog({
  open,
  onOpenChange,
  providers,
  editing,
  onSaved,
}: StorageFormDialogProps) {
  const cloud = providers.filter((p) => !p.isBuiltIn);
  const [providerId, setProviderId] = useState<string | null>(editing?.provider ?? null);
  const provider = cloud.find((p) => p.id === providerId) ?? null;
  const [values, setValues] = useState<StorageFormValues | null>(
    provider ? initialValues(provider, editing) : null,
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [test, setTest] = useState<StorageTestResult | null>(null);
  const [isTesting, setIsTesting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const { error: apiError, setError, fieldError } = useApiError();

  const choose = (next: StorageProvider) => {
    setProviderId(next.id);
    setValues(initialValues(next, editing));
    setErrors({});
    setTest(null);
    setError(null);
  };

  const setSetting = (key: string, value: string | boolean) => {
    setValues((v) => (v ? { ...v, settings: { ...v.settings, [key]: value } } : v));
    setTest(null);
  };
  const setSecret = (key: string, value: string) => {
    setValues((v) => (v ? { ...v, secrets: { ...v.secrets, [key]: value } } : v));
    setTest(null);
  };

  const payload = () => {
    if (!provider || !values) return null;
    const settings = Object.fromEntries(
      Object.entries(values.settings).filter(([, v]) => typeof v === 'boolean' || v.trim() !== ''),
    );
    const secrets = Object.fromEntries(
      Object.entries(values.secrets).filter(([, v]) => v.trim() !== ''),
    );
    return { settings, secrets };
  };

  const check = (): boolean => {
    if (!provider || !values) return false;
    const next = validate(provider, values, editing);
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const runTest = async () => {
    const body = payload();
    if (!provider || !body || !check()) return;
    setIsTesting(true);
    setTest(null);
    try {
      setTest(
        await storageApi.testValues({
          provider: provider.id,
          ...body,
          ...(editing ? { id: editing.id } : {}),
        }),
      );
    } catch (err) {
      setError(err, 'Could not run the test');
    } finally {
      setIsTesting(false);
    }
  };

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const body = payload();
    if (!provider || !values || !body || !check()) return;
    setIsSaving(true);
    try {
      const saved = editing
        ? await storageApi.update(editing.id, {
            name: values.name.trim(),
            ...body,
            version: editing.version,
          })
        : await storageApi.create({ name: values.name.trim(), provider: provider.id, ...body });
      notifySuccess(editing ? `${saved.name} updated` : `${saved.name} added`, {
        description: editing
          ? 'Run a test to check the new values.'
          : 'Test it, then make it active to send new uploads there.',
      });
      onSaved(saved, !editing);
      onOpenChange(false);
    } catch (err) {
      setError(err, 'Could not save the storage');
      notifyError(err, 'Could not save the storage');
    } finally {
      setIsSaving(false);
    }
  };

  const errorFor = (key: string, isSecret: boolean) =>
    errors[key] ?? fieldError(`${isSecret ? 'secrets' : 'settings'}.${key}`);

  const renderField = (field: StorageField) => {
    if (!values) return null;
    if (field.type === 'boolean') {
      return (
        <Switch
          key={field.key}
          label={field.label}
          hint={field.hint}
          checked={values.settings[field.key] === true}
          onCheckedChange={(on) => setSetting(field.key, on)}
        />
      );
    }
    if (field.secret) {
      const saved = editing?.secrets[field.key];
      return (
        <PasswordInput
          key={field.key}
          label={field.label}
          required={field.required && !saved?.isSet}
          autoComplete="new-password"
          value={values.secrets[field.key] ?? ''}
          placeholder={
            saved?.isSet
              ? `Saved (${saved.hint ?? '••••'}) — leave empty to keep it`
              : field.placeholder
          }
          hint={field.hint ?? 'Encrypted when saved; never shown again.'}
          error={errorFor(field.key, true)}
          onChange={(e) => setSecret(field.key, e.target.value)}
        />
      );
    }
    return (
      <Input
        key={field.key}
        label={field.label}
        required={field.required}
        type={field.type === 'url' ? 'url' : 'text'}
        spellCheck={false}
        autoComplete="off"
        value={String(values.settings[field.key] ?? '')}
        placeholder={field.placeholder}
        hint={field.hint}
        error={errorFor(field.key, false)}
        onChange={(e) => setSetting(field.key, e.target.value)}
      />
    );
  };

  const title = editing
    ? `Edit ${editing.name}`
    : provider
      ? `Add ${provider.label}`
      : 'Add storage';
  const description = provider
    ? provider.description
    : 'Choose where uploaded files should be stored.';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title={title} description={description} size="xl">
        {!provider || !values ? (
          <DialogBody>
            <fieldset>
              <legend className="sr-only">Storage provider</legend>
              <div className="grid gap-2 sm:grid-cols-2">
                {cloud.map((p) => {
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => choose(p)}
                      className="flex cursor-pointer items-start gap-3 rounded-md border border-border bg-surface p-3 text-left transition-colors hover:border-primary hover:bg-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                    >
                      <ProviderLogo provider={p.id} />
                      <span className="min-w-0">
                        <span className="block text-sm font-semibold text-foreground">
                          {p.label}
                        </span>
                        <span className="block text-xs text-muted-foreground">{p.description}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </fieldset>
          </DialogBody>
        ) : (
          <form noValidate onSubmit={save} className="flex min-h-0 flex-1 flex-col">
            <DialogBody className="space-y-5">
              {!editing && (
                <button
                  type="button"
                  onClick={() => {
                    setProviderId(null);
                    setValues(null);
                  }}
                  className="inline-flex cursor-pointer items-center gap-1.5 rounded-md text-sm text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
                >
                  <ArrowLeft className="size-4" aria-hidden="true" /> Other provider
                </button>
              )}
              {provider.docsUrl && (
                <a
                  href={provider.docsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-sm text-primary hover:underline"
                >
                  <ExternalLink className="size-3.5" aria-hidden="true" />
                  How to create a bucket and keys ({provider.label})
                </a>
              )}
              <div className="grid gap-5 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <Input
                    label="Name"
                    required
                    maxLength={60}
                    value={values.name}
                    placeholder="Enter a name you will recognise, e.g. Production files"
                    error={errors.name ?? fieldError('name')}
                    onChange={(e) => setValues((v) => (v ? { ...v, name: e.target.value } : v))}
                  />
                </div>
                {provider.fields.map((field) => (
                  // Short text fields side by side; URLs, secrets and switches full width.
                  <div
                    key={field.key}
                    className={field.type === 'text' ? undefined : 'sm:col-span-2'}
                  >
                    {renderField(field)}
                  </div>
                ))}
              </div>

              {test && (
                <output
                  className={cn(
                    'flex items-start gap-2 rounded-md px-3 py-2.5 text-sm',
                    test.isSuccess
                      ? 'bg-success-soft text-success-soft-foreground'
                      : 'bg-danger-soft text-danger-soft-foreground',
                  )}
                >
                  {test.isSuccess ? (
                    <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                  ) : (
                    <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                  )}
                  <span>
                    {test.message}
                    {test.isSuccess && ` (${test.durationMs} ms)`}
                  </span>
                </output>
              )}
              {apiError !== null && !test && (
                <p role="alert" className="text-sm text-danger">
                  Check the highlighted fields.
                </p>
              )}
            </DialogBody>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                leftIcon={<PlugZap />}
                isLoading={isTesting}
                disabled={isSaving}
                onClick={() => void runTest()}
              >
                Test connection
              </Button>
              <Button type="submit" isLoading={isSaving} disabled={isTesting}>
                {editing ? 'Save changes' : 'Add storage'}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
