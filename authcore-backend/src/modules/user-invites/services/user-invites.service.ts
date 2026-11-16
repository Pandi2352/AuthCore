import { createHmac, randomBytes } from 'node:crypto';

import { HttpStatus, Inject, Injectable, Logger } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';

import { ErrorCode } from '@common/constants/error-codes.constants';
import { AppException } from '@common/exceptions/app.exception';
import type { Paginated } from '@common/interfaces/api-response.interface';
import type { ClientInfo } from '@common/interfaces/client-info.interface';
import { normalizePagination, paginate } from '@common/utils/pagination.util';
import {
  buildDateRange,
  buildSort,
  containsPattern,
} from '@common/utils/query.util';
import { generateUuid } from '@common/utils/uuid.util';
import { inviteConfig, registrationConfig } from '@config/configuration';
import {
  AuditAction,
  AuditEntity,
} from '@modules/access-control/enums/access-control.enum';
import type { Actor } from '@modules/access-control/interfaces/actor.interface';
import { AccessAuditService } from '@modules/access-control/services/access-audit.service';
import { AccessMappingsService } from '@modules/access-control/services/access-mappings.service';
import { AccessResolverService } from '@modules/access-control/services/access-resolver.service';
import { MailService } from '@modules/mail/mail.service';
import { userInviteEmail } from '@modules/mail/templates/mail-templates';
import { PasswordValidationService } from '@modules/password-policy/services/password-validation.service';
import { UserSource } from '@modules/users/enums/user-source.enum';
import { UserStatus } from '@modules/users/enums/user-status.enum';
import { UsersService } from '@modules/users/users.service';
import { PasswordService } from '@shared/password.service';

import {
  type AcceptInviteDto,
  type AcceptInviteResponseDto,
  type BulkInviteDto,
  type BulkInviteResultDto,
  type CreateInviteDto,
  INVITE_SORT_FIELDS,
  type InviteListQueryDto,
  type InvitePersonDto,
  type InvitePublicInfoDto,
  type InviteResponseDto,
} from '../dto/user-invite.dto';
import { InviteStatus } from '../enums/invite-status.enum';
import { UserInvite } from '../schemas/user-invite.schema';

const DAY_MS = 86_400_000;

/**
 * Invitations: an admin invites an email; the person opens the link, sees who
 * invited them (public info) and accepts by choosing a password. The new
 * account is ACTIVE with a verified email (the link proves the address) and
 * joins the invite's groups. Tokens travel in request bodies, never in URLs.
 */
@Injectable()
export class UserInvitesService {
  private readonly logger = new Logger(UserInvitesService.name);

  constructor(
    @InjectModel(UserInvite.name)
    private readonly inviteModel: Model<UserInvite>,
    private readonly usersService: UsersService,
    private readonly passwordService: PasswordService,
    private readonly passwordValidationService: PasswordValidationService,
    private readonly mappingsService: AccessMappingsService,
    private readonly resolver: AccessResolverService,
    private readonly auditService: AccessAuditService,
    private readonly mailService: MailService,
    @Inject(inviteConfig.KEY)
    private readonly config: ConfigType<typeof inviteConfig>,
    @Inject(registrationConfig.KEY)
    private readonly registration: ConfigType<typeof registrationConfig>,
  ) {}

  async create(dto: CreateInviteDto, actor: Actor): Promise<InviteResponseDto> {
    const groupIds = dto.groupIds ?? [];
    await this.assertGroupsGrantable(groupIds, actor);
    if (await this.usersService.isEmailTaken(dto.email)) {
      throw new AppException(
        HttpStatus.CONFLICT,
        ErrorCode.AccountEmailInUse,
        'This email address already has an account',
        [{ field: 'email', message: 'already registered' }],
      );
    }
    await this.expireStale(dto.email);
    if (
      await this.inviteModel.exists({
        email: dto.email,
        status: InviteStatus.Pending,
      })
    ) {
      throw new AppException(
        HttpStatus.CONFLICT,
        ErrorCode.DuplicateResource,
        'This email address already has a pending invite. Resend it instead.',
        [{ field: 'email', message: 'already invited' }],
      );
    }
    const invite = await this.insert(dto, groupIds, dto.message ?? null, actor);
    return (await this.toResponses([invite]))[0] as InviteResponseDto;
  }

  /** Same groups / message for everyone; already-registered or already-invited emails are skipped and reported. */
  async bulkCreate(
    dto: BulkInviteDto,
    actor: Actor,
  ): Promise<BulkInviteResultDto> {
    const groupIds = dto.groupIds ?? [];
    await this.assertGroupsGrantable(groupIds, actor);
    const created: UserInvite[] = [];
    const skipped: { email: string; reason: string }[] = [];
    const seen = new Set<string>();
    for (const person of dto.invites) {
      if (seen.has(person.email)) {
        skipped.push({ email: person.email, reason: 'DUPLICATE_IN_REQUEST' });
        continue;
      }
      seen.add(person.email);
      if (await this.usersService.isEmailTaken(person.email)) {
        skipped.push({ email: person.email, reason: 'ALREADY_REGISTERED' });
        continue;
      }
      await this.expireStale(person.email);
      if (
        await this.inviteModel.exists({
          email: person.email,
          status: InviteStatus.Pending,
        })
      ) {
        skipped.push({ email: person.email, reason: 'ALREADY_INVITED' });
        continue;
      }
      try {
        created.push(
          await this.insert(person, groupIds, dto.message ?? null, actor),
        );
      } catch (error) {
        if ((error as { code?: unknown }).code !== 11000) {
          throw error;
        }
        skipped.push({ email: person.email, reason: 'ALREADY_INVITED' });
      }
    }
    return {
      createdCount: created.length,
      created: await this.toResponses(created),
      skipped,
    };
  }

  /** New link (the old one stops working), new expiry; pending or expired invites only. */
  async resend(id: string, actor: Actor): Promise<InviteResponseDto> {
    const invite = await this.findOrThrow(id);
    const status = effectiveStatus(invite);
    if (status !== InviteStatus.Pending && status !== InviteStatus.Expired) {
      throw this.notPending(status);
    }
    const wait = Math.ceil(
      (invite.lastSentAt.getTime() +
        this.config.resendCooldownSeconds * 1000 -
        Date.now()) /
        1000,
    );
    if (wait > 0) {
      throw new AppException(
        HttpStatus.TOO_MANY_REQUESTS,
        ErrorCode.InviteResendTooSoon,
        `The invite was sent recently. Try again in ${String(wait)} seconds.`,
        [],
        {
          'Retry-After': String(wait),
        },
      );
    }
    if (await this.usersService.isEmailTaken(invite.email)) {
      throw new AppException(
        HttpStatus.CONFLICT,
        ErrorCode.AccountEmailInUse,
        'This email address already has an account',
      );
    }
    const token = newToken();
    const now = new Date();
    const updated = await this.inviteModel
      .findOneAndUpdate(
        {
          _id: id,
          status: { $in: [InviteStatus.Pending, InviteStatus.Expired] },
        },
        {
          $set: {
            tokenHash: this.hash(token),
            status: InviteStatus.Pending,
            expiresAt: this.expiry(now),
            lastSentAt: now,
          },
          $inc: { resendCount: 1 },
        },
        { new: true },
      )
      .lean();
    if (!updated) {
      throw this.notPending(status);
    }
    await this.sendInvite(updated, token, actor);
    await this.audit(actor, id, AuditAction.Update, {
      resent: true,
      resendCount: updated.resendCount,
    });
    return (await this.toResponses([updated]))[0] as InviteResponseDto;
  }

  async revoke(id: string, actor: Actor): Promise<InviteResponseDto> {
    const invite = await this.findOrThrow(id);
    const updated = await this.inviteModel
      .findOneAndUpdate(
        { _id: id, status: InviteStatus.Pending },
        {
          $set: {
            status: InviteStatus.Revoked,
            revokedAt: new Date(),
            revokedBy: actor.auth.userId,
          },
        },
        { new: true },
      )
      .lean();
    if (!updated) {
      throw this.notPending(effectiveStatus(invite));
    }
    await this.audit(actor, id, AuditAction.Revoke, { email: invite.email });
    return (await this.toResponses([updated]))[0] as InviteResponseDto;
  }

  /** Removes the record. Accepted invites are kept (onboarding history). */
  async remove(id: string, actor: Actor): Promise<{ id: string }> {
    const invite = await this.findOrThrow(id);
    if (invite.status === InviteStatus.Accepted) {
      throw new AppException(
        HttpStatus.CONFLICT,
        ErrorCode.InviteNotPending,
        'Accepted invites are kept as history and cannot be deleted',
      );
    }
    await this.inviteModel.deleteOne({
      _id: id,
      status: { $ne: InviteStatus.Accepted },
    });
    await this.audit(actor, id, AuditAction.Delete, { email: invite.email });
    return { id };
  }

  async list(query: InviteListQueryDto): Promise<Paginated<InviteResponseDto>> {
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
    const now = new Date();
    const statusFilter =
      query.status === InviteStatus.Expired
        ? {
            $or: [
              { status: InviteStatus.Expired },
              { status: InviteStatus.Pending, expiresAt: { $lte: now } },
            ],
          }
        : query.status === InviteStatus.Pending
          ? { status: InviteStatus.Pending, expiresAt: { $gt: now } }
          : query.status
            ? { status: query.status }
            : {};
    const filter = {
      ...statusFilter,
      ...(search
        ? {
            $and: [
              {
                $or: [
                  { email: search },
                  { firstName: search },
                  { lastName: search },
                ],
              },
            ],
          }
        : {}),
      ...(query.invitedBy ? { invitedBy: query.invitedBy } : {}),
      ...(createdAt ? { createdAt } : {}),
      ...(updatedAt ? { updatedAt } : {}),
    };
    const [invites, total] = await Promise.all([
      this.inviteModel
        .find(filter)
        .sort(
          buildSort(
            query.sortBy,
            query.sortOrder,
            INVITE_SORT_FIELDS,
            'createdAt',
          ),
        )
        .skip(skip)
        .limit(limit)
        .lean(),
      this.inviteModel.countDocuments(filter),
    ]);
    return paginate(await this.toResponses(invites), page, limit, total);
  }

  async get(id: string): Promise<InviteResponseDto> {
    return (
      await this.toResponses([await this.findOrThrow(id)])
    )[0] as InviteResponseDto;
  }

  /** Public: what the invitee sees on the accept page. 404 for unknown tokens. */
  async publicInfo(token: string): Promise<InvitePublicInfoDto> {
    const invite = await this.inviteModel
      .findOne({ tokenHash: this.hash(token) })
      .lean();
    if (!invite) {
      throw new AppException(
        HttpStatus.NOT_FOUND,
        ErrorCode.InviteInvalid,
        'This invitation link is not valid',
      );
    }
    const [inviter] = await this.usersService.findManyByIds([invite.invitedBy]);
    const status = effectiveStatus(invite);
    return {
      email: invite.email,
      firstName: invite.firstName,
      lastName: invite.lastName,
      invitedByName: inviter
        ? `${inviter.firstName} ${inviter.lastName ?? ''}`.trim()
        : this.registration.appName,
      appName: this.registration.appName,
      expiresAt: invite.expiresAt,
      status,
      isAcceptable: status === InviteStatus.Pending,
    };
  }

  /**
   * Creates the account. Checks run first (invite usable, email free, username,
   * password policy); then the invite is claimed atomically (works once) and
   * released again if the account can't be created.
   */
  async accept(
    dto: AcceptInviteDto,
    client: ClientInfo,
  ): Promise<AcceptInviteResponseDto> {
    const tokenHash = this.hash(dto.token);
    const invite = await this.inviteModel.findOne({ tokenHash }).lean();
    const status = invite ? effectiveStatus(invite) : null;
    if (!invite || status !== InviteStatus.Pending) {
      throw new AppException(
        HttpStatus.BAD_REQUEST,
        ErrorCode.InviteInvalid,
        status === InviteStatus.Expired
          ? 'This invitation has expired. Ask for a new one.'
          : status === InviteStatus.Accepted
            ? 'This invitation was already used. Sign in instead.'
            : 'This invitation is not valid',
      );
    }
    const firstName = dto.firstName ?? invite.firstName;
    if (!firstName) {
      throw new AppException(
        HttpStatus.BAD_REQUEST,
        ErrorCode.ValidationFailed,
        'Validation failed',
        [{ field: 'firstName', message: 'firstName is required' }],
      );
    }
    const lastName = dto.lastName ?? invite.lastName ?? undefined;
    if (await this.usersService.isEmailTaken(invite.email)) {
      throw new AppException(
        HttpStatus.CONFLICT,
        ErrorCode.AccountEmailInUse,
        'This email address already has an account. Sign in instead.',
      );
    }
    if (
      dto.username &&
      (await this.usersService.isUsernameTaken(dto.username))
    ) {
      throw new AppException(
        HttpStatus.CONFLICT,
        ErrorCode.DuplicateResource,
        'This username is already taken',
        [{ field: 'username', message: 'username is already taken' }],
      );
    }
    await this.passwordValidationService.assertAcceptable(
      dto.password,
      'password',
      {
        email: invite.email,
        firstName,
        lastName: lastName ?? null,
        username: dto.username ?? null,
      },
    );
    const passwordHash = await this.passwordService.hash(dto.password);

    const claimed = await this.inviteModel.findOneAndUpdate(
      {
        _id: invite._id,
        tokenHash,
        status: InviteStatus.Pending,
        expiresAt: { $gt: new Date() },
      },
      { $set: { status: InviteStatus.Accepted, acceptedAt: new Date() } },
      { new: true },
    );
    if (!claimed) {
      throw new AppException(
        HttpStatus.BAD_REQUEST,
        ErrorCode.InviteInvalid,
        'This invitation is not valid',
      );
    }
    let user;
    try {
      user = await this.usersService.create({
        email: invite.email,
        firstName,
        ...(lastName ? { lastName } : {}),
        ...(dto.username ? { username: dto.username } : {}),
        passwordHash,
        status: UserStatus.Active,
        isEmailVerified: true,
        source: UserSource.Invite,
        createdBy: invite.invitedBy,
      });
    } catch (error) {
      await this.inviteModel.updateOne(
        { _id: invite._id },
        { $set: { status: InviteStatus.Pending, acceptedAt: null } },
      );
      throw error;
    }
    await this.inviteModel.updateOne(
      { _id: invite._id },
      { $set: { acceptedUserId: user.id } },
    );
    await this.mappingsService.assignDefaultGroups(user.id, 'INVITE');
    const groupsJoined = await this.joinGroups(invite, user.id, client);
    this.logger.log({
      message: 'Invite accepted',
      inviteId: invite._id,
      userId: user.id,
      groupsJoined,
      ipAddress: client.ipAddress,
    });
    return { user, groupsJoined };
  }

  // ----- helpers ------------------------------------------------------------

  private async insert(
    person: InvitePersonDto,
    groupIds: string[],
    message: string | null,
    actor: Actor,
  ): Promise<UserInvite> {
    const token = newToken();
    const now = new Date();
    const invite = await this.inviteModel.create({
      _id: generateUuid(),
      email: person.email,
      firstName: person.firstName ?? null,
      lastName: person.lastName ?? null,
      groupIds,
      message,
      tokenHash: this.hash(token),
      status: InviteStatus.Pending,
      expiresAt: this.expiry(now),
      invitedBy: actor.auth.userId,
      lastSentAt: now,
    });
    await this.sendInvite(invite, token, actor);
    await this.audit(actor, invite._id, AuditAction.Create, {
      email: invite.email,
      groupIds,
    });
    this.logger.log({
      message: 'Invite sent',
      inviteId: invite._id,
      invitedBy: actor.auth.userId,
    });
    // Plain object with _id (toObject() would apply the API output transform).
    return (
      (await this.inviteModel.findById(invite._id).lean()) ??
      invite.toObject<UserInvite>({ transform: false })
    );
  }

  /** Groups exist, are active, and the inviter may grant what they give. */
  private async assertGroupsGrantable(
    groupIds: string[],
    actor: Actor,
  ): Promise<void> {
    if (groupIds.length === 0) {
      return;
    }
    await this.mappingsService.validateRoleSetup(groupIds, [], actor);
    await this.resolver.assertCanGrant(
      actor,
      await this.resolver.permissionKeysOfGroups(groupIds),
    );
  }

  /**
   * Adds the new user to the invite's groups on behalf of the inviter. A group
   * that was deleted / deactivated meanwhile (or an inviter who lost the right)
   * is skipped and logged: the account itself is already created.
   */
  private async joinGroups(
    invite: UserInvite,
    userId: string,
    client: ClientInfo,
  ): Promise<number> {
    if (invite.groupIds.length === 0) {
      return 0;
    }
    const [inviter] = await this.usersService.findManyByIds([invite.invitedBy]);
    if (!inviter) {
      this.logger.warn({
        message: 'Invite groups skipped: inviter no longer exists',
        inviteId: invite._id,
      });
      return 0;
    }
    const actor: Actor = {
      auth: {
        userId: inviter.id,
        role: inviter.role,
        sessionId: 'invite',
        tokenId: 'invite',
      },
      client,
    };
    let joined = 0;
    for (const groupId of invite.groupIds) {
      try {
        joined += (
          await this.mappingsService.assignGroupUsers(
            { groupId, userIds: [userId] },
            actor,
          )
        ).assignedCount;
      } catch (error) {
        this.logger.warn({
          message: 'Invite group skipped',
          inviteId: invite._id,
          groupId,
          reason: error instanceof Error ? error.message : 'unknown',
        });
      }
    }
    return joined;
  }

  /** Marks pending-but-expired invites of this email EXPIRED (frees the unique slot). */
  private async expireStale(email: string): Promise<void> {
    await this.inviteModel.updateMany(
      { email, status: InviteStatus.Pending, expiresAt: { $lte: new Date() } },
      { $set: { status: InviteStatus.Expired } },
    );
  }

  private async sendInvite(
    invite: UserInvite,
    token: string,
    actor: Actor,
  ): Promise<void> {
    const [inviter] = await this.usersService.findManyByIds([
      actor.auth.userId,
    ]);
    const url = new URL(this.config.acceptUrl);
    url.searchParams.set('token', token);
    try {
      await this.mailService.send({
        to: invite.email,
        template: 'user-invite',
        ...userInviteEmail({
          appName: this.registration.appName,
          firstName: invite.firstName,
          inviterName: inviter
            ? `${inviter.firstName} ${inviter.lastName ?? ''}`.trim()
            : this.registration.appName,
          link: url.toString(),
          expiresAt: invite.expiresAt,
          message: invite.message,
        }),
      });
    } catch (error) {
      this.logger.error(
        { message: 'Invite email could not be sent', inviteId: invite._id },
        error instanceof Error ? error.stack : undefined,
      );
    }
  }

  private async toResponses(
    invites: UserInvite[],
  ): Promise<InviteResponseDto[]> {
    const inviters = await this.usersService.findManyByIds([
      ...new Set(invites.map((i) => i.invitedBy)),
    ]);
    const names = new Map(
      inviters.map((u) => [u.id, `${u.firstName} ${u.lastName ?? ''}`.trim()]),
    );
    return invites.map((i) => ({
      id: i._id,
      email: i.email,
      firstName: i.firstName,
      lastName: i.lastName,
      status: effectiveStatus(i),
      groupIds: i.groupIds,
      message: i.message,
      expiresAt: i.expiresAt,
      invitedBy: names.has(i.invitedBy)
        ? { id: i.invitedBy, name: names.get(i.invitedBy) ?? '' }
        : null,
      resendCount: i.resendCount,
      lastSentAt: i.lastSentAt,
      acceptedAt: i.acceptedAt,
      acceptedUserId: i.acceptedUserId,
      revokedAt: i.revokedAt,
      createdAt: i.createdAt,
      updatedAt: i.updatedAt,
    }));
  }

  private async findOrThrow(id: string): Promise<UserInvite> {
    const invite = await this.inviteModel.findById(id).lean();
    if (!invite) {
      throw new AppException(
        HttpStatus.NOT_FOUND,
        ErrorCode.NotFound,
        'Invite not found',
      );
    }
    return invite;
  }

  private notPending(status: InviteStatus): AppException {
    return new AppException(
      HttpStatus.CONFLICT,
      ErrorCode.InviteNotPending,
      `This invite is ${status.toLowerCase()}`,
    );
  }

  private expiry(from: Date): Date {
    return new Date(from.getTime() + this.config.ttlDays * DAY_MS);
  }

  private hash(token: string): string {
    return createHmac('sha256', this.config.tokenSecret)
      .update(`invite:${token}`)
      .digest('hex');
  }

  private async audit(
    actor: Actor,
    inviteId: string,
    action: AuditAction,
    after: Record<string, unknown>,
  ): Promise<void> {
    await this.auditService.record(actor, [
      { entityType: AuditEntity.Invite, entityId: inviteId, action, after },
    ]);
  }
}

function newToken(): string {
  return randomBytes(32).toString('base64url');
}

function effectiveStatus(
  invite: Pick<UserInvite, 'status' | 'expiresAt'>,
): InviteStatus {
  return invite.status === InviteStatus.Pending &&
    invite.expiresAt <= new Date()
    ? InviteStatus.Expired
    : invite.status;
}
