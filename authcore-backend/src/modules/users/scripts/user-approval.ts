import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';

import { AppModule } from '../../../app.module';
import { UserApprovalService } from '../user-approval.service';

/**
 * Review registrations from the command line (REGISTRATION_REQUIRE_APPROVAL=true)
 * until the Admin module provides HTTP endpoints. Run after `npm run build`:
 *
 *   npm run users:pending
 *   npm run users:approve -- jane@example.com
 *   npm run users:reject  -- jane@example.com "Not a company email address"
 */
const REVIEWER = 'cli';
const USAGE =
  'Usage: users:pending | users:approve -- <email> | users:reject -- <email> [reason]';

async function run(): Promise<void> {
  const [command, email, ...reasonParts] = process.argv.slice(2);
  const logger = new Logger('UserApproval');

  const app = await NestFactory.createApplicationContext(AppModule, {
    bufferLogs: true,
  });
  app.useLogger(app.get(WINSTON_MODULE_NEST_PROVIDER));

  try {
    const approval = app.get(UserApprovalService);

    if (command === 'pending') {
      const users = await approval.listPending();
      logger.log(`${users.length} registration(s) waiting for approval`);
      for (const user of users) {
        logger.log(
          `${user.email} | ${user.firstName} ${user.lastName ?? ''} | registered ${user.createdAt.toISOString()} | id ${user.id}`,
        );
      }
      return;
    }

    if (!email || (command !== 'approve' && command !== 'reject')) {
      throw new Error(USAGE);
    }

    if (command === 'approve') {
      const user = await approval.approve(email, REVIEWER);
      logger.log(`Approved ${user.email} → ${user.status}`);
      return;
    }

    const reason = reasonParts.join(' ').trim();
    const user = await approval.reject(email, REVIEWER, reason || null);
    logger.log(`Rejected ${user.email} → ${user.status}`);
  } finally {
    await app.close();
  }
}

run().catch((error: unknown) => {
  new Logger('UserApproval').error(
    error instanceof Error ? error.message : String(error),
  );
  process.exitCode = 1;
});
