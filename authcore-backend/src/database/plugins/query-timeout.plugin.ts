import type { MongooseQueryMiddleware, Query, Schema } from 'mongoose';

const QUERY_OPERATIONS: MongooseQueryMiddleware[] = [
  'find',
  'findOne',
  'countDocuments',
  'estimatedDocumentCount',
  'distinct',
  'findOneAndUpdate',
  'findOneAndDelete',
  'findOneAndReplace',
];

/**
 * Sets maxTimeMS on every query and aggregation that doesn't set its own, so
 * MongoDB stops a slow operation on the server instead of letting it run on.
 * A query can still choose its own limit: Model.find(...).maxTimeMS(30_000).
 */
export function queryTimeoutPlugin(defaultMaxTimeMs: number) {
  return (schema: Schema): void => {
    schema.pre(QUERY_OPERATIONS, function (this: Query<unknown, unknown>) {
      if (this.getOptions().maxTimeMS === undefined) {
        this.maxTimeMS(defaultMaxTimeMs);
      }
    });

    schema.pre('aggregate', function () {
      if (this.options.maxTimeMS === undefined) {
        this.options.maxTimeMS = defaultMaxTimeMs;
      }
    });
  };
}
