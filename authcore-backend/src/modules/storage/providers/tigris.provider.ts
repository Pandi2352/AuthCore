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

const DEFAULT_ENDPOINT = 'https://t3.storage.dev';

/** Tigris (S3-compatible, global): API https://t3.storage.dev, region "auto". */
export const tigrisProvider: StorageProviderDefinition = {
  id: 'TIGRIS',
  label: 'Tigris',
  description:
    'Globally distributed S3-compatible storage (also available through Fly.io).',
  docsUrl: 'https://www.tigrisdata.com/docs/buckets/public-bucket/',
  fields: [
    {
      key: 'bucket',
      label: 'Bucket',
      type: 'text',
      required: true,
      placeholder: 'Enter the bucket name',
    },
    {
      key: 'accessKeyId',
      label: 'Access key ID',
      type: 'text',
      required: true,
      placeholder: 'Enter the access key ID (starts with tid_)',
    },
    {
      key: 'secretAccessKey',
      label: 'Secret access key',
      type: 'secret',
      required: true,
      secret: true,
      placeholder: 'Enter the secret access key (starts with tsec_)',
    },
    {
      key: 'endpoint',
      label: 'Endpoint',
      type: 'url',
      required: true,
      defaultValue: DEFAULT_ENDPOINT,
      placeholder: 'Enter the S3 endpoint',
      hint: 'Keep the default unless Tigris gave you another one.',
      pattern: '^https://\\S+$',
      formatHint: 'Use an https:// address, e.g. https://t3.storage.dev',
    },
    PREFIX_FIELD,
    PUBLIC_ACCESS_FIELD,
    PUBLIC_URL_FIELD(
      'Leave empty to use https://<bucket>.t3.tigrisfiles.io (public bucket), or enter your custom domain.',
    ),
    QUOTA_FIELD,
  ],
  toDriverConfig: (v) => ({
    kind: 's3',
    bucket: text(v, 'bucket'),
    region: 'auto',
    endpoint: text(v, 'endpoint') || DEFAULT_ENDPOINT,
    forcePathStyle: false,
    accessKeyId: text(v, 'accessKeyId'),
    secretAccessKey: secret(v, 'secretAccessKey'),
    prefix: cleanPrefix(text(v, 'prefix')),
  }),
  publicUrl: (v, key) =>
    publicAddress(v, `https://${text(v, 'bucket')}.t3.tigrisfiles.io`, key),
};
