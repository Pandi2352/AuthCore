import { useId } from 'react';

import { cn } from '@/lib/utils';

export interface IllustrationProps {
  size?: 'compact' | 'default';
  className?: string;
}

/**
 * 3D-faceted isometric security shield & floating crystal padlock illustration.
 * Symmetrically styled with translucent frosted-glass facets and ambient theme aura.
 */
export function AccessDeniedIllustration({ size = 'default', className }: IllustrationProps) {
  const id = useId();
  const isCompact = size === 'compact';
  const width = isCompact ? 96 : 180;
  const height = isCompact ? 86 : 160;

  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 200 180"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn('shrink-0 overflow-visible select-none', className)}
      aria-hidden="true"
    >
      <defs>
        {/* Ambient radial aura */}
        <radialGradient id={`lock-aura-${id}`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.28" />
          <stop offset="55%" stopColor="var(--primary-soft)" stopOpacity="0.12" />
          <stop offset="100%" stopColor="var(--primary)" stopOpacity="0" />
        </radialGradient>

        {/* Shield facet gradients */}
        <linearGradient id={`shield-lit-${id}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="var(--surface)" stopOpacity="0.95" />
          <stop offset="50%" stopColor="var(--primary-soft)" stopOpacity="0.45" />
          <stop offset="100%" stopColor="var(--surface)" stopOpacity="0.8" />
        </linearGradient>

        <linearGradient id={`shield-shade-${id}`} x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="var(--primary-soft)" stopOpacity="0.6" />
          <stop offset="50%" stopColor="var(--surface)" stopOpacity="0.75" />
          <stop offset="100%" stopColor="var(--primary-soft)" stopOpacity="0.25" />
        </linearGradient>

        <linearGradient id={`shield-glass-${id}`} x1="0%" y1="50%" x2="100%" y2="50%">
          <stop offset="0%" stopColor="var(--surface)" stopOpacity="0.9" />
          <stop offset="100%" stopColor="var(--surface)" stopOpacity="0.65" />
        </linearGradient>

        {/* Shackle arc gradient */}
        <linearGradient id={`shackle-grad-${id}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="var(--surface)" stopOpacity="0.95" />
          <stop offset="50%" stopColor="var(--primary-soft)" stopOpacity="0.75" />
          <stop offset="100%" stopColor="var(--primary)" stopOpacity="0.5" />
        </linearGradient>

        {/* Specular ridge highlight */}
        <linearGradient id={`specular-edge-${id}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="var(--surface)" stopOpacity="0.95" />
          <stop offset="50%" stopColor="var(--primary)" stopOpacity="0.4" />
          <stop offset="100%" stopColor="var(--surface)" stopOpacity="0.85" />
        </linearGradient>

        {/* Keyhole core glow */}
        <radialGradient id={`key-glow-${id}`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.9" />
          <stop offset="100%" stopColor="var(--primary)" stopOpacity="0.2" />
        </radialGradient>
      </defs>

      {/* Ambient background glow */}
      <ellipse cx="100" cy="92" rx="88" ry="72" fill={`url(#lock-aura-${id})`} />

      {/* Security radar rings */}
      <ellipse
        cx="100"
        cy="92"
        rx="78"
        ry="64"
        stroke="var(--primary)"
        strokeOpacity="0.22"
        strokeWidth="1"
        strokeDasharray="4 6"
      />
      <ellipse
        cx="100"
        cy="92"
        rx="62"
        ry="50"
        stroke="var(--primary)"
        strokeOpacity="0.14"
        strokeWidth="0.8"
      />

      {/* Background 3D Faceted Security Shield */}
      <g>
        {/* Top-left crest */}
        <polygon
          points="100,22 52,52 100,84"
          fill={`url(#shield-lit-${id})`}
          stroke={`url(#specular-edge-${id})`}
          strokeWidth="1.2"
        />
        {/* Top-right crest */}
        <polygon
          points="100,22 148,52 100,84"
          fill={`url(#shield-shade-${id})`}
          stroke={`url(#specular-edge-${id})`}
          strokeWidth="1.2"
        />
        {/* Lower-left flank */}
        <polygon
          points="52,52 52,110 100,158 100,84"
          fill={`url(#shield-glass-${id})`}
          stroke={`url(#specular-edge-${id})`}
          strokeWidth="1.2"
        />
        {/* Lower-right flank */}
        <polygon
          points="148,52 148,110 100,158 100,84"
          fill={`url(#shield-shade-${id})`}
          stroke={`url(#specular-edge-${id})`}
          strokeWidth="1.2"
        />
      </g>

      {/* Floating 3D Crystal Padlock (Foreground) */}
      <g>
        {/* Shackle left pillar */}
        <polygon
          points="80,92 80,60 90,54 90,92"
          fill={`url(#shackle-grad-${id})`}
          stroke={`url(#specular-edge-${id})`}
          strokeWidth="1"
        />
        {/* Shackle right pillar */}
        <polygon
          points="110,92 110,54 120,60 120,92"
          fill={`url(#shackle-grad-${id})`}
          stroke={`url(#specular-edge-${id})`}
          strokeWidth="1"
        />
        {/* Shackle curved crown */}
        <polygon
          points="80,60 90,54 100,46 110,54 120,60 112,68 100,58 88,68"
          fill={`url(#shield-lit-${id})`}
          stroke={`url(#specular-edge-${id})`}
          strokeWidth="1.2"
        />

        {/* Lock body 3D crystal prism */}
        <polygon
          points="70,88 130,88 100,106"
          fill={`url(#shield-lit-${id})`}
          stroke={`url(#specular-edge-${id})`}
          strokeWidth="1.2"
        />
        <polygon
          points="70,88 100,106 70,136"
          fill={`url(#shield-glass-${id})`}
          stroke={`url(#specular-edge-${id})`}
          strokeWidth="1.2"
        />
        <polygon
          points="130,88 130,136 100,106"
          fill={`url(#shield-shade-${id})`}
          stroke={`url(#specular-edge-${id})`}
          strokeWidth="1.2"
        />
        <polygon
          points="70,136 100,106 130,136"
          fill={`url(#shield-lit-${id})`}
          stroke={`url(#specular-edge-${id})`}
          strokeWidth="1.2"
        />
        <polygon
          points="76,136 100,144 124,136 100,106"
          fill={`url(#shield-shade-${id})`}
          stroke={`url(#specular-edge-${id})`}
          strokeWidth="1"
        />

        {/* Center glowing keyhole aperture */}
        <circle
          cx="100"
          cy="110"
          r="12"
          stroke="var(--primary)"
          strokeOpacity="0.3"
          strokeWidth="0.8"
          fill="none"
        />
        <circle cx="100" cy="107" r="4.5" fill={`url(#key-glow-${id})`} />
        <polygon points="98,109 102,109 103,119 97,119" fill={`url(#key-glow-${id})`} />
      </g>

      {/* Floating accent crystal shards */}
      <polygon
        points="34,66 42,58 38,76 30,72"
        fill={`url(#shield-lit-${id})`}
        stroke={`url(#specular-edge-${id})`}
        strokeWidth="0.8"
      />
      <polygon
        points="166,66 174,72 170,58 162,76"
        fill={`url(#shield-shade-${id})`}
        stroke={`url(#specular-edge-${id})`}
        strokeWidth="0.8"
      />
      <polygon
        points="44,124 50,120 48,132 42,129"
        fill={`url(#shield-glass-${id})`}
        stroke={`url(#specular-edge-${id})`}
        strokeWidth="0.8"
      />
      <polygon
        points="156,124 162,129 160,120 154,132"
        fill={`url(#shield-lit-${id})`}
        stroke={`url(#specular-edge-${id})`}
        strokeWidth="0.8"
      />
    </svg>
  );
}

/**
 * 3D-faceted warning crystal tetrahedron with exclamation core.
 */
export function ErrorAlertIllustration({ size = 'default', className }: IllustrationProps) {
  const id = useId();
  const isCompact = size === 'compact';
  const width = isCompact ? 96 : 180;
  const height = isCompact ? 86 : 160;

  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 200 180"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn('shrink-0 overflow-visible select-none', className)}
      aria-hidden="true"
    >
      <defs>
        <radialGradient id={`err-aura-${id}`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="var(--danger)" stopOpacity="0.25" />
          <stop offset="55%" stopColor="var(--danger-soft)" stopOpacity="0.1" />
          <stop offset="100%" stopColor="var(--danger)" stopOpacity="0" />
        </radialGradient>

        <linearGradient id={`err-lit-${id}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="var(--surface)" stopOpacity="0.95" />
          <stop offset="50%" stopColor="var(--danger-soft)" stopOpacity="0.5" />
          <stop offset="100%" stopColor="var(--surface)" stopOpacity="0.8" />
        </linearGradient>

        <linearGradient id={`err-shade-${id}`} x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="var(--danger-soft)" stopOpacity="0.65" />
          <stop offset="50%" stopColor="var(--surface)" stopOpacity="0.75" />
          <stop offset="100%" stopColor="var(--danger-soft)" stopOpacity="0.25" />
        </linearGradient>

        <linearGradient id={`err-edge-${id}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="var(--surface)" stopOpacity="0.95" />
          <stop offset="50%" stopColor="var(--danger)" stopOpacity="0.4" />
          <stop offset="100%" stopColor="var(--surface)" stopOpacity="0.85" />
        </linearGradient>
      </defs>

      {/* Ambient aura */}
      <ellipse cx="100" cy="92" rx="88" ry="72" fill={`url(#err-aura-${id})`} />

      {/* Radar rings */}
      <ellipse
        cx="100"
        cy="92"
        rx="78"
        ry="64"
        stroke="var(--danger)"
        strokeOpacity="0.2"
        strokeWidth="1"
        strokeDasharray="4 6"
      />

      {/* 3D Faceted Warning Prism */}
      <g>
        <polygon
          points="100,24 50,136 100,116"
          fill={`url(#err-lit-${id})`}
          stroke={`url(#err-edge-${id})`}
          strokeWidth="1.2"
        />
        <polygon
          points="100,24 150,136 100,116"
          fill={`url(#err-shade-${id})`}
          stroke={`url(#err-edge-${id})`}
          strokeWidth="1.2"
        />
        <polygon
          points="50,136 150,136 100,116"
          fill={`url(#err-lit-${id})`}
          stroke={`url(#err-edge-${id})`}
          strokeWidth="1.2"
        />
        <polygon
          points="56,136 100,146 144,136 100,116"
          fill={`url(#err-shade-${id})`}
          stroke={`url(#err-edge-${id})`}
          strokeWidth="1"
        />

        {/* Floating Exclamation Mark */}
        <line
          x1="100"
          y1="62"
          x2="100"
          y2="92"
          stroke="var(--danger)"
          strokeWidth="4"
          strokeLinecap="round"
        />
        <circle cx="100" cy="104" r="2.5" fill="var(--danger)" />
      </g>

      {/* Floating accent shards */}
      <polygon
        points="32,70 40,62 36,80 28,76"
        fill={`url(#err-lit-${id})`}
        stroke={`url(#err-edge-${id})`}
        strokeWidth="0.8"
      />
      <polygon
        points="168,70 176,76 172,62 164,80"
        fill={`url(#err-shade-${id})`}
        stroke={`url(#err-edge-${id})`}
        strokeWidth="0.8"
      />
    </svg>
  );
}

/**
 * 3D-faceted magnifying search prism for 404 / not found feedback.
 */
export function NotFoundIllustration({ size = 'default', className }: IllustrationProps) {
  const id = useId();
  const isCompact = size === 'compact';
  const width = isCompact ? 96 : 180;
  const height = isCompact ? 86 : 160;

  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 200 180"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn('shrink-0 overflow-visible select-none', className)}
      aria-hidden="true"
    >
      <defs>
        <radialGradient id={`nf-aura-${id}`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.25" />
          <stop offset="55%" stopColor="var(--primary-soft)" stopOpacity="0.1" />
          <stop offset="100%" stopColor="var(--primary)" stopOpacity="0" />
        </radialGradient>

        <linearGradient id={`nf-lit-${id}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="var(--surface)" stopOpacity="0.95" />
          <stop offset="50%" stopColor="var(--primary-soft)" stopOpacity="0.45" />
          <stop offset="100%" stopColor="var(--surface)" stopOpacity="0.8" />
        </linearGradient>

        <linearGradient id={`nf-shade-${id}`} x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="var(--primary-soft)" stopOpacity="0.6" />
          <stop offset="50%" stopColor="var(--surface)" stopOpacity="0.75" />
          <stop offset="100%" stopColor="var(--primary-soft)" stopOpacity="0.25" />
        </linearGradient>

        <linearGradient id={`nf-edge-${id}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="var(--surface)" stopOpacity="0.95" />
          <stop offset="50%" stopColor="var(--primary)" stopOpacity="0.35" />
          <stop offset="100%" stopColor="var(--surface)" stopOpacity="0.85" />
        </linearGradient>
      </defs>

      {/* Ambient aura */}
      <ellipse cx="100" cy="92" rx="88" ry="72" fill={`url(#nf-aura-${id})`} />

      {/* Radar beacon rings */}
      <ellipse
        cx="92"
        cy="84"
        rx="64"
        ry="64"
        stroke="var(--primary)"
        strokeOpacity="0.2"
        strokeWidth="1"
        strokeDasharray="4 6"
      />
      <ellipse
        cx="92"
        cy="84"
        rx="46"
        ry="46"
        stroke="var(--primary)"
        strokeOpacity="0.15"
        strokeWidth="0.8"
      />

      {/* 3D Faceted Search Prism & Lens */}
      <g>
        <polygon
          points="92,42 122,54 134,84 122,114 92,126 62,114 50,84 62,54"
          fill={`url(#nf-lit-${id})`}
          stroke={`url(#nf-edge-${id})`}
          strokeWidth="1.2"
        />
        <circle
          cx="92"
          cy="84"
          r="26"
          fill={`url(#nf-shade-${id})`}
          stroke={`url(#nf-edge-${id})`}
          strokeWidth="1"
        />
        <circle cx="92" cy="84" r="14" fill="var(--surface)" fillOpacity="0.4" />

        <polygon
          points="114,106 148,140 140,148 106,114"
          fill={`url(#nf-lit-${id})`}
          stroke={`url(#nf-edge-${id})`}
          strokeWidth="1.2"
        />
        <polygon
          points="148,140 156,148 148,156 140,148"
          fill={`url(#nf-shade-${id})`}
          stroke={`url(#nf-edge-${id})`}
          strokeWidth="1.2"
        />
      </g>

      {/* Floating accent shards */}
      <polygon
        points="36,60 44,52 40,70 32,66"
        fill={`url(#nf-lit-${id})`}
        stroke={`url(#nf-edge-${id})`}
        strokeWidth="0.8"
      />
      <polygon
        points="160,54 168,60 164,46 156,64"
        fill={`url(#nf-shade-${id})`}
        stroke={`url(#nf-edge-${id})`}
        strokeWidth="0.8"
      />
    </svg>
  );
}

/**
 * 3D-faceted floating signal node for offline status.
 */
export function OfflineIllustration({ size = 'default', className }: IllustrationProps) {
  const id = useId();
  const isCompact = size === 'compact';
  const width = isCompact ? 96 : 180;
  const height = isCompact ? 86 : 160;

  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 200 180"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn('shrink-0 overflow-visible select-none', className)}
      aria-hidden="true"
    >
      <defs>
        <radialGradient id={`off-aura-${id}`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="var(--warning)" stopOpacity="0.25" />
          <stop offset="55%" stopColor="var(--warning-soft)" stopOpacity="0.1" />
          <stop offset="100%" stopColor="var(--warning)" stopOpacity="0" />
        </radialGradient>

        <linearGradient id={`off-lit-${id}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="var(--surface)" stopOpacity="0.95" />
          <stop offset="50%" stopColor="var(--warning-soft)" stopOpacity="0.5" />
          <stop offset="100%" stopColor="var(--surface)" stopOpacity="0.8" />
        </linearGradient>

        <linearGradient id={`off-shade-${id}`} x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="var(--warning-soft)" stopOpacity="0.65" />
          <stop offset="50%" stopColor="var(--surface)" stopOpacity="0.75" />
          <stop offset="100%" stopColor="var(--warning-soft)" stopOpacity="0.25" />
        </linearGradient>

        <linearGradient id={`off-edge-${id}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="var(--surface)" stopOpacity="0.95" />
          <stop offset="50%" stopColor="var(--warning)" stopOpacity="0.4" />
          <stop offset="100%" stopColor="var(--surface)" stopOpacity="0.85" />
        </linearGradient>
      </defs>

      {/* Ambient aura */}
      <ellipse cx="100" cy="92" rx="88" ry="72" fill={`url(#off-aura-${id})`} />

      {/* Disconnected wave arcs */}
      <path
        d="M 54 62 A 58 58 0 0 1 146 62"
        stroke="var(--warning)"
        strokeOpacity="0.35"
        strokeWidth="2"
        strokeLinecap="round"
        strokeDasharray="6 8"
        fill="none"
      />
      <path
        d="M 68 78 A 42 42 0 0 1 132 78"
        stroke="var(--warning)"
        strokeOpacity="0.5"
        strokeWidth="2.2"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M 82 94 A 26 26 0 0 1 118 94"
        stroke="var(--warning)"
        strokeOpacity="0.75"
        strokeWidth="2.5"
        strokeLinecap="round"
        fill="none"
      />

      {/* 3D Tower node */}
      <g>
        <polygon
          points="100,98 84,142 100,132"
          fill={`url(#off-lit-${id})`}
          stroke={`url(#off-edge-${id})`}
          strokeWidth="1.2"
        />
        <polygon
          points="100,98 116,142 100,132"
          fill={`url(#off-shade-${id})`}
          stroke={`url(#off-edge-${id})`}
          strokeWidth="1.2"
        />
        <circle cx="100" cy="100" r="5" fill="var(--warning)" />
        <line
          x1="62"
          y1="138"
          x2="138"
          y2="62"
          stroke="var(--danger)"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
      </g>
    </svg>
  );
}
