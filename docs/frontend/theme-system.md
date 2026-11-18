# AuthCore Frontend — Theme System

How the starter kit changes its whole look without touching components.

> **Project defaults:** corners are `rounded-md` everywhere (`radius: 'medium'` = 6px) and there are **no shadows** (`shadows: 'none'`). Components use only `rounded-md` (`rounded-full` for circles: avatars, dots) and only the themed `shadow-card` / `shadow-popover`; `npm run check:architecture` rejects any other `rounded-*` / `shadow-*` class. A project that wants shadows changes one value in `theme.config.ts`.

**Files:** tokens `src/styles/tokens.css` · values `themes.css` / `appearance.css` · element defaults `base.css` · runtime `src/app/theme/` (`theme-core.ts` pure logic shared with the no-flash script, `theme-options.ts`, `ThemeProvider.tsx`, `useTheme.ts`) · storage `src/lib/storage.ts` · UI `components/common/ThemeToggle.tsx`, `ThemeCustomizer.tsx`, page `pages/settings/Appearance.tsx`.

## Three independent axes

| Axis | Values | Stored as | Changes |
| --- | --- | --- | --- |
| **Color mode** | `light` · `dark` · `system` | `<html data-mode="light|dark">` (system resolved at runtime) | Background / foreground lightness |
| **Preset** | `default` (blue) · `indigo` · `violet` · `pink` · `rose` · `orange` · `amber` · `lime` · `emerald` · `teal` · `sky` · `slate` · custom brand | `<html data-preset="…">` | Brand and accent colors |
| **Appearance** | radius, density, font, sidebar / navbar / card / input / button styles | `<html data-radius="…" data-density="…">` + layout config | Shape, spacing, component styles |

They never depend on each other: any preset works in light and dark and with any appearance. Components only read **tokens**, so they don't know which preset, mode or style is active.

```text
config/theme.config.ts ─┐                         ┌─ styles/tokens.css   (@theme: names → var(--…))
user choice (storage) ──┼─► ThemeProvider ─► <html data-mode data-preset data-radius data-density …>
system preference ──────┘                         ├─ styles/themes.css   ([data-preset][data-mode] → color values)
                                                  └─ styles/appearance.css ([data-radius] … → radius / spacing values)
                                                          │
                                       Tailwind utilities: bg-primary, text-foreground, rounded-md, border-border …
                                                          │
                                                     components/ui/*
```

## Design tokens

All tokens are CSS custom properties, registered in Tailwind v4's `@theme` so utilities are generated for them.

### Colors (semantic, each with a `-foreground` pair where text sits on it)

| Token | Use |
| --- | --- |
| `background` / `foreground` | Page |
| `surface` / `surface-foreground` | Raised areas (cards, panels) |
| `muted` / `muted-foreground` | Subtle backgrounds, secondary text |
| `primary` / `primary-foreground` | Main actions, active nav, focus accents |
| `primary-hover`, `primary-soft`, `primary-soft-foreground` | Hover, soft buttons, selected rows |
| `secondary` / `secondary-foreground` | Secondary actions |
| `accent` / `accent-foreground` | Hover backgrounds of menu items |
| `border`, `input`, `field`, `ring` | Borders; `input` = checkbox / radio / switch outlines (3:1); `field` = softer text-field and outline-button borders (focus = primary, error = danger); focus ring |
| `success`, `warning`, `danger`, `info` (+ `-foreground`, `-soft`) | Status, alerts, badges, toasts |
| `overlay` | Dialog / drawer backdrop |
| `sidebar`, `sidebar-foreground`, `sidebar-muted`, `sidebar-accent`, `sidebar-accent-foreground`, `sidebar-border`, `sidebar-active`, `sidebar-active-foreground` | Sidebar (can differ from the page, e.g. dark sidebar on a light app) |
| `navbar`, `navbar-foreground`, `navbar-border` | Navbar |
| `chart-1` … `chart-5` | Charts (Level 3) |

Rule: **no palette classes** (`bg-indigo-600`, `text-slate-500`) and **no hex values** in components. Lint / architecture check enforces it.

### Non-color tokens

| Group | Tokens | Driven by |
| --- | --- | --- |
| Radius | `--radius-base` → `rounded-md`; the other steps scale from it | `data-radius`: `sharp` (0) · `small` (4px) · `medium` (6px, default) · `large` (8px) · `pill` (14px) |
| Density / spacing | `h-control-sm/md/lg`, `p-page`, `p-card`, `gap-section`, `gap-form` | `data-density`: `compact` · `comfortable` · `spacious` |
| Typography | `--font-sans`, `--font-mono`, `--text-base-size`, heading scale | `theme.config.ts` font option |
| Shadows | `shadow-card`, `shadow-popover` (every Tailwind `shadow-*` step maps to the same setting) | `data-shadow`: `none` (default) · `subtle` · `elevated` |
| Borders | `--border-width`, `--border-strength` | `data-borders`: `none` · `subtle` · `strong` |
| Layout | `--sidebar-width`, `--sidebar-width-collapsed`, `--navbar-height`, `--content-max-width` | `layout.config.ts` |
| Motion | `--duration-fast/normal`, `--ease-standard` | `0ms` under `prefers-reduced-motion` |
| Z-index | `--z-sidebar`, `--z-navbar`, `--z-dropdown`, `--z-overlay`, `--z-modal`, `--z-toast` | fixed scale |

## CSS layout (Tailwind v4)

```css
/* styles/index.css — import order only */
@import "tailwindcss";
@import "./tokens.css";
@import "./themes.css";
@import "./appearance.css";
@import "./base.css";
@import "./utilities.css";

/* Dark mode follows the user's choice, not only the OS */
@custom-variant dark (&:where([data-mode="dark"], [data-mode="dark"] *));
```

```css
/* styles/tokens.css — names Tailwind knows; values come from themes / appearance */
@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  /* … every semantic color … */
  --radius-md: var(--radius-base);
  --font-sans: var(--font-family-sans);
}
```

```css
/* styles/themes.css — one block per preset × mode (OKLCH: even lightness steps) */
:root,
[data-preset="default"] {
  --primary: oklch(0.55 0.2 260);
  --primary-foreground: oklch(0.98 0 0);
  --background: oklch(1 0 0);
  --foreground: oklch(0.2 0.02 260);
  /* … */
}
[data-preset="default"][data-mode="dark"] {
  --primary: oklch(0.68 0.17 260);
  --background: oklch(0.17 0.02 260);
  --foreground: oklch(0.96 0.01 260);
  /* … */
}
[data-preset="emerald"] { --primary: oklch(0.6 0.15 160); /* … */ }
```

Hover shades use `color-mix(in oklch, var(--primary) 86%, black)`. Every color that text sits on is a literal OKLCH value, so `npm run check:contrast` can verify it. Neutrals and status colors are shared; a preset only overrides the primary family (`--primary`, `--primary-foreground`, `--primary-soft`, `--primary-soft-foreground`) in light and dark.

The **brand** preset takes `branding.primaryColor` from `app.config.ts`. At runtime it is darkened (light mode) or lightened (dark mode) only as much as needed to reach 4.5:1 against the page, and the text on it is black or white, whichever contrasts more. So any brand color works in both modes.

## Presets

| Preset | Character | Primary |
| --- | --- | --- |
| `default` | Clean SaaS | Blue |
| `emerald` | Business dashboard | Green |
| `violet` | Modern product | Violet |
| `orange` | Warm, friendly | Orange |
| `slate` | Neutral / enterprise | Gray-blue |
| `rose` | Consumer | Rose |
| `brand` | The project's own color from `app.config.ts` → `brand.primaryColor` | Any |

Each preset defines **every** color token for light and dark. `config/theme.presets.ts` holds the metadata (id, label, swatch, `isDark`-friendly) used by the customizer; the CSS holds the values. A preset that misses a token falls back to `default` (the `:root` block).

### Adding a preset

1. Add the light and dark blocks to `styles/themes.css`.
2. Register it in `config/theme.presets.ts` (`id`, `label`, `swatch`).
3. Open `/dev/ui`: check every component in light and dark; text contrast ≥ 4.5:1 (focus ring and borders ≥ 3:1).

## Appearance

| Option | Values | Effect |
| --- | --- | --- |
| `radius` | `sharp` · `small` · `medium` · `large` · `pill` | All `rounded-*` tokens |
| `density` | `compact` · `comfortable` · `spacious` | Control heights, paddings, table row height, page spacing |
| `font` | `inter` · `system` · `serif` · `mono` + 16 more (`config/fonts.ts`) · `custom` | `--font-family-sans` set on `<html>`; the chosen Google font's stylesheet (`<link id="theme-font">`) is loaded **only when that font is selected** — no font requests otherwise. `custom` = your `--font-custom` `@font-face` |
| `fontSize` | `13` … `18` (px) | Root font size (`14` = 100 %); the whole rem-based UI scales |
| `shadows` | `none` · `subtle` · `elevated` | Card / popover shadows |
| `borders` | `none` · `subtle` · `strong` | Border width / color strength |
| `sidebar` | `classic` · `minimal` · `floating` · `compact` | Sidebar look (the same four as the navbar) |
| `navbar` | `classic` · `minimal` · `floating` · `compact` | Navbar look: classic (bar + border) · minimal (no background / border) · floating (separate rounded bar) · compact (12 px shorter; the sidebar header follows) |
| `cards` | `bordered` · `filled` · `elevated` · `minimal` | Default `Card` variant |
| `inputs` | `outlined` · `filled` · `underlined` | Default `Input` / `Select` / `Textarea` variant |
| `buttons` | `solid` · `soft` · `outline` | Default `Button` variant for `intent="primary"` |
| `icons` | `classic` · `modern` · `duotone` · `color` | Navigation icons: lucide outline · Phosphor regular · Phosphor two-tone (fill in the primary color) · two-tone, one color per item (`iconColor` or picked from the id; tokens `--nav-<color>`, 3:1 on the sidebar) |
| `contrast` | `standard` · `high` | High: strong borders, field borders = input color, muted text closer to foreground |
| `contentWidth` | `fluid` · `boxed` · `narrow` | `--content-max-width`: none · 88 % · 72 % (replaces `layout.content.maxWidth`) |
| `sidebarPosition` | `left` · `right` | Sidebar side (desktop, drawer, tooltips, toggle icon); default from `layout.sidebar.position` |
| `navbarSearch` · `breadcrumbs` | `on` · `off` | Show the navbar search box / breadcrumbs (the config switches still win) |
| `striped` | `on` · `off` | Zebra rows in every table |
| `gradientButtons` | `on` · `off` | Gradient on solid buttons (`[data-variant='solid']`) |
| `strongFocus` | `on` · `off` | 3 px focus outline |
| `reduceMotion` | `on` · `off` | Turns off transitions / animations (on top of the OS setting) |
| `tooltips` | `on` · `off` | `Tooltip` renders only its trigger (accessible names stay) |
| `autoDark` | `on` · `off` | Light mode turns dark 19:00 – 06:00 (provider clock + no-flash script) |
| `customColor` | `''` or `#rrggbb` | The user's own accent: used when preset = `custom` (same contrast correction as `brand`) |

### Appearance page

`Settings → Appearance` (`features/settings`) edits all of the above: quick presets (`config/appearance-presets.ts`: Default, Midnight, Sunrise, Forest, Ocean, High contrast — each = project defaults + a few changes, applied in one `applyTheme()` call), mode, accent chips + custom color, radius, density, sidebar / navbar style, icons, typography, contrast & effects, preferences, a live preview, a configuration summary, and a live WCAG contrast check of the rendered colors. "Copy settings" copies the theme JSON; "Reset to default" restores `theme.config.ts`. Settings are saved in this browser (`storageKey`); "Sync across devices" is shown disabled until the account preferences API stores appearance.

Components read the defaults from the theme context (`useTheme().appearance.cards`) when no explicit `variant` prop is given, so `<Card>` follows the configuration while `<Card variant="filled">` still works.

Switching appearance must never change layout dimensions unexpectedly: control heights come from the density tokens, borders reserve their width (transparent when hidden).

## One application look (super admin)

The look is the same for everyone and is set by the super admin on **Settings → Appearance** (route and menu need `APPEARANCE_SETTINGS_MANAGE`; the ADMIN role always has it). Other users don't see the page.

- **Stored on the server** (`GET /settings/appearance/public`, no sign-in; `PUT /settings/appearance`), cached in localStorage (`<slug>:theme-org:v1`) and applied before the first paint — also on the sign-in pages.
- **Editing:** every change on the page applies at once and is saved automatically ~1 s later (`AppearanceSync`; header chip: Applies to everyone · Saving… · Saved for everyone). *Reset to default* puts everyone back on `theme.config.ts` (after a confirmation).
- **Personal light / dark:** the only per-person choice (navbar toggle, user menu, command menu → `setMode`), stored per browser (`<slug>:theme:v2`). The Mode card on the Appearance page sets everyone's *default* mode (`setDefaultMode`).

How it works: the cached look is applied through `withOrganization(options, look)` with every option locked except `mode`, so `resolveThemeState` (and the no-flash script) always use the application look. `useTheme()` → `organization` (the look), `defaultMode`, `canEdit` (set from the permission), `setOrganization()`; the look setters (`setPreset`, `setAppearance`, `applyTheme`, `reset`, `setDefaultMode`) only act when `canEdit`. Backend: `modules/appearance` (known option keys + value shape; the frontend applies only whitelisted values).

## Configuration

```ts
// config/theme.config.ts
import type { ThemeConfig } from '@/types/theme.types';

export const themeConfig: ThemeConfig = {
  defaults: {
    mode: 'system',
    preset: 'default',
    appearance: {
      radius: 'medium',
      density: 'comfortable',
      font: 'system',
      shadows: 'none',
      borders: 'subtle',
      sidebar: 'classic',
      navbar: 'standard',
      cards: 'bordered',
      inputs: 'outlined',
      buttons: 'solid',
    },
  },
  /** What end users may change (the rest is fixed by the project). */
  userCustomizable: {
    mode: true,
    preset: true,
    appearance: ['radius', 'density'], // + 'sidebar' once the sidebar exists (module 7)
  },
  /** Presets offered in the customizer (all registered presets if omitted). */
  presets: ['default', 'emerald', 'violet', 'orange', 'brand'],
};
```

Types are unions of literal strings (`type Radius = 'sharp' | 'small' | …`), so a typo fails the type check. Persisted values are validated on load; unknown values fall back to the defaults (no broken theme after a release removes an option).

## ThemeProvider

- Resolves `system` with `matchMedia('(prefers-color-scheme: dark)')` and listens for changes.
- Applies `data-mode`, `data-preset`, `data-radius`, `data-density`, `data-shadow`, `data-borders`, `data-font` on `<html>`; sets `color-scheme` and `<meta name="theme-color">`.
- Persists the user's choice through `lib/storage.ts` under `<slug>:theme:v1` (only the axes the project allows users to change; everything else always follows `theme.config.ts`).
- Syncs across tabs (`storage` event).
- Exposes `useTheme()` → `{ mode, resolvedMode, preset, appearance, setMode, setPreset, setAppearance, reset }`.
- Pure helpers in `theme-core.ts` (`resolveThemeState`, `applyThemeToElement`) keep the React part thin.
- Components outside `app/` may import only `@/app/theme` (the public index).

## No-flash loading

The theme must be applied **before** React renders, or users see a white flash in dark mode. A small inline script (≈4 KB) is injected first in `<head>` at build by the `themeNoFlash` Vite plugin. It is built from the **same** `resolveThemeState` / `applyThemeToElement` functions the provider uses (`theme-core.ts`, serialized with `toString()`, so they must stay self-contained), reads the stored choice, resolves `system`, and sets the `data-*` attributes, `color-scheme` and the `theme-color` meta on `<html>`. With a CSP, the script is allowed by its hash.

## Sidebar and navbar styles

Sidebar and navbar have their own tokens (`--sidebar-*`, `--navbar-*`), so a project can use a dark sidebar with a light page (`sidebar: 'dark'`) or a transparent navbar over a colored header, without special cases in components. `layout.config.ts` sets size and behavior (width, collapsed width, sticky / fixed, position left / right); the theme sets the look.

## Checklist

- [x] Tokens defined in `tokens.css` and mapped in `@theme inline`.
- [x] 13 presets for light and dark: `default`, `indigo`, `violet`, `pink`, `rose`, `orange`, `amber`, `lime`, `emerald`, `teal`, `sky`, `slate`, `brand`. Filled-button text is black on light fills and white on dark fills (enforced by `check:contrast`).
- [x] Appearance attributes and their token values in `appearance.css`.
- [x] `dark` custom variant on `[data-mode="dark"]`.
- [x] `ThemeProvider`, `useTheme`, storage with validation and versioned key, cross-tab sync.
- [x] No-flash inline script; `color-scheme` and `theme-color` meta updated.
- [x] `ThemeToggle` (navbar) and `ThemeCustomizer` (Appearance page) respect `userCustomizable`.
- [ ] Components use defaults from `useTheme().appearance` when no variant prop is passed *(module 4, UI library)*.
- [x] Reduced-motion and focus-ring styles in `base.css`.
- [ ] `/dev/ui` kitchen-sink page shows every component; preset / mode / appearance switchers at the top *(module 4)*.
- [ ] Manual check: provider resolves system mode, persists, falls back on invalid stored values, applies attributes; pages reviewed in every preset × mode before each release.
- [x] Contrast check for every preset × mode (`npm run check:contrast`).
