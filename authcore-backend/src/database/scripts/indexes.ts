import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { getConnectionToken } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';

import { AppModule } from '../../app.module';

/**
 * Safe index management for all registered models.
 *
 *   npm run db:indexes          -> report only (what would be created/dropped)
 *   npm run db:indexes:apply    -> create missing indexes
 *
 * Indexes are never dropped by this script. Review "extra" indexes and drop
 * them manually if they are really unused.
 */
async function run(): Promise<void> {
  const shouldApply = process.argv.includes('--apply');
  const logger = new Logger('Indexes');

  const app = await NestFactory.createApplicationContext(AppModule, {
    bufferLogs: true,
  });
  app.useLogger(app.get(WINSTON_MODULE_NEST_PROVIDER));

  try {
    const connection = app.get<Connection>(getConnectionToken());
    const models = Object.values(connection.models);

    if (models.length === 0) {
      logger.log('No models registered. Nothing to do.');
      return;
    }

    for (const model of models) {
      const diff = await model.diffIndexes();
      const toCreate = diff.toCreate.map((index) => JSON.stringify(index));
      logger.log(
        `${model.modelName}: missing [${toCreate.join(', ') || 'none'}], ` +
          `extra [${diff.toDrop.join(', ') || 'none'}]`,
      );

      if (shouldApply && diff.toCreate.length > 0) {
        await model.createIndexes();
        logger.log(`${model.modelName}: missing indexes created`);
      }
    }

    if (!shouldApply) {
      logger.log('Report only. Run "npm run db:indexes:apply" to create.');
    }
  } finally {
    await app.close();
  }
}

run().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  new Logger('Indexes').error(message);
  process.exit(1);
});
