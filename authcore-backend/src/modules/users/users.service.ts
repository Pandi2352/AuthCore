import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';

import { AdminUserResponseDto, UserResponseDto } from './dto/user-response.dto';
import { UserRole } from './enums/user-role.enum';
import { UserSource } from './enums/user-source.enum';
import { UserStatus } from './enums/user-status.enum';
import { CreateUserInput } from './interfaces/create-user-input.interface';
import {
  LoginLookup,
  UserCredentials,
} from './interfaces/user-credentials.interface';
import type { UserPreferences } from './interfaces/user-preferences.interface';
import { toAdminUserResponse, toUserResponse } from './mappers/user.mapper';
import { User } from './schemas/user.schema';

/** Profile fields a user / admin can change (null clears an optional field). */
export interface ProfileChanges {
  firstName?: string;
  lastName?: string | null;
  username?: string | null;
  email?: string;
}

/** Max users returned by listPendingApproval(). */
const PENDING_LIST_LIMIT = 100;

/**
 * Owns the users collection. Other modules use this service, never the model.
 * Status changes are conditional updates (`status: <expected>` in the filter),
 * so two concurrent requests can never both apply a transition.
 */
@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<User>,
  ) {}

  /**
   * Creates a user. A duplicate email/username that slips past the caller's
   * checks (two requests at once) fails on the unique index → 409.
   */
  async create(input: CreateUserInput): Promise<UserResponseDto> {
    const isVerified = input.isEmailVerified ?? false;
    const user = await this.userModel.create({
      email: input.email,
      username: input.username,
      firstName: input.firstName,
      lastName: input.lastName,
      passwordHash: input.passwordHash,
      status: input.status,
      passwordChangedAt: new Date(),
      isEmailVerified: isVerified,
      emailVerifiedAt: isVerified ? new Date() : null,
      mustChangePassword: input.mustChangePassword ?? false,
      source: input.source ?? UserSource.Registration,
      createdBy: input.createdBy ?? null,
    });
    return toUserResponse(user);
  }

  /** Including soft-deleted users (admin use). */
  async findAdminById(id: string): Promise<AdminUserResponseDto | null> {
    const user = await this.userModel.findById(id).lean();
    return user ? toAdminUserResponse(user) : null;
  }

  async isUsernameTakenByOther(
    username: string,
    excludeId: string,
  ): Promise<boolean> {
    return (
      (await this.userModel.exists({ username, _id: { $ne: excludeId } })) !==
      null
    );
  }

  async isEmailTakenByOther(
    email: string,
    excludeId: string,
  ): Promise<boolean> {
    return (
      (await this.userModel.exists({ email, _id: { $ne: excludeId } })) !== null
    );
  }

  /** Profile fields; null values remove optional fields (lastName / username). */
  async updateProfile(
    id: string,
    changes: ProfileChanges,
  ): Promise<UserResponseDto | null> {
    const set: Record<string, unknown> = {};
    const unset: Record<string, ''> = {};
    for (const [key, value] of Object.entries(changes)) {
      if (value === undefined) {
        continue;
      }
      if (value === null) {
        unset[key] = '';
      } else {
        set[key] = value;
      }
    }
    const user = await this.userModel
      .findOneAndUpdate(
        { _id: id },
        {
          ...(Object.keys(set).length ? { $set: set } : {}),
          ...(Object.keys(unset).length ? { $unset: unset } : {}),
        },
        { new: true },
      )
      .lean();
    return user ? toUserResponse(user) : null;
  }

  async updatePreferences(
    id: string,
    preferences: UserPreferences,
  ): Promise<UserResponseDto | null> {
    const user = await this.userModel
      .findOneAndUpdate(
        { _id: id, deletedAt: null },
        { $set: { preferences } },
        { new: true },
      )
      .lean();
    return user ? toUserResponse(user) : null;
  }

  /** Sets a confirmed new email (verified). Conditional on the old one. */
  async changeEmail(
    id: string,
    fromEmail: string,
    toEmail: string,
  ): Promise<UserResponseDto | null> {
    const user = await this.userModel
      .findOneAndUpdate(
        { _id: id, email: fromEmail, deletedAt: null },
        {
          $set: {
            email: toEmail,
            isEmailVerified: true,
            emailVerifiedAt: new Date(),
          },
        },
        { new: true },
      )
      .lean();
    return user ? toUserResponse(user) : null;
  }

  /**
   * Status change with reason / who / when. With `fromStatuses`, only applies
   * when the current status is one of them. null when nothing matched.
   */
  async setStatus(
    id: string,
    status: UserStatus,
    change: {
      reason: string | null;
      changedBy: string;
      fromStatuses?: UserStatus[];
    },
  ): Promise<UserResponseDto | null> {
    const user = await this.userModel
      .findOneAndUpdate(
        {
          _id: id,
          deletedAt: null,
          ...(change.fromStatuses
            ? { status: { $in: change.fromStatuses } }
            : {}),
        },
        {
          $set: {
            status,
            statusReason: change.reason,
            statusChangedBy: change.changedBy,
            statusChangedAt: new Date(),
            ...(status === UserStatus.Active
              ? { deletionScheduledAt: null }
              : {}),
          },
        },
        { new: true },
      )
      .lean();
    return user ? toUserResponse(user) : null;
  }

  /** The user asked for deletion: deactivated now, purged at `at` unless recovered. */
  async scheduleDeletion(
    id: string,
    at: Date,
    reason: string | null,
  ): Promise<UserResponseDto | null> {
    const user = await this.userModel
      .findOneAndUpdate(
        { _id: id, deletedAt: null, deletionScheduledAt: null },
        {
          $set: {
            status: UserStatus.Inactive,
            deletionScheduledAt: at,
            statusReason: reason ?? 'Deletion requested by the user',
            statusChangedBy: id,
            statusChangedAt: new Date(),
          },
        },
        { new: true },
      )
      .lean();
    return user ? toUserResponse(user) : null;
  }

  async setMustChangePassword(
    id: string,
    value: boolean,
  ): Promise<UserResponseDto | null> {
    const user = await this.userModel
      .findOneAndUpdate(
        { _id: id, deletedAt: null },
        { $set: { mustChangePassword: value } },
        { new: true },
      )
      .lean();
    return user ? toUserResponse(user) : null;
  }

  async setRoleById(
    id: string,
    role: UserRole,
  ): Promise<UserResponseDto | null> {
    const user = await this.userModel
      .findOneAndUpdate(
        { _id: id, deletedAt: null },
        { $set: { role } },
        { new: true },
      )
      .lean();
    return user ? toUserResponse(user) : null;
  }

  /** ADMIN users that can still sign in (protects the last administrator). */
  async countActiveAdmins(): Promise<number> {
    return this.userModel.countDocuments({
      role: UserRole.Admin,
      status: UserStatus.Active,
      deletedAt: null,
    });
  }

  async softDelete(
    id: string,
    deletedBy: string,
  ): Promise<AdminUserResponseDto | null> {
    const user = await this.userModel
      .findOneAndUpdate(
        { _id: id, deletedAt: null },
        { $set: { deletedAt: new Date(), deletedBy } },
        { new: true },
      )
      .lean();
    return user ? toAdminUserResponse(user) : null;
  }

  async restore(id: string): Promise<AdminUserResponseDto | null> {
    const user = await this.userModel
      .findOneAndUpdate(
        { _id: id, deletedAt: { $ne: null } },
        { $set: { deletedAt: null, deletedBy: null } },
        { new: true },
      )
      .lean();
    return user ? toAdminUserResponse(user) : null;
  }

  /** Removes the user document for good (callers delete related data first). */
  async hardDelete(id: string): Promise<boolean> {
    return (await this.userModel.deleteOne({ _id: id })).deletedCount === 1;
  }

  /** Users whose self-requested deletion date has passed. */
  async findDueForDeletion(now: Date, limit: number): Promise<string[]> {
    const users = await this.userModel
      .find({ deletionScheduledAt: { $ne: null, $lte: now } }, { _id: 1 })
      .limit(limit)
      .lean();
    return users.map((u) => u._id);
  }

  /** Filtered, sorted page of users for admins. */
  async listForAdmin(
    filter: Record<string, unknown>,
    sort: Record<string, 1 | -1>,
    skip: number,
    limit: number,
  ): Promise<{ items: AdminUserResponseDto[]; total: number }> {
    const [users, total] = await Promise.all([
      this.userModel
        .find(filter)
        .collation({ locale: 'en', strength: 2 })
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .lean(),
      this.userModel.countDocuments(filter),
    ]);
    return { items: users.map(toAdminUserResponse), total };
  }

  async findByEmail(email: string): Promise<UserResponseDto | null> {
    const user = await this.userModel
      .findOne({ email, deletedAt: null })
      .lean();
    return user ? toUserResponse(user) : null;
  }

  async findById(id: string): Promise<UserResponseDto | null> {
    const user = await this.userModel
      .findOne({ _id: id, deletedAt: null })
      .lean();
    return user ? toUserResponse(user) : null;
  }

  /**
   * For login only: the user plus the password hash (normally never selected).
   * Deleted users are not found. `lookup` holds an already normalized value.
   */
  async findCredentials(lookup: LoginLookup): Promise<UserCredentials | null> {
    const filter =
      'email' in lookup
        ? { email: lookup.email, deletedAt: null }
        : { username: lookup.username, deletedAt: null };
    const user = await this.userModel
      .findOne(filter)
      .select('+passwordHash')
      .lean();
    return user
      ? { user: toUserResponse(user), passwordHash: user.passwordHash }
      : null;
  }

  /**
   * Current and previous password hashes, for password checks only (never
   * returned by an API or logged). null if the user doesn't exist.
   */
  async findPasswordHashes(id: string): Promise<{
    user: UserResponseDto;
    passwordHash: string;
    history: string[];
  } | null> {
    const user = await this.userModel
      .findOne({ _id: id, deletedAt: null })
      .select('+passwordHash +passwordHistory')
      .lean();
    return user
      ? {
          user: toUserResponse(user),
          passwordHash: user.passwordHash,
          history: user.passwordHistory,
        }
      : null;
  }

  /**
   * Sets a new password hash. The previous hash moves into the history (the
   * most recent `historySize` are kept). Conditional on `expectedHash`: if
   * the password changed in the meantime, nothing happens and false is
   * returned.
   */
  async changePasswordHash(
    id: string,
    expectedHash: string,
    newHash: string,
    historySize: number,
  ): Promise<boolean> {
    const result = await this.userModel.updateOne(
      { _id: id, passwordHash: expectedHash, deletedAt: null },
      {
        $set: {
          passwordHash: newHash,
          passwordChangedAt: new Date(),
          mustChangePassword: false,
        },
        $push: {
          passwordHistory: {
            $each: [expectedHash],
            // 0 keeps no history; -N keeps the last N.
            $slice: historySize === 0 ? 0 : -historySize,
          },
        },
      },
    );
    return result.modifiedCount > 0;
  }

  /** Non-deleted users among these ids (order not guaranteed). */
  async findManyByIds(ids: string[]): Promise<UserResponseDto[]> {
    if (ids.length === 0) {
      return [];
    }
    const users = await this.userModel
      .find({ _id: { $in: ids }, deletedAt: null })
      .lean();
    return users.map(toUserResponse);
  }

  /** Ids of users whose email, first or last name contains `pattern` (bounded). */
  async findIdsMatching(pattern: RegExp, limit: number): Promise<string[]> {
    const users = await this.userModel
      .find(
        {
          deletedAt: null,
          $or: [
            { email: pattern },
            { firstName: pattern },
            { lastName: pattern },
          ],
        },
        { _id: 1 },
      )
      .limit(limit)
      .lean();
    return users.map((u) => u._id);
  }

  /** Sets a user's role by email. null if no such user. */
  async setRole(
    email: string,
    role: UserRole,
  ): Promise<UserResponseDto | null> {
    const user = await this.userModel
      .findOneAndUpdate(
        { email: email.trim().toLowerCase(), deletedAt: null },
        { $set: { role } },
        { new: true },
      )
      .lean();
    return user ? toUserResponse(user) : null;
  }

  /**
   * Active users whose password was last set within [from, to), oldest
   * first. Used for password-expiry reminders.
   */
  async findByPasswordChangedBetween(
    from: Date,
    to: Date,
    limit: number,
  ): Promise<UserResponseDto[]> {
    const users = await this.userModel
      .find({
        status: UserStatus.Active,
        deletedAt: null,
        passwordChangedAt: { $gte: from, $lt: to },
      })
      .sort({ passwordChangedAt: 1 })
      .limit(limit)
      .lean();
    return users.map(toUserResponse);
  }

  async recordLogin(id: string): Promise<void> {
    await this.userModel.updateOne(
      { _id: id },
      { $set: { lastLoginAt: new Date() } },
    );
  }

  /** Replaces the hash without changing passwordChangedAt (same password, stronger hash). */
  async updatePasswordHash(id: string, passwordHash: string): Promise<void> {
    await this.userModel.updateOne({ _id: id }, { $set: { passwordHash } });
  }

  async isEmailTaken(email: string): Promise<boolean> {
    return (await this.userModel.exists({ email })) !== null;
  }

  async isUsernameTaken(username: string): Promise<boolean> {
    return (await this.userModel.exists({ username })) !== null;
  }

  /**
   * Marks the email verified and moves `fromStatus` → `nextStatus`
   * (PENDING_VERIFICATION → ACTIVE / PENDING_APPROVAL, or ACTIVE → ACTIVE for
   * accounts created before verification was turned on).
   * Returns null if the user isn't in `fromStatus` or is already verified.
   */
  async markEmailVerified(
    id: string,
    fromStatus: UserStatus.PendingVerification | UserStatus.Active,
    nextStatus: UserStatus.Active | UserStatus.PendingApproval,
  ): Promise<UserResponseDto | null> {
    const user = await this.userModel
      .findOneAndUpdate(
        {
          _id: id,
          status: fromStatus,
          isEmailVerified: false,
          deletedAt: null,
        },
        {
          $set: {
            status: nextStatus,
            isEmailVerified: true,
            emailVerifiedAt: new Date(),
          },
        },
        { new: true },
      )
      .lean();
    return user ? toUserResponse(user) : null;
  }

  /** PENDING_APPROVAL → ACTIVE. Returns null if the user isn't pending approval. */
  async approve(
    id: string,
    reviewedBy: string,
  ): Promise<UserResponseDto | null> {
    return this.review(id, UserStatus.Active, reviewedBy, null);
  }

  /** PENDING_APPROVAL → REJECTED. Returns null if the user isn't pending approval. */
  async reject(
    id: string,
    reviewedBy: string,
    reason: string | null,
  ): Promise<UserResponseDto | null> {
    return this.review(id, UserStatus.Rejected, reviewedBy, reason);
  }

  /** Oldest first, so the longest-waiting registrations are reviewed first. */
  async listPendingApproval(): Promise<UserResponseDto[]> {
    const users = await this.userModel
      .find({ status: UserStatus.PendingApproval })
      .sort({ createdAt: 1 })
      .limit(PENDING_LIST_LIMIT)
      .lean();
    return users.map(toUserResponse);
  }

  private async review(
    id: string,
    status: UserStatus.Active | UserStatus.Rejected,
    reviewedBy: string,
    reason: string | null,
  ): Promise<UserResponseDto | null> {
    const user = await this.userModel
      .findOneAndUpdate(
        { _id: id, status: UserStatus.PendingApproval },
        {
          $set: {
            status,
            reviewedAt: new Date(),
            reviewedBy,
            rejectionReason: reason,
          },
        },
        { new: true },
      )
      .lean();
    return user ? toUserResponse(user) : null;
  }
}
