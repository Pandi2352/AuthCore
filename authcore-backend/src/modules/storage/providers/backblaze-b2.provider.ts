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

/** Backblaze B2 through its S3-compatible API: https://s3.<region>.backblazeb2.com */
export const backblazeB2Provider: StorageProviderDefinition = {
  id: 'BACKBLAZE_B2',
  label: 'Backblaze B2',
  description:
    'Low-cost S3-compatible storage. Create an application key limited to this bucket.',
  docsUrl:
    'https://www.backblaze.com/docs/cloud-storage-call-the-s3-compatible-api',
  fields: [
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
      placeholder: 'Enter the region, e.g. us-east-005, or paste the endpoint',
      hint: 'From the bucket "Endpoint" s3.<region>.backblazeb2.com — pasting the whole endpoint works too.',
      // Accepts "us-east-005" or the endpoint shown in Backblaze (with or without https://).
      pattern:
        '^(https?://)?(s3\\.)?[a-z]{2}-[a-z]+-\\d{3}(\\.backblazeb2\\.com)?/?$',
      formatHint: 'Use the region from the bucket endpoint, e.g. us-east-005',
      normalize: (value) => /[a-z]{2}-[a-z]+-\d{3}/.exec(value)?.[0] ?? value,
    },
    {
      key: 'accessKeyId',
      label: 'Key ID',
      type: 'text',
      required: true,
      placeholder: 'Enter the application keyID, e.g. 005f557d…0000000001',
      hint: 'App Keys → your key\'s "keyID". The master key (12-character account ID) does not work with the S3 API.',
      // Application keys: 25 hex characters. The 12-character master key ID is refused by B2's S3 API.
      pattern: '^[0-9a-fA-F]{25}$',
      formatHint:
        "Use an application key's keyID (25 characters, starts with 00…) — the master key / account ID does not work here",
    },
    {
      key: 'secretAccessKey',
      label: 'Application key',
      type: 'secret',
      required: true,
      secret: true,
      placeholder: 'Enter the applicationKey (starts with K…)',
      hint: 'Shown once, right after the key is created. Not the master application key.',
      // B2 application keys: "K" + 30 characters (e.g. K005…).
      pattern: '^K\\S{30}$',
      formatHint:
        'Use the applicationKey of this keyID (31 characters, starts with K) — shown once when the key is created',
    },
    PREFIX_FIELD,
    PUBLIC_ACCESS_FIELD,
    PUBLIC_URL_FIELD(
      'Leave empty to use https://<bucket>.s3.<region>.backblazeb2.com (public bucket), or enter a CDN domain.',
    ),
    QUOTA_FIELD,
  ],
  toDriverConfig: (v) => ({
    kind: 's3',
    bucket: text(v, 'bucket'),
    region: text(v, 'region'),
    endpoint: `https://s3.${text(v, 'region')}.backblazeb2.com`,
    forcePathStyle: false,
    accessKeyId: text(v, 'accessKeyId'),
    secretAccessKey: secret(v, 'secretAccessKey'),
    prefix: cleanPrefix(text(v, 'prefix')),
  }),
  publicUrl: (v, key) =>
    publicAddress(
      v,
      `https://${text(v, 'bucket')}.s3.${text(v, 'region')}.backblazeb2.com`,
      key,
    ),
};
