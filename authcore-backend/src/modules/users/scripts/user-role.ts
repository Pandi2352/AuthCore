import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';

import { AppModule } from '../../../app.module';
import { UserRole } from '../enums/user-role.enum';
import { UsersService } from '../users.service';

/**
 * Grant or remove the ADMIN role from the command line until the RBAC /
 * Admin module provides HTTP endpoints. Run after `npm run build`:
 *
 *   npm run users:role -- jane@example.com ADMIN
 *   npm run users:role -- jane@example.com USER
 *
 * The user's existing access tokens pick up the new role on their next request.
 */
const USAGE = `Usage: users:role -- <email> <${Object.values(UserRole).join('|')}>`;

async function run(): Promise<void> {
  const [email, roleArg] = process.argv.slice(2);
  const role = Object.values(UserRole).find(
    (r) => r === roleArg?.toUpperCase(),
  );
  if (!email || !role) {
    throw new Error(USAGE);
  }

  const logger = new Logger('UserRole');
  const app = await NestFactory.createApplicationContext(AppModule, {
    bufferLogs: true,
  });
  app.useLogger(app.get(WINSTON_MODULE_NEST_PROVIDER));
  try {
    const user = await app.get(UsersService).setRole(email, role);
    if (!user) {
      throw new Error(`No user with email ${email}`);
    }
    logger.log({
      message: 'User role changed',
      userId: user.id,
      role: user.role,
      changedBy: 'cli',
    });
  } finally {
    await app.close();
  }
}

run().catch((error: unknown) => {
  new Logger('UserRole').error(
    error instanceof Error ? error.message : String(error),
  );
  process.exitCode = 1;
});
