#!/usr/bin/env node
// Turn a copy of this frontend into a new project (the backend has the same command).
//
//   npm run project:init -- --name "Nexa CRM" --slug nexa-crm
//   npm run project:init -- --name "Nexa CRM" --slug nexa-crm --short-name Nexa \
//     --description "Customer relationships, simplified" --color "#0f766e" \
//     --support-email support@nexacrm.com --company "Nexa Software" --website https://nexacrm.com \
//     --language en --timezone Asia/Kolkata
//   add --dry-run to only show what would change.
//
// Updates src/config/app.config.ts and the package name. Use the same name / slug as the
// backend (authcore-backend: npm run project:init). Prints what is left to do by hand.
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const APP_CONFIG = path.join(ROOT, 'src', 'config', 'app.config.ts');

const SLUG = /^[a-z][a-z0-9-]{1,30}[a-z0-9]$/;
const HEX = /^#[0-9a-fA-F]{6}$/;
const LANGUAGE = /^[a-z]{2,3}(-[A-Z]{2})?$/;
const EMAIL = /^[^\s@]+@[^\s@]+$/;
const URL_RE = /^https?:\/\/\S+$/;

function parseArgs(argv) {
  const args = { flags: new Set() };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) continue;
    const key = a.slice(2);
    if (['dry-run', 'help'].includes(key)) args.flags.add(key);
    else args[key] = argv[++i];
  }
  return args;
}

const fail = (message) => {
  console.error(`project:init: ${message}`);
  process.exit(1);
};

const isTimeZone = (value) => {
  try {
    return new Intl.DateTimeFormat('en', { timeZone: value }).resolvedOptions().timeZone !== '';
  } catch {
    return false;
  }
};

/** "none" → null (clears an optional field). */
const optional = (value) => (value === undefined ? undefined : value === 'none' ? null : value);

const args = parseArgs(process.argv.slice(2));
if (args.flags.has('help') || !args.name || !args.slug) {
  console.log(
    [
      'Usage: npm run project:init -- --name "Nexa CRM" --slug nexa-crm [options]',
      '  --short-name Nexa              --description "…"',
      '  --color "#0f766e"              brand color (branding.primaryColor)',
      '  --support-email a@b.com        --company "…"   --website https://…   (use "none" to clear)',
      '  --language en                  --timezone Asia/Kolkata',
      '  --dry-run                      show the changes only',
    ].join('\n'),
  );
  process.exit(args.flags.has('help') ? 0 : 1);
}

const name = args.name.trim();
const slug = args.slug.trim();
const shortName = (args['short-name'] ?? name).trim();
const supportEmail = optional(args['support-email']);
const company = optional(args.company);
const website = optional(args.website);
if (!name || name.length > 50) fail('--name must be 1–50 characters');
if (!SLUG.test(slug))
  fail('--slug must be lowercase letters, digits and "-" (3–32 characters), e.g. nexa-crm');
if (!shortName || shortName.length > 20) fail('--short-name must be 1–20 characters');
if (args.color !== undefined && !HEX.test(args.color)) fail('--color must look like #0f766e');
if (supportEmail && !EMAIL.test(supportEmail)) fail('--support-email is not an email address');
if (website && !URL_RE.test(website)) fail('--website must be an http(s) URL');
if (args.language !== undefined && !LANGUAGE.test(args.language))
  fail('--language must look like "en" or "en-IN"');
if (args.timezone !== undefined && !isTimeZone(args.timezone))
  fail(`--timezone "${args.timezone}" is not an IANA time zone`);

const quote = (value) =>
  value === null ? 'null' : `'${value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;

/** Replace `  key: <value>,` at the given indentation (top level = 2, nested = 4). */
function setField(source, key, value, indent) {
  if (value === undefined) return source;
  const re = new RegExp(`^(${' '.repeat(indent)}${key}: )(?:'(?:[^'\\\\]|\\\\.)*'|null)(,)$`, 'm');
  if (!re.test(source))
    fail(`could not find "${key}" in src/config/app.config.ts (was the file restructured?)`);
  return source.replace(re, `$1${quote(value)}$2`);
}

const changes = [];
const isDryRun = args.flags.has('dry-run');
function write(file, content, note) {
  const abs = path.join(ROOT, file);
  if (fs.existsSync(abs) && fs.readFileSync(abs, 'utf8') === content) return;
  changes.push(`${file}: ${note}`);
  if (!isDryRun) fs.writeFileSync(abs, content);
}

// 1. app.config.ts
let config = fs.readFileSync(APP_CONFIG, 'utf8');
config = setField(config, 'name', name, 2);
config = setField(config, 'shortName', shortName, 2);
config = setField(config, 'slug', slug, 2);
config = setField(config, 'description', args.description, 2);
config = setField(config, 'primaryColor', args.color, 4);
config = setField(config, 'companyName', company, 4);
config = setField(config, 'supportEmail', supportEmail, 4);
config = setField(config, 'websiteUrl', website, 4);
config = setField(config, 'defaultLanguage', args.language, 4);
config = setField(config, 'defaultTimeZone', args.timezone, 4);
write('src/config/app.config.ts', config, `name "${name}", slug "${slug}"`);

// 2. package name
const packageName = `${slug}-frontend`;
for (const file of ['package.json', 'package-lock.json']) {
  const abs = path.join(ROOT, file);
  if (!fs.existsSync(abs)) continue;
  const json = JSON.parse(fs.readFileSync(abs, 'utf8'));
  json.name = packageName;
  if (json.packages?.['']) json.packages[''].name = packageName;
  write(file, `${JSON.stringify(json, null, 2)}\n`, `name "${packageName}"`);
}

// 3. Report
console.log(isDryRun ? '\nWould change:' : '\nChanged:');
console.log(
  changes.length ? changes.map((c) => `  - ${c}`).join('\n') : '  (nothing: already up to date)',
);
console.log(`
Still to do by hand (docs/new-project-guide.md):
  - Backend: same name / slug (authcore-backend: npm run project:init -- --name "${name}" --slug ${slug}).
  - Logos: public/brand/ (logo.svg, logo-dark.svg, logo-mark.svg) → app.config.ts "logos"; favicon in public/.
  - Navigation: src/config/navigation.config.ts (your modules and pages).
  - Feature toggles: src/config/features.config.ts ("auth" must match the backend .env).
  - Look: src/config/theme.config.ts (preset, appearance) and layout.config.ts.
  - Environment: .env from .env.example (VITE_API_BASE_URL); proxy target in vite.config.ts.
  - Then: npm run verify.
`);
