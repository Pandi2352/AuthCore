import { Types } from 'mongoose';

/**
 * Strict ObjectId check: only a 24-character hex string passes.
 * (mongoose.isValidObjectId also accepts any 12-character string.)
 */
export function isValidObjectId(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    /^[a-f0-9]{24}$/i.test(value) &&
    Types.ObjectId.isValid(value)
  );
}

export function toObjectId(value: string): Types.ObjectId {
  return new Types.ObjectId(value);
}
