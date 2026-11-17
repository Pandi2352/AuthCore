import type { ThemePreset, ThemePresetId } from '@/types/theme.types';

/**
 * Registered color presets (metadata for the customizer). The color values
 * themselves live in src/styles/themes.css (theme module). Add a preset:
 * define it there for light and dark, then register it here.
 */
export const themePresets: readonly ThemePreset[] = [
  {
    id: 'default',
    label: 'Blue',
    description: 'Clean SaaS interface',
    swatch: { light: '#2563eb', dark: '#60a5fa' },
  },
  {
    id: 'emerald',
    label: 'Emerald',
    description: 'Business dashboard',
    swatch: { light: '#059669', dark: '#34d399' },
  },
  {
    id: 'violet',
    label: 'Violet',
    description: 'Modern product',
    swatch: { light: '#7c3aed', dark: '#a78bfa' },
  },
  {
    id: 'orange',
    label: 'Orange',
    description: 'Warm, friendly',
    swatch: { light: '#ea580c', dark: '#fb923c' },
  },
  {
    id: 'slate',
    label: 'Slate',
    description: 'Neutral, enterprise',
    swatch: { light: '#475569', dark: '#94a3b8' },
  },
  {
    id: 'rose',
    label: 'Rose',
    description: 'Consumer',
    swatch: { light: '#e11d48', dark: '#fb7185' },
  },
  {
    id: 'brand',
    label: 'Brand',
    description: 'The project color from app.config.ts (branding.primaryColor)',
    swatch: { light: 'var(--brand-color)', dark: 'var(--brand-color)' },
  },
];

export const findThemePreset = (id: ThemePresetId): ThemePreset | undefined =>
  themePresets.find((preset) => preset.id === id);
