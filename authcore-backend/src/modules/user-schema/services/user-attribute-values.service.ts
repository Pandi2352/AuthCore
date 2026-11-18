import { HttpStatus, Injectable } from '@nestjs/common';
import { isEmail, isISO8601, isURL } from 'class-validator';

import { ErrorCode } from '@common/constants/error-codes.constants';
import { AppException } from '@common/exceptions/app.exception';
import { ValidationException } from '@common/exceptions/validation.exception';
import type { ApiFieldError } from '@common/interfaces/api-response.interface';
import { escapeRegex } from '@common/utils/query.util';
import {
  PERSON_NAME_PATTERN,
  RESERVED_USERNAMES,
  USERNAME_PATTERN,
} from '@modules/auth/constants/auth.constants';
import type { ProfileChanges } from '@modules/users/users.service';
import { UsersService } from '@modules/users/users.service';
import { PasswordService } from '@shared/password.service';

import {
  DATE_PATTERN,
  DEFAULT_TEXT_MAX_LENGTH,
  DEFAULT_TEXTAREA_MAX_LENGTH,
  MAX_LIST_ITEMS,
  MAX_TOKEN_CLAIMS_BYTES,
  MOBILE_PATTERN,
} from '../constants/user-schema.constants';
import {
  AttributeDataType as T,
  AttributeGroupType,
  AttributeKind,
  AttributeMutability as M,
  AttributeReturned as R,
} from '../enums/user-schema.enum';
import type { UserAttribute } from '../schemas/user-attribute.schema';
import { UserSchemaService } from './user-schema.service';

type Values = Record<string, unknown>;

export interface AttributeWriteContext {
  isAdmin: boolean;
  /** null when the user doesn't exist yet (admin create). */
  userId: string | null;
}

export interface AttributeWriteResult {
  attributes: Values;
  core: ProfileChanges;
}

/** Core variables writable through the attributes endpoint (others have their own flows). */
const WRITABLE_CORE: Record<string, keyof ProfileChanges> = {
  firstName: 'firstName',
  lastName: 'lastName',
  username: 'username',
};

/**
 * Validates, merges and filters user attribute values against the user
 * schema. All problems are reported at once as `attributes.<path>` errors.
 */
@Injectable()
export class UserAttributeValuesService {
  constructor(
    private readonly schemaService: UserSchemaService,
    private readonly usersService: UsersService,
    private readonly passwordService: PasswordService,
  ) {}

  /**
   * Applies `patch` on top of `current`. null clears a value. Groups (OBJECT)
   * merge field by field; LIST groups are replaced as a whole.
   */
  async merge(
    current: Values,
    patch: Values,
    ctx: AttributeWriteContext,
  ): Promise<AttributeWriteResult> {
    const defs = await this.schemaService.definitions();
    const top = defs.filter((d) => d.parentId === null);
    const errors: ApiFieldError[] = [];
    const result: Values = { ...current };
    const core: ProfileChanges = {};

    for (const [name, value] of Object.entries(patch)) {
      const def = top.find((d) => d.name === name);
      const path = `attributes.${name}`;
      if (!def || !def.isEnabled) {
        errors.push({
          field: path,
          message: `unknown or disabled variable "${name}"`,
        });
        continue;
      }
      if (!this.canWrite(def, ctx, current[name], path, errors)) {
        continue;
      }
      if (def.coreField) {
        const target = WRITABLE_CORE[def.coreField];
        if (!target) {
          errors.push({
            field: path,
            message: `"${name}" is changed with its own endpoint (email / password flows)`,
          });
          continue;
        }
        const checked = this.checkValue(def, value, path, errors);
        if (checked !== INVALID) {
          (core as Record<string, unknown>)[target] = checked;
        }
        continue;
      }
      if (def.kind === AttributeKind.Group) {
        const children = defs.filter(
          (d) => d.parentId === def._id && d.isEnabled,
        );
        result[name] = this.mergeGroup(
          def,
          children,
          current[name],
          value,
          path,
          ctx,
          errors,
        );
      } else {
        const checked = this.checkValue(def, value, path, errors);
        if (checked !== INVALID) {
          result[name] = checked;
        }
      }
    }

    this.checkMatches(top, patch, errors, 'attributes');
    this.checkRequired(top, defs, result, errors);
    if (errors.length > 0) {
      throw new ValidationException(errors);
    }
    await this.assertUnique(top, defs, result, current, ctx.userId);
    return {
      attributes: await this.hashPasswords(top, defs, result, current),
      core,
    };
  }

  /** Built-in fields changed through attributes: same rules as the profile endpoint. */
  async assertCoreChanges(
    core: ProfileChanges,
    userId: string | null,
  ): Promise<void> {
    const errors: ApiFieldError[] = [];
    for (const [key, claim] of [
      ['firstName', 'given_name'],
      ['lastName', 'family_name'],
    ] as const) {
      const value = core[key];
      if (
        typeof value === 'string' &&
        (value.length > 50 || !PERSON_NAME_PATTERN.test(value))
      ) {
        errors.push({
          field: `attributes.${claim}`,
          message: `${claim} contains characters that are not allowed`,
        });
      }
    }
    if ((core as Record<string, unknown>).firstName === null) {
      errors.push({
        field: 'attributes.given_name',
        message: 'given_name is required',
      });
    }
    if (typeof core.username === 'string') {
      core.username = core.username.toLowerCase();
      if (
        !USERNAME_PATTERN.test(core.username) ||
        RESERVED_USERNAMES.has(core.username)
      ) {
        errors.push({
          field: 'attributes.preferred_username',
          message: 'username is not valid or not available',
        });
      }
    }
    if (errors.length > 0) {
      throw new ValidationException(errors);
    }
    if (
      typeof core.username === 'string' &&
      userId &&
      (await this.usersService.isUsernameTakenByOther(core.username, userId))
    ) {
      throw new AppException(
        HttpStatus.CONFLICT,
        ErrorCode.DuplicateResource,
        'This username is already taken',
        [{ field: 'attributes.preferred_username', message: 'already taken' }],
      );
    }
  }

  /** Values the caller may see; `include` adds returned=REQUEST variables. */
  async filterForOutput(
    values: Values,
    opts: { isAdmin: boolean; include?: string[] },
  ): Promise<{ attributes: Values; missingRequired: string[] }> {
    const defs = await this.schemaService.definitions();
    const visible = (d: UserAttribute) =>
      d.isEnabled &&
      !d.isPassword &&
      d.coreField === null &&
      d.returned !== R.Never &&
      d.mutability !== M.WriteOnly &&
      (opts.isAdmin || !d.isInternal) &&
      (d.returned !== R.Request || (opts.include ?? []).includes(d.name));
    const attributes: Values = {};
    for (const def of defs.filter((d) => d.parentId === null && visible(d))) {
      const value = values[def.name];
      if (value === undefined || value === null) {
        continue;
      }
      if (def.kind === AttributeKind.Group) {
        const children = defs
          .filter((c) => c.parentId === def._id && visible(c))
          .map((c) => c.name);
        const pickChildren = (v: unknown) =>
          Object.fromEntries(
            Object.entries(asObject(v)).filter(([k]) => children.includes(k)),
          );
        attributes[def.name] = Array.isArray(value)
          ? value.map(pickChildren)
          : pickChildren(value);
      } else {
        attributes[def.name] = value;
      }
    }
    const missingRequired = defs
      .filter(
        (d) =>
          d.parentId === null &&
          d.isEnabled &&
          d.isRequired &&
          d.coreField === null &&
          (opts.isAdmin || !d.isInternal),
      )
      .filter((d) => isEmpty(values[d.name]))
      .map((d) => d.name);
    return { attributes, missingRequired };
  }

  /** Claims for the access token (`attrs`): includeInToken variables, size-capped. */
  async tokenClaims(values: Values): Promise<Values | undefined> {
    const defs = await this.schemaService.definitions();
    const claims: Values = {};
    for (const def of defs.filter(
      (d) =>
        d.parentId === null &&
        d.includeInToken &&
        d.isEnabled &&
        d.coreField === null,
    )) {
      if (!isEmpty(values[def.name])) {
        claims[def.name] = values[def.name];
      }
    }
    if (Object.keys(claims).length === 0) {
      return undefined;
    }
    return Buffer.byteLength(JSON.stringify(claims)) <= MAX_TOKEN_CLAIMS_BYTES
      ? claims
      : undefined;
  }

  /** Mongo filter for GET /admin/users?attr[name]=value (searchable variables only). */
  async searchFilter(attr: Record<string, unknown>): Promise<Values> {
    const defs = await this.schemaService.definitions();
    const errors: ApiFieldError[] = [];
    const filter: Values = {};
    for (const [name, raw] of Object.entries(attr)) {
      const def = defs.find((d) => d.parentId === null && d.name === name);
      if (
        !def ||
        !def.includeInSearchFilter ||
        def.coreField !== null ||
        typeof raw !== 'string'
      ) {
        errors.push({
          field: `attr.${name}`,
          message: 'not a searchable variable',
        });
        continue;
      }
      filter[`attributes.${name}`] =
        def.dataType === T.Number
          ? Number(raw)
          : def.dataType === T.Boolean
            ? raw === 'true'
            : new RegExp(`^${escapeRegex(raw)}$`, 'i');
    }
    if (errors.length > 0) {
      throw new ValidationException(errors);
    }
    return filter;
  }

  /**
   * Custom variables marked "include in search filter" that hold text (employee ID, phone …):
   * the free-text user search also looks in them. Returned as document paths.
   */
  async searchablePaths(): Promise<string[]> {
    const textTypes: readonly string[] = [
      T.Text,
      T.TextArea,
      T.Email,
      T.Mobile,
      T.Url,
      T.Dropdown,
    ];
    const defs = await this.schemaService.definitions();
    return defs
      .filter(
        (d) =>
          d.parentId === null &&
          d.includeInSearchFilter &&
          d.coreField === null &&
          d.dataType !== null &&
          textTypes.includes(d.dataType),
      )
      .map((d) => `attributes.${d.name}`);
  }

  /** Top-level custom (non-system) fields, label + name, for exports, in display order. */
  async exportColumns(): Promise<{ name: string; label: string }[]> {
    const defs = await this.schemaService.definitions();
    return defs
      .filter(
        (d) =>
          d.parentId === null &&
          d.coreField === null &&
          !d.isSystem &&
          !d.isPassword &&
          !d.isMatchEnabled &&
          d.kind === AttributeKind.Field,
      )
      .sort((a, b) => a.displayOrder - b.displayOrder)
      .map((d) => ({ name: d.name, label: d.label }));
  }

  /** Top-level variables that can be used as the sign-in identifier. */
  async usernameAttributeNames(): Promise<string[]> {
    const defs = await this.schemaService.definitions();
    return defs
      .filter(
        (d) =>
          d.parentId === null &&
          d.isUsername &&
          d.isEnabled &&
          d.coreField === null,
      )
      .map((d) => d.name);
  }

  // ----- helpers ------------------------------------------------------------

  private canWrite(
    def: UserAttribute,
    ctx: AttributeWriteContext,
    currentValue: unknown,
    path: string,
    errors: ApiFieldError[],
  ): boolean {
    if (def.isInternal && !ctx.isAdmin) {
      errors.push({
        field: path,
        message: 'only administrators can set this variable',
      });
      return false;
    }
    if (def.mutability === M.ReadOnly && !ctx.isAdmin) {
      errors.push({ field: path, message: 'this variable is read-only' });
      return false;
    }
    if (def.mutability === M.Immutable && !isEmpty(currentValue)) {
      errors.push({
        field: path,
        message: 'this variable cannot be changed once set',
      });
      return false;
    }
    if (
      def.isMatchEnabled &&
      def.isPassword &&
      def.coreField === null &&
      def.matchWith === 'password'
    ) {
      // confirm_password: form-only, validated by the password flows.
      errors.push({
        field: path,
        message: `"${def.name}" is only used in password forms`,
      });
      return false;
    }
    return true;
  }

  private mergeGroup(
    def: UserAttribute,
    children: UserAttribute[],
    currentValue: unknown,
    value: unknown,
    path: string,
    ctx: AttributeWriteContext,
    errors: ApiFieldError[],
  ): unknown {
    if (value === null) {
      return null;
    }
    const mergeOne = (
      item: unknown,
      base: unknown,
      itemPath: string,
    ): Values | null => {
      if (typeof item !== 'object' || item === null || Array.isArray(item)) {
        errors.push({ field: itemPath, message: 'must be an object' });
        return null;
      }
      const merged: Values = { ...asObject(base) };
      for (const [key, childValue] of Object.entries(item as Values)) {
        const child = children.find((c) => c.name === key);
        const childPath = `${itemPath}.${key}`;
        if (!child) {
          errors.push({
            field: childPath,
            message: `unknown variable "${key}" in ${def.name}`,
          });
          continue;
        }
        if (
          !this.canWrite(child, ctx, asObject(base)[key], childPath, errors)
        ) {
          continue;
        }
        const checked = this.checkValue(child, childValue, childPath, errors);
        if (checked !== INVALID) {
          merged[key] = checked;
        }
      }
      this.checkMatches(children, item as Values, errors, itemPath);
      for (const child of children.filter((c) => c.isRequired)) {
        if (isEmpty(merged[child.name])) {
          errors.push({
            field: `${itemPath}.${child.name}`,
            message: `${child.name} is required`,
          });
        }
      }
      return merged;
    };
    if (def.groupType === AttributeGroupType.List) {
      if (!Array.isArray(value) || value.length > MAX_LIST_ITEMS) {
        errors.push({
          field: path,
          message: `must be a list of at most ${String(MAX_LIST_ITEMS)} items`,
        });
        return currentValue;
      }
      return value.map((item, index) =>
        mergeOne(item, {}, `${path}.${String(index)}`),
      );
    }
    return mergeOne(value, currentValue, path);
  }

  /** The validated (normalized) value, null to clear, or INVALID (error recorded). */
  private checkValue(
    def: UserAttribute,
    value: unknown,
    path: string,
    errors: ApiFieldError[],
  ): unknown {
    if (value === null || value === '') {
      if (def.isRequired) {
        errors.push({ field: path, message: `${def.name} is required` });
        return INVALID;
      }
      return null;
    }
    const fail = (message: string) => {
      errors.push({ field: path, message });
      return INVALID;
    };
    switch (def.dataType) {
      case T.Text:
      case T.TextArea:
      case T.Email:
      case T.Url:
      case T.Mobile: {
        if (typeof value !== 'string') {
          return fail('must be a string');
        }
        const text = value.trim();
        const max =
          def.maxLength ??
          (def.dataType === T.TextArea
            ? DEFAULT_TEXTAREA_MAX_LENGTH
            : DEFAULT_TEXT_MAX_LENGTH);
        if (text.length > max) {
          return fail(`must be at most ${String(max)} characters`);
        }
        if (def.minLength !== null && text.length < def.minLength) {
          return fail(`must be at least ${String(def.minLength)} characters`);
        }
        if (def.dataType === T.Email && !isEmail(text)) {
          return fail('must be a valid email address');
        }
        if (
          def.dataType === T.Url &&
          !isURL(text, { protocols: ['http', 'https'], require_protocol: true })
        ) {
          return fail('must be an http(s) URL');
        }
        if (def.dataType === T.Mobile && !MOBILE_PATTERN.test(text)) {
          return fail('must be an international number, e.g. +919876543210');
        }
        return def.dataType === T.Email ? text.toLowerCase() : text;
      }
      case T.Number: {
        if (typeof value !== 'number' || !Number.isFinite(value)) {
          return fail('must be a number');
        }
        if (def.min !== null && value < def.min) {
          return fail(`must be at least ${String(def.min)}`);
        }
        if (def.max !== null && value > def.max) {
          return fail(`must be at most ${String(def.max)}`);
        }
        return value;
      }
      case T.Boolean:
        return typeof value === 'boolean'
          ? value
          : fail('must be true or false');
      case T.Date:
        return typeof value === 'string' &&
          DATE_PATTERN.test(value) &&
          isISO8601(value, { strict: true })
          ? value
          : fail('must be a date YYYY-MM-DD');
      case T.DateTime:
        return typeof value === 'string' && isISO8601(value, { strict: true })
          ? new Date(value).toISOString()
          : fail('must be an ISO 8601 date-time');
      case T.Dropdown:
        return typeof value === 'string' &&
          def.options.some((o) => o.value === value)
          ? value
          : fail(
              `must be one of: ${def.options.map((o) => o.value).join(', ')}`,
            );
      case T.MultiSelect: {
        if (
          !Array.isArray(value) ||
          !value.every(
            (v) =>
              typeof v === 'string' && def.options.some((o) => o.value === v),
          )
        ) {
          return fail(
            `must be a list of: ${def.options.map((o) => o.value).join(', ')}`,
          );
        }
        return [...new Set(value as string[])];
      }
      default:
        return fail('this variable has no value type');
    }
  }

  private checkMatches(
    defs: UserAttribute[],
    patch: Values,
    errors: ApiFieldError[],
    prefix: string,
  ): void {
    for (const def of defs.filter(
      (d) => d.isMatchEnabled && d.matchWith && d.name in patch,
    )) {
      if (patch[def.name] !== patch[def.matchWith ?? '']) {
        errors.push({
          field: `${prefix}.${def.name}`,
          message: `${def.name} must match ${def.matchWith ?? ''}`,
        });
      }
    }
  }

  private checkRequired(
    top: UserAttribute[],
    _defs: UserAttribute[],
    result: Values,
    errors: ApiFieldError[],
  ): void {
    // Required variables may not be cleared; missing ones are reported by filterForOutput (missingRequired).
    for (const def of top.filter(
      (d) =>
        d.isRequired &&
        d.coreField === null &&
        d.name in result &&
        result[d.name] === null,
    )) {
      errors.push({
        field: `attributes.${def.name}`,
        message: `${def.name} is required`,
      });
    }
  }

  private async assertUnique(
    top: UserAttribute[],
    defs: UserAttribute[],
    result: Values,
    current: Values,
    userId: string | null,
  ): Promise<void> {
    const errors: ApiFieldError[] = [];
    const check = async (path: string, value: unknown) => {
      if (
        !isEmpty(value) &&
        (await this.usersService.isAttributeValueTaken(path, value, userId))
      ) {
        errors.push({
          field: `attributes.${path}`,
          message: 'this value is already used by another account',
        });
      }
    };
    for (const def of top.filter(
      (d) =>
        d.isUnique && d.kind === AttributeKind.Field && d.coreField === null,
    )) {
      if (result[def.name] !== current[def.name]) {
        await check(def.name, result[def.name]);
      }
    }
    for (const group of top.filter(
      (d) =>
        d.kind === AttributeKind.Group &&
        d.groupType === AttributeGroupType.Object,
    )) {
      for (const child of defs.filter(
        (c) => c.parentId === group._id && c.isUnique,
      )) {
        const value = asObject(result[group.name])[child.name];
        if (value !== asObject(current[group.name])[child.name]) {
          await check(`${group.name}.${child.name}`, value);
        }
      }
    }
    if (errors.length > 0) {
      throw new AppException(
        HttpStatus.CONFLICT,
        ErrorCode.DuplicateResource,
        'Some values are already in use',
        errors,
      );
    }
  }

  /** Custom password variables are stored as Argon2 hashes. */
  private async hashPasswords(
    top: UserAttribute[],
    _defs: UserAttribute[],
    result: Values,
    current: Values,
  ): Promise<Values> {
    for (const def of top.filter(
      (d) => d.isPassword && d.coreField === null && !d.isMatchEnabled,
    )) {
      const value = result[def.name];
      if (typeof value === 'string' && value !== current[def.name]) {
        result[def.name] = await this.passwordService.hash(value);
      }
    }
    for (const def of top.filter((d) => d.isMatchEnabled && d.isPassword)) {
      // Confirmation fields are never stored.
      Reflect.deleteProperty(result, def.name);
    }
    return result;
  }
}

const INVALID = Symbol('invalid');

function asObject(value: unknown): Values {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Values)
    : {};
}

function isEmpty(value: unknown): boolean {
  return (
    value === undefined ||
    value === null ||
    value === '' ||
    (Array.isArray(value) && value.length === 0)
  );
}
