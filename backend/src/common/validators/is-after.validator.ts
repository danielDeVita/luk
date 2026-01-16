import {
  registerDecorator,
  ValidationOptions,
  ValidationArguments,
} from 'class-validator';

/**
 * Validates that a date is after a specified date or 'now'
 * Usage: @IsAfter('now') or @IsAfter('2024-01-01')
 */
export function IsAfter(date: string, validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isAfter',
      target: object.constructor,
      propertyName: propertyName,
      constraints: [date],
      options: validationOptions,
      validator: {
        validate(value: any, args: ValidationArguments) {
          const [relatedDate] = args.constraints;

          if (!value) {
            return false;
          }

          const dateValue = new Date(value);

          if (isNaN(dateValue.getTime())) {
            return false;
          }

          const compareDate =
            relatedDate === 'now' ? new Date() : new Date(relatedDate);

          return dateValue > compareDate;
        },
        defaultMessage(args: ValidationArguments) {
          const [relatedDate] = args.constraints;
          if (relatedDate === 'now') {
            return `${args.property} debe ser una fecha futura`;
          }
          return `${args.property} debe ser posterior a ${relatedDate}`;
        },
      },
    });
  };
}
