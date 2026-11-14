import { format } from 'winston';

export const REDACTED = '[REDACTED]';

/** Keys whose values are never logged, at any depth. */
const SENSITIVE_KEY =
  /(password|passwd|secret|token|authorization|cookie|api[-_]?key|credential|private[-_]?key|session|^otp$|^pin$)/i;

/** Patterns removed from any logged string (messages, stacks, values). */
const SENSITIVE_STRING_PATTERNS: [RegExp, string][] = [
  // user:password@ in connection strings (mongodb://user:pass@host)
  [/(\b[a-z][a-z0-9+.-]*:\/\/)[^:/?#\s@]+:[^@/?#\s]+@/gi, `$1${REDACTED}@`],
  // Authorization header values
  [/\b(Bearer|Basic)\s+[A-Za-z0-9._~+/=-]+/gi, `$1 ${REDACTED}`],
  // JWTs
  [/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, REDACTED],
  // key=value / key: value pairs inside text (password=..., "token": "...")
  [
    /\b(password|passwd|secret|token|api[-_]?key|authorization|cookie)(["']?\s*[=:]\s*["']?)[^\s"'&,;}]+/gi,
    `$1$2${REDACTED}`,
  ],
];

const MAX_DEPTH = 8;

export function redactString(value: string): string {
  return SENSITIVE_STRING_PATTERNS.reduce(
    (result, [pattern, replacement]) => result.replace(pattern, replacement),
    value,
  );
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value) as unknown;
  return prototype === Object.prototype || prototype === null;
}

/** Returns a redacted copy. Plain objects and arrays are walked; originals are not changed. */
export function redactValue(value: unknown, depth = 0): unknown {
  if (typeof value === 'string') {
    return redactString(value);
  }
  if (depth >= MAX_DEPTH) {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((item) => redactValue(item, depth + 1));
  }
  if (value instanceof Error) {
    return {
      name: value.name,
      message: redactString(value.message),
      stack: value.stack ? redactString(value.stack) : undefined,
    };
  }
  if (isPlainObject(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([key, child]) => [
        key,
        SENSITIVE_KEY.test(key) ? REDACTED : redactValue(child, depth + 1),
      ]),
    );
  }
  return value;
}

/** Winston format: redacts every field of every log entry. */
export const redactFormat = format((info) => {
  for (const key of Object.keys(info)) {
    if (key === 'level') {
      continue;
    }
    info[key] = SENSITIVE_KEY.test(key) ? REDACTED : redactValue(info[key]);
  }
  return info;
});
