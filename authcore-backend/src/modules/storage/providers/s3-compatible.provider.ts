import {
  cleanPrefix,
  flag,
  joinUrl,
  PREFIX_FIELD,
  PUBLIC_URL_FIELD,
  QUOTA_FIELD,
  secret,
  type StorageProviderDefinition,
  text,
} from './storage-provider.types';

/** Any other S3-compatible service: DigitalOcean Spaces, Cloudflare R2, Wasabi, MinIO … */
export const s3CompatibleProvider: StorageProviderDefinition = {
  id: 'S3_COMPATIBLE',
  label: 'Other S3-compatible',
  description:
    'DigitalOcean Spaces, Cloudflare R2, Wasabi, MinIO or any service with an S3 API.',
  fields: [
    {
      key: 'endpoint',
      label: 'Endpoint',
      type: 'url',
      required: true,
      placeholder:
        'Enter the S3 endpoint, e.g. https://sgp1.digitaloceanspaces.com',
      pattern: '^https?://\\S+$',
      formatHint:
        'Use the full address, e.g. https://sgp1.digitaloceanspaces.com',
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
      defaultValue: 'us-east-1',
      placeholder: 'Enter the region (Cloudflare R2: auto)',
    },
    {
      key: 'accessKeyId',
      label: 'Access key ID',
      type: 'text',
      required: true,
      placeholder: 'Enter the access key ID',
    },
    {
      key: 'secretAccessKey',
      label: 'Secret access key',
      type: 'secret',
      required: true,
      secret: true,
      placeholder: 'Enter the secret access key',
    },
    {
      key: 'forcePathStyle',
      label: 'Path-style addressing',
      type: 'boolean',
      required: false,
      defaultValue: false,
      hint: 'Turn on for MinIO and services without bucket sub-domains.',
    },
    PREFIX_FIELD,
    PUBLIC_URL_FIELD(
      'Public base URL of the bucket, e.g. https://<bucket>.sgp1.digitaloceanspaces.com. Leave empty to serve files through this API.',
    ),
    QUOTA_FIELD,
  ],
  toDriverConfig: (v) => ({
    kind: 's3',
    bucket: text(v, 'bucket'),
    region: text(v, 'region') || 'us-east-1',
    endpoint: text(v, 'endpoint'),
    forcePathStyle: flag(v, 'forcePathStyle'),
    accessKeyId: text(v, 'accessKeyId'),
    secretAccessKey: secret(v, 'secretAccessKey'),
    prefix: cleanPrefix(text(v, 'prefix')),
  }),
  // No safe default here: only when the admin entered one.
  publicUrl: (v, key) =>
    text(v, 'publicUrl') ? joinUrl(text(v, 'publicUrl'), key) : null,
};
