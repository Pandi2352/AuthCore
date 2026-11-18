import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';

import { API_TAGS } from '@common/constants/api-tags.constants';
import {
  ApiErrorResponses,
  ApiPaginatedResponse,
  ApiStandardErrors,
  ApiWrappedResponse,
} from '@common/decorators/api-response.decorator';
import { ClientInfoParam } from '@common/decorators/client-info.decorator';
import { CurrentUser } from '@common/decorators/current-user.decorator';
import { Public } from '@common/decorators/public.decorator';
import { RequirePermissions } from '@common/decorators/require-permissions.decorator';
import { ResponseMessage } from '@common/decorators/response-message.decorator';
import { PaginationQueryDto } from '@common/dto/pagination-query.dto';
import type { Paginated } from '@common/interfaces/api-response.interface';
import type { AuthContext } from '@common/interfaces/auth-context.interface';
import type { ClientInfo } from '@common/interfaces/client-info.interface';
import { ParseIdPipe } from '@common/pipes/parse-id.pipe';
import { PASSWORD_POLICY_PERMISSIONS as PP } from '@modules/access-control/constants/access-control.constants';

import {
  POLICY_UPDATE_THROTTLE,
  VALIDATE_PASSWORD_THROTTLE,
} from './constants/password-policy.constants';
import {
  PasswordPolicyResponseDto,
  PasswordRequirementsDto,
  PolicyAuditEntryDto,
  UpdatePasswordPolicyDto,
} from './dto/password-policy.dto';
import {
  SchedulerRunResponseDto,
  SchedulersResponseDto,
  UpdateSchedulersDto,
} from './dto/scheduler.dto';
import {
  GeneratedPasswordDto,
  GeneratePasswordDto,
  ValidatePasswordDto,
  ValidatePasswordResponseDto,
} from './dto/validate-password.dto';
import { SchedulerJob } from './enums/scheduler.enum';
import { PasswordPolicyService } from './services/password-policy.service';
import { PasswordSchedulerService } from './services/password-scheduler.service';
import { PasswordValidationService } from './services/password-validation.service';
import { PolicyAuditService } from './services/policy-audit.service';

const ADMIN_ONLY =
  'Requires a signed-in user with PASSWORD_POLICY_READ (reading) or PASSWORD_POLICY_MANAGE (changing / running), ' +
  'e.g. through the system role PASSWORD_POLICY_ADMIN, or the ADMIN role (403 FORBIDDEN otherwise).';

/**
 * Password policy: admins configure it; sign-up / reset / change forms read
 * the requirements and pre-check passwords (public).
 */
@ApiTags(API_TAGS.PasswordPolicy.name)
@ApiStandardErrors()
@Controller('password-policies')
export class PasswordPolicyController {
  constructor(
    private readonly passwordPolicyService: PasswordPolicyService,
    private readonly passwordValidationService: PasswordValidationService,
    private readonly passwordSchedulerService: PasswordSchedulerService,
    private readonly policyAuditService: PolicyAuditService,
  ) {}

  @Get()
  @RequirePermissions(PP.Read)
  @ApiBearerAuth('access-token')
  @Header('Cache-Control', 'no-store')
  @ResponseMessage('Password policy retrieved successfully')
  @ApiOperation({
    summary: 'Get the password policy',
    description: `${ADMIN_ONLY} Until a policy is saved, the built-in default is returned with \`isDefault: true\`.`,
  })
  @ApiWrappedResponse(PasswordPolicyResponseDto)
  @ApiErrorResponses(HttpStatus.UNAUTHORIZED, HttpStatus.FORBIDDEN)
  getPolicy(): Promise<PasswordPolicyResponseDto> {
    return this.passwordPolicyService.getPolicy();
  }

  @Put()
  @RequirePermissions(PP.Manage)
  @ApiBearerAuth('access-token')
  @Throttle({ default: POLICY_UPDATE_THROTTLE })
  @Header('Cache-Control', 'no-store')
  @ResponseMessage('Password policy updated successfully')
  @ApiOperation({
    summary: 'Create or update the password policy',
    description:
      `${ADMIN_ONLY} Send the complete policy. Applies to every password set from then on ` +
      '(register, reset, change) on all instances within 15 seconds; existing passwords are not ' +
      're-checked, but expiry (passwordValidity) applies to them immediately.\n\n' +
      'Errors: 400 VALIDATION_FAILED (a field), 400 INVALID_PASSWORD_POLICY (fields that ' +
      'contradict each other, e.g. minimum > maximum). Every change is recorded in /history.',
  })
  @ApiWrappedResponse(PasswordPolicyResponseDto)
  @ApiErrorResponses(
    HttpStatus.BAD_REQUEST,
    HttpStatus.UNAUTHORIZED,
    HttpStatus.FORBIDDEN,
    HttpStatus.TOO_MANY_REQUESTS,
  )
  updatePolicy(
    @CurrentUser() auth: AuthContext,
    @Body() dto: UpdatePasswordPolicyDto,
    @ClientInfoParam() client: ClientInfo,
  ): Promise<PasswordPolicyResponseDto> {
    return this.passwordPolicyService.update(dto, auth, client);
  }

  @Get('history')
  @RequirePermissions(PP.Read)
  @ApiBearerAuth('access-token')
  @Header('Cache-Control', 'no-store')
  @ResponseMessage('Password policy history')
  @ApiOperation({
    summary: 'Policy and scheduler change history',
    description: `${ADMIN_ONLY} Newest first: who changed what (old / new values, changed fields), when and from where.`,
  })
  @ApiPaginatedResponse(PolicyAuditEntryDto)
  @ApiErrorResponses(
    HttpStatus.BAD_REQUEST,
    HttpStatus.UNAUTHORIZED,
    HttpStatus.FORBIDDEN,
  )
  getHistory(
    @Query() query: PaginationQueryDto,
  ): Promise<Paginated<PolicyAuditEntryDto>> {
    return this.policyAuditService.list(query.page, query.limit);
  }

  @Public()
  @Get('requirements')
  @ResponseMessage('Password requirements')
  @ApiOperation({
    summary: 'Password requirements for forms (public)',
    description:
      'The rules a new password must meet, as numbers and as a ready-to-display list. ' +
      'For sign-up, reset and change-password forms.',
  })
  @ApiWrappedResponse(PasswordRequirementsDto)
  getRequirements(): Promise<PasswordRequirementsDto> {
    return this.passwordPolicyService.getRequirements();
  }

  @Post('generate-password')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('access-token')
  @Throttle({ default: VALIDATE_PASSWORD_THROTTLE })
  @Header('Cache-Control', 'no-store')
  @ResponseMessage('Password generated')
  @ApiOperation({
    summary: 'Generate a password that meets the policy',
    description:
      'Any signed-in user (e.g. the "Generate" button on reset / change / create-user forms). Random, uses a ' +
      'cryptographic RNG, avoids look-alike characters, satisfies every current policy rule. Never stored or logged.',
  })
  @ApiWrappedResponse(GeneratedPasswordDto)
  @ApiErrorResponses(HttpStatus.BAD_REQUEST, HttpStatus.UNAUTHORIZED)
  async generatePassword(
    @Body() dto: GeneratePasswordDto,
  ): Promise<GeneratedPasswordDto> {
    const password = await this.passwordValidationService.generate(dto.length);
    return { password, length: password.length };
  }

  @Public()
  @Post('validate')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: VALIDATE_PASSWORD_THROTTLE })
  @Header('Cache-Control', 'no-store')
  @ResponseMessage('Password checked')
  @ApiOperation({
    summary: 'Check a password against the policy (public)',
    description:
      "Returns every rule the password breaks, for live feedback while typing. Send the user's " +
      'email / username / names to also check the personal-info rule. The password is never ' +
      'stored, logged or returned. Password history is only checked when the password is ' +
      'actually set.',
  })
  @ApiWrappedResponse(ValidatePasswordResponseDto)
  @ApiErrorResponses(HttpStatus.BAD_REQUEST, HttpStatus.TOO_MANY_REQUESTS)
  async validatePassword(
    @Body() dto: ValidatePasswordDto,
  ): Promise<ValidatePasswordResponseDto> {
    const violations = await this.passwordValidationService.validate(
      dto.password,
      dto,
    );
    return { isValid: violations.length === 0, violations };
  }

  @Get('schedulers')
  @RequirePermissions(PP.Read)
  @ApiBearerAuth('access-token')
  @Header('Cache-Control', 'no-store')
  @ResponseMessage('Scheduler configuration retrieved successfully')
  @ApiOperation({
    summary: 'Get scheduler configuration',
    description: `${ADMIN_ONLY} Includes last / next execution and status.`,
  })
  @ApiWrappedResponse(SchedulersResponseDto)
  @ApiErrorResponses(HttpStatus.UNAUTHORIZED, HttpStatus.FORBIDDEN)
  getSchedulers(): Promise<SchedulersResponseDto> {
    return this.passwordSchedulerService.getAll();
  }

  @Put('schedulers')
  @RequirePermissions(PP.Manage)
  @ApiBearerAuth('access-token')
  @Throttle({ default: POLICY_UPDATE_THROTTLE })
  @Header('Cache-Control', 'no-store')
  @ResponseMessage('Scheduler configuration updated successfully')
  @ApiOperation({
    summary: 'Update scheduler configuration',
    description:
      `${ADMIN_ONLY} Takes effect without a restart; the next execution is recalculated. ` +
      'Runs on one instance at a time (database lock). Failed runs are retried after 15 minutes.',
  })
  @ApiWrappedResponse(SchedulersResponseDto)
  @ApiErrorResponses(
    HttpStatus.BAD_REQUEST,
    HttpStatus.UNAUTHORIZED,
    HttpStatus.FORBIDDEN,
    HttpStatus.TOO_MANY_REQUESTS,
  )
  updateSchedulers(
    @CurrentUser() auth: AuthContext,
    @Body() dto: UpdateSchedulersDto,
    @ClientInfoParam() client: ClientInfo,
  ): Promise<SchedulersResponseDto> {
    return this.passwordSchedulerService.update(dto, auth, client);
  }

  @Post('schedulers/password-expiry-notification/run')
  @RequirePermissions(PP.Manage)
  @ApiBearerAuth('access-token')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: POLICY_UPDATE_THROTTLE })
  @ResponseMessage('Password expiry notification job finished')
  @ApiOperation({
    summary: 'Run the password expiry reminder job now',
    description: `${ADMIN_ONLY} Runs immediately, even if the schedule is disabled. Users already reminded are skipped. 409 if it is already running.`,
  })
  @ApiWrappedResponse(SchedulerRunResponseDto)
  @ApiErrorResponses(
    HttpStatus.UNAUTHORIZED,
    HttpStatus.FORBIDDEN,
    HttpStatus.CONFLICT,
  )
  runExpiryNotification(
    @CurrentUser() auth: AuthContext,
  ): Promise<SchedulerRunResponseDto> {
    return this.passwordSchedulerService.runNow(
      SchedulerJob.PasswordExpiryNotification,
      auth,
    );
  }

  // ---------------------------------------------------------------- several policies
  // Declared after the fixed paths (history, requirements, schedulers …) so ":id" never
  // shadows them.

  @Get('all')
  @RequirePermissions(PP.Read)
  @ApiBearerAuth('access-token')
  @Header('Cache-Control', 'no-store')
  @ResponseMessage('Password policies')
  @ApiOperation({
    summary: 'All password policies',
    description: `${ADMIN_ONLY} The active one first (exactly one is active), then the most recently changed.`,
  })
  @ApiWrappedResponse(PasswordPolicyResponseDto, { isArray: true })
  @ApiErrorResponses(HttpStatus.UNAUTHORIZED, HttpStatus.FORBIDDEN)
  list(): Promise<PasswordPolicyResponseDto[]> {
    return this.passwordPolicyService.list();
  }

  @Post()
  @RequirePermissions(PP.Manage)
  @ApiBearerAuth('access-token')
  @Throttle({ default: POLICY_UPDATE_THROTTLE })
  @ResponseMessage('Password policy created')
  @ApiOperation({
    summary: 'Create a password policy',
    description: `${ADMIN_ONLY} Saved inactive: activate it to apply it. Same rules as PUT.`,
  })
  @ApiWrappedResponse(PasswordPolicyResponseDto, { status: HttpStatus.CREATED })
  @ApiErrorResponses(
    HttpStatus.BAD_REQUEST,
    HttpStatus.UNAUTHORIZED,
    HttpStatus.FORBIDDEN,
  )
  create(
    @CurrentUser() auth: AuthContext,
    @Body() dto: UpdatePasswordPolicyDto,
    @ClientInfoParam() client: ClientInfo,
  ): Promise<PasswordPolicyResponseDto> {
    return this.passwordPolicyService.create(dto, auth, client);
  }

  @Get(':id')
  @RequirePermissions(PP.Read)
  @ApiBearerAuth('access-token')
  @Header('Cache-Control', 'no-store')
  @ResponseMessage('Password policy')
  @ApiOperation({ summary: 'One password policy', description: ADMIN_ONLY })
  @ApiWrappedResponse(PasswordPolicyResponseDto)
  @ApiErrorResponses(
    HttpStatus.UNAUTHORIZED,
    HttpStatus.FORBIDDEN,
    HttpStatus.NOT_FOUND,
  )
  getOne(
    @Param('id', ParseIdPipe) id: string,
  ): Promise<PasswordPolicyResponseDto> {
    return this.passwordPolicyService.getById(id);
  }

  @Put(':id')
  @RequirePermissions(PP.Manage)
  @ApiBearerAuth('access-token')
  @Throttle({ default: POLICY_UPDATE_THROTTLE })
  @Header('Cache-Control', 'no-store')
  @ResponseMessage('Password policy updated')
  @ApiOperation({
    summary: 'Update a password policy',
    description: `${ADMIN_ONLY} Send the complete policy. Editing the active policy applies at once (within 15 s on every instance).`,
  })
  @ApiWrappedResponse(PasswordPolicyResponseDto)
  @ApiErrorResponses(
    HttpStatus.BAD_REQUEST,
    HttpStatus.UNAUTHORIZED,
    HttpStatus.FORBIDDEN,
    HttpStatus.NOT_FOUND,
  )
  updateOne(
    @Param('id', ParseIdPipe) id: string,
    @CurrentUser() auth: AuthContext,
    @Body() dto: UpdatePasswordPolicyDto,
    @ClientInfoParam() client: ClientInfo,
  ): Promise<PasswordPolicyResponseDto> {
    return this.passwordPolicyService.updateById(id, dto, auth, client);
  }

  @Post(':id/activate')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(PP.Manage)
  @ApiBearerAuth('access-token')
  @Throttle({ default: POLICY_UPDATE_THROTTLE })
  @ResponseMessage('Password policy activated')
  @ApiOperation({
    summary: 'Make a policy the active one',
    description: `${ADMIN_ONLY} Every password set from now on follows it; the previous active policy is kept (inactive). Recorded in /history.`,
  })
  @ApiWrappedResponse(PasswordPolicyResponseDto)
  @ApiErrorResponses(
    HttpStatus.UNAUTHORIZED,
    HttpStatus.FORBIDDEN,
    HttpStatus.NOT_FOUND,
  )
  activate(
    @Param('id', ParseIdPipe) id: string,
    @CurrentUser() auth: AuthContext,
    @ClientInfoParam() client: ClientInfo,
  ): Promise<PasswordPolicyResponseDto> {
    return this.passwordPolicyService.activate(id, auth, client);
  }

  @Post(':id/duplicate')
  @RequirePermissions(PP.Manage)
  @ApiBearerAuth('access-token')
  @Throttle({ default: POLICY_UPDATE_THROTTLE })
  @ResponseMessage('Password policy duplicated')
  @ApiOperation({
    summary: 'Duplicate a policy',
    description: `${ADMIN_ONLY} An inactive copy named "<name> (copy)".`,
  })
  @ApiWrappedResponse(PasswordPolicyResponseDto, { status: HttpStatus.CREATED })
  @ApiErrorResponses(
    HttpStatus.UNAUTHORIZED,
    HttpStatus.FORBIDDEN,
    HttpStatus.NOT_FOUND,
  )
  duplicate(
    @Param('id', ParseIdPipe) id: string,
    @CurrentUser() auth: AuthContext,
    @ClientInfoParam() client: ClientInfo,
  ): Promise<PasswordPolicyResponseDto> {
    return this.passwordPolicyService.duplicate(id, auth, client);
  }

  @Delete(':id')
  @RequirePermissions(PP.Manage)
  @ApiBearerAuth('access-token')
  @Throttle({ default: POLICY_UPDATE_THROTTLE })
  @ResponseMessage('Password policy deleted')
  @ApiOperation({
    summary: 'Delete a policy',
    description: `${ADMIN_ONLY} Not the active one (409 — activate another policy first).`,
  })
  @ApiWrappedResponse()
  @ApiErrorResponses(
    HttpStatus.UNAUTHORIZED,
    HttpStatus.FORBIDDEN,
    HttpStatus.NOT_FOUND,
    HttpStatus.CONFLICT,
  )
  remove(
    @Param('id', ParseIdPipe) id: string,
    @CurrentUser() auth: AuthContext,
    @ClientInfoParam() client: ClientInfo,
  ): Promise<{ id: string }> {
    return this.passwordPolicyService.remove(id, auth, client);
  }
}
