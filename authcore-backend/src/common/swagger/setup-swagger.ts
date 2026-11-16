import { type INestApplication, VersioningType } from '@nestjs/common';
import {
  DocumentBuilder,
  type OpenAPIObject,
  SwaggerModule,
} from '@nestjs/swagger';

import { DEFAULT_API_VERSION } from '@common/constants/api.constants';
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
 * Global prefix + URI versioning: every route is /<apiPrefix>/v<version>/...
 * Shared by main.ts and the OpenAPI export, so both see the same paths.
 */
export function applyApiRouting(
  app: INestApplication,
  apiPrefix: string,
): void {
  app.setGlobalPrefix(apiPrefix);
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: DEFAULT_API_VERSION,
  });
}

/**
 * Builds the OpenAPI document from the app's controllers and DTOs.
 * `serverUrl` is "/" when served by the app itself, or an absolute URL for
 * the exported file (Postman, client generators).
 */
export function createOpenApiDocument(
  app: INestApplication,
  apiVersion: string,
  serverUrl = '/',
): OpenAPIObject {
  const builder = new DocumentBuilder()
    .setTitle(SWAGGER_INFO.title)
    .setDescription(SWAGGER_INFO.description)
    .setVersion(`${apiVersion}.0`)
    .addServer(serverUrl, serverUrl === '/' ? 'Current server' : 'Server')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Access token from POST /api/v1/auth/login',
      },
      'access-token',
    );

  for (const tag of Object.values(API_TAGS)) {
    builder.addTag(tag.name, tag.description);
  }

  return SwaggerModule.createDocument(app, builder.build(), {
    operationIdFactory: (controllerKey: string, methodKey: string) =>
      `${controllerKey.replace(/Controller$/, '')}_${methodKey}`,
  });
}

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
  const document = createOpenApiDocument(app, options.apiVersion);

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
