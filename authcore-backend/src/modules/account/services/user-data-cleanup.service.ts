import { Injectable, Logger } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import type { Connection } from 'mongoose';

import { UsersService } from '@modules/users/users.service';

/**
 * Collections holding a user's personal data, and how to find it. Every new
 * collection with user data must be added here so a permanent deletion
 * really removes everything. Audit logs are kept on purpose (records of who
 * did what), and accepted invites stay as onboarding history.
 */
const USER_DATA: readonly {
  collection: string;
  filter: (userId: string) => Record<string, unknown>;
}[] = [
  { collection: 'sessions', filter: (userId) => ({ userId }) },
  { collection: 'access_mappings', filter: (userId) => ({ userId }) },
  { collection: 'password_resets', filter: (userId) => ({ userId }) },
  { collection: 'email_verifications', filter: (userId) => ({ userId }) },
  { collection: 'account_codes', filter: (userId) => ({ userId }) },
  { collection: 'user_activities', filter: (userId) => ({ userId }) },
  {
    collection: 'password_expiry_notifications',
    filter: (userId) => ({ userId }),
  },
  {
    collection: 'login_attempts',
    filter: (userId) => ({ key: `user:${userId}` }),
  },
];

export interface PurgeResult {
  userId: string;
  isDeleted: boolean;
  removed: Record<string, number>;
}

/** Permanent deletion of a user and their personal data (GDPR-style erasure). */
@Injectable()
export class UserDataCleanupService {
  private readonly logger = new Logger(UserDataCleanupService.name);

  constructor(
    @InjectConnection() private readonly connection: Connection,
    private readonly usersService: UsersService,
  ) {}

  async purge(
    userId: string,
    reason: string,
    actorId: string,
  ): Promise<PurgeResult> {
    const removed: Record<string, number> = {};
    for (const { collection, filter } of USER_DATA) {
      const result = await this.connection
        .collection(collection)
        .deleteMany(filter(userId));
      removed[collection] = result.deletedCount;
    }
    const isDeleted = await this.usersService.hardDelete(userId);
    this.logger.log({
      message: 'User permanently deleted',
      userId,
      reason,
      changedBy: actorId,
      ...removed,
    });
    return { userId, isDeleted, removed };
  }
}
