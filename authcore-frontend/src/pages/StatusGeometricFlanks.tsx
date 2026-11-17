import type { FC } from 'react';

/**
 * Luminous 3D frosted-glass geometric crystal wings with delicate theme reflections.
 * Symmetrically frames the left and right borders of the status page with an airy,
 * airy aesthetic, matching the reference status design.
 *
 * Drawn only with theme tokens (var(--primary), var(--primary-soft), var(--surface)), so it
 * follows every color preset and light / dark mode — no images.
 */
export const StatusGeometricFlanks: FC = () => {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 z-0 overflow-hidden select-none"
    >
      {/* Light Ambient Backdrop: clean, luminous gradient with a delicate theme breath */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse at 50% 50%, var(--surface) 0%, color-mix(in oklch, var(--primary-soft) 30%, var(--surface)) 100%)',
        }}
      />

      {/* 3D Frosted Crystal Polygon Flanks SVG */}
      <svg
        className="absolute inset-0 h-full w-full"
        viewBox="0 0 1440 900"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        preserveAspectRatio="xMidYMid slice"
      >
        <defs>
          {/* Subtle airy pastel aura gradients */}
          <radialGradient id="status-glow-left" cx="0%" cy="50%" r="55%">
            <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.12" />
            <stop offset="45%" stopColor="var(--primary)" stopOpacity="0.04" />
            <stop offset="100%" stopColor="var(--primary)" stopOpacity="0" />
          </radialGradient>

          <radialGradient id="status-glow-right" cx="100%" cy="50%" r="55%">
            <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.12" />
            <stop offset="45%" stopColor="var(--primary)" stopOpacity="0.04" />
            <stop offset="100%" stopColor="var(--primary)" stopOpacity="0" />
          </radialGradient>

          {/* Frosted Glass Facet Fills (Light, luminous, multi-angle 3D reflection) */}
          <linearGradient id="facet-lit" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="var(--surface)" stopOpacity="0.92" />
            <stop offset="60%" stopColor="var(--primary-soft)" stopOpacity="0.4" />
            <stop offset="100%" stopColor="var(--surface)" stopOpacity="0.8" />
          </linearGradient>

          <linearGradient id="facet-shade" x1="0%" y1="100%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="var(--primary-soft)" stopOpacity="0.5" />
            <stop offset="50%" stopColor="var(--surface)" stopOpacity="0.8" />
            <stop offset="100%" stopColor="var(--primary-soft)" stopOpacity="0.25" />
          </linearGradient>

          <linearGradient id="facet-glass" x1="0%" y1="50%" x2="100%" y2="50%">
            <stop offset="0%" stopColor="var(--surface)" stopOpacity="0.95" />
            <stop offset="100%" stopColor="var(--surface)" stopOpacity="0.75" />
          </linearGradient>

          <linearGradient id="facet-apex" x1="0%" y1="50%" x2="100%" y2="50%">
            <stop offset="0%" stopColor="var(--primary-soft)" stopOpacity="0.7" />
            <stop offset="100%" stopColor="var(--surface)" stopOpacity="0.9" />
          </linearGradient>

          {/* Specular ridge edges: bright white glass highlight with delicate theme tint */}
          <linearGradient id="facet-edge" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="var(--surface)" stopOpacity="0.95" />
            <stop offset="50%" stopColor="var(--primary)" stopOpacity="0.25" />
            <stop offset="100%" stopColor="var(--surface)" stopOpacity="0.9" />
          </linearGradient>

          {/* Symmetrical Left Crystal Cluster Definition */}
          <g id="crystal-wing">
            {/* Top-most wall & anchor */}
            <polygon
              points="0,0 140,0 210,80 120,120 0,150"
              fill="url(#facet-lit)"
              stroke="url(#facet-edge)"
              strokeWidth="1.2"
            />
            <polygon
              points="0,150 120,120 120,240 0,260"
              fill="url(#facet-glass)"
              stroke="url(#facet-edge)"
              strokeWidth="1"
            />

            {/* Upper flare wing */}
            <polygon
              points="200,160 260,220 280,140 210,80"
              fill="url(#facet-shade)"
              stroke="url(#facet-edge)"
              strokeWidth="1.2"
            />
            <polygon
              points="180,340 260,220 200,160 120,240"
              fill="url(#facet-lit)"
              stroke="url(#facet-edge)"
              strokeWidth="1.2"
            />

            {/* Central inward-pointing chevron/arrowhead */}
            <polygon
              points="90,450 180,340 320,450"
              fill="url(#facet-lit)"
              stroke="url(#facet-edge)"
              strokeWidth="1.5"
            />
            <polygon
              points="90,450 320,450 180,560"
              fill="url(#facet-shade)"
              stroke="url(#facet-edge)"
              strokeWidth="1.5"
            />
            <polygon
              points="0,320 90,320 180,340 90,450 0,450"
              fill="url(#facet-glass)"
              stroke="url(#facet-edge)"
              strokeWidth="1"
            />
            <polygon
              points="0,450 90,450 180,560 90,580 0,580"
              fill="url(#facet-apex)"
              stroke="url(#facet-edge)"
              strokeWidth="1"
            />

            {/* Lower flare wing (symmetrical) */}
            <polygon
              points="180,560 260,680 200,740 120,660"
              fill="url(#facet-shade)"
              stroke="url(#facet-edge)"
              strokeWidth="1.2"
            />
            <polygon
              points="200,740 260,680 280,760 210,820"
              fill="url(#facet-lit)"
              stroke="url(#facet-edge)"
              strokeWidth="1.2"
            />

            {/* Bottom-most wall & anchor */}
            <polygon
              points="0,640 120,660 120,780 0,750"
              fill="url(#facet-glass)"
              stroke="url(#facet-edge)"
              strokeWidth="1"
            />
            <polygon
              points="0,900 140,900 210,820 120,780 0,750"
              fill="url(#facet-shade)"
              stroke="url(#facet-edge)"
              strokeWidth="1.2"
            />
          </g>
        </defs>

        {/* Left Side Glow & Geometry */}
        <ellipse cx="60" cy="450" rx="420" ry="480" fill="url(#status-glow-left)" />
        <use href="#crystal-wing" />

        {/* Right Side Glow & Mirrored Geometry */}
        <ellipse cx="1380" cy="450" rx="420" ry="480" fill="url(#status-glow-right)" />
        <g transform="translate(1440, 0) scale(-1, 1)">
          <use href="#crystal-wing" />
        </g>
      </svg>
    </div>
  );
};
