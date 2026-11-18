import type {
  ColorMode,
  ContentWidth,
  ContrastLevel,
  Density,
  IconStyle,
  NavbarStyle,
  Radius,
  ShadowStyle,
  SidebarPosition,
  SidebarStyle,
} from '@/types/theme.types';

type Labels<K extends string> = Record<K, { title: string; description: string }>;

export const MODE_LABEL: Labels<ColorMode> = {
  light: { title: 'Light', description: 'Always light' },
  dark: { title: 'Dark', description: 'Easier at night' },
  system: { title: 'System', description: 'Matches your device' },
};

export const RADIUS_LABEL: Labels<Radius> = {
  sharp: { title: 'Sharp', description: 'Square corners' },
  small: { title: 'Small', description: '4 px' },
  medium: { title: 'Medium', description: '6 px' },
  large: { title: 'Large', description: '8 px' },
  pill: { title: 'Pill', description: 'Fully curved' },
};

export const DENSITY_LABEL: Labels<Density> = {
  compact: { title: 'Compact', description: 'Tight, fits more' },
  comfortable: { title: 'Comfortable', description: 'Balanced spacing' },
  spacious: { title: 'Spacious', description: 'Airy, easy to scan' },
};

export const SIDEBAR_LABEL: Labels<SidebarStyle> = {
  classic: { title: 'Classic', description: 'Solid panel with divider' },
  minimal: { title: 'Minimal', description: 'Borderless, text-led' },
  floating: { title: 'Floating', description: 'Detached card' },
  compact: { title: 'Compact', description: 'Tighter rows' },
};

export const POSITION_LABEL: Labels<SidebarPosition> = {
  left: { title: 'Left', description: 'Default reading side' },
  right: { title: 'Right', description: 'Mirrors the layout' },
};

export const NAVBAR_LABEL: Labels<NavbarStyle> = {
  classic: { title: 'Classic', description: 'Solid bar with divider' },
  minimal: { title: 'Minimal', description: 'Transparent, borderless' },
  floating: { title: 'Floating', description: 'Detached bar' },
  compact: { title: 'Compact', description: 'Shorter, tighter bar' },
};

export const ICON_LABEL: Labels<IconStyle> = {
  classic: { title: 'Classic', description: 'Outline in neutral grey' },
  modern: { title: 'Modern', description: 'Rounded, contemporary' },
  duotone: { title: 'Duotone', description: 'Accent fill, soft tone' },
  color: { title: 'Color', description: 'Each icon its own hue' },
  emoji: { title: 'Emoji', description: 'Colorful Fluent emoji' },
};

export const CONTRAST_LABEL: Labels<ContrastLevel> = {
  standard: { title: 'Standard', description: 'Balanced borders' },
  high: { title: 'High', description: 'Stronger borders and text' },
};

export const SHADOW_LABEL: Labels<ShadowStyle> = {
  none: { title: 'None', description: 'Flat surfaces' },
  subtle: { title: 'Soft', description: 'Subtle lift' },
  elevated: { title: 'Strong', description: 'Pronounced depth' },
};

export const WIDTH_LABEL: Labels<ContentWidth> = {
  fluid: { title: 'Fluid', description: 'Use the full width' },
  boxed: { title: 'Boxed', description: 'Centered, 88%' },
  narrow: { title: 'Narrow', description: 'Focused, 72%' },
};

export const entries = <K extends string>(labels: Labels<K>) =>
  Object.entries(labels) as Array<[K, { title: string; description: string }]>;
