#!/usr/bin/env node
// The frontend's API error codes (src/lib/constants/error-codes.ts → API_ERROR_CODES) must
// match the backend's ErrorCode enum. Part of `npm run verify`.
// Skipped (with a note) when the backend is not next to the frontend, e.g. a split repo.
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const BACKEND = path.resolve(
  ROOT,
  process.env.BACKEND_DIR ?? '../authcore-backend',
  'src/common/constants/error-codes.constants.ts',
);
const FRONTEND = path.join(ROOT, 'src/lib/constants/error-codes.ts');

if (!fs.existsSync(BACKEND)) {
  console.log(`- Error codes: backend not found (${path.relative(ROOT, BACKEND)}), check skipped`);
  process.exit(0);
}

const backendSource = fs.readFileSync(BACKEND, 'utf8');
const enumStart = backendSource.indexOf('export enum ErrorCode {');
const enumBody = backendSource.slice(enumStart, backendSource.indexOf('\n}', enumStart));
const backend = new Set([...enumBody.matchAll(/=\s*'([A-Z0-9_]+)'/g)].map((m) => m[1]));

const frontendSource = fs.readFileSync(FRONTEND, 'utf8');
const apiStart = frontendSource.indexOf('export const API_ERROR_CODES = {');
const apiBody = frontendSource.slice(apiStart, frontendSource.indexOf('} as const;', apiStart));
const frontend = new Set([...apiBody.matchAll(/:\s*'([A-Z0-9_]+)'/g)].map((m) => m[1]));

const missing = [...backend].filter((c) => !frontend.has(c));
const extra = [...frontend].filter((c) => !backend.has(c));
if (missing.length || extra.length) {
  console.error('✖ Error codes out of sync with the backend ErrorCode enum');
  if (missing.length) console.error(`  missing in the frontend: ${missing.join(', ')}`);
  if (extra.length) console.error(`  not in the backend:      ${extra.join(', ')}`);
  console.error('  Update src/lib/constants/error-codes.ts → API_ERROR_CODES.');
  process.exit(1);
}
console.log(`✔ Error codes: ${backend.size} codes match the backend`);
