/** Theme vocabulary (docs/frontend/theme-system.md). Literal unions: a typo fails the type check. */

export type ColorMode = 'light' | 'dark' | 'system';
export type ResolvedColorMode = 'light' | 'dark';

export type ThemePresetId =
  'default' | 'emerald' | 'violet' | 'orange' | 'slate' | 'rose' | 'brand';

export type Radius = 'sharp' | 'small' | 'medium' | 'large' | 'pill';
export type Density = 'compact' | 'comfortable' | 'spacious';
export type FontOption = 'system' | 'inter' | 'custom';
export type ShadowStyle = 'none' | 'subtle' | 'elevated';
export type BorderStyle = 'none' | 'subtle' | 'strong';
export type SidebarStyle = 'classic' | 'minimal' | 'floating' | 'compact' | 'dark';
export type NavbarStyle = 'standard' | 'transparent' | 'bordered' | 'floating' | 'blurred';
export type CardStyle = 'bordered' | 'filled' | 'elevated' | 'minimal';
export type InputStyle = 'outlined' | 'filled' | 'underlined';
export type ButtonStyle = 'solid' | 'soft' | 'outline';

export interface Appearance {
  radius: Radius;
  density: Density;
  font: FontOption;
  shadows: ShadowStyle;
  borders: BorderStyle;
  sidebar: SidebarStyle;
  navbar: NavbarStyle;
  cards: CardStyle;
  inputs: InputStyle;
  buttons: ButtonStyle;
}

export type AppearanceOption = keyof Appearance;

export interface ThemeState {
  mode: ColorMode;
  preset: ThemePresetId;
  appearance: Appearance;
}

export interface ThemePreset {
  id: ThemePresetId;
  label: string;
  description: string;
  /** Swatch shown in the theme customizer (light / dark primary color). */
  swatch: { light: string; dark: string };
}

export interface ThemeConfig {
  /** What every user starts with. */
  defaults: ThemeState;
  /** What end users may change themselves (the rest is fixed by the project). */
  userCustomizable: {
    mode: boolean;
    preset: boolean;
    appearance: readonly AppearanceOption[];
  };
  /** Presets offered in the customizer, in this order. */
  presets: readonly ThemePresetId[];
}

/** Every allowed value per appearance option (runtime validation, customizer pickers). */
export const APPEARANCE_VALUES: { readonly [K in AppearanceOption]: readonly Appearance[K][] } = {
  radius: ['sharp', 'small', 'medium', 'large', 'pill'],
  density: ['compact', 'comfortable', 'spacious'],
  font: ['system', 'inter', 'custom'],
  shadows: ['none', 'subtle', 'elevated'],
  borders: ['none', 'subtle', 'strong'],
  sidebar: ['classic', 'minimal', 'floating', 'compact', 'dark'],
  navbar: ['standard', 'transparent', 'bordered', 'floating', 'blurred'],
  cards: ['bordered', 'filled', 'elevated', 'minimal'],
  inputs: ['outlined', 'filled', 'underlined'],
  buttons: ['solid', 'soft', 'outline'],
};

export const COLOR_MODES: readonly ColorMode[] = ['light', 'dark', 'system'];
