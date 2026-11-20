import { HttpStatus, Injectable } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { ErrorCode } from '@common/constants/error-codes.constants';
import { AppException } from '@common/exceptions/app.exception';
import type { Paginated } from '@common/interfaces/api-response.interface';
import { toCsv } from '@common/utils/csv.util';
import { USER_PERMISSIONS as U } from '@modules/access-control/constants/access-control.constants';
import type { Actor } from '@modules/access-control/interfaces/actor.interface';
import { AccessMappingsService } from '@modules/access-control/services/access-mappings.service';
import { AccessResolverService } from '@modules/access-control/services/access-resolver.service';
import {
  type BulkJobDefinition,
  BulkJobsService,
  type BulkRowOutcome,
} from '@modules/bulk-jobs/bulk-jobs.service';
import type {
  BulkJobDto,
  BulkJobStatsDto,
} from '@modules/bulk-jobs/dto/bulk-job.dto';
import type { IncomingFile } from '@modules/files/services/files.service';
import type { AttributeResponseDto } from '@modules/user-schema/dto/user-attribute.dto';
import {
  AttributeDataType,
  AttributeGroupType,
  AttributeKind,
} from '@modules/user-schema/enums/user-schema.enum';
import { UserRole } from '@modules/users/enums/user-role.enum';
import { UserStatus } from '@modules/users/enums/user-status.enum';
import { UsersService } from '@modules/users/users.service';

import {
  ADMIN_SETTABLE_STATUSES,
  AdminCreateUserDto,
  AdminSetPasswordDto,
  AdminUpdateUserDto,
  type AdminUserListQueryDto,
} from '../dto/admin-user.dto';
import { UserAdminService } from './user-admin.service';

/** The three bulk operations on the Bulk user operations page. */
export const BULK_USER_TYPES = ['create', 'update', 'password'] as const;
export type BulkUserType = (typeof BULK_USER_TYPES)[number];

/** A path segment → the operation (404 for anything else). */
export function bulkType(value: string): BulkUserType {
  const match = BULK_USER_TYPES.find((t) => t === value);
  if (!match) {
    throw new AppException(
      HttpStatus.NOT_FOUND,
      ErrorCode.NotFound,
      'Unknown bulk operation',
    );
  }
  return match;
}

const KIND: Record<BulkUserType, string> = {
  create: 'USER_CREATE',
  update: 'USER_UPDATE',
  password: 'USER_PASSWORD',
};
const PERMISSION: Record<BulkUserType, string> = {
  create: U.Create,
  update: U.Update,
  password: U.PasswordManage,
};
const MAX_ROWS = 1000;
/** In an update file: this value empties a field (a blank cell leaves it as it is). */
const CLEAR = '-';

const CREATE_COLUMNS = [
  'email',
  'given_name',
  'family_name',
  'username',
  'password',
  'must_change_password',
  'email_verified',
  'send_welcome_email',
  'groups',
] as const;
const UPDATE_COLUMNS = [
  'email',
  'given_name',
  'family_name',
  'username',
  'email_verified',
  'status',
  'groups',
] as const;
const PASSWORD_COLUMNS = [
  'email',
  'given_name',
  'family_name',
  'action',
  'new_password',
  'must_change_password',
  'notify',
] as const;

/** A custom profile field as a column: `phone_number`, or `address.street` inside a group. */
interface AttributeColumn {
  column: string;
  attribute: AttributeResponseDto;
  /** Set for a field inside an object group (address.street). */
  groupName: string | null;
}

interface RowContext {
  attributes: AttributeColumn[];
}

const isBlank = (value: string | undefined): value is undefined | '' =>
  value === undefined || value.trim() === '';

function parseBoolean(
  column: string,
  value: string | undefined,
  fallback: boolean,
): boolean {
  if (isBlank(value)) {
    return fallback;
  }
  const text = value.trim().toLowerCase();
  if (['true', 'yes', 'y', '1'].includes(text)) {
    return true;
  }
  if (['false', 'no', 'n', '0'].includes(text)) {
    return false;
  }
  throw new Error(`${column}: use true or false`);
}

/** "GRP-01|GRP-05" → codes. */
const splitList = (value: string): string[] =>
  value
    .split('|')
    .map((part) => part.trim())
    .filter(Boolean);

/** The DTO's own validation (same rules as the single-user screens). */
async function validated<T extends object>(
  cls: new () => T,
  plain: object,
): Promise<T> {
  const instance = plainToInstance(cls, plain);
  const errors = await validate(instance, {
    whitelist: true,
    forbidNonWhitelisted: true,
  });
  if (errors.length > 0) {
    const first = errors
      .flatMap((e) =>
        Object.values(e.constraints ?? {}).map((m) => `${e.property}: ${m}`),
      )
      .slice(0, 3);
    throw new Error(first.join('; '));
  }
  return instance;
}

/**
 * Bulk user operations (create, update, reset password) on top of the single-user service:
 * every row goes through the same checks as the screens (password policy, uniqueness, only
 * granting access you have). Files run as bulk jobs (history, progress, result CSV).
 */
@Injectable()
export class BulkUsersService {
  constructor(
    private readonly userAdminService: UserAdminService,
    private readonly usersService: UsersService,
    private readonly mappingsService: AccessMappingsService,
    private readonly resolver: AccessResolverService,
    private readonly bulkJobs: BulkJobsService,
  ) {}

  // ---------------------------------------------------------------- files

  /** Column names only (create starts from scratch; update / password usually start from an export). */
  async template(
    type: BulkUserType,
    actor: Actor,
  ): Promise<{ fileName: string; csv: string }> {
    await this.assertAllowed(type, actor);
    const attributes =
      type === 'password' ? [] : await this.attributeColumns(actor);
    return {
      fileName: `bulk-${type === 'password' ? 'reset-password' : type}-template.csv`,
      csv: toCsv(this.columnsOf(type, attributes), []),
    };
  }

  /** The users matching the search page's filters, ready to edit and upload (max 1000). */
  async export(
    type: Exclude<BulkUserType, 'create'>,
    query: AdminUserListQueryDto,
    actor: Actor,
  ): Promise<{ fileName: string; csv: string; count: number }> {
    await this.assertAllowed(type, actor);
    const filter = await this.userAdminService.buildFilter(query);
    const users = await this.usersService.listForExport(
      filter,
      { email: 1 },
      0,
      MAX_ROWS + 1,
    );
    if (users.length > MAX_ROWS) {
      throw new AppException(
        HttpStatus.BAD_REQUEST,
        ErrorCode.ValidationFailed,
        `More than ${String(MAX_ROWS)} users match: narrow the search first`,
      );
    }
    const stamp = new Date().toISOString().slice(0, 19).replaceAll(':', '-');
    if (type === 'password') {
      return {
        fileName: `reset-password-${stamp}.csv`,
        count: users.length,
        csv: toCsv(
          [...PASSWORD_COLUMNS],
          users.map((u) => [
            u.email,
            u.firstName,
            u.lastName ?? '',
            'link',
            '',
            'true',
            'true',
          ]),
        ),
      };
    }
    const attributes = await this.attributeColumns(actor);
    const groups = await this.mappingsService.groupsOfUsers(
      users.map((u) => u.id),
    );
    return {
      fileName: `update-users-${stamp}.csv`,
      count: users.length,
      csv: toCsv(
        this.columnsOf('update', attributes),
        users.map((u) => [
          u.email,
          u.firstName,
          u.lastName ?? '',
          u.username ?? '',
          String(u.isEmailVerified),
          u.status,
          (groups.get(u.id) ?? []).map((g) => g.code).join('|'),
          ...attributes.map((a) => attributeText(a, u.attributes)),
        ]),
      ),
    };
  }

  // ---------------------------------------------------------------- jobs

  async upload(
    type: BulkUserType,
    file: IncomingFile | undefined,
    actor: Actor,
  ): Promise<BulkJobDto> {
    await this.assertAllowed(type, actor);
    if (!file) {
      throw new AppException(
        HttpStatus.BAD_REQUEST,
        ErrorCode.ValidationFailed,
        'Choose a CSV or Excel file',
        [{ field: 'file', message: 'Choose a CSV or Excel file' }],
      );
    }
    const me = await this.usersService.findById(actor.auth.userId);
    const attributes =
      type === 'password' ? [] : await this.attributeColumns(actor);
    return this.bulkJobs.start(this.definition(type, attributes, actor), file, {
      userId: actor.auth.userId,
      email: me?.email ?? null,
    });
  }

  list(
    type: BulkUserType,
    query: { page?: number; limit?: number; search?: string },
  ): Promise<Paginated<BulkJobDto>> {
    return this.bulkJobs.list(KIND[type], query);
  }

  get(type: BulkUserType, id: string): Promise<BulkJobDto> {
    return this.bulkJobs.get(KIND[type], id);
  }

  result(
    type: BulkUserType,
    id: string,
  ): Promise<{ fileName: string; csv: string }> {
    return this.bulkJobs.resultCsv(KIND[type], id);
  }

  stats(type: BulkUserType): Promise<BulkJobStatsDto> {
    return this.bulkJobs.stats(KIND[type]);
  }

  // ---------------------------------------------------------------- definitions

  private definition(
    type: BulkUserType,
    attributes: AttributeColumn[],
    actor: Actor,
  ): BulkJobDefinition<RowContext> {
    const columns = this.columnsOf(type, attributes);
    const common = {
      kind: KIND[type],
      maxRows: MAX_ROWS,
      allowedColumns: columns,
      keyColumn: 'email',
      prepare: () => Promise.resolve({ attributes }),
    };
    if (type === 'create') {
      return {
        ...common,
        requiredColumns: ['email', 'given_name', 'password'],
        secretColumns: ['password'],
        processRow: (values, context) => this.createRow(values, context, actor),
      };
    }
    if (type === 'update') {
      return {
        ...common,
        requiredColumns: ['email'],
        processRow: (values, context) => this.updateRow(values, context, actor),
      };
    }
    return {
      ...common,
      requiredColumns: ['email'],
      secretColumns: ['new_password'],
      processRow: (values) => this.passwordRow(values, actor),
    };
  }

  private async createRow(
    values: Record<string, string>,
    context: RowContext,
    actor: Actor,
  ): Promise<BulkRowOutcome> {
    const groupIds = isBlank(values.groups)
      ? []
      : await this.groupIds(splitList(values.groups));
    const attributes = this.attributesFrom(values, context.attributes, false);
    const dto = await validated(AdminCreateUserDto, {
      email: values.email?.trim().toLowerCase(),
      firstName: values.given_name?.trim(),
      ...(isBlank(values.family_name)
        ? {}
        : { lastName: values.family_name.trim() }),
      ...(isBlank(values.username)
        ? {}
        : { username: values.username.trim().toLowerCase() }),
      password: values.password ?? '',
      mustChangePassword: parseBoolean(
        'must_change_password',
        values.must_change_password,
        true,
      ),
      isEmailVerified: parseBoolean(
        'email_verified',
        values.email_verified,
        true,
      ),
      sendWelcomeEmail: parseBoolean(
        'send_welcome_email',
        values.send_welcome_email,
        false,
      ),
      ...(groupIds.length > 0 ? { groupIds } : {}),
      ...(Object.keys(attributes).length > 0 ? { attributes } : {}),
    });
    await this.userAdminService.create(dto, actor);
    return { status: 'SUCCESS', message: 'Created' };
  }

  private async updateRow(
    values: Record<string, string>,
    context: RowContext,
    actor: Actor,
  ): Promise<BulkRowOutcome> {
    const user = await this.findUser(values.email);
    const current = await this.userAdminService.get(user.id);
    const changed: string[] = [];

    // Name, username, email verified
    const profile: Record<string, unknown> = {};
    if (
      !isBlank(values.given_name) &&
      values.given_name.trim() !== current.firstName
    ) {
      profile.firstName = values.given_name.trim();
    }
    if (!isBlank(values.family_name)) {
      const next =
        values.family_name.trim() === CLEAR ? null : values.family_name.trim();
      if (next !== (current.lastName ?? null)) {
        profile.lastName = next;
      }
    }
    if (!isBlank(values.username)) {
      const next =
        values.username.trim() === CLEAR
          ? null
          : values.username.trim().toLowerCase();
      if (next !== (current.username ?? null)) {
        profile.username = next;
      }
    }
    if (!isBlank(values.email_verified)) {
      const isVerified = parseBoolean(
        'email_verified',
        values.email_verified,
        current.isEmailVerified,
      );
      if (isVerified !== current.isEmailVerified) {
        profile.isEmailVerified = isVerified;
      }
    }
    if (Object.keys(profile).length > 0) {
      await this.userAdminService.update(
        user.id,
        await validated(AdminUpdateUserDto, profile),
        actor,
      );
      changed.push(...Object.keys(profile));
    }

    // Status
    if (!isBlank(values.status)) {
      const status = Object.values(UserStatus).find(
        (s) => s === values.status?.trim().toUpperCase(),
      );
      if (
        !status ||
        !(ADMIN_SETTABLE_STATUSES as readonly UserStatus[]).includes(status)
      ) {
        throw new Error(`status: use ${ADMIN_SETTABLE_STATUSES.join(', ')}`);
      }
      if (status !== current.status) {
        await this.userAdminService.setStatus(
          user.id,
          { status: status as (typeof ADMIN_SETTABLE_STATUSES)[number] },
          actor,
        );
        changed.push('status');
      }
    }

    // Profile fields (only the filled-in cells; "-" empties one)
    const patch = this.attributesFrom(values, context.attributes, true);
    if (Object.keys(patch).length > 0) {
      await this.userAdminService.updateAttributes(user.id, patch, actor);
      changed.push(...Object.keys(patch));
    }

    // Groups: the cell lists every group the user should be in ("-" = none)
    if (!isBlank(values.groups)) {
      const wanted =
        values.groups.trim() === CLEAR
          ? []
          : await this.groupIds(splitList(values.groups));
      const have = (
        (await this.mappingsService.groupsOfUsers([user.id])).get(user.id) ?? []
      ).map((g) => g.id);
      const add = wanted.filter((id) => !have.includes(id));
      const remove = have.filter((id) => !wanted.includes(id));
      for (const groupId of add) {
        await this.mappingsService.assignGroupUsers(
          { groupId, userIds: [user.id] },
          actor,
        );
      }
      for (const groupId of remove) {
        await this.mappingsService.removeGroupUsers(
          { groupId, userIds: [user.id] },
          actor,
        );
      }
      if (add.length > 0 || remove.length > 0) {
        changed.push('groups');
      }
    }

    return changed.length > 0
      ? {
          status: 'SUCCESS',
          message: `Updated: ${[...new Set(changed)].join(', ')}`,
        }
      : { status: 'SKIPPED', message: 'No changes' };
  }

  private async passwordRow(
    values: Record<string, string>,
    actor: Actor,
  ): Promise<BulkRowOutcome> {
    const user = await this.findUser(values.email);
    const action = (values.action ?? '').trim().toLowerCase() || 'link';
    if (action === 'link') {
      await this.userAdminService.sendPasswordReset(user.id, actor);
      return { status: 'SUCCESS', message: 'Reset link emailed' };
    }
    if (action !== 'set') {
      throw new Error(
        'action: use link (email a reset link) or set (use new_password)',
      );
    }
    if (isBlank(values.new_password)) {
      throw new Error('new_password: required when action is set');
    }
    const dto = await validated(AdminSetPasswordDto, {
      newPassword: values.new_password,
      confirmPassword: values.new_password,
      requireChangeOnNextLogin: parseBoolean(
        'must_change_password',
        values.must_change_password,
        true,
      ),
      notifyByEmail: parseBoolean('notify', values.notify, true),
    });
    await this.userAdminService.setPassword(user.id, dto, actor);
    return { status: 'SUCCESS', message: 'Password set' };
  }

  // ---------------------------------------------------------------- helpers

  private columnsOf(
    type: BulkUserType,
    attributes: AttributeColumn[],
  ): string[] {
    const base =
      type === 'create'
        ? CREATE_COLUMNS
        : type === 'update'
          ? UPDATE_COLUMNS
          : PASSWORD_COLUMNS;
    return [...base, ...attributes.map((a) => a.column)];
  }

  /** Profile fields an admin can fill: plain fields and fields inside object groups. */
  private async attributeColumns(actor: Actor): Promise<AttributeColumn[]> {
    const { attributes } = await this.userAdminService.createConfig(actor);
    return attributes.flatMap((a): AttributeColumn[] => {
      if (a.kind === AttributeKind.Field) {
        return [
          { column: a.name.toLowerCase(), attribute: a, groupName: null },
        ];
      }
      if (a.groupType === AttributeGroupType.Object) {
        return (a.children ?? [])
          .filter((c) => c.kind === AttributeKind.Field)
          .map((c) => ({
            column: `${a.name}.${c.name}`.toLowerCase(),
            attribute: c,
            groupName: a.name,
          }));
      }
      return []; // lists of groups (several addresses) don't fit one cell
    });
  }

  /** Cells → attribute values. `forUpdate`: blank = keep, "-" = clear (null). */
  private attributesFrom(
    values: Record<string, string>,
    columns: AttributeColumn[],
    forUpdate: boolean,
  ): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const { column, attribute, groupName } of columns) {
      const raw = values[column];
      if (isBlank(raw)) {
        continue;
      }
      const value =
        forUpdate && raw.trim() === CLEAR
          ? null
          : cellToValue(column, attribute, raw.trim());
      if (groupName) {
        const group =
          (out[groupName] as Record<string, unknown> | undefined) ?? {};
        group[attribute.name] = value;
        out[groupName] = group;
      } else {
        out[attribute.name] = value;
      }
    }
    return out;
  }

  private async groupIds(codes: string[]): Promise<string[]> {
    const found = await this.mappingsService.groupIdsByCodes(codes);
    const unknown = codes.filter((c) => !found.has(c.toUpperCase()));
    if (unknown.length > 0) {
      throw new Error(`groups: unknown group ID(s) ${unknown.join(', ')}`);
    }
    return codes.map((c) => found.get(c.toUpperCase()) ?? '');
  }

  private async findUser(email: string | undefined): Promise<{ id: string }> {
    if (isBlank(email)) {
      throw new Error('email: required');
    }
    const user = await this.usersService.findByEmail(
      email.trim().toLowerCase(),
    );
    if (!user) {
      throw new Error('email: no user with this email');
    }
    return user;
  }

  /** Admins pass; others need the operation's permission (create / update / password). */
  private async assertAllowed(type: BulkUserType, actor: Actor): Promise<void> {
    if (actor.auth.role === (UserRole.Admin as string)) {
      return;
    }
    const held = await this.resolver.getPermissionKeys(actor.auth.userId);
    if (!held.has(PERMISSION[type])) {
      throw new AppException(
        HttpStatus.FORBIDDEN,
        ErrorCode.Forbidden,
        `This needs the ${PERMISSION[type]} permission`,
      );
    }
  }
}

/** A cell → the attribute's value type (labels accepted for options). */
function cellToValue(
  column: string,
  attribute: AttributeResponseDto,
  text: string,
): unknown {
  const option = (value: string) => {
    const match = attribute.options.find(
      (o) =>
        o.value.toLowerCase() === value.toLowerCase() ||
        o.label.toLowerCase() === value.toLowerCase(),
    );
    if (!match) {
      throw new Error(
        `${column}: "${value}" is not one of ${attribute.options.map((o) => o.value).join(', ')}`,
      );
    }
    return match.value;
  };
  switch (attribute.dataType) {
    case AttributeDataType.Boolean:
      return parseBoolean(column, text, false);
    case AttributeDataType.Number: {
      const n = Number(text);
      if (!Number.isFinite(n)) {
        throw new Error(`${column}: not a number`);
      }
      return n;
    }
    case AttributeDataType.Dropdown:
      return option(text);
    case AttributeDataType.MultiSelect:
      return splitList(text).map(option);
    default:
      return text;
  }
}

/** A stored value → cell text (the reverse of cellToValue; groups by path). */
function attributeText(
  column: AttributeColumn,
  stored: Record<string, unknown>,
): string {
  const holder = column.groupName
    ? (stored[column.groupName] as Record<string, unknown> | undefined)
    : stored;
  const value = holder?.[column.attribute.name];
  if (value === undefined || value === null) {
    return '';
  }
  if (Array.isArray(value)) {
    return value
      .map((v: unknown) =>
        typeof v === 'object'
          ? JSON.stringify(v)
          : String(v as string | number | boolean),
      )
      .join('|');
  }
  if (typeof value === 'object') {
    return JSON.stringify(value);
  }
  if (typeof value === 'string') {
    return value;
  }
  return typeof value === 'number' || typeof value === 'boolean'
    ? String(value)
    : '';
}
