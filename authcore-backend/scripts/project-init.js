#!/usr/bin/env node
// Turn a copy of this backend into a new project.
//
//   npm run project:init -- --name "Shop X" --slug shop-x
//   npm run project:init -- --name "Shop X" --slug shop-x --db shopx --support-email help@shopx.com \
//                           --color "#0f766e" --reset-secrets
//   add --dry-run to only show what would change.
//
// Updates project.config.json, package.json / package-lock.json names, and the
// project-derived values in .env.example and .env (app name, database name,
// JWT issuer / audience, refresh cookie, mail sender). --reset-secrets puts new
// JWT / verification secrets into .env. Prints what is left to do by hand.
'use strict';
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const SLUG = /^[a-z][a-z0-9-]{1,30}[a-z0-9]$/;

function parseArgs(argv) {
  const args = { flags: new Set() };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) continue;
    const key = a.slice(2);
    if (['reset-secrets', 'dry-run', 'help'].includes(key)) args.flags.add(key);
    else args[key] = argv[++i];
  }
  return args;
}

function fail(message) {
  console.error(`project:init: ${message}`);
  process.exit(1);
}

const changes = [];
function write(file, content, note) {
  const abs = path.join(ROOT, file);
  if (fs.existsSync(abs) && fs.readFileSync(abs, 'utf8') === content) return;
  changes.push(`${file}: ${note}`);
  if (!args.flags.has('dry-run')) fs.writeFileSync(abs, content);
}

/** KEY=value replacements in an env file (only keys that exist, or appended when `append`). */
function setEnv(text, values, append = false) {
  let out = text;
  for (const [key, value] of Object.entries(values)) {
    const re = new RegExp(`^${key}=.*$`, 'm');
    if (re.test(out)) out = out.replace(re, `${key}=${value}`);
    else if (append) out += `${out.endsWith('\n') ? '' : '\n'}${key}=${value}\n`;
  }
  return out;
}

function withDatabase(uri, db) {
  // mongodb://host:port/<db>?options  → replace the path segment only
  const m = /^(mongodb(?:\+srv)?:\/\/[^/?]+)(\/[^?]*)?(\?.*)?$/.exec(uri ?? '');
  return m ? `${m[1]}/${db}${m[3] ?? ''}` : uri;
}

const args = parseArgs(process.argv.slice(2));
if (args.flags.has('help') || !args.name || !args.slug) {
  console.log('Usage: npm run project:init -- --name "Shop X" --slug shop-x [--db shopx] [--description "..."]');
  console.log('                                [--support-email help@shopx.com] [--color "#0f766e"] [--logo-url https://...]');
  console.log('                                [--company "Shop X Pvt Ltd"] [--website https://shopx.com] [--language en]');
  console.log('                                [--reset-secrets] [--dry-run]');
  process.exit(args.flags.has('help') ? 0 : 1);
}
const name = args.name.trim();
const slug = args.slug.trim();
if (!name || name.length > 50) fail('--name must be 1–50 characters');
if (!SLUG.test(slug)) fail('--slug must be lowercase letters, digits and "-" (3–32 characters), e.g. shop-x');
if (args.color && !/^#[0-9a-fA-F]{6}$/.test(args.color)) fail('--color must look like #0f766e');
if (args['support-email'] && !/^[^@\s]+@[^@\s]+$/.test(args['support-email'])) fail('--support-email is not an email address');
const key = slug.replace(/-/g, '_');
const db = (args.db ?? key).trim();
if (!/^[A-Za-z0-9_-]{1,63}$/.test(db)) fail('--db must be letters, digits, "_" or "-"');

// 1. project.config.json
const configFile = path.join(ROOT, 'project.config.json');
const config = fs.existsSync(configFile) ? JSON.parse(fs.readFileSync(configFile, 'utf8')) : { $schema: './project.config.schema.json' };
config.name = name;
config.slug = slug;
if (args.description !== undefined) config.description = args.description;
if (args.language) config.defaultLanguage = args.language;
config.branding = config.branding ?? {};
if (args.color) config.branding.primaryColor = args.color;
if (args['logo-url']) config.branding.logoUrl = args['logo-url'];
if (args.company) config.branding.companyName = args.company;
if (args['support-email']) config.branding.supportEmail = args['support-email'];
if (args.website) config.branding.websiteUrl = args.website;
write('project.config.json', `${JSON.stringify(config, null, 2)}\n`, `name "${name}", slug "${slug}"`);

// 2. package.json / package-lock.json
const pkgName = `${slug}-backend`;
for (const file of ['package.json', 'package-lock.json']) {
  const abs = path.join(ROOT, file);
  if (!fs.existsSync(abs)) continue;
  const json = JSON.parse(fs.readFileSync(abs, 'utf8'));
  json.name = pkgName;
  if (file === 'package.json' && args.description !== undefined) json.description = args.description;
  if (json.packages?.['']) json.packages[''].name = pkgName;
  write(file, `${JSON.stringify(json, null, 2)}\n`, `name "${pkgName}"`);
}

// 3. .env.example and .env
const derived = {
  APP_NAME: name.includes(' ') ? `"${name}"` : name,
  JWT_ISSUER: slug,
  JWT_AUDIENCE: `${slug}-api`,
  REFRESH_COOKIE_NAME: `${key}_refresh`,
  MAIL_FROM: `"${name} <no-reply@example.com>"`,
};
for (const file of ['.env.example', '.env']) {
  const abs = path.join(ROOT, file);
  if (!fs.existsSync(abs)) continue;
  let text = fs.readFileSync(abs, 'utf8');
  const uri = (/^MONGODB_URI=(.*)$/m.exec(text) ?? [])[1];
  const values = { ...derived, ...(uri ? { MONGODB_URI: withDatabase(uri, db) } : {}) };
  if (file === '.env') {
    // Keep a real sender address the developer already configured, only rename the display name.
    const from = (/^MAIL_FROM=(.*)$/m.exec(text) ?? [])[1];
    const address = from && /<([^>]+)>/.exec(from)?.[1];
    if (address) values.MAIL_FROM = `"${name} <${address}>"`;
    if (args.flags.has('reset-secrets')) {
      values.JWT_ACCESS_SECRET = crypto.randomBytes(48).toString('base64');
      values.VERIFICATION_TOKEN_SECRET = crypto.randomBytes(48).toString('base64');
      values.JWT_ACCESS_PREVIOUS_SECRETS = '';
    }
  }
  text = setEnv(text, values, file === '.env' && args.flags.has('reset-secrets'));
  write(file, text, `app name, database "${db}", JWT issuer / audience, cookie, mail sender${file === '.env' && args.flags.has('reset-secrets') ? ', new secrets' : ''}`);
}

// 4. Report
console.log(args.flags.has('dry-run') ? '\nWould change:' : '\nChanged:');
console.log(changes.length ? changes.map((c) => `  - ${c}`).join('\n') : '  (nothing: already up to date)');
const envExists = fs.existsSync(path.join(ROOT, '.env'));
console.log(`
Still to do by hand:
  - ${envExists && args.flags.has('reset-secrets') ? 'Secrets were regenerated in .env.' : 'Generate NEW secrets for this project (never reuse another project\'s): JWT_ACCESS_SECRET, VERIFICATION_TOKEN_SECRET (or rerun with --reset-secrets).'}
  - Mail: MAIL_FROM address and SMTP_* credentials for this project.
  - First admin: BOOTSTRAP_ADMIN_EMAIL / BOOTSTRAP_ADMIN_PASSWORD.
  - Frontend URLs: CORS_ORIGIN, EMAIL_VERIFICATION_URL, PASSWORD_RESET_URL, INVITE_ACCEPT_URL, FILES_PUBLIC_BASE_URL.
  - Docker image / repository names, README titles, Postman workspace names.
  - Use a NEW, empty database ("${db}"): two projects must never share one (they would share users).
`);
