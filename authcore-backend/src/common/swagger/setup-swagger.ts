import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

import { API_TAGS } from '@common/constants/api-tags.constants';

export interface SwaggerSetupOptions {
  path: string;
  apiVersion: string;
}

export const SWAGGER_INFO = {
  title: 'AuthCore API',
  description:
    'AuthCore: reusable authentication and authorization service.\n\n' +
    'All responses use the standard envelope. Success: `success`, `message`, ' +
    '`data`, `meta` (lists only), `timestamp`, `path`. Error: `success`, ' +
    '`message`, `code`, `errors`, `statusCode`, `timestamp`, `path`. ' +
    'All dates are ISO 8601 UTC.',
  siteTitle: 'AuthCore API Docs',
};

/**
 * Serves:
 *   /<path>               Swagger UI
 *   /<path>/openapi.json  OpenAPI JSON
 *   /<path>/openapi.yaml  OpenAPI YAML
 * Returns the URLs so the caller can log them.
 */
export function setupSwagger(
  app: INestApplication,
  options: SwaggerSetupOptions,
): { uiPath: string; jsonPath: string } {
  const builder = new DocumentBuilder()
    .setTitle(SWAGGER_INFO.title)
    .setDescription(SWAGGER_INFO.description)
    .setVersion(`${options.apiVersion}.0`)
    .addServer('/', 'Current server');

  for (const tag of Object.values(API_TAGS)) {
    builder.addTag(tag.name, tag.description);
  }

  const document = SwaggerModule.createDocument(app, builder.build(), {
    operationIdFactory: (controllerKey: string, methodKey: string) =>
      `${controllerKey.replace(/Controller$/, '')}_${methodKey}`,
  });

  const jsonPath = `${options.path}/openapi.json`;
  SwaggerModule.setup(options.path, app, document, {
    customSiteTitle: SWAGGER_INFO.siteTitle,
    jsonDocumentUrl: jsonPath,
    yamlDocumentUrl: `${options.path}/openapi.yaml`,
    swaggerOptions: {
      docExpansion: 'none',
      filter: true,
      displayRequestDuration: true,
      persistAuthorization: true,
      tagsSorter: 'alpha',
      operationsSorter: 'alpha',
    },
  });

  return { uiPath: `/${options.path}`, jsonPath: `/${jsonPath}` };
}
