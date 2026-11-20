import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';

import type { Paginated } from '@common/interfaces/api-response.interface';
import { normalizePagination, paginate } from '@common/utils/pagination.util';
import { buildDateRange, containsPattern } from '@common/utils/query.util';
import { generateUuid } from '@common/utils/uuid.util';
import { UsersService } from '@modules/users/users.service';

import { SYSTEM_ACTOR } from '../constants/access-control.constants';
import type {
  AuditEntryDto,
  AuditQueryDto,
  AuditStatsDto,
} from '../dto/access-mapping.dto';
import { AuditAction, AuditEntity } from '../enums/access-control.enum';
import type { Actor } from '../interfaces/actor.interface';
import { AccessAudit } from '../schemas/access-audit.schema';
import { Group } from '../schemas/group.schema';
import { Permission } from '../schemas/permission.schema';
import { Role } from '../schemas/role.schema';

export interface AuditInput {
  entityType: AuditEntity;
  entityId: string;
  action: AuditAction;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
}

/** History of every access-control change. Settings only: never passwords, hashes or tokens. */
@Injectable()
export class AccessAuditService {
  constructor(
    @InjectModel(AccessAudit.name)
    private readonly auditModel: Model<AccessAudit>,
    @InjectModel(Role.name) private readonly roleModel: Model<Role>,
    @InjectModel(Group.name) private readonly groupModel: Model<Group>,
    @InjectModel(Permission.name)
    private readonly permissionModel: Model<Permission>,
    private readonly usersService: UsersService,
  ) {}

  async record(actor: Actor | null, entries: AuditInput[]): Promise<void> {
    if (entries.length === 0) {
      return;
    }
    await this.auditModel.insertMany(
      entries.map((entry) => ({
        _id: generateUuid(),
        entityType: entry.entityType,
        entityId: entry.entityId,
        action: entry.action,
        changedBy: actor?.auth.userId ?? SYSTEM_ACTOR,
        before: entry.before ?? null,
        after: entry.after ?? null,
        ipAddress: actor?.client.ipAddress ?? null,
        userAgent: actor?.client.userAgent.slice(0, 512) || null,
      })),
    );
  }

  async list(query: AuditQueryDto): Promise<Paginated<AuditEntryDto>> {
    const { page, limit, skip } = normalizePagination(query.page, query.limit);
    const createdAt = buildDateRange('', query.from, query.to);
    const search = query.search ? await this.searchFilter(query.search) : null;
    const filter = {
      ...(query.entityType ? { entityType: query.entityType } : {}),
      ...(query.entityId ? { entityId: query.entityId } : {}),
      ...(query.action ? { action: query.action } : {}),
      ...(query.changedBy ? { changedBy: query.changedBy } : {}),
      ...(createdAt ? { createdAt } : {}),
      ...(search ?? {}),
    };
    const [entries, total] = await Promise.all([
      this.auditModel
        .find(filter)
        .sort({ createdAt: -1, _id: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      this.auditModel.countDocuments(filter),
    ]);
    const names = await this.namesFor(entries);
    return paginate(
      entries.map((e) => {
        const actor = names.users.get(e.changedBy);
        return {
          id: e._id,
          entityType: e.entityType,
          entityId: e.entityId,
          action: e.action,
          changedBy: e.changedBy,
          before: e.before,
          after: e.after,
          ipAddress: e.ipAddress,
          createdAt: e.createdAt,
          changedByName: actor?.name ?? null,
          changedByEmail: actor?.email ?? null,
          entityLabel: this.labelOf(e, names),
        };
      }),
      page,
      limit,
      total,
    );
  }

  /** Counts for the audit page cards. */
  async stats(): Promise<AuditStatsDto> {
    const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const byAction = (action: AuditAction) =>
      this.auditModel.countDocuments({ action });
    const [
      total,
      last24Hours,
      created,
      updated,
      deleted,
      assigned,
      revoked,
      actors,
    ] = await Promise.all([
      this.auditModel.countDocuments(),
      this.auditModel.countDocuments({ createdAt: { $gte: dayAgo } }),
      byAction(AuditAction.Create),
      byAction(AuditAction.Update),
      byAction(AuditAction.Delete),
      byAction(AuditAction.Assign),
      byAction(AuditAction.Revoke),
      this.auditModel.distinct('changedBy'),
    ]);
    return {
      total,
      last24Hours,
      created,
      updated,
      deleted,
      assigned,
      revoked,
      people: actors.filter((id) => id !== SYSTEM_ACTOR).length,
    };
  }

  /** Search: the id, a name / key / email in the snapshot, or who made it (name / email). */
  private async searchFilter(text: string): Promise<Record<string, unknown>> {
    const pattern = containsPattern(text);
    const actorIds = await this.usersService.findIdsMatching(pattern, 50);
    return {
      $or: [
        { entityId: text.trim().toLowerCase() },
        ...SNAPSHOT_NAME_FIELDS.flatMap((field) => [
          { [`before.${field}`]: pattern },
          { [`after.${field}`]: pattern },
        ]),
        ...(actorIds.length > 0 ? [{ changedBy: { $in: actorIds } }] : []),
      ],
    };
  }

  /** Names of everyone and everything the page's entries mention (one query per kind). */
  private async namesFor(entries: AccessAudit[]): Promise<AuditNames> {
    const userIds = new Set<string>();
    const roleIds = new Set<string>();
    const groupIds = new Set<string>();
    const permissionIds = new Set<string>();
    for (const e of entries) {
      if (e.changedBy !== SYSTEM_ACTOR) {
        userIds.add(e.changedBy);
      }
      if (e.entityType !== AuditEntity.AccessMapping) {
        continue;
      }
      const link = e.after ?? e.before ?? {};
      const add = (set: Set<string>, value: unknown) => {
        if (typeof value === 'string') {
          set.add(value);
        }
      };
      add(roleIds, link.roleId);
      add(groupIds, link.groupId);
      add(permissionIds, link.permissionId);
      add(userIds, link.userId);
    }
    const [users, roles, groups, permissions] = await Promise.all([
      userIds.size ? this.usersService.findManyByIds([...userIds]) : [],
      roleIds.size
        ? this.roleModel
            .find({ _id: { $in: [...roleIds] } }, { roleName: 1 })
            .lean()
        : [],
      groupIds.size
        ? this.groupModel
            .find({ _id: { $in: [...groupIds] } }, { groupName: 1 })
            .lean()
        : [],
      permissionIds.size
        ? this.permissionModel
            .find({ _id: { $in: [...permissionIds] } }, { permissionKey: 1 })
            .lean()
        : [],
    ]);
    return {
      users: new Map(
        users.map((u) => [
          u.id,
          {
            name: [u.firstName, u.lastName].filter(Boolean).join(' '),
            email: u.email,
          },
        ]),
      ),
      roles: new Map(roles.map((r) => [r._id, r.roleName])),
      groups: new Map(groups.map((g) => [g._id, g.groupName])),
      permissions: new Map(permissions.map((p) => [p._id, p.permissionKey])),
    };
  }

  /** "Support Team → Helpdesk Agent", or the item's own name from the snapshot. */
  private labelOf(e: AccessAudit, names: AuditNames): string | null {
    const snapshot = e.after ?? e.before ?? {};
    if (e.entityType === AuditEntity.AccessMapping) {
      const id = (value: unknown) => (typeof value === 'string' ? value : '');
      const group = names.groups.get(id(snapshot.groupId));
      const role = names.roles.get(id(snapshot.roleId));
      const permission = names.permissions.get(id(snapshot.permissionId));
      const user = names.users.get(id(snapshot.userId));
      const parts =
        snapshot.type === 'ROLE_PERMISSION'
          ? [role, permission]
          : snapshot.type === 'GROUP_ROLE'
            ? [group, role]
            : [group, user?.email];
      const known = parts.filter((p): p is string => Boolean(p));
      return known.length > 0 ? known.join(' → ') : null;
    }
    for (const field of SNAPSHOT_NAME_FIELDS) {
      const value = snapshot[field];
      if (typeof value === 'string' && value) {
        return value;
      }
    }
    return null;
  }
}

/** Snapshot fields that name the changed item (first match wins for the label). */
const SNAPSHOT_NAME_FIELDS = [
  'roleName',
  'groupName',
  'permissionName',
  'label',
  'email',
  'name',
  'roleKey',
  'groupId',
  'permissionKey',
] as const;

interface AuditNames {
  users: Map<string, { name: string; email: string }>;
  roles: Map<string, string>;
  groups: Map<string, string>;
  permissions: Map<string, string>;
}
