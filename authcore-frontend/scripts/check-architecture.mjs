#!/usr/bin/env node
// Architecture rules the linter can't express (part of `npm run verify`).
//
//   node scripts/check-architecture.mjs           rules as errors, colors as warnings
//   node scripts/check-architecture.mjs --strict  colors as errors too (after the theme module)
//
// Rules (docs/frontend/folder-structure.md):
//   1. import.meta.env only in src/config/env.ts
//   2. fetch / XMLHttpRequest only in the API layer (src/lib/api/, src/lib/api-client.ts)
//   3. Layer boundaries: lib → no React / UI; hooks → no UI / features; components → no features / app / pages;
//      config → only types and other config; features → no other feature (except the auth public API), no app
//   4. Colors: no Tailwind palette classes (bg-indigo-600 …) or hex values outside config / styles
//   5. Project identity: the app name / slug from app.config.ts never hard-coded outside config/
//   6. Routes: no inline path strings in to="/…", href="/…", navigate('/…') — use paths from config/paths.ts
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const SRC = path.join(ROOT, 'src');
const isStrict = process.argv.includes('--strict');

const ENV_READER = 'src/config/env.ts';
const API_LAYER = [/^src\/lib\/api\//, /^src\/lib\/api-client\.ts$/];
/** App name and slug, read from src/config/app.config.ts (rule 5). */
const APP_CONFIG_SOURCE = fs.readFileSync(path.join(ROOT, 'src/config/app.config.ts'), 'utf8');
const IDENTITY = ['name', 'slug']
  .map((key) => new RegExp(`^\\s+${key}: '([^']+)'`, 'm').exec(APP_CONFIG_SOURCE)?.[1])
  .filter((value) => typeof value === 'string' && value.length >= 3);
const escapeRe = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const IDENTITY_RE = IDENTITY.length
  ? new RegExp(`\\b(?:${IDENTITY.map(escapeRe).join('|')})\\b`, 'g')
  : null;
/** Inline internal routes (rule 6). */
const INLINE_ROUTE = /\b(?:to|href)="\/|\bnavigate\(\s*['"`]\/|location\.href\s*=\s*['"`]\//g;

/** Where literal colors are allowed (configuration and token definitions). */
const COLOR_ALLOWED = [/^src\/config\//, /^src\/styles\//, /^src\/index\.css$/];

const PALETTE =
  /\b(?:bg|text|border|ring|from|to|via|fill|stroke|outline|divide|placeholder|shadow|accent|caret|decoration)-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|white|black)(?:-\d{2,3})?(?:\/\d{1,3})?\b/g;
const HEX = /(?<![\w&])#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})\b/g;
const IMPORT =
  /(?:import|export)\s[^'"]*?from\s*['"]([^'"]+)['"]|import\s*\(\s*['"]([^'"]+)['"]\s*\)|import\s+['"]([^'"]+)['"]/g;

/** Layer rules: files under `from` may not import modules matching `deny`. */
const BOUNDARIES = [
  {
    from: /^src\/lib\//,
    deny: [/^react(-dom)?$/, /^react\//, /^src\/(components|hooks|features|app|pages|context)\//],
    why: 'lib/ is plain TypeScript: no React, no UI, no features',
  },
  {
    from: /^src\/hooks\//,
    deny: [/^src\/(components|features|app|pages)\//],
    why: 'hooks/ are generic: no UI components, features or app wiring',
  },
  {
    from: /^src\/components\//,
    deny: [/^src\/(features|app|pages)\//],
    why: 'components/ are business-free: no features, app wiring or pages',
  },
  {
    from: /^src\/config\//,
    deny: [/^src\/(?!config\/|types\/)/],
    why: 'config/ only imports types and other config',
  },
  {
    from: /^src\/features\//,
    deny: [/^src\/app\//],
    why: 'features never import app wiring',
  },
];

const toPosix = (p) => p.split(path.sep).join('/');
const rel = (abs) => toPosix(path.relative(ROOT, abs));

function walk(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(abs));
    else if (/\.(tsx?|css)$/.test(entry.name) && !entry.name.endsWith('.d.ts')) out.push(abs);
  }
  return out;
}

/** Import specifier → "src/…" for project modules, or the package name for externals. */
function resolveImport(fromFile, spec) {
  if (spec.startsWith('@/')) return `src/${spec.slice(2)}`;
  if (spec.startsWith('.')) return rel(path.resolve(path.dirname(path.join(ROOT, fromFile)), spec));
  return spec;
}

const lineOf = (text, index) => text.slice(0, index).split('\n').length;

/** Blanks out comments (keeps strings, newlines and offsets), so rules only see code. */
function stripComments(text) {
  let out = '';
  let i = 0;
  let quote = null;
  while (i < text.length) {
    const c = text[i];
    const next = text[i + 1];
    if (quote) {
      out += c;
      if (c === '\\') {
        out += next ?? '';
        i += 2;
        continue;
      }
      if (c === quote) quote = null;
      i++;
    } else if (c === '"' || c === "'" || c === '`') {
      quote = c;
      out += c;
      i++;
    } else if (c === '/' && next === '/') {
      while (i < text.length && text[i] !== '\n') {
        out += ' ';
        i++;
      }
    } else if (c === '/' && next === '*') {
      while (i < text.length && !(text[i] === '*' && text[i + 1] === '/')) {
        out += text[i] === '\n' ? '\n' : ' ';
        i++;
      }
      out += '  ';
      i += 2;
    } else {
      out += c;
      i++;
    }
  }
  return out;
}
const errors = [];
const colorFindings = [];

for (const abs of walk(SRC)) {
  const file = rel(abs);
  const isCss = file.endsWith('.css');
  const text = stripComments(fs.readFileSync(abs, 'utf8'));

  if (!isCss) {
    // 1. Environment access
    if (file !== ENV_READER) {
      for (const m of text.matchAll(/import\.meta\.env/g)) {
        errors.push(
          `${file}:${lineOf(text, m.index)}  import.meta.env outside ${ENV_READER} (use \`env\` from '@/config/env')`,
        );
      }
    }
    // 5. Project identity
    if (IDENTITY_RE && !file.startsWith('src/config/')) {
      for (const m of text.matchAll(IDENTITY_RE)) {
        errors.push(
          `${file}:${lineOf(text, m.index)}  "${m[0]}" is the project name / slug: use appConfig from '@/config'`,
        );
      }
    }
    // 6. Inline routes
    if (!file.startsWith('src/config/')) {
      for (const m of text.matchAll(INLINE_ROUTE)) {
        errors.push(
          `${file}:${lineOf(text, m.index)}  inline route ${m[0].trim()}…: use paths from '@/config'`,
        );
      }
    }
    // 2. Network access
    if (!API_LAYER.some((re) => re.test(file))) {
      for (const m of text.matchAll(/\bfetch\s*\(|new\s+XMLHttpRequest\b/g)) {
        errors.push(
          `${file}:${lineOf(text, m.index)}  network call outside the API layer (use apiClient)`,
        );
      }
    }
    // 3. Boundaries
    for (const m of text.matchAll(IMPORT)) {
      const spec = m[1] ?? m[2] ?? m[3];
      if (!spec) continue;
      const target = resolveImport(file, spec);
      for (const rule of BOUNDARIES) {
        if (rule.from.test(file) && rule.deny.some((re) => re.test(target))) {
          errors.push(`${file}:${lineOf(text, m.index)}  imports "${spec}": ${rule.why}`);
        }
      }
      const fromFeature = /^src\/features\/([^/]+)\//.exec(file)?.[1];
      const toFeature = /^src\/features\/([^/]+)(\/.*)?$/.exec(target);
      if (fromFeature && toFeature && toFeature[1] !== fromFeature) {
        const isAuthPublicApi =
          toFeature[1] === 'auth' &&
          (toFeature[2] === undefined || toFeature[2] === '/index' || toFeature[2] === '/index.ts');
        if (!isAuthPublicApi) {
          errors.push(
            `${file}:${lineOf(text, m.index)}  imports "${spec}": features don't import other features (only '@/features/auth')`,
          );
        }
      }
    }
  }

  // 4. Literal colors
  if (!COLOR_ALLOWED.some((re) => re.test(file))) {
    for (const re of isCss ? [HEX] : [PALETTE, HEX]) {
      for (const m of text.matchAll(re)) {
        colorFindings.push(`${file}:${lineOf(text, m.index)}  ${m[0]}`);
      }
    }
  }
}

if (errors.length > 0) {
  console.error(`Architecture rules: ${errors.length} problem(s)\n`);
  for (const e of errors) console.error(`  ✖ ${e}`);
}
if (colorFindings.length > 0) {
  const files = new Set(colorFindings.map((f) => f.split(':')[0]));
  const label = isStrict ? '✖' : '⚠';
  console[isStrict ? 'error' : 'warn'](
    `\n${label} ${colorFindings.length} hard-coded color(s) in ${files.size} file(s): use design tokens (docs/frontend/theme-system.md).` +
      (isStrict
        ? ''
        : ' Warning until the theme module replaces them; --strict makes it an error.'),
  );
  if (isStrict || process.argv.includes('--verbose')) {
    for (const f of colorFindings) console.error(`    ${f}`);
  }
}
const hasFailed = errors.length > 0 || (isStrict && colorFindings.length > 0);
if (!hasFailed)
  console.log(`✔ Architecture rules passed${colorFindings.length ? ' (with color warnings)' : ''}`);
process.exit(hasFailed ? 1 : 0);
