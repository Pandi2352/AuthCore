import {
  registerDecorator,
  type ValidationArguments,
  type ValidationOptions,
} from 'class-validator';

/**
 * The property must equal another property of the same DTO:
 *   @Match('newPassword') confirmPassword!: string;
 */
export function Match(property: string, options?: ValidationOptions) {
  return (object: object, propertyName: string): void => {
    registerDecorator({
      name: 'match',
      target: object.constructor,
      propertyName,
      constraints: [property],
      options: {
        message: `${propertyName} must match ${property}`,
        ...options,
      },
      validator: {
        validate(value: unknown, args: ValidationArguments): boolean {
          const [other] = args.constraints as [string];
          return value === (args.object as Record<string, unknown>)[other];
        },
      },
    });
  };
}
