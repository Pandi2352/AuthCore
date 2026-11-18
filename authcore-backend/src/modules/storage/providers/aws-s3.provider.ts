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

/** Amazon S3. The SDK picks the endpoint from the region. */
export const awsS3Provider: StorageProviderDefinition = {
  id: 'AWS_S3',
  label: 'Amazon S3',
  description:
    'AWS object storage. Use an IAM user that can access this bucket only.',
  docsUrl:
    'https://docs.aws.amazon.com/AmazonS3/latest/userguide/create-bucket-overview.html',
  fields: [
    {
      key: 'bucket',
      label: 'Bucket',
      type: 'text',
      required: true,
      placeholder: 'Enter the bucket name',
      pattern: '^[a-z0-9][a-z0-9.\\-]{1,61}[a-z0-9]$',
      formatHint: 'Use 3–63 lowercase letters, digits, dots or hyphens',
    },
    {
      key: 'region',
      label: 'Region',
      type: 'text',
      required: true,
      placeholder: 'Enter the bucket region, e.g. ap-south-1',
      pattern: '^[a-z]{2}(-[a-z]+)+-\\d$',
      formatHint: 'Use an AWS region code, e.g. ap-south-1',
    },
    {
      key: 'accessKeyId',
      label: 'Access key ID',
      type: 'text',
      required: true,
      placeholder: 'Enter the IAM access key ID',
    },
    {
      key: 'secretAccessKey',
      label: 'Secret access key',
      type: 'secret',
      required: true,
      secret: true,
      placeholder: 'Enter the IAM secret access key',
    },
    PREFIX_FIELD,
    PUBLIC_ACCESS_FIELD,
    PUBLIC_URL_FIELD(
      'Leave empty to use https://<bucket>.s3.<region>.amazonaws.com (the bucket must allow public reads), or enter a CloudFront domain.',
    ),
    QUOTA_FIELD,
  ],
  toDriverConfig: (v) => ({
    kind: 's3',
    bucket: text(v, 'bucket'),
    region: text(v, 'region'),
    forcePathStyle: false,
    accessKeyId: text(v, 'accessKeyId'),
    secretAccessKey: secret(v, 'secretAccessKey'),
    prefix: cleanPrefix(text(v, 'prefix')),
  }),
  publicUrl: (v, key) =>
    publicAddress(
      v,
      `https://${text(v, 'bucket')}.s3.${text(v, 'region')}.amazonaws.com`,
      key,
    ),
};
