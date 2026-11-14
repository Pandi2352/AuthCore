import { join } from 'node:path';

import type { WinstonModuleOptions } from 'nest-winston';
import { addColors, format, transports } from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';

import { getRequestId } from '@common/context/request-context';

import { redactFormat } from './log-redaction';

/** Winston levels (lower = more severe). Includes Nest's `fatal`. */
export const LOG_LEVELS = {
  fatal: 0,
  error: 1,
  warn: 2,
  info: 3,
  verbose: 4,
  debug: 5,
} as const;

// Pretty output colorizes levels; every custom level needs a color, or
// colorize() throws and the entry is lost (e.g. Nest's fatal).
addColors({
  fatal: 'bold red',
  error: 'red',
  warn: 'yellow',
  info: 'green',
  verbose: 'cyan',
  debug: 'blue',
});

export interface LoggerSettings {
  serviceName: string;
  environment: string;
  level: string;
  format: 'json' | 'pretty';
  isFileEnabled: boolean;
  directory: string;
  maxFileSize: string;
  maxFiles: string;
}

/** Adds the current request id to every entry logged during a request. */
const requestIdFormat = format((info) => {
  if (info.requestId === undefined) {
    const requestId = getRequestId();
    if (requestId !== undefined) {
      info.requestId = requestId;
    }
  }
  return info;
});

/** Fields shown inline in pretty output, not in the trailing JSON. */
const PRETTY_INLINE_FIELDS = new Set([
  'level',
  'message',
  'timestamp',
  'context',
  'requestId',
  'stack',
  'service',
  'environment',
]);

function stringify(value: unknown): string {
  return typeof value === 'string' ? value : JSON.stringify(value);
}

const prettyFormat = format.printf((info) => {
  const context = typeof info.context === 'string' ? ` [${info.context}]` : '';
  const requestId =
    typeof info.requestId === 'string' ? ` (${info.requestId})` : '';
  const meta = Object.fromEntries(
    Object.entries(info).filter(([key]) => !PRETTY_INLINE_FIELDS.has(key)),
  );
  const metaText =
    Object.keys(meta).length > 0 ? ` ${JSON.stringify(meta)}` : '';
  const stack = Array.isArray(info.stack)
    ? info.stack.filter(Boolean).map(stringify).join('\n')
    : info.stack
      ? stringify(info.stack)
      : '';

  return (
    `${stringify(info.timestamp)} ${info.level}${context}${requestId} ` +
    `${stringify(info.message)}${metaText}${stack ? `\n${stack}` : ''}`
  );
});

/** Shared first steps: redact, attach request id, UTC ISO timestamp. */
const baseFormat = format.combine(
  format.errors({ stack: true }),
  redactFormat(),
  requestIdFormat(),
  format.timestamp(),
);

const jsonFormat = format.combine(baseFormat, format.json());

/**
 * Winston config for nest-winston.
 * - Console: JSON (production / log collectors) or pretty (development).
 * - Optional daily-rotated files (always JSON): app-*.log and error-*.log.
 * - Uncaught exceptions and unhandled rejections are logged.
 */
export function createWinstonOptions(
  settings: LoggerSettings,
): WinstonModuleOptions {
  const consoleFormat =
    settings.format === 'json'
      ? jsonFormat
      : format.combine(
          baseFormat,
          format.colorize({ level: true }),
          prettyFormat,
        );

  const fileTransports = settings.isFileEnabled
    ? [
        new DailyRotateFile({
          dirname: settings.directory,
          filename: 'app-%DATE%.log',
          datePattern: 'YYYY-MM-DD',
          zippedArchive: true,
          maxSize: settings.maxFileSize,
          maxFiles: settings.maxFiles,
          format: jsonFormat,
        }),
        new DailyRotateFile({
          dirname: settings.directory,
          filename: 'error-%DATE%.log',
          datePattern: 'YYYY-MM-DD',
          zippedArchive: true,
          maxSize: settings.maxFileSize,
          maxFiles: settings.maxFiles,
          level: 'error',
          format: jsonFormat,
        }),
      ]
    : [];

  return {
    levels: LOG_LEVELS,
    level: settings.level,
    defaultMeta: {
      service: settings.serviceName,
      environment: settings.environment,
    },
    transports: [
      new transports.Console({
        format: consoleFormat,
        handleExceptions: true,
        handleRejections: true,
      }),
      ...fileTransports,
    ],
    exitOnError: true,
  };
}

/** Where rotated files go, for documentation and startup logs. */
export function logFilePattern(directory: string): string {
  return join(directory, 'app-YYYY-MM-DD.log');
}
