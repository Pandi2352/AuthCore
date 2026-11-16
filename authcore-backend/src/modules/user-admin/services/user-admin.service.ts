import { HttpStatus, Inject, Injectable, Logger } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';

import { ErrorCode } from '@common/constants/error-codes.constants';
import { AppException } from '@common/exceptions/app.exception';
import type { Paginated } from '@common/interfaces/api-response.interface';
import { normalizePagination, paginate } from '@common/utils/pagination.util';
import {
  buildDateRange,
  buildSort,
  containsPattern,
} from '@common/utils/query.util';
import { registrationConfig } from '@config/configuration';
import {
  AuditAction,
  AuditEntity,
  MappingType,
} from '@modules/access-control/enums/access-control.enum';
import type { Actor } from '@modules/access-control/interfaces/actor.interface';
import { AccessAuditService } from '@modules/access-control/services/access-audit.service';
import { AccessMappingsService } from '@modules/access-control/services/access-mappings.service';
import { AccessResolverService } from '@modules/access-control/services/access-resolver.service';
import { AccountPurgeService } from '@modules/account/services/account-purge.service';
import { UserDataCleanupService } from '@modules/account/services/user-data-cleanup.service';
import { LoginSecurityService } from '@modules/auth/services/login-security.service';
import { PasswordManagementService } from '@modules/auth/services/password-management.service';
import type { FileResponseDto } from '@modules/files/dto/file.dto';
import { AvatarService } from '@modules/files/services/avatar.service';
import type { IncomingFile } from '@modules/files/services/files.service';
import type { MailContent } from '@modules/mail/interfaces/mail-message.interface';
import { MailService } from '@modules/mail/mail.service';
import {
  accountStatusChangedEmail,
  adminCreatedAccountEmail,
  emailChangedNoticeEmail,
  passwordSetByAdminEmail,
} from '@modules/mail/templates/mail-templates';
import { PasswordValidationService } from '@modules/password-policy/services/password-validation.service';
import { SessionsService } from '@modules/sessions/sessions.service';
import {
  ActivityEvent,
  VerificationType,
} from '@modules/user-activity/enums/user-activity.enum';
import { UserActivityService } from '@modules/user-activity/user-activity.service';
import { UserAttributeValuesService } from '@modules/user-schema/services/user-attribute-values.service';
import type {
  AdminUserResponseDto,
  UserResponseDto,
} from '@modules/users/dto/user-response.dto';
import { UserRole } from '@modules/users/enums/user-role.enum';
import { UserSource } from '@modules/users/enums/user-source.enum';
import { UserStatus } from '@modules/users/enums/user-status.enum';
import { UsersService } from '@modules/users/users.service';
import { PasswordService } from '@shared/password.service';

import {
  ADMIN_USER_SORT_FIELDS,
  type AdminCreateUserDto,
  type AdminSessionDto,
  type AdminSetPasswordDto,
  type AdminSetStatusDto,
  type AdminUpdateUserDto,
  type AdminUserDetailsDto,
  type AdminUserListQueryDto,
  type PasswordResetSentDto,
  type PurgeRunDto,
} from '../dto/admin-user.dto';

/**
 * User administration. Guard rails on top of the permission checks:
 * - admins act on other accounts only (their own account → /users/me);
 * - only ADMIN users may manage ADMIN users or change roles;
 * - the last active ADMIN can't be suspended, demoted or deleted.
 * Every change is written to the access-control audit log (entity USER).
 */
@Injectable()
export class UserAdminService {
  private readonly logger = new Logger(UserAdminService.name);

  constructor(
    private readonly usersService: UsersService,
    private readonly sessionsService: SessionsService,
    private readonly passwordService: PasswordService,
    private readonly passwordValidationService: PasswordValidationService,
    private readonly passwordManagementService: PasswordManagementService,
    private readonly loginSecurityService: LoginSecurityService,
    private readonly mappingsService: AccessMappingsService,
    private readonly resolver: AccessResolverService,
    private readonly auditService: AccessAuditService,
    private readonly cleanupService: UserDataCleanupService,
    private readonly purgeService: AccountPurgeService,
    private readonly mailService: MailService,
    private readonly activityService: UserActivityService,
    private readonly attributeValuesService: UserAttributeValuesService,
    private readonly avatarService: AvatarService,
    @Inject(registrationConfig.KEY)
    private readonly registration: ConfigType<typeof registrationConfig>,
  ) {}

  async list(
    query: AdminUserListQueryDto,
  ): Promise<Paginated<AdminUserResponseDto>> {
    const { page, limit, skip } = normalizePagination(query.page, query.limit);
    const createdAt = buildDateRange(
      'created',
      query.createdFrom,
      query.createdTo,
    );
    const updatedAt = buildDateRange(
      'updated',
      query.updatedFrom,
      query.updatedTo,
    );
    const search = query.search ? containsPattern(query.search) : null;
    const deleted = query.deleted ?? 'EXCLUDE';
    const filter = {
      ...(deleted === 'EXCLUDE'
        ? { deletedAt: null }
        : deleted === 'ONLY'
          ? { deletedAt: { $ne: null } }
          : {}),
      ...(search
        ? {
            $or: [
              { email: search },
              { username: search },
              { firstName: search },
              { lastName: search },
            ],
          }
        : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.role ? { role: query.role } : {}),
      ...(query.source ? { source: query.source } : {}),
      ...(query.isEmailVerified !== undefined
        ? { isEmailVerified: query.isEmailVerified }
        : {}),
      ...(query.isPendingDeletion !== undefined
        ? {
            deletionScheduledAt: query.isPendingDeletion ? { $ne: null } : null,
          }
        : {}),
      ...(createdAt ? { createdAt } : {}),
      ...(updatedAt ? { updatedAt } : {}),
      ...(query.attr
        ? await this.attributeValuesService.searchFilter(query.attr)
        : {}),
    };
    const { items, total } = await this.usersService.listForAdmin(
      filter,
      buildSort(
        query.sortBy,
        query.sortOrder,
        ADMIN_USER_SORT_FIELDS,
        'createdAt',
      ),
      skip,
      limit,
    );
    return paginate(items, page, limit, total);
  }

  async get(id: string): Promise<AdminUserDetailsDto> {
    const user = await this.findOrThrow(id, true);
    const [sessions, links, keys, lockedUntil, lastActivity] =
      await Promise.all([
        this.sessionsService.listActiveForUser(id),
        this.mappingsService.list({
          type: MappingType.GroupUser,
          userId: id,
          page: 1,
          limit: 100,
        }),
        this.resolver.resolve(id),
        this.loginSecurityService.getActiveLock(
          this.loginSecurityService.keyFor(id, ''),
        ),
        this.activityService.lastActivityAt(id),
      ]);
    const values = await this.attributeValuesService.filterForOutput(
      await this.usersService.getAttributes(id),
      { isAdmin: true, include: [] },
    );
    const lastActivityAt = latest([
      user.lastLoginAt,
      lastActivity,
      ...sessions.map((s) => s.lastUsedAt),
    ]);
    return Object.assign(user, {
      activeSessionCount: sessions.length,
      groups: links.items.flatMap((m) => (m.group ? [m.group] : [])),
      permissionKeys: keys.permissions.map((p) => p.permissionKey),
      isLocked: lockedUntil !== null,
      lockedUntil,
      lastActivityAt,
      attributes: values.attributes,
      missingRequired: values.missingRequired,
    });
  }

  async create(
    dto: AdminCreateUserDto,
    actor: Actor,
  ): Promise<AdminUserDetailsDto> {
    if (await this.usersService.isEmailTaken(dto.email)) {
      throw this.duplicate(
        'email',
        'An account with this email already exists',
      );
    }
    if (
      dto.username &&
      (await this.usersService.isUsernameTaken(dto.username))
    ) {
      throw this.duplicate('username', 'This username is already taken');
    }
    await this.passwordValidationService.assertAcceptable(
      dto.password,
      'password',
      dto,
    );
    const attributeChanges = dto.attributes
      ? await this.attributeValuesService.merge({}, dto.attributes, {
          isAdmin: true,
          userId: null,
        })
      : null;
    if (attributeChanges && Object.keys(attributeChanges.core).length > 0) {
      throw new AppException(
        HttpStatus.BAD_REQUEST,
        ErrorCode.ValidationFailed,
        'Validation failed',
        [
          {
            field: 'attributes',
            message: 'set names and username with the top-level fields',
          },
        ],
      );
    }
    const groupIds = dto.groupIds ?? [];
    if (groupIds.length > 0) {
      // Validate the groups and the escalation rule before creating anything.
      await this.mappingsService.validateRoleSetup(groupIds, [], actor);
      await this.resolver.assertCanGrant(
        actor,
        await this.resolver.permissionKeysOfGroups(groupIds),
      );
    }
    const isPasswordChangeRequired = dto.mustChangePassword ?? true;
    const user = await this.usersService.create({
      email: dto.email,
      firstName: dto.firstName,
      ...(dto.lastName ? { lastName: dto.lastName } : {}),
      ...(dto.username ? { username: dto.username } : {}),
      passwordHash: await this.passwordService.hash(dto.password),
      status: UserStatus.Active,
      isEmailVerified: dto.isEmailVerified ?? true,
      mustChangePassword: isPasswordChangeRequired,
      source: UserSource.Admin,
      createdBy: actor.auth.userId,
    });
    if (attributeChanges) {
      await this.usersService.setAttributes(
        user.id,
        attributeChanges.attributes,
      );
    }
    for (const groupId of groupIds) {
      await this.mappingsService.assignGroupUsers(
        { groupId, userIds: [user.id] },
        actor,
      );
    }
    await this.audit(actor, user.id, AuditAction.Create, null, {
      email: user.email,
      source: UserSource.Admin,
      groupIds,
    });
    if (dto.sendWelcomeEmail ?? true) {
      await this.send(user, 'admin-created-account', () =>
        adminCreatedAccountEmail({
          appName: this.registration.appName,
          firstName: user.firstName,
          email: user.email,
          mustChangePassword: isPasswordChangeRequired,
        }),
      );
    }
    this.logger.log({
      message: 'User created by admin',
      userId: user.id,
      changedBy: actor.auth.userId,
    });
    return this.get(user.id);
  }

  async update(
    id: string,
    dto: AdminUpdateUserDto,
    actor: Actor,
  ): Promise<AdminUserDetailsDto> {
    const user = await this.manageable(id, actor);
    if (
      dto.username &&
      (await this.usersService.isUsernameTakenByOther(dto.username, id))
    ) {
      throw this.duplicate('username', 'This username is already taken');
    }
    if (
      dto.email &&
      dto.email !== user.email &&
      (await this.usersService.isEmailTakenByOther(dto.email, id))
    ) {
      throw this.duplicate(
        'email',
        'An account with this email already exists',
      );
    }
    const changes = {
      ...(dto.firstName !== undefined ? { firstName: dto.firstName } : {}),
      ...(dto.lastName !== undefined ? { lastName: dto.lastName } : {}),
      ...(dto.username !== undefined ? { username: dto.username } : {}),
    };
    await this.usersService.updateProfile(id, changes);
    if (
      dto.isEmailVerified !== undefined &&
      dto.isEmailVerified !== user.isEmailVerified
    ) {
      await this.usersService.setEmailVerified(id, dto.isEmailVerified);
    }
    if (dto.email && dto.email !== user.email) {
      await this.usersService.changeEmail(id, user.email, dto.email);
      await this.send(user, 'email-changed-notice', () =>
        emailChangedNoticeEmail({
          appName: this.registration.appName,
          firstName: user.firstName,
          newEmail: dto.email ?? '',
        }),
      );
    }
    await this.audit(
      actor,
      id,
      AuditAction.Update,
      pick(user, Object.keys(dto)),
      { ...changes, ...(dto.email ? { email: dto.email } : {}) },
    );
    return this.get(id);
  }

  /** ACTIVE / INACTIVE / SUSPENDED / BANNED. Anything but ACTIVE signs the user out everywhere. */
  async setStatus(
    id: string,
    dto: AdminSetStatusDto,
    actor: Actor,
  ): Promise<AdminUserDetailsDto> {
    const user = await this.manageable(id, actor);
    if (dto.status !== UserStatus.Active) {
      await this.assertNotLastAdmin(user);
    }
    const updated = await this.usersService.setStatus(id, dto.status, {
      reason: dto.reason ?? null,
      changedBy: actor.auth.userId,
    });
    if (!updated) {
      throw AccessErrorsNotFound();
    }
    const revokedSessionCount =
      dto.status === UserStatus.Active
        ? 0
        : await this.sessionsService.revokeAllForUser(
            id,
            `status_${dto.status.toLowerCase()}`,
          );
    if (dto.status === UserStatus.Active) {
      // A fresh start: forget earlier failed sign-ins.
      await this.loginSecurityService.clear(
        this.loginSecurityService.keyFor(id, ''),
      );
    }
    await this.audit(
      actor,
      id,
      AuditAction.Update,
      { status: user.status },
      { status: dto.status, reason: dto.reason ?? null },
    );
    await this.activityService.record({
      userId: id,
      event: ActivityEvent.StatusChanged,
      client: actor.client,
      verificationType: VerificationType.Admin,
      actorId: actor.auth.userId,
      details: {
        from: user.status,
        to: dto.status,
        reason: dto.reason ?? null,
      },
    });
    if (dto.notifyUser ?? true) {
      await this.send(user, 'account-status-changed', () =>
        accountStatusChangedEmail({
          appName: this.registration.appName,
          firstName: user.firstName,
          status: dto.status,
          reason: dto.reason ?? null,
        }),
      );
    }
    this.logger.log({
      message: 'User status changed by admin',
      userId: id,
      status: dto.status,
      revokedSessionCount,
      changedBy: actor.auth.userId,
    });
    return this.get(id);
  }

  async setRole(
    id: string,
    role: UserRole,
    actor: Actor,
  ): Promise<AdminUserDetailsDto> {
    const user = await this.manageable(id, actor);
    if (role !== UserRole.Admin) {
      await this.assertNotLastAdmin(user);
    }
    await this.usersService.setRoleById(id, role);
    this.resolver.invalidate();
    await this.audit(
      actor,
      id,
      AuditAction.Update,
      { role: user.role },
      { role },
    );
    return this.get(id);
  }

  /** Emails the user a normal password-reset code / link. */
  async sendPasswordReset(
    id: string,
    actor: Actor,
  ): Promise<PasswordResetSentDto> {
    const user = await this.manageable(id, actor);
    const { expiresInMinutes } =
      await this.passwordManagementService.sendResetByAdmin(user);
    await this.audit(actor, id, AuditAction.Update, null, {
      passwordResetEmailSent: true,
    });
    return { sentTo: user.email, expiresInMinutes };
  }

  /**
   * The admin sets a new password (typed or generated). Policy and password
   * history apply; the user is signed out; optional "change at next login"
   * and email notice (never containing the password).
   */
  async setPassword(
    id: string,
    dto: AdminSetPasswordDto,
    actor: Actor,
  ): Promise<AdminUserDetailsDto> {
    const user = await this.manageable(id, actor);
    const account = await this.usersService.findPasswordHashes(id);
    if (!account) {
      throw AccessErrorsNotFound();
    }
    await this.passwordValidationService.assertAcceptable(
      dto.newPassword,
      'newPassword',
      user,
      {
        passwordHash: account.passwordHash,
        history: account.history,
      },
    );
    const isUpdated = await this.usersService.changePasswordHash(
      id,
      account.passwordHash,
      await this.passwordService.hash(dto.newPassword),
      await this.passwordValidationService.historySize(),
    );
    if (!isUpdated) {
      throw new AppException(
        HttpStatus.CONFLICT,
        ErrorCode.Conflict,
        'The password was changed meanwhile. Try again.',
      );
    }
    const isChangeRequired = dto.requireChangeOnNextLogin ?? false;
    if (isChangeRequired) {
      await this.usersService.setMustChangePassword(id, true);
    }
    const revoked =
      (dto.signOutAllSessions ?? true)
        ? await this.sessionsService.revokeAllForUser(
            id,
            'password_set_by_admin',
          )
        : 0;
    await this.loginSecurityService.clear(
      this.loginSecurityService.keyFor(id, ''),
    );
    await this.activityService.record({
      userId: id,
      event: ActivityEvent.PasswordSetByAdmin,
      client: actor.client,
      verificationType: VerificationType.Admin,
      actorId: actor.auth.userId,
      details: {
        revokedSessionCount: revoked,
        mustChangePassword: isChangeRequired,
      },
    });
    await this.audit(actor, id, AuditAction.Update, null, {
      passwordSetByAdmin: true,
      mustChangePassword: isChangeRequired,
      revokedSessionCount: revoked,
    });
    if (dto.notifyByEmail ?? true) {
      await this.send(user, 'password-set-by-admin', () =>
        passwordSetByAdminEmail({
          appName: this.registration.appName,
          firstName: user.firstName,
          mustChangePassword: isChangeRequired,
        }),
      );
    }
    return this.get(id);
  }

  async setAvatar(
    id: string,
    file: IncomingFile | undefined,
    actor: Actor,
  ): Promise<FileResponseDto> {
    await this.manageable(id, actor);
    const avatar = await this.avatarService.set(id, file, actor.auth.userId);
    await this.audit(actor, id, AuditAction.Update, null, {
      avatarFileId: avatar.id,
    });
    return avatar;
  }

  async removeAvatar(
    id: string,
    actor: Actor,
  ): Promise<{ isRemoved: boolean }> {
    await this.manageable(id, actor);
    const result = await this.avatarService.remove(id);
    await this.audit(actor, id, AuditAction.Update, null, {
      avatarRemoved: result.isRemoved,
    });
    return result;
  }

  /** Admin edit of the personal details (internal and read-only variables allowed). */
  async updateAttributes(
    id: string,
    patch: Record<string, unknown>,
    actor: Actor,
  ): Promise<AdminUserDetailsDto> {
    await this.manageable(id, actor);
    const current = await this.usersService.getAttributes(id);
    const { attributes, core } = await this.attributeValuesService.merge(
      current,
      patch,
      { isAdmin: true, userId: id },
    );
    await this.attributeValuesService.assertCoreChanges(core, id);
    if (Object.keys(core).length > 0) {
      await this.usersService.updateProfile(id, core);
    }
    await this.usersService.setAttributes(id, attributes);
    await this.audit(actor, id, AuditAction.Update, null, {
      attributesChanged: Object.keys(patch),
    });
    return this.get(id);
  }

  async accessTree(id: string) {
    await this.findOrThrow(id, true);
    return this.mappingsService.userAccessTree(id);
  }

  /** Silent: no email. The user must change the password at the next sign-in. */
  async forcePasswordReset(
    id: string,
    shouldSignOut: boolean,
    actor: Actor,
  ): Promise<AdminUserDetailsDto> {
    await this.manageable(id, actor);
    await this.usersService.setMustChangePassword(id, true);
    const revoked = shouldSignOut
      ? await this.sessionsService.revokeAllForUser(
          id,
          'password_change_required',
        )
      : 0;
    await this.activityService.record({
      userId: id,
      event: ActivityEvent.PasswordChangeRequired,
      client: actor.client,
      verificationType: VerificationType.Admin,
      actorId: actor.auth.userId,
      details: { revokedSessionCount: revoked },
    });
    await this.audit(actor, id, AuditAction.Update, null, {
      mustChangePassword: true,
      revokedSessionCount: revoked,
    });
    return this.get(id);
  }

  async unlock(id: string, actor: Actor): Promise<AdminUserDetailsDto> {
    await this.manageable(id, actor);
    await this.loginSecurityService.clear(
      this.loginSecurityService.keyFor(id, ''),
    );
    await this.audit(actor, id, AuditAction.Update, null, { unlocked: true });
    return this.get(id);
  }

  async sessions(id: string): Promise<AdminSessionDto[]> {
    await this.findOrThrow(id, false);
    const sessions = await this.sessionsService.listActiveForUser(id);
    return sessions.map((s) => ({
      id: s._id,
      deviceName: s.deviceName,
      ipAddress: s.ipAddress,
      signedInAt: s.createdAt,
      lastUsedAt: s.lastUsedAt,
      expiresAt: s.expiresAt,
    }));
  }

  async revokeSessions(id: string, actor: Actor): Promise<number> {
    await this.manageable(id, actor);
    const count = await this.sessionsService.revokeAllForUser(
      id,
      'revoked_by_admin',
    );
    await this.activityService.record({
      userId: id,
      event: ActivityEvent.SessionsRevoked,
      client: actor.client,
      verificationType: VerificationType.Admin,
      actorId: actor.auth.userId,
      details: { revokedSessionCount: count },
    });
    await this.audit(actor, id, AuditAction.Revoke, null, {
      revokedSessionCount: count,
    });
    return count;
  }

  /** Soft delete: hidden and signed out, restorable. */
  async softDelete(
    id: string,
    reason: string | undefined,
    actor: Actor,
  ): Promise<AdminUserResponseDto> {
    const user = await this.manageable(id, actor);
    await this.assertNotLastAdmin(user);
    const deleted = await this.usersService.softDelete(id, actor.auth.userId);
    if (!deleted) {
      throw AccessErrorsNotFound();
    }
    await this.sessionsService.revokeAllForUser(id, 'deleted_by_admin');
    await this.audit(actor, id, AuditAction.Delete, null, {
      softDeleted: true,
      reason: reason ?? null,
    });
    return deleted;
  }

  async restore(id: string, actor: Actor): Promise<AdminUserResponseDto> {
    const restored = await this.usersService.restore(id);
    if (!restored) {
      throw new AppException(
        HttpStatus.NOT_FOUND,
        ErrorCode.NotFound,
        'No deleted user with this id',
      );
    }
    await this.audit(
      actor,
      id,
      AuditAction.Update,
      { softDeleted: true },
      { softDeleted: false },
    );
    return restored;
  }

  /** Erases the user and their data. Only for soft-deleted users or accounts pending deletion. */
  async permanentDelete(
    id: string,
    actor: Actor,
  ): Promise<{ id: string; removed: Record<string, number> }> {
    const user = await this.findOrThrow(id, true);
    if (user.id === actor.auth.userId) {
      throw this.forbidden('You cannot delete your own account here');
    }
    if (user.deletedAt === null && user.deletionScheduledAt === null) {
      throw new AppException(
        HttpStatus.CONFLICT,
        ErrorCode.AccountActionNotAllowed,
        'Delete the user first (DELETE /admin/users/:id); permanent deletion is only for deleted users or accounts pending deletion',
      );
    }
    if (
      user.role === UserRole.Admin &&
      actor.auth.role !== (UserRole.Admin as string)
    ) {
      throw this.forbidden('Only ADMIN users can manage ADMIN accounts');
    }
    const result = await this.cleanupService.purge(
      id,
      'admin_permanent_delete',
      actor.auth.userId,
    );
    this.resolver.invalidate();
    await this.audit(
      actor,
      id,
      AuditAction.Delete,
      { email: user.email },
      { permanent: true },
    );
    return { id, removed: result.removed };
  }

  async runPurge(): Promise<PurgeRunDto> {
    return this.purgeService.run();
  }

  // ----- helpers ------------------------------------------------------------

  private async findOrThrow(
    id: string,
    isDeletedAllowed: boolean,
  ): Promise<AdminUserResponseDto> {
    const user = await this.usersService.findAdminById(id);
    if (!user || (!isDeletedAllowed && user.deletedAt !== null)) {
      throw AccessErrorsNotFound();
    }
    return user;
  }

  /** Existing, not deleted, not the caller, and ADMIN targets only for ADMIN callers. */
  private async manageable(
    id: string,
    actor: Actor,
  ): Promise<AdminUserResponseDto> {
    const user = await this.findOrThrow(id, false);
    if (user.id === actor.auth.userId) {
      throw this.forbidden(
        'Use your own account endpoints (/users/me) to change your own account',
      );
    }
    if (
      user.role === UserRole.Admin &&
      actor.auth.role !== (UserRole.Admin as string)
    ) {
      throw this.forbidden('Only ADMIN users can manage ADMIN accounts');
    }
    return user;
  }

  private async assertNotLastAdmin(user: UserResponseDto): Promise<void> {
    if (
      user.role === UserRole.Admin &&
      user.status === UserStatus.Active &&
      (await this.usersService.countActiveAdmins()) <= 1
    ) {
      throw new AppException(
        HttpStatus.CONFLICT,
        ErrorCode.AccountActionNotAllowed,
        'This is the last active administrator',
      );
    }
  }

  private duplicate(field: string, message: string): AppException {
    return new AppException(
      HttpStatus.CONFLICT,
      ErrorCode.DuplicateResource,
      message,
      [{ field, message }],
    );
  }

  private forbidden(message: string): AppException {
    return new AppException(HttpStatus.FORBIDDEN, ErrorCode.Forbidden, message);
  }

  private async audit(
    actor: Actor,
    userId: string,
    action: AuditAction,
    before: Record<string, unknown> | null,
    after: Record<string, unknown> | null,
  ): Promise<void> {
    await this.auditService.record(actor, [
      { entityType: AuditEntity.User, entityId: userId, action, before, after },
    ]);
  }

  private async send(
    user: UserResponseDto,
    template: string,
    render: () => MailContent,
  ): Promise<void> {
    try {
      await this.mailService.send({ to: user.email, template, ...render() });
    } catch (error) {
      this.logger.error(
        { message: 'Email could not be sent', template, userId: user.id },
        error instanceof Error ? error.stack : undefined,
      );
    }
  }
}

function latest(dates: (Date | null)[]): Date | null {
  const times = dates
    .filter((d): d is Date => d instanceof Date)
    .map((d) => d.getTime());
  return times.length ? new Date(Math.max(...times)) : null;
}

function AccessErrorsNotFound(): AppException {
  return new AppException(
    HttpStatus.NOT_FOUND,
    ErrorCode.NotFound,
    'User not found',
  );
}

function pick(
  user: AdminUserResponseDto,
  keys: string[],
): Record<string, unknown> {
  const source = user as unknown as Record<string, unknown>;
  return Object.fromEntries(
    keys.filter((k) => k in source).map((k) => [k, source[k]]),
  );
}
