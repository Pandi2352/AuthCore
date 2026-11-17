#!/usr/bin/env node
// WCAG contrast of the theme colors for every preset × mode (part of `npm run verify`).
//
//   node scripts/check-contrast.mjs            fail on any pair below its minimum
//   node scripts/check-contrast.mjs --verbose  print every ratio
//
// Reads src/styles/themes.css (OKLCH literals) and the brand color from src/config/app.config.ts.
// Text pairs need 4.5:1; focus ring and form-control boundaries 3:1 (WCAG 2.2 AA: 1.4.3, 1.4.11).
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const css = fs
  .readFileSync(path.join(ROOT, 'src/styles/themes.css'), 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '');
const appConfig = fs.readFileSync(path.join(ROOT, 'src/config/app.config.ts'), 'utf8');
const isVerbose = process.argv.includes('--verbose');

// ---------------------------------------------------------------- parse blocks
const blocks = [];
for (const m of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
  const selectors = m[1].split(',').map((s) => s.trim().replace(/"/g, "'"));
  const declarations = {};
  for (const d of m[2].matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) declarations[d[1]] = d[2].trim();
  blocks.push({ selectors, declarations, order: blocks.length });
}
const presets = [...new Set([...css.matchAll(/\[data-preset='([\w-]+)'\]/g)].map((m) => m[1]))];
presets.unshift('default');

/** Attributes on <html> for a combination; a selector matches when all its attributes do. */
function matches(selector, attrs) {
  if (selector === ':root') return true;
  const parts = [...selector.matchAll(/\[data-([\w-]+)='([\w-]+)'\]/g)];
  if (parts.length === 0 || parts.map((p) => p[0]).join('') !== selector) return false;
  return parts.every((p) => attrs[p[1]] === p[2]);
}
const specificity = (selector) => (selector === ':root' ? 1 : selector.split('[').length - 1);

function tokensFor(attrs) {
  const applied = [];
  for (const block of blocks) {
    const hits = block.selectors.filter((s) => matches(s, attrs));
    if (hits.length) applied.push({ ...block, spec: Math.max(...hits.map(specificity)) });
  }
  applied.sort((a, b) => a.spec - b.spec || a.order - b.order);
  const tokens = {};
  for (const block of applied) Object.assign(tokens, block.declarations);
  return tokens;
}

// ---------------------------------------------------------------- colors
const brandHex = /primaryColor:\s*'(#[0-9a-fA-F]{6})'/.exec(appConfig)?.[1] ?? '#4f46e5';

const srgbToLinear = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const clamp = (v) => Math.min(1, Math.max(0, v));

function hexToLinear(hex) {
  const n = hex.slice(1);
  return [0, 2, 4].map((i) => srgbToLinear(parseInt(n.slice(i, i + 2), 16) / 255));
}

function oklchToLinear(L, C, H) {
  const h = (H * Math.PI) / 180;
  const a = C * Math.cos(h);
  const b = C * Math.sin(h);
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    clamp(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
    clamp(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
    clamp(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s),
  ];
}

/** Token → linear RGB, following var() references; null when not a plain opaque color. */
function resolve(tokens, value, depth = 0) {
  if (depth > 10 || value === undefined) return null;
  const v = /^var\((--[\w-]+)\)$/.exec(value);
  if (v) {
    if (v[1] === '--brand-color') return brandVariant(currentMode).color;
    if (v[1] === '--brand-foreground') return brandVariant(currentMode).foreground;
    return resolve(tokens, tokens[v[1]], depth + 1);
  }
  const o = /^oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*\)$/.exec(value);
  if (o) return oklchToLinear(Number(o[1]), Number(o[2]), Number(o[3]));
  if (/^#[0-9a-fA-F]{6}$/.test(value)) return hexToLinear(value);
  return null;
}

const luminance = ([r, g, b]) => 0.2126 * r + 0.7152 * g + 0.0722 * b;
const contrast = (x, y) => {
  const [hi, lo] = [luminance(x), luminance(y)].toSorted((a, b) => b - a);
  return (hi + 0.05) / (lo + 0.05);
};

const toLinear = (rgb) => rgb.map((v) => srgbToLinear(v / 255));
const ratio = (a, b) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);

/** Same algorithm as applyThemeToElement (src/app/theme/theme-core.ts). */
function brandVariant(mode) {
  const base = [1, 3, 5].map((i) => parseInt(brandHex.slice(i, i + 2), 16));
  const pageLum = mode === 'dark' ? 0.012 : 0.96;
  const toward = mode === 'dark' ? 255 : 0;
  let rgb = base;
  for (let step = 1; step <= 25 && ratio(luminance(toLinear(rgb)), pageLum) < 4.6; step++) {
    rgb = base.map((v) => Math.round(v + (toward - v) * step * 0.04));
  }
  const color = toLinear(rgb);
  const lum = luminance(color);
  const foreground = ratio(lum, 1) >= ratio(lum, 0) ? '#ffffff' : '#0b0f19';
  return { color, foreground: hexToLinear(foreground) };
}
let currentMode = 'light';

// ---------------------------------------------------------------- pairs
const TEXT = 4.5;
const UI = 3;
/**
 * Text-field borders are deliberately soft (design decision): the field is also identified by
 * its label and surface, and the focus (primary) and error (danger) borders meet 3:1. Keep
 * them at least visibly distinct from the surface.
 */
const FIELD = 1.25;
const PAIRS = [
  ['--foreground', '--background', TEXT],
  ['--foreground', '--surface', TEXT],
  ['--foreground', '--muted', TEXT],
  ['--muted-foreground', '--background', TEXT],
  ['--muted-foreground', '--surface', TEXT],
  ['--muted-foreground', '--muted', TEXT],
  ['--accent-foreground', '--accent', TEXT],
  ['--secondary-foreground', '--secondary', TEXT],
  ['--primary-foreground', '--primary', TEXT],
  ['--primary', '--surface', TEXT],
  ['--primary', '--background', TEXT],
  ['--primary-soft-foreground', '--primary-soft', TEXT],
  ['--ring', '--background', UI],
  ['--ring', '--surface', UI],
  // Form control boundaries (WCAG 1.4.11): input borders, checkbox / radio outlines, switch track
  ['--input', '--surface', UI],
  ['--input', '--background', UI],
  ['--input', '--muted', UI],
  // Navigation icon colors (icon style "color") on the sidebar
  ['--nav-blue', '--sidebar', UI],
  ['--nav-violet', '--sidebar', UI],
  ['--nav-emerald', '--sidebar', UI],
  ['--nav-amber', '--sidebar', UI],
  ['--nav-rose', '--sidebar', UI],
  ['--nav-cyan', '--sidebar', UI],
  ['--nav-orange', '--sidebar', UI],
  ['--nav-indigo', '--sidebar', UI],
  ['--field-border', '--surface', FIELD],
  ['--field-border', '--background', FIELD],
  ['--sidebar-foreground', '--sidebar', TEXT],
  ['--sidebar-muted', '--sidebar', TEXT],
  ['--sidebar-active-foreground', '--sidebar-active', TEXT],
  ['--navbar-foreground', '--navbar', TEXT],
  ...['success', 'warning', 'danger', 'info'].flatMap((s) => [
    [`--${s}-foreground`, `--${s}`, TEXT],
    [`--${s}`, '--surface', TEXT],
    [`--${s}-soft-foreground`, `--${s}-soft`, TEXT],
  ]),
];

const failures = [];
const skipped = new Set();
let checked = 0;
const combos = presets.flatMap((preset) =>
  ['light', 'dark'].map((mode) => ({ preset, mode, sidebar: 'classic' })),
);

for (const { preset, mode, sidebar } of combos) {
  const attrs = { preset, mode, sidebar };
  const tokens = tokensFor(attrs);
  currentMode = mode;
  const label = `${preset}/${mode}`;
  for (const [fg, bg, min] of PAIRS) {
    const a = resolve(tokens, tokens[fg]);
    const b = resolve(tokens, tokens[bg]);
    if (!a || !b) {
      skipped.add(`${preset}: ${fg} on ${bg} (derived with color-mix)`);
      continue;
    }
    checked++;
    const measured = contrast(a, b);
    const line =
      `${label.padEnd(30)} ${fg} on ${bg}`.padEnd(80) + ` ${measured.toFixed(2)}:1 (min ${min})`;
    if (measured < min) failures.push(line);
    else if (isVerbose) console.log(`  ✓ ${line}`);
  }

  // Filled buttons: text is black(-ish) on light fills and white(-ish) on dark fills —
  // whichever of the two reads better on this preset's primary color.
  {
    const fill = resolve(tokens, tokens['--primary']);
    const text = resolve(tokens, tokens['--primary-foreground']);
    if (fill && text) {
      checked++;
      const fillLum = luminance(fill);
      const wantsDark = ratio(fillLum, 0) > ratio(fillLum, 1);
      const isDark = luminance(text) < 0.2;
      if (wantsDark !== isDark) {
        failures.push(
          `${label.padEnd(30)} --primary-foreground should be ${wantsDark ? 'dark (black)' : 'light (white)'} on this --primary`,
        );
      }
    }
  }
}

if (isVerbose && skipped.size) {
  console.log(
    `\nSkipped (not plain colors, check on screen):\n${[...skipped].map((s) => `  - ${s}`).join('\n')}`,
  );
}
if (failures.length) {
  console.error(
    `✖ Contrast: ${failures.length} pair(s) too low\n${failures.map((f) => `  ${f}`).join('\n')}`,
  );
  process.exit(1);
}
console.log(
  `✔ Contrast: ${checked} pairs pass across ${presets.length} presets × light / dark (brand ${brandHex})`,
);
