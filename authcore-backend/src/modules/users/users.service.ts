import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';

import { UserResponseDto } from './dto/user-response.dto';
import { UserStatus } from './enums/user-status.enum';
import { CreateUserInput } from './interfaces/create-user-input.interface';
import {
  LoginLookup,
  UserCredentials,
} from './interfaces/user-credentials.interface';
import { toUserResponse } from './mappers/user.mapper';
import { User } from './schemas/user.schema';

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
    const user = await this.userModel.create({
      email: input.email,
      username: input.username,
      firstName: input.firstName,
      lastName: input.lastName,
      passwordHash: input.passwordHash,
      status: input.status,
      passwordChangedAt: new Date(),
    });
    return toUserResponse(user);
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
