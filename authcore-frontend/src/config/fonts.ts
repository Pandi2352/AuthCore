import type { FontOption } from '../types/theme.types.ts';

/**
 * Typefaces users can pick on the Appearance page (theme appearance.font).
 * `google`: the family spec loaded from Google Fonts ONLY when that font is selected
 * (no request otherwise); null = installed on the device / defined by the project.
 */
export interface FontDefinition {
  id: FontOption;
  label: string;
  /** Short description on the font card. */
  note: string;
  category: 'sans' | 'serif' | 'mono';
  /** CSS font-family value (with fallbacks). */
  family: string;
  google: string | null;
}

const SANS = "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";
const SERIF = "ui-serif, Georgia, Cambria, 'Times New Roman', serif";
const MONO = "ui-monospace, SFMono-Regular, Menlo, Consolas, 'Liberation Mono', monospace";
const W = ':wght@400;500;600;700';

export const FONTS: readonly FontDefinition[] = [
  // Featured (cards)
  {
    id: 'inter',
    label: 'Inter',
    note: 'Clean sans',
    category: 'sans',
    family: `'Inter', ${SANS}`,
    google: `Inter${W}`,
  },
  {
    id: 'system',
    label: 'System UI',
    note: 'Native look',
    category: 'sans',
    family: SANS,
    google: null,
  },
  {
    id: 'serif',
    label: 'Serif',
    note: 'Editorial',
    category: 'serif',
    family: `'Source Serif 4', ${SERIF}`,
    google: `Source+Serif+4${W}`,
  },
  {
    id: 'mono',
    label: 'Mono',
    note: 'Technical',
    category: 'mono',
    family: `'JetBrains Mono', ${MONO}`,
    google: `JetBrains+Mono${W}`,
  },
  // More professional typefaces
  {
    id: 'roboto',
    label: 'Roboto',
    note: 'Neutral, Android',
    category: 'sans',
    family: `'Roboto', ${SANS}`,
    google: `Roboto${W}`,
  },
  {
    id: 'open-sans',
    label: 'Open Sans',
    note: 'Friendly, readable',
    category: 'sans',
    family: `'Open Sans', ${SANS}`,
    google: `Open+Sans${W}`,
  },
  {
    id: 'lato',
    label: 'Lato',
    note: 'Warm, corporate',
    category: 'sans',
    family: `'Lato', ${SANS}`,
    google: 'Lato:wght@400;700',
  },
  {
    id: 'poppins',
    label: 'Poppins',
    note: 'Geometric, bold',
    category: 'sans',
    family: `'Poppins', ${SANS}`,
    google: `Poppins${W}`,
  },
  {
    id: 'montserrat',
    label: 'Montserrat',
    note: 'Urban, wide',
    category: 'sans',
    family: `'Montserrat', ${SANS}`,
    google: `Montserrat${W}`,
  },
  {
    id: 'nunito-sans',
    label: 'Nunito Sans',
    note: 'Soft, friendly',
    category: 'sans',
    family: `'Nunito Sans', ${SANS}`,
    google: `Nunito+Sans${W}`,
  },
  {
    id: 'source-sans',
    label: 'Source Sans 3',
    note: 'UI classic',
    category: 'sans',
    family: `'Source Sans 3', ${SANS}`,
    google: `Source+Sans+3${W}`,
  },
  {
    id: 'ibm-plex-sans',
    label: 'IBM Plex Sans',
    note: 'Engineered',
    category: 'sans',
    family: `'IBM Plex Sans', ${SANS}`,
    google: `IBM+Plex+Sans${W}`,
  },
  {
    id: 'work-sans',
    label: 'Work Sans',
    note: 'Plain, versatile',
    category: 'sans',
    family: `'Work Sans', ${SANS}`,
    google: `Work+Sans${W}`,
  },
  {
    id: 'manrope',
    label: 'Manrope',
    note: 'Modern, precise',
    category: 'sans',
    family: `'Manrope', ${SANS}`,
    google: `Manrope${W}`,
  },
  {
    id: 'dm-sans',
    label: 'DM Sans',
    note: 'Compact, crisp',
    category: 'sans',
    family: `'DM Sans', ${SANS}`,
    google: `DM+Sans${W}`,
  },
  {
    id: 'plus-jakarta',
    label: 'Plus Jakarta Sans',
    note: 'Contemporary',
    category: 'sans',
    family: `'Plus Jakarta Sans', ${SANS}`,
    google: `Plus+Jakarta+Sans${W}`,
  },
  {
    id: 'figtree',
    label: 'Figtree',
    note: 'Friendly geometric',
    category: 'sans',
    family: `'Figtree', ${SANS}`,
    google: `Figtree${W}`,
  },
  {
    id: 'outfit',
    label: 'Outfit',
    note: 'Brand-forward',
    category: 'sans',
    family: `'Outfit', ${SANS}`,
    google: `Outfit${W}`,
  },
  {
    id: 'merriweather',
    label: 'Merriweather',
    note: 'Readable serif',
    category: 'serif',
    family: `'Merriweather', ${SERIF}`,
    google: 'Merriweather:wght@400;700',
  },
  {
    id: 'lora',
    label: 'Lora',
    note: 'Elegant serif',
    category: 'serif',
    family: `'Lora', ${SERIF}`,
    google: `Lora${W}`,
  },
  // Project font: define --font-custom with @font-face in styles/base.css
  {
    id: 'custom',
    label: 'Project font',
    note: 'Brand typeface',
    category: 'sans',
    family: `var(--font-custom, ui-sans-serif), ${SANS}`,
    google: null,
  },
];

export const FEATURED_FONTS: readonly FontOption[] = ['inter', 'system', 'serif', 'mono'];

export const fontById = (id: FontOption): FontDefinition =>
  FONTS.find((f) => f.id === id) ?? (FONTS[1] as FontDefinition);

/** Google Fonts stylesheet URL for a font, or null. */
export const googleFontUrl = (font: FontDefinition): string | null =>
  font.google ? `https://fonts.googleapis.com/css2?family=${font.google}&display=swap` : null;
