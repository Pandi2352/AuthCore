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
    id: 'indigo',
    label: 'Indigo',
    description: 'Deep, focused',
    swatch: { light: '#4f46e5', dark: '#818cf8' },
  },
  {
    id: 'sky',
    label: 'Sky',
    description: 'Fresh, calm',
    swatch: { light: '#0369a1', dark: '#38bdf8' },
  },
  {
    id: 'teal',
    label: 'Teal',
    description: 'Health, finance',
    swatch: { light: '#0f766e', dark: '#2dd4bf' },
  },
  {
    id: 'pink',
    label: 'Pink',
    description: 'Playful, creative',
    swatch: { light: '#db2777', dark: '#f472b6' },
  },
  {
    id: 'amber',
    label: 'Amber',
    description: 'Warm, energetic',
    swatch: { light: '#b45309', dark: '#fbbf24' },
  },
  {
    id: 'lime',
    label: 'Lime',
    description: 'Natural, growth',
    swatch: { light: '#4d7c0f', dark: '#a3e635' },
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
