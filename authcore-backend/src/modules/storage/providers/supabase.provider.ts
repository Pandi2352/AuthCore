import {
  cleanPrefix,
  PREFIX_FIELD,
  PUBLIC_ACCESS_FIELD,
  PUBLIC_URL_FIELD,
  publicAddress,
  QUOTA_FIELD,
  secret,
  type StorageProviderDefinition,
  text,
} from './storage-provider.types';

/**
 * Supabase Storage through its S3 protocol:
 * https://<project-ref>.storage.supabase.co/storage/v1/s3 (path-style).
 * Keys: Project Settings → Storage → S3 access keys.
 */
export const supabaseProvider: StorageProviderDefinition = {
  id: 'SUPABASE',
  label: 'Supabase Storage',
  description:
    'Storage of your Supabase project, using its S3-compatible access keys.',
  docsUrl: 'https://supabase.com/docs/guides/storage/s3/authentication',
  fields: [
    {
      key: 'projectRef',
      label: 'Project reference',
      type: 'text',
      required: true,
      placeholder: 'Enter the project ref (the <ref> in <ref>.supabase.co)',
      pattern: '^[a-z0-9]{10,40}$',
      formatHint:
        'Use the project ref only (the <ref> in https://<ref>.supabase.co)',
    },
    {
      key: 'bucket',
      label: 'Bucket',
      type: 'text',
      required: true,
      placeholder: 'Enter the bucket name',
    },
    {
      key: 'region',
      label: 'Region',
      type: 'text',
      required: true,
      placeholder: 'Enter the project region, e.g. ap-southeast-1',
      hint: 'Shown on the Storage → S3 configuration page.',
    },
    {
      key: 'accessKeyId',
      label: 'Access key ID',
      type: 'text',
      required: true,
      placeholder: 'Enter the S3 access key ID',
    },
    {
      key: 'secretAccessKey',
      label: 'Secret access key',
      type: 'secret',
      required: true,
      secret: true,
      placeholder: 'Enter the S3 secret access key',
    },
    PREFIX_FIELD,
    PUBLIC_ACCESS_FIELD,
    PUBLIC_URL_FIELD(
      'Leave empty to use the public bucket URL https://<ref>.supabase.co/storage/v1/object/public/<bucket>.',
    ),
    QUOTA_FIELD,
  ],
  toDriverConfig: (v) => ({
    kind: 's3',
    bucket: text(v, 'bucket'),
    region: text(v, 'region'),
    endpoint: `https://${text(v, 'projectRef')}.storage.supabase.co/storage/v1/s3`,
    forcePathStyle: true,
    accessKeyId: text(v, 'accessKeyId'),
    secretAccessKey: secret(v, 'secretAccessKey'),
    prefix: cleanPrefix(text(v, 'prefix')),
  }),
  publicUrl: (v, key) =>
    publicAddress(
      v,
      `https://${text(v, 'projectRef')}.supabase.co/storage/v1/object/public/${text(v, 'bucket')}`,
      key,
    ),
};
