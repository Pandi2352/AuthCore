import { Layers, type LucideIcon } from 'lucide-react';

import awsS3Logo from '@/assets/file-storage-providers/aws-s3.jpg';
import backblazeLogo from '@/assets/file-storage-providers/backblaze.png';
import localLogo from '@/assets/file-storage-providers/local-provider.jpg';
import supabaseLogo from '@/assets/file-storage-providers/supabase.png';
import tigrisLogo from '@/assets/file-storage-providers/trigris.webp';

import type { StorageConfig, StorageProviderId } from '../../types/storage.types';

/**
 * Logo per provider (src/assets/file-storage-providers). Providers without a logo use a
 * generic icon on an accent tile (theme tokens).
 */
export const PROVIDER_META: Record<
  StorageProviderId,
  {
    logo: string | null;
    /** Zoom for logos with a lot of white space around them. */
    zoom: number;
    icon: LucideIcon;
    accent: string;
  }
> = {
  LOCAL: { logo: localLogo, zoom: 1.35, icon: Layers, accent: '' },
  AWS_S3: { logo: awsS3Logo, zoom: 1.6, icon: Layers, accent: '' },
  BACKBLAZE_B2: { logo: backblazeLogo, zoom: 1.15, icon: Layers, accent: '' },
  TIGRIS: { logo: tigrisLogo, zoom: 1.45, icon: Layers, accent: '' },
  SUPABASE: { logo: supabaseLogo, zoom: 0.8, icon: Layers, accent: '' },
  S3_COMPATIBLE: { logo: null, zoom: 1, icon: Layers, accent: 'bg-nav-blue/15 text-nav-blue' },
};

/** "bucket/prefix · region" line under a storage name. */
export function storageSummary(config: StorageConfig): string {
  if (config.provider === 'LOCAL') return 'Uploads folder on this server';
  const s = config.settings;
  const parts = [
    typeof s.bucket === 'string' ? s.bucket : null,
    typeof s.prefix === 'string' && s.prefix ? `/${s.prefix}` : null,
  ]
    .filter(Boolean)
    .join('');
  const where =
    typeof s.region === 'string' && s.region
      ? s.region
      : typeof s.endpoint === 'string'
        ? s.endpoint.replace(/^https?:\/\//, '')
        : null;
  return [parts, where].filter(Boolean).join(' · ');
}
