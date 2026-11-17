# Access Control (RBAC): checklist status

Roles, Permissions, Groups and Access Mapping, as one module (`src/modules/access-control`).

**Model:** User → Group → Role → Permission. Users belong to many groups, groups have many roles, roles have many permissions; a user's permissions are the union, without duplicates.

Legend: `[x]` done and verified · `[~]` done differently (reason given) · `[ ]` deferred (reason given).

Verified by an end-to-end test against MongoDB (143 checks, including a restart and inheritance mode), a regression run of every earlier suite, and the Postman collection run (74 requests, 257 assertions).

**Decisions**

| Topic | Decision |
| --- | --- |
| Who can manage | Each endpoint needs a permission (`ROLE_CREATE`, `GROUP_UPDATE`, `ACCESS_MAPPING_ASSIGN`, ...). ADMIN users (CLI `users:role`) pass every check, so nobody can lock themselves out |
| System data | 18 system permissions + the `ACCESS_CONTROL_ADMIN` and `PASSWORD_POLICY_ADMIN` roles, seeded on startup; cannot be edited or deleted |
| Group inheritance | Off by default; `ACCESS_INHERIT_PARENT_GROUPS=true` gives sub-group members the parent groups' roles |
| Delete with dependencies | Blocked (`409 RESOURCE_IN_USE` with counts); soft delete; keys / names reusable afterwards |
| Categories, actions | Code-level lists (`access-control.constants.ts`), served by dropdown endpoints |
| Direct user roles / permissions | Not supported: always through groups (one clear path) |

---

## 1. Roles

- [x] Create: key, name, category, description; trimmed; key normalized uppercase and format-checked; duplicate key; duplicate name within the category (case-insensitive); category must exist (SYSTEM reserved); createdBy / updatedBy, timestamps; default ACTIVE; permission-protected
- [x] Update: by id (UUID checked); exists; partial; duplicates excluding itself; category checked; updatedBy / updatedAt; system roles protected (409); returns the role; optional `version` → 409 VERSION_CONFLICT
- [x] Delete: id checked; exists; blocked while assigned to groups (users get roles only through groups); system roles protected; soft delete with deletedBy / deletedAt; deleted roles can't be assigned
- [x] Details: key, name, category, description, status, created / updated info, permissionCount, groupCount
- [x] List: pagination; search key / name / description; filter category, status, created / updated dates; sort roleName, roleKey, category, createdAt, updatedAt (asc / desc, default updatedAt desc); totals and pages; list fields only (key, name, category, description, status, updated on)
- [x] Dropdown: separate; active only; `{ id, label, key }`; search; category filter; all records (no limit); deleted excluded
- [x] Category dropdown (`/roles/categories`, SYSTEM marked reserved)

## 2. Permissions

- [x] Create: key, name, description, metadata; key normalized / format-checked; duplicate key and name; default ACTIVE; who / when
- [x] Metadata: array of `{ key, value, action }`; key format; plain-text value (no markup or script characters); action from the central list (`CREATE READ UPDATE DELETE LIST EXPORT APPROVE ASSIGN MANAGE`); unique keys per permission; max 20 entries; optional; replaced as a whole on update
- [x] Update: by id; duplicates excluding itself; metadata re-validated; who / when; system permissions protected; changes apply to every role that has the permission (cache cleared)
- [x] Delete: blocked while any role has it; soft delete; deleted permissions can't be assigned
- [x] Details incl. roleCount
- [x] List: pagination; search key / name / description; filter metadataKey, metadataValue, action (one metadata entry must match all), status, dates; sort
- [x] Dropdown: active only; search; action and module filters
- [x] Actions dropdown (`/permissions/actions`)

## 3. Groups

- [x] Create: category, optional parent, group ID (given or generated `GRP-XXXXXX`), name, description, tags; parent must exist, not deleted, active; duplicate name among siblings; duplicate group ID; who / when; default ACTIVE
- [x] Tags: comma-separated string or array; split, trimmed, empty and duplicate tags removed, stored lowercase as an array; each tag only letters, numbers, `_`, `-`, `:`; max 20 tags × 30 characters; searchable
- [x] Update: name / group ID duplicates excluding itself; category; parent change validated: not itself, not under its own sub-group (no cycles), depth limit for the whole subtree; the subtree moves with it; tags re-validated; who / when
- [x] Delete: blocked while it has sub-groups or members (no accidental removal of a hierarchy); its role assignments go with it; soft delete
- [x] Details: group ID, name, category, parent, path from the main group, description, tags, child / member / role counts, status, dates
- [x] List: pagination; search name, group ID, description, tags; filter category, parent, ROOT / CHILD, status, dates; tags with ANY or ALL; sort
- [x] Dropdowns: group categories; groups (search, category, `rootOnly`, `parentGroupId` for nested selects, `parentId` returned); parent selection while editing (`excludeId` leaves out the group and its sub-groups); sub-groups (`/groups/:id/children`, optionally recursive)

## 4. Access mapping

- [x] Users ↔ groups: add (bulk), remove (bulk or by id); user exists and isn't suspended / banned / rejected / deactivated; group exists and active; duplicates skipped and reported; list members of a group and groups of a user; who / when
- [x] Roles ↔ groups: assign (bulk), remove; inactive roles rejected; duplicates; list both directions
- [x] Permissions ↔ roles: assign (bulk), remove (bulk); inactive permissions rejected; system role fixed; list both directions
- [x] Effective access: groups, roles (through groups) and permissions of a user, active only, without duplicates; optional parent-group inheritance; `/access-control/me` for the signed-in user
- [x] Mapping list: pagination; filter type, user, group, role, permission, assigned date; search users by email / name; sort by assigned date; names filled in (user, group, role, permission)
- [ ] Direct user ↔ role / permission assignments *(not supported by design: one path through groups keeps access explainable)*

## 5. Common functions

- [x] Duplicate check (`database/utils/unique-check.util.ts`): several rules at once, excluded id, extra conditions (category, parent), case-insensitive, soft-delete aware, one 409 listing every field; Mongo duplicate-key errors mapped to the same 409
- [x] Query helpers (`common/utils/query.util.ts`): literal-safe search, allowlisted sort, validated date ranges
- [x] Shared DTOs: list query (pagination, search, sort order, dates) and dropdown query / option
- [x] Normalizers: uppercase keys, collapsed names, tag parsing
- [x] Consistent errors: not found, protected, in use, inactive, version conflict, hierarchy, forbidden
- [x] Standard success / paginated / error envelopes (existing interceptor and filter)
- [~] Transactions: MongoDB runs standalone (no replica set), so multi-document transactions aren't available. Writes use atomic single-document operations, conditional updates and unique indexes instead

## 6. Database

- [x] `roles`, `permissions`, `groups` with status, isSystem, isDeleted, deletedAt / deletedBy, createdBy / updatedBy, timestamps, version
- [~] One `access_mappings` collection (type GROUP_USER / GROUP_ROLE / ROLE_PERMISSION) instead of three: one list endpoint and one audit path; uniqueness per type via partial unique indexes
- [x] `access_control_audit_logs`
- [x] Indexes: unique roleKey, permissionKey, groupId (among non-deleted); unique role name per category, permission name, group name per parent (case-insensitive); unique pair per mapping type; parentGroupId, ancestorIds, tags, status, isDeleted, metadata, reverse-lookup indexes

## 7. Security

- [x] JWT authentication and permission checks on every endpoint (dropdowns included)
- [x] No privilege escalation: non-ADMIN callers can only grant permissions they hold; nobody changes their own group membership (except ADMIN)
- [x] DTO whitelisting (no mass assignment), UUID validation, allowlisted sort fields, literal search (no regex / NoSQL injection), rate limits on writes
- [x] Inactive or deleted roles / permissions / groups grant nothing; suspended / banned users are already rejected by the guard
- [x] Cache refreshed on every change (immediately on the same instance, ≤ 30 s elsewhere)
- [x] Audit history; internal errors not exposed
- [x] Cannot remove the last administrator: ADMIN is a user flag set from the CLI, independent of groups
- [ ] Tenant isolation *(multi-tenancy module)*

## 8. Group and role features from the reference project

Same features, REST-style names (one endpoint per feature instead of v1 / v2 / v3 variants; options are query parameters):

| Reference endpoint | Feature | AuthCore |
| --- | --- | --- |
| `POST /group` · `PUT / GET / DELETE /group/{group_id}` | Group CRUD | `POST /groups` · `PATCH / GET / DELETE /groups/:id` |
| `POST /group/util/list/lite` (+ `/v2`) | Light list by category | `GET /groups/dropdown?category=` (all records, no limit) |
| `POST /group/path/util/list/lite` | Light list with path | `GET /groups/dropdown?withPath=true` |
| `POST /group/util/list/tree` (+ `/v2`, `/v3`) | Hierarchical tree | `GET /groups/tree` (`category`, `rootId`, `maxDepth`, `status`, `withCounts`) |
| `POST /group/util/admin/find/{group_id}/{category_id}` | Details by group ID within a category | `GET /groups/code/:groupCode?category=` |
| `POST /group/permission/matrix` | Permission matrix of a group in a category | `GET /groups/:id/permission-matrix?category=` |
| `POST /group/search/util/list` | Search list by category | `GET /groups?category=&search=&tags=` (paginated) |
| `POST /role` · `PUT / GET / DELETE /role/{role_key}` | Role CRUD by key | `POST /roles` · `PATCH / GET / DELETE /roles/key/:roleKey` |
| `GET /role/util/list/lite` | All roles (light) | `GET /roles/dropdown` (all, no limit) |
| `PUT /role/util/bulk/update` | Bulk update | `PATCH /roles/bulk` (all-or-nothing validation) |
| `GET /role/util/find/role/{role_id}` · `DELETE /role/util/delete/role/{role_id}` | By id | `GET / DELETE /roles/:id` |
| `POST /util/add/roles/with/group` | Create or update a role with its groups | `POST /roles/setup` (+ permissions, `replaceAssignments`) |
| `POST /util/name/existcheck` | Name exists check | `GET /roles/exists` (also `/permissions/exists`, `/groups/exists`) |

- [x] All of the above, verified by the end-to-end test (143 checks) and the Postman run (74 requests, 257 assertions)
- [x] Dropdowns return all active records (no limit), with optional search

## 9. Not in this sprint

- Direct user permissions, tenant isolation, a categories master table (categories are code lists for now).
