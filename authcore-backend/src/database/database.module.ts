import { Logger, Module } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { MongooseModule, MongooseModuleFactoryOptions } from '@nestjs/mongoose';
import mongoose, { Connection } from 'mongoose';

import { databaseConfig } from '@config/configuration';

import { queryTimeoutPlugin } from './plugins/query-timeout.plugin';

// Only filter on fields defined in the schema; unknown query fields are dropped.
mongoose.set('strictQuery', true);

const logger = new Logger('MongoDB');

/** Logs the connection lifecycle. Never logs the URI (it may contain credentials). */
function attachConnectionListeners(connection: Connection): void {
  connection.on('connected', () => {
    logger.log(`Connected to database "${connection.name}"`);
  });
  connection.on('reconnected', () => {
    logger.log('Reconnected');
  });
  connection.on('disconnected', () => {
    logger.warn('Disconnected');
  });
  connection.on('close', () => {
    logger.log('Connection closed');
  });
  connection.on('error', (error: Error) => {
    logger.error(`Connection error: ${error.message}`);
  });
}

@Module({
  imports: [
    MongooseModule.forRootAsync({
      inject: [databaseConfig.KEY],
      useFactory: (
        db: ConfigType<typeof databaseConfig>,
      ): MongooseModuleFactoryOptions => ({
        uri: db.uri,

        // Connection pool
        maxPoolSize: db.maxPoolSize,
        minPoolSize: db.minPoolSize,

        // Timeouts
        serverSelectionTimeoutMS: db.serverSelectionTimeoutMS,
        connectTimeoutMS: db.connectTimeoutMS,
        socketTimeoutMS: db.socketTimeoutMS,

        // Initial connection retry (the driver handles reconnects after that)
        retryAttempts: db.retryAttempts,
        retryDelay: db.retryDelayMS,
        retryWrites: true,

        // Index management: off in production by default (see npm run db:indexes)
        autoIndex: db.autoIndex,
        autoCreate: db.autoIndex,

        onConnectionCreate: (connection: Connection) => {
          attachConnectionListeners(connection);
          // Server-side time limit for queries without their own maxTimeMS.
          connection.plugin(queryTimeoutPlugin(db.queryTimeoutMS));
        },
      }),
    }),
  ],
})
export class DatabaseModule {}
