import { registerDecorator, type ValidationOptions } from 'class-validator';

/** The value is a Date later than now (e.g. an expiry date). */
export function IsFutureDate(options?: ValidationOptions) {
  return (object: object, propertyName: string): void => {
    registerDecorator({
      name: 'isFutureDate',
      target: object.constructor,
      propertyName,
      options: { message: `${propertyName} must be in the future`, ...options },
      validator: {
        validate(value: unknown): boolean {
          return value instanceof Date && value.getTime() > Date.now();
        },
      },
    });
  };
}
