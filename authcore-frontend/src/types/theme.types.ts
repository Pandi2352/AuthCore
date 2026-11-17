/** Theme vocabulary (docs/frontend/theme-system.md). Literal unions: a typo fails the type check. */

export type ColorMode = 'light' | 'dark' | 'system';
export type ResolvedColorMode = 'light' | 'dark';

export type ThemePresetId =
  | 'default'
  | 'emerald'
  | 'violet'
  | 'orange'
  | 'slate'
  | 'rose'
  | 'indigo'
  | 'sky'
  | 'teal'
  | 'pink'
  | 'amber'
  | 'lime'
  | 'brand'
  /** The user's own color (appearance.customColor). */
  | 'custom';

export type Radius = 'sharp' | 'small' | 'medium' | 'large' | 'pill';
export type Density = 'compact' | 'comfortable' | 'spacious';
/** Typefaces users can pick (families / Google Fonts in config/fonts.ts). */
export const FONT_IDS = [
  'inter',
  'system',
  'serif',
  'mono',
  'roboto',
  'open-sans',
  'lato',
  'poppins',
  'montserrat',
  'nunito-sans',
  'source-sans',
  'ibm-plex-sans',
  'work-sans',
  'manrope',
  'dm-sans',
  'plus-jakarta',
  'figtree',
  'outfit',
  'merriweather',
  'lora',
  'custom',
] as const;
export type FontOption = (typeof FONT_IDS)[number];
/** Base text size in px (14 = default); the whole UI scales with it. */
export type TextSize = '13' | '14' | '15' | '16' | '17' | '18';
export type ContrastLevel = 'standard' | 'high';
export type ContentWidth = 'fluid' | 'boxed' | 'narrow';
export type SidebarPosition = 'left' | 'right';
/** On / off preference (stored as a string like every appearance value). */
export type Toggle = 'on' | 'off';
export type ShadowStyle = 'none' | 'subtle' | 'elevated';
export type BorderStyle = 'none' | 'subtle' | 'strong';
/** The same four looks for the sidebar and the navbar. */
export type SidebarStyle = 'classic' | 'minimal' | 'floating' | 'compact';
export type NavbarStyle = 'classic' | 'minimal' | 'floating' | 'compact';
export type CardStyle = 'bordered' | 'filled' | 'elevated' | 'minimal';
export type InputStyle = 'outlined' | 'filled' | 'underlined';
export type ButtonStyle = 'solid' | 'soft' | 'outline';
/** Navigation icons: classic (lucide outline), modern (Phosphor), duotone (Phosphor two-tone), color (two-tone, one color per item). */
export type IconStyle = 'classic' | 'modern' | 'duotone' | 'color';

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
  icons: IconStyle;
  fontSize: TextSize;
  contrast: ContrastLevel;
  contentWidth: ContentWidth;
  sidebarPosition: SidebarPosition;
  navbarSearch: Toggle;
  breadcrumbs: Toggle;
  striped: Toggle;
  gradientButtons: Toggle;
  strongFocus: Toggle;
  reduceMotion: Toggle;
  tooltips: Toggle;
  /** Dark between 7 PM and 6 AM (when mode is light or system). */
  autoDark: Toggle;
  /** #rrggbb for the "custom" preset ('' = none). */
  customColor: string;
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
  font: FONT_IDS,
  shadows: ['none', 'subtle', 'elevated'],
  borders: ['none', 'subtle', 'strong'],
  sidebar: ['classic', 'minimal', 'floating', 'compact'],
  navbar: ['classic', 'minimal', 'floating', 'compact'],
  cards: ['bordered', 'filled', 'elevated', 'minimal'],
  inputs: ['outlined', 'filled', 'underlined'],
  buttons: ['solid', 'soft', 'outline'],
  icons: ['classic', 'modern', 'duotone', 'color'],
  fontSize: ['13', '14', '15', '16', '17', '18'],
  contrast: ['standard', 'high'],
  contentWidth: ['fluid', 'boxed', 'narrow'],
  sidebarPosition: ['left', 'right'],
  navbarSearch: ['on', 'off'],
  breadcrumbs: ['on', 'off'],
  striped: ['on', 'off'],
  gradientButtons: ['on', 'off'],
  strongFocus: ['on', 'off'],
  reduceMotion: ['on', 'off'],
  tooltips: ['on', 'off'],
  autoDark: ['on', 'off'],
  /** Free value: any #rrggbb (validated in theme-core). */
  customColor: [],
};

export const COLOR_MODES: readonly ColorMode[] = ['light', 'dark', 'system'];
