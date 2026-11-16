// @ts-check
/// <reference types="node" />
import eslint from '@eslint/js';
import checkFile from 'eslint-plugin-check-file';
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended';
import simpleImportSort from 'eslint-plugin-simple-import-sort';
import { defineConfig } from 'eslint/config';
import globals from 'globals';
import tseslint from 'typescript-eslint';

/*
 * Code quality rules: docs/project-setup-checklist.md, sections 4 and 7.
 * ESLint replaces a rule's whole config when a later block matches the same
 * file, so blocks that refine a rule repeat its shared parts.
 */

// ---------------------------------------------------------------------------
// Section 4: architecture
// ---------------------------------------------------------------------------

/** The default mongoose import (connect/model/set) belongs in src/database only. */
const MONGOOSE_DEFAULT_IMPORT = {
  name: 'mongoose',
  importNames: ['default'],
  message:
    'Database access is set up in src/database. Inject models with @InjectModel() instead. Type imports (Types, HydratedDocument) are fine.',
};

/** Lower layers must not depend on feature modules. */
const NO_FEATURE_MODULE_IMPORTS = {
  group: ['@modules/*', '**/modules/*', '**/modules/**'],
  message:
    'common, config, database and shared must not import feature modules. Move shared code down into common/ or shared/.',
};

/** Controllers handle HTTP only: no database access, no schemas. */
const CONTROLLER_RESTRICTED_PATHS = [
  {
    name: 'mongoose',
    message:
      'Controllers must not touch the database. Put the logic in a service.',
  },
  {
    name: '@nestjs/mongoose',
    message:
      'Controllers must not inject models or connections. Use a service.',
  },
];
const CONTROLLER_RESTRICTED_PATTERNS = [
  {
    group: ['**/schemas/*', '**/schemas/**', '@database/*', '@database/**'],
    message:
      'Controllers use DTOs, not schemas or database code. Map data in the service.',
  },
];

// ---------------------------------------------------------------------------
// Section 7: naming conventions
// ---------------------------------------------------------------------------

const BOOLEAN_PREFIXES = ['is', 'has', 'can', 'should', 'was', 'will', 'did'];

/** Shared naming rules. The most specific matching selector wins. */
const NAMING_BASE = [
  {
    selector: 'default',
    format: ['camelCase'],
    leadingUnderscore: 'forbid',
    trailingUnderscore: 'forbid',
  },
  // Imported names keep the library's spelling (Joi, mongoose, ...).
  { selector: 'import', format: null },
  // camelCase values, UPPER_CASE constants, PascalCase decorator factories.
  { selector: 'variable', format: ['camelCase', 'UPPER_CASE', 'PascalCase'] },
  { selector: 'variable', modifiers: ['destructured'], format: null },
  {
    selector: 'variable',
    types: ['boolean'],
    format: ['PascalCase'],
    prefix: BOOLEAN_PREFIXES,
  },
  // `_name` marks an intentionally unused parameter.
  { selector: 'parameter', format: ['camelCase'], leadingUnderscore: 'allow' },
  // PascalCase is for decorators (ApiWrappedResponse, ResponseMessage).
  { selector: 'function', format: ['camelCase', 'PascalCase'] },
  { selector: 'typeLike', format: ['PascalCase'] },
  {
    selector: 'interface',
    format: ['PascalCase'],
    custom: { regex: '^I[A-Z]', match: false },
  },
  { selector: 'enumMember', format: ['PascalCase'] },
  // Object keys often mirror external names (headers, env vars, tag maps).
  {
    selector: ['objectLiteralProperty', 'objectLiteralMethod'],
    format: null,
  },
  // MongoDB's own field names.
  {
    selector: ['classProperty', 'typeProperty'],
    filter: { regex: '^(_id|__v)$', match: true },
    format: null,
  },
];

/** File suffix -> required class name suffix. */
const CLASS_SUFFIX_BY_FILE = {
  controller: 'Controller',
  service: 'Service',
  module: 'Module',
  dto: 'Dto',
  guard: 'Guard',
  interceptor: 'Interceptor',
  filter: 'Filter',
  pipe: 'Pipe',
  middleware: 'Middleware',
  exception: 'Exception',
  strategy: 'Strategy',
};

const classSuffixBlocks = Object.entries(CLASS_SUFFIX_BY_FILE).map(
  ([fileType, suffix]) => ({
    files: [`src/**/*.${fileType}.ts`],
    rules: {
      '@typescript-eslint/naming-convention': [
        'error',
        ...NAMING_BASE,
        { selector: 'class', format: ['PascalCase'], suffix: [suffix] },
      ],
    },
  }),
);

/** Folder -> required file suffix (kebab-case name + suffix). */
const FILE_SUFFIX_BY_FOLDER = {
  constants: 'constants',
  exceptions: 'exception',
  decorators: 'decorator',
  dto: 'dto',
  enums: 'enum',
  filters: 'filter',
  guards: 'guard',
  interceptors: 'interceptor',
  interfaces: 'interface',
  middleware: 'middleware',
  pipes: 'pipe',
  schemas: 'schema',
  utils: 'util',
};

const KEBAB = '+([a-z0-9])*(-+([a-z0-9]))';

const filenameRules = {
  // Every file: kebab-case, optionally followed by one type suffix.
  'src/**/*.ts': `${KEBAB}?(.+([a-z0-9]))`,
  ...Object.fromEntries(
    Object.entries(FILE_SUFFIX_BY_FOLDER).map(([folder, suffix]) => [
      `src/**/${folder}/*.ts`,
      `${KEBAB}.${suffix}`,
    ]),
  ),
};

export default defineConfig(
  {
    ignores: ['eslint.config.mjs', 'dist/**', 'node_modules/**'],
  },
  eslint.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  eslintPluginPrettierRecommended,
  {
    languageOptions: {
      globals: {
        ...globals.node,
      },
      sourceType: 'commonjs',
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: {
      'simple-import-sort': simpleImportSort,
      'check-file': checkFile,
    },
  },

  // General code quality.
  {
    rules: {
      'prettier/prettier': ['error', { endOfLine: 'lf' }],

      // Type safety
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-unsafe-argument': 'error',
      // No consistent-type-imports: with emitDecoratorMetadata, `import type`
      // on an injected class breaks Nest dependency injection at runtime.
      // Nest modules are empty classes with a @Module() decorator.
      '@typescript-eslint/no-extraneous-class': [
        'error',
        { allowWithDecorator: true },
      ],
      '@typescript-eslint/restrict-template-expressions': [
        'error',
        { allowNumber: true },
      ],

      // Unused code
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          args: 'after-used',
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrors: 'all',
          caughtErrorsIgnorePattern: '^_',
          ignoreRestSiblings: true,
        },
      ],

      // Imports
      'simple-import-sort/imports': [
        'error',
        {
          groups: [
            // Side-effect imports, then Node built-ins
            ['^\\u0000', '^node:'],
            // Packages: @nestjs first, then everything else
            ['^@nestjs(/.*|$)', '^@?\\w'],
            // Project aliases
            ['^@(common|config|database|modules|shared)(/.*|$)'],
            // Relative imports
            ['^\\.'],
          ],
        },
      ],
      'simple-import-sort/exports': 'error',
      'no-duplicate-imports': ['error', { allowSeparateTypeImports: true }],

      // General
      eqeqeq: ['error', 'always'],
      curly: ['error', 'all'],
      'no-console': 'error',
      'no-restricted-properties': [
        'error',
        {
          object: 'process',
          property: 'env',
          message:
            'Read configuration through the typed config (src/config), not process.env.',
        },
      ],

      // Naming
      '@typescript-eslint/naming-convention': ['error', ...NAMING_BASE],
      'check-file/filename-naming-convention': ['error', filenameRules],
      'check-file/folder-naming-convention': [
        'error',
        { 'src/**/': 'KEBAB_CASE' },
      ],
    },
  },

  // Class names must match the file type (users.service.ts -> UsersService).
  ...classSuffixBlocks,

  // Dependency injection: never construct injectable classes by hand.
  {
    files: ['src/**/*.ts'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector:
            'NewExpression[callee.name=/(Service|Repository|Controller|Guard|Interceptor|Pipe|Filter|Middleware)$/]',
          message:
            'Do not create injectable classes with "new". Register them as providers and inject them through the constructor.',
        },
      ],
    },
  },

  // Default: mongoose default import only allowed in src/database.
  {
    files: ['src/**/*.ts'],
    rules: {
      'no-restricted-imports': ['error', { paths: [MONGOOSE_DEFAULT_IMPORT] }],
    },
  },

  // Layering: common/config/shared must not depend on feature modules.
  {
    files: ['src/common/**/*.ts', 'src/config/**/*.ts', 'src/shared/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [MONGOOSE_DEFAULT_IMPORT],
          patterns: [NO_FEATURE_MODULE_IMPORTS],
        },
      ],
    },
  },

  // The database layer may use mongoose directly, but not feature modules.
  {
    files: ['src/database/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        { patterns: [NO_FEATURE_MODULE_IMPORTS] },
      ],
    },
  },

  // Thin controllers: HTTP in, call a service, HTTP out.
  {
    files: ['src/**/*.controller.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: CONTROLLER_RESTRICTED_PATHS,
          patterns: CONTROLLER_RESTRICTED_PATTERNS,
        },
      ],
      // Counts statements in handler bodies (decorators don't count): a
      // handler should only call a service.
      'max-statements': ['warn', 5],
      complexity: ['warn', 3],
    },
  },

  // Only the config layer reads process.env.
  {
    files: ['src/config/**/*.ts'],
    rules: {
      'no-restricted-properties': 'off',
    },
  },
);
