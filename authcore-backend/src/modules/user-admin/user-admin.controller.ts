import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';

import { API_TAGS } from '@common/constants/api-tags.constants';
import {
  ApiErrorResponses,
  ApiPaginatedResponse,
  ApiStandardErrors,
  ApiWrappedResponse,
} from '@common/decorators/api-response.decorator';
import { RequirePermissions } from '@common/decorators/require-permissions.decorator';
import { ResponseMessage } from '@common/decorators/response-message.decorator';
import { Roles } from '@common/decorators/roles.decorator';
import type { Paginated } from '@common/interfaces/api-response.interface';
import { ParseIdPipe } from '@common/pipes/parse-id.pipe';
import { USER_PERMISSIONS as U } from '@modules/access-control/constants/access-control.constants';
import { CurrentActor } from '@modules/access-control/decorators/current-actor.decorator';
import { AccessTreeGroupDto } from '@modules/access-control/dto/access-mapping.dto';
import type { Actor } from '@modules/access-control/interfaces/actor.interface';
import {
  AVATAR_BODY_SCHEMA,
  FileResponseDto,
} from '@modules/files/dto/file.dto';
import { FileUploadInterceptor } from '@modules/files/interceptors/file-upload.interceptor';
import type { IncomingFile } from '@modules/files/services/files.service';
import {
  ActivityQueryDto,
  UserActivityDto,
} from '@modules/user-activity/dto/user-activity.dto';
import { UserActivityService } from '@modules/user-activity/user-activity.service';
import { UpdateAttributesDto } from '@modules/user-schema/dto/user-attribute.dto';
import { AdminUserResponseDto } from '@modules/users/dto/user-response.dto';
import { UserRole } from '@modules/users/enums/user-role.enum';

import {
  AdminCreateUserDto,
  AdminReasonDto,
  AdminSessionDto,
  AdminSetPasswordDto,
  AdminSetRoleDto,
  AdminSetStatusDto,
  AdminUpdateUserDto,
  AdminUserDetailsDto,
  AdminUserListQueryDto,
  AvailabilityDto,
  AvailabilityQueryDto,
  CountResultDto,
  CreateUserConfigDto,
  ForcePasswordResetDto,
  PasswordResetSentDto,
  PurgeRunDto,
} from './dto/admin-user.dto';
import { UserAdminService } from './services/user-admin.service';

const WRITE_THROTTLE = { limit: 60, ttl: 60_000 } as const;
const ERRORS = [
  HttpStatus.BAD_REQUEST,
  HttpStatus.UNAUTHORIZED,
  HttpStatus.FORBIDDEN,
  HttpStatus.NOT_FOUND,
] as const;
const GUARD_RAILS =
  'You cannot act on your own account here (use /users/me); only ADMIN users can manage ADMIN accounts; the last active ADMIN is protected.';

@ApiTags(API_TAGS.UserAdmin.name)
@ApiBearerAuth('access-token')
@ApiStandardErrors()
@Controller('admin/users')
export class UserAdminController {
  constructor(
    private readonly userAdminService: UserAdminService,
    private readonly activityService: UserActivityService,
  ) {}

  @Get()
  @RequirePermissions(U.Read)
  @Header('Cache-Control', 'no-store')
  @ResponseMessage('Users')
  @ApiOperation({
    summary: 'List users',
    description:
      'Needs USER_READ. Search (email, username, names); filter status, role, source, isEmailVerified, ' +
      'isPendingDeletion, deleted (EXCLUDE / ONLY / INCLUDE), created / updated dates; sort; pagination.',
  })
  @ApiPaginatedResponse(AdminUserResponseDto)
  @ApiErrorResponses(...ERRORS)
  list(
    @Query() query: AdminUserListQueryDto,
  ): Promise<Paginated<AdminUserResponseDto>> {
    return this.userAdminService.list(query);
  }

  @Post()
  @RequirePermissions(U.Create)
  @Throttle({ default: WRITE_THROTTLE })
  @ResponseMessage('User created')
  @ApiOperation({
    summary: 'Create a user',
    description:
      'Needs USER_CREATE. Active account with an initial password (password policy applies; never emailed). ' +
      'By default the email counts as verified and the user must change the password at first sign-in. ' +
      'Optional groupIds (you can only grant permissions you hold) and a welcome email.',
  })
  @ApiWrappedResponse(AdminUserDetailsDto, { status: HttpStatus.CREATED })
  @ApiErrorResponses(...ERRORS, HttpStatus.CONFLICT)
  create(
    @Body() dto: AdminCreateUserDto,
    @CurrentActor() actor: Actor,
  ): Promise<AdminUserDetailsDto> {
    return this.userAdminService.create(dto, actor);
  }

  @Post('deletion-purge/run')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(U.Delete)
  @ResponseMessage('Scheduled deletions processed')
  @ApiOperation({
    summary: 'Run the scheduled account purge now',
    description:
      'Needs USER_DELETE. Permanently deletes accounts whose self-requested deletion date has passed (normally runs every ACCOUNT_PURGE_INTERVAL_MINUTES).',
  })
  @ApiWrappedResponse(PurgeRunDto)
  @ApiErrorResponses(HttpStatus.UNAUTHORIZED, HttpStatus.FORBIDDEN)
  runPurge(): Promise<PurgeRunDto> {
    return this.userAdminService.runPurge();
  }

  @Get('create-config')
  @RequirePermissions(U.Create)
  @Header('Cache-Control', 'no-store')
  @ResponseMessage('Create user form')
  @ApiOperation({
    summary: 'Create user: form configuration',
    description:
      'Needs USER_CREATE. Built-in name fields (label / enabled / required from the user schema), the custom ' +
      'variables to show (enabled, incl. internal ones; values go in "attributes" of POST /admin/users), the ' +
      'active password rules, the form defaults and whether the caller can pick groups.',
  })
  @ApiWrappedResponse(CreateUserConfigDto)
  @ApiErrorResponses(HttpStatus.UNAUTHORIZED, HttpStatus.FORBIDDEN)
  createConfig(@CurrentActor() actor: Actor): Promise<CreateUserConfigDto> {
    return this.userAdminService.createConfig(actor);
  }

  @Get('availability')
  @RequirePermissions(U.Create)
  @Throttle({ default: { limit: 120, ttl: 60_000 } })
  @Header('Cache-Control', 'no-store')
  @ResponseMessage('Availability')
  @ApiOperation({
    summary: 'Is an email / username free?',
    description:
      'Needs USER_CREATE. For live checks while typing; POST /admin/users still decides (409 if taken).',
  })
  @ApiWrappedResponse(AvailabilityDto)
  @ApiErrorResponses(
    HttpStatus.BAD_REQUEST,
    HttpStatus.UNAUTHORIZED,
    HttpStatus.FORBIDDEN,
  )
  availability(@Query() query: AvailabilityQueryDto): Promise<AvailabilityDto> {
    return this.userAdminService.availability(query);
  }

  @Get(':id')
  @RequirePermissions(U.Read)
  @Header('Cache-Control', 'no-store')
  @ResponseMessage('User')
  @ApiOperation({
    summary: 'User info',
    description:
      'Needs USER_READ. Profile, status history, active session count, groups, effective permissions and sign-in lock. Includes soft-deleted users.',
  })
  @ApiWrappedResponse(AdminUserDetailsDto)
  @ApiErrorResponses(...ERRORS)
  get(@Param('id', ParseIdPipe) id: string): Promise<AdminUserDetailsDto> {
    return this.userAdminService.get(id);
  }

  @Patch(':id')
  @RequirePermissions(U.Update)
  @Throttle({ default: WRITE_THROTTLE })
  @ResponseMessage('User updated')
  @ApiOperation({
    summary: 'Update a user',
    description: `Needs USER_UPDATE. firstName, lastName, username, email (changed directly; old address notified). ${GUARD_RAILS}`,
  })
  @ApiWrappedResponse(AdminUserDetailsDto)
  @ApiErrorResponses(...ERRORS, HttpStatus.CONFLICT)
  update(
    @Param('id', ParseIdPipe) id: string,
    @Body() dto: AdminUpdateUserDto,
    @CurrentActor() actor: Actor,
  ): Promise<AdminUserDetailsDto> {
    return this.userAdminService.update(id, dto, actor);
  }

  @Patch(':id/status')
  @RequirePermissions(U.Update)
  @Throttle({ default: WRITE_THROTTLE })
  @ResponseMessage('User status changed')
  @ApiOperation({
    summary: 'Activate, deactivate, suspend or ban a user',
    description:
      'Needs USER_UPDATE. status ACTIVE / INACTIVE / SUSPENDED / BANNED with an optional reason (stored, and in ' +
      'the email to the user unless notifyUser=false). Anything but ACTIVE signs the user out everywhere; ACTIVE ' +
      `also cancels a scheduled deletion and clears the sign-in lock. ${GUARD_RAILS}`,
  })
  @ApiWrappedResponse(AdminUserDetailsDto)
  @ApiErrorResponses(...ERRORS, HttpStatus.CONFLICT)
  setStatus(
    @Param('id', ParseIdPipe) id: string,
    @Body() dto: AdminSetStatusDto,
    @CurrentActor() actor: Actor,
  ): Promise<AdminUserDetailsDto> {
    return this.userAdminService.setStatus(id, dto, actor);
  }

  @Patch(':id/role')
  @Roles(UserRole.Admin)
  @Throttle({ default: WRITE_THROTTLE })
  @ResponseMessage('User role changed')
  @ApiOperation({
    summary: 'Make a user ADMIN or USER',
    description:
      'ADMIN users only (ADMIN = super admin, passes every permission check). The last active ADMIN cannot be demoted.',
  })
  @ApiWrappedResponse(AdminUserDetailsDto)
  @ApiErrorResponses(...ERRORS, HttpStatus.CONFLICT)
  setRole(
    @Param('id', ParseIdPipe) id: string,
    @Body() dto: AdminSetRoleDto,
    @CurrentActor() actor: Actor,
  ): Promise<AdminUserDetailsDto> {
    return this.userAdminService.setRole(id, dto.role, actor);
  }

  @Post(':id/reset-password')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(U.PasswordManage)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ResponseMessage('Password reset email sent')
  @ApiOperation({
    summary: 'Send the user a password-reset email',
    description: `Needs USER_PASSWORD_MANAGE. The user gets the normal reset code / link (PASSWORD_RESET_METHOD) and sets a new password. ${GUARD_RAILS}`,
  })
  @ApiWrappedResponse(PasswordResetSentDto)
  @ApiErrorResponses(...ERRORS)
  resetPassword(
    @Param('id', ParseIdPipe) id: string,
    @CurrentActor() actor: Actor,
  ): Promise<PasswordResetSentDto> {
    return this.userAdminService.sendPasswordReset(id, actor);
  }

  @Patch(':id/attributes')
  @RequirePermissions(U.Update)
  @Throttle({ default: WRITE_THROTTLE })
  @ResponseMessage('Personal details updated')
  @ApiOperation({
    summary: "Update the user's personal details (custom variables)",
    description: `Needs USER_UPDATE. Like PATCH /users/me/attributes, but internal and read-only variables can be set. ${GUARD_RAILS}`,
  })
  @ApiWrappedResponse(AdminUserDetailsDto)
  @ApiErrorResponses(...ERRORS, HttpStatus.CONFLICT)
  updateAttributes(
    @Param('id', ParseIdPipe) id: string,
    @Body() dto: UpdateAttributesDto,
    @CurrentActor() actor: Actor,
  ): Promise<AdminUserDetailsDto> {
    return this.userAdminService.updateAttributes(id, dto.attributes, actor);
  }

  @Post(':id/avatar')
  @RequirePermissions(U.Update)
  @UseInterceptors(FileUploadInterceptor)
  @Throttle({ default: WRITE_THROTTLE })
  @ResponseMessage('Profile picture updated')
  @ApiConsumes('multipart/form-data')
  @ApiBody({ schema: AVATAR_BODY_SCHEMA })
  @ApiOperation({
    summary: "Upload the user's profile picture",
    description: `Needs USER_UPDATE. Same rules as POST /users/me/avatar. ${GUARD_RAILS}`,
  })
  @ApiWrappedResponse(FileResponseDto, { status: HttpStatus.CREATED })
  @ApiErrorResponses(
    ...ERRORS,
    HttpStatus.PAYLOAD_TOO_LARGE,
    HttpStatus.UNSUPPORTED_MEDIA_TYPE,
  )
  uploadAvatar(
    @Param('id', ParseIdPipe) id: string,
    @UploadedFile() file: IncomingFile | undefined,
    @CurrentActor() actor: Actor,
  ): Promise<FileResponseDto> {
    return this.userAdminService.setAvatar(id, file, actor);
  }

  @Delete(':id/avatar')
  @RequirePermissions(U.Update)
  @Throttle({ default: WRITE_THROTTLE })
  @ResponseMessage('Profile picture removed')
  @ApiOperation({
    summary: "Remove the user's profile picture",
    description: `Needs USER_UPDATE. ${GUARD_RAILS}`,
  })
  @ApiWrappedResponse()
  @ApiErrorResponses(...ERRORS)
  removeAvatar(
    @Param('id', ParseIdPipe) id: string,
    @CurrentActor() actor: Actor,
  ): Promise<{ isRemoved: boolean }> {
    return this.userAdminService.removeAvatar(id, actor);
  }

  @Post(':id/set-password')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(U.PasswordManage)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Header('Cache-Control', 'no-store')
  @ResponseMessage('Password set')
  @ApiOperation({
    summary: 'Set a new password for the user',
    description:
      'Needs USER_PASSWORD_MANAGE. The "Reset password" panel: newPassword + confirmPassword (policy and history ' +
      'apply; "Generate" = POST /password-policies/generate-password), optional email notice (never contains the ' +
      'password), "reset password on next login", signs the user out unless signOutAllSessions=false. ' +
      GUARD_RAILS,
  })
  @ApiWrappedResponse(AdminUserDetailsDto)
  @ApiErrorResponses(...ERRORS, HttpStatus.CONFLICT)
  setPassword(
    @Param('id', ParseIdPipe) id: string,
    @Body() dto: AdminSetPasswordDto,
    @CurrentActor() actor: Actor,
  ): Promise<AdminUserDetailsDto> {
    return this.userAdminService.setPassword(id, dto, actor);
  }

  @Get(':id/access')
  @RequirePermissions(U.Read)
  @Header('Cache-Control', 'no-store')
  @ResponseMessage('User groups and roles')
  @ApiOperation({
    summary: "The user's groups, roles and permissions",
    description:
      'Needs USER_READ. "Groups & roles" panel: memberships → group roles → role permissions, each with its mapping ' +
      'id and end date (isExpired). Set an end date with PATCH /access-mappings/:mappingId, remove with ' +
      'DELETE /access-mappings/:mappingId.',
  })
  @ApiWrappedResponse(AccessTreeGroupDto, { isArray: true })
  @ApiErrorResponses(...ERRORS)
  access(@Param('id', ParseIdPipe) id: string): Promise<AccessTreeGroupDto[]> {
    return this.userAdminService.accessTree(id);
  }

  @Get(':id/activity')
  @RequirePermissions(U.Read)
  @Header('Cache-Control', 'no-store')
  @ResponseMessage('User activity')
  @ApiOperation({
    summary: 'Recent user activities',
    description:
      'Needs USER_READ. Sign-ins, failed sign-ins, logouts, password / email changes, admin actions; device, browser, IP. Newest first.',
  })
  @ApiPaginatedResponse(UserActivityDto)
  @ApiErrorResponses(...ERRORS)
  activity(
    @Param('id', ParseIdPipe) id: string,
    @Query() query: ActivityQueryDto,
  ): Promise<Paginated<UserActivityDto>> {
    return this.activityService.list(id, query);
  }

  @Post(':id/force-password-reset')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(U.PasswordManage)
  @Throttle({ default: WRITE_THROTTLE })
  @ResponseMessage('Password change required at next sign-in')
  @ApiOperation({
    summary: 'Force a password change (silent)',
    description:
      'Needs USER_PASSWORD_MANAGE. No email. At the next sign-in `isPasswordChangeRequired` is true and only ' +
      'change-password, /me and logout work until the password is changed. Signs the user out everywhere unless ' +
      `signOutAllSessions=false. ${GUARD_RAILS}`,
  })
  @ApiWrappedResponse(AdminUserDetailsDto)
  @ApiErrorResponses(...ERRORS)
  forcePasswordReset(
    @Param('id', ParseIdPipe) id: string,
    @Body() dto: ForcePasswordResetDto,
    @CurrentActor() actor: Actor,
  ): Promise<AdminUserDetailsDto> {
    return this.userAdminService.forcePasswordReset(
      id,
      dto.signOutAllSessions ?? true,
      actor,
    );
  }

  @Post(':id/unlock')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(U.Update)
  @ResponseMessage('Sign-in unlocked')
  @ApiOperation({
    summary: 'Clear the sign-in lock',
    description:
      'Needs USER_UPDATE. Removes the lock after too many failed sign-ins.',
  })
  @ApiWrappedResponse(AdminUserDetailsDto)
  @ApiErrorResponses(...ERRORS)
  unlock(
    @Param('id', ParseIdPipe) id: string,
    @CurrentActor() actor: Actor,
  ): Promise<AdminUserDetailsDto> {
    return this.userAdminService.unlock(id, actor);
  }

  @Get(':id/sessions')
  @RequirePermissions(U.Read)
  @Header('Cache-Control', 'no-store')
  @ResponseMessage('User sessions')
  @ApiOperation({
    summary: "The user's active sessions",
    description: 'Needs USER_READ.',
  })
  @ApiWrappedResponse(AdminSessionDto, { isArray: true })
  @ApiErrorResponses(...ERRORS)
  sessions(@Param('id', ParseIdPipe) id: string): Promise<AdminSessionDto[]> {
    return this.userAdminService.sessions(id);
  }

  @Post(':id/sessions/revoke')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(U.Update)
  @ResponseMessage('User signed out everywhere')
  @ApiOperation({
    summary: 'Sign the user out on all devices',
    description: `Needs USER_UPDATE. ${GUARD_RAILS}`,
  })
  @ApiWrappedResponse(CountResultDto)
  @ApiErrorResponses(...ERRORS)
  async revokeSessions(
    @Param('id', ParseIdPipe) id: string,
    @CurrentActor() actor: Actor,
  ): Promise<CountResultDto> {
    return { count: await this.userAdminService.revokeSessions(id, actor) };
  }

  @Delete(':id')
  @RequirePermissions(U.Delete)
  @Throttle({ default: WRITE_THROTTLE })
  @ResponseMessage('User deleted')
  @ApiOperation({
    summary: 'Delete a user (soft)',
    description: `Needs USER_DELETE. Hidden from lists, cannot sign in, signed out everywhere; restorable with POST /admin/users/:id/restore. ${GUARD_RAILS}`,
  })
  @ApiWrappedResponse(AdminUserResponseDto)
  @ApiErrorResponses(...ERRORS, HttpStatus.CONFLICT)
  softDelete(
    @Param('id', ParseIdPipe) id: string,
    @Body() dto: AdminReasonDto,
    @CurrentActor() actor: Actor,
  ): Promise<AdminUserResponseDto> {
    return this.userAdminService.softDelete(id, dto.reason, actor);
  }

  @Post(':id/restore')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(U.Delete)
  @ResponseMessage('User restored')
  @ApiOperation({
    summary: 'Restore a deleted user',
    description: 'Needs USER_DELETE.',
  })
  @ApiWrappedResponse(AdminUserResponseDto)
  @ApiErrorResponses(...ERRORS)
  restore(
    @Param('id', ParseIdPipe) id: string,
    @CurrentActor() actor: Actor,
  ): Promise<AdminUserResponseDto> {
    return this.userAdminService.restore(id, actor);
  }

  @Delete(':id/permanent')
  @RequirePermissions(U.Delete)
  @Throttle({ default: WRITE_THROTTLE })
  @ResponseMessage('User permanently deleted')
  @ApiOperation({
    summary: 'Permanently delete a user and their data',
    description:
      'Needs USER_DELETE. Only for soft-deleted users or accounts pending deletion (409 otherwise). Removes the ' +
      'account, sessions, group memberships, codes and sign-in history; audit logs are kept. Cannot be undone.',
  })
  @ApiWrappedResponse()
  @ApiErrorResponses(...ERRORS, HttpStatus.CONFLICT)
  permanentDelete(
    @Param('id', ParseIdPipe) id: string,
    @CurrentActor() actor: Actor,
  ) {
    return this.userAdminService.permanentDelete(id, actor);
  }
}
