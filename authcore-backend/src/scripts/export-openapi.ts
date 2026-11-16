import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

import { Logger } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';

import { DEFAULT_API_VERSION } from '@common/constants/api.constants';
import {
  applyApiRouting,
  createOpenApiDocument,
} from '@common/swagger/setup-swagger';
import { appConfig } from '@config/configuration';

import { AppModule } from '../app.module';

/**
 * Writes the OpenAPI document generated from the code to a file, without
 * starting the HTTP server. The file is the API contract used for Postman
 * (and client generators); regenerate it whenever endpoints or DTOs change:
 *
 *   npm run openapi:export                       → dist/openapi.json
 *   npm run openapi:export -- <file> [serverUrl]
 *
 * Needs the same configuration as the app (it loads AppModule).
 */
const DEFAULT_OUTPUT = 'dist/openapi.json';

async function run(): Promise<void> {
  const [output = DEFAULT_OUTPUT, serverArg] = process.argv.slice(2);
  const logger = new Logger('OpenApiExport');

  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn'],
    abortOnError: false,
    bodyParser: false,
  });
  try {
    const { apiPrefix, port } = app.get<ConfigType<typeof appConfig>>(
      appConfig.KEY,
    );
    applyApiRouting(app, apiPrefix);

    const serverUrl = serverArg ?? `http://localhost:${port}`;
    const document = createOpenApiDocument(app, DEFAULT_API_VERSION, serverUrl);

    const file = resolve(output);
    await mkdir(dirname(file), { recursive: true });
    await writeFile(file, `${JSON.stringify(document, null, 2)}\n`);
    logger.log(
      `OpenAPI ${document.openapi} written to ${file} (${Object.keys(document.paths).length} paths, server ${serverUrl})`,
    );
  } finally {
    await app.close();
  }
}

run().catch((error: unknown) => {
  new Logger('OpenApiExport').error(
    error instanceof Error ? error.message : String(error),
  );
  process.exitCode = 1;
});
