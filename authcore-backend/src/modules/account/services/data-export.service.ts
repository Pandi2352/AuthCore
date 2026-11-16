import { Injectable } from '@nestjs/common';

import { AccessMappingsService } from '@modules/access-control/services/access-mappings.service';
import { FilesService } from '@modules/files/services/files.service';
import { LoginAlertsService } from '@modules/login-alerts/services/login-alerts.service';
import { SessionsService } from '@modules/sessions/sessions.service';
import { UserActivityService } from '@modules/user-activity/user-activity.service';
import { UserAttributeValuesService } from '@modules/user-schema/services/user-attribute-values.service';
import type { UserResponseDto } from '@modules/users/dto/user-response.dto';
import { UsersService } from '@modules/users/users.service';

/** Bumped when the export layout changes. */
const EXPORT_FORMAT_VERSION = 1;

/**
 * "Download my data" (GDPR-style access / portability): everything AuthCore
 * holds about the user, as one JSON document. Secrets are never included
 * (password and code hashes, tokens, custom password variables); uploaded
 * files are listed with their download URLs instead of being embedded.
 */
@Injectable()
export class DataExportService {
  constructor(
    private readonly usersService: UsersService,
    private readonly sessionsService: SessionsService,
    private readonly activityService: UserActivityService,
    private readonly attributeValuesService: UserAttributeValuesService,
    private readonly mappingsService: AccessMappingsService,
    private readonly loginAlertsService: LoginAlertsService,
    private readonly filesService: FilesService,
  ) {}

  async build(user: UserResponseDto): Promise<Record<string, unknown>> {
    const userId = user.id;
    const [attributes, sessions, devices, activity, access, files] =
      await Promise.all([
        this.usersService.getAttributes(userId),
        this.sessionsService.listActiveForUser(userId),
        this.loginAlertsService.listDevices(userId),
        this.activityService.exportForUser(userId),
        this.mappingsService.userAccessTree(userId),
        this.filesService.listAllOf(userId),
      ]);
    // Admin view: internal variables are personal data too; passwords are filtered out.
    const visible = await this.attributeValuesService.filterForOutput(
      attributes,
      { isAdmin: true },
    );
    return {
      exportFormatVersion: EXPORT_FORMAT_VERSION,
      exportedAt: new Date().toISOString(),
      account: user,
      personalDetails: visible.attributes,
      activeSessions: sessions.map((s) => ({
        id: s._id,
        deviceName: s.deviceName,
        deviceType: s.deviceType,
        browser: s.browser,
        os: s.os,
        ipAddress: s.ipAddress,
        lastIpAddress: s.lastIpAddress,
        signedInAt: s.createdAt,
        lastUsedAt: s.lastUsedAt,
        expiresAt: s.expiresAt,
        isPersistent: s.isPersistent,
      })),
      knownDevices: devices,
      groupsAndRoles: access.map((g) => ({
        group: g.group,
        expiresAt: g.expiresAt,
        isExpired: g.isExpired,
        roles: g.roles.map((r) => ({
          role: r.role,
          permissions: r.permissions.map((p) => p.permission.permissionKey),
        })),
      })),
      files,
      activity,
      notes: [
        'Passwords, verification codes and tokens are stored only as one-way hashes and are not included.',
        `Activity is kept for a limited time (USER_ACTIVITY_RETENTION_DAYS); older entries no longer exist.`,
        'Files are listed with their download URLs (sign in to download private files).',
      ],
    };
  }
}
