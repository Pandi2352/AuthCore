import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  HttpStatus,
  Put,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';

import { API_TAGS } from '@common/constants/api-tags.constants';
import {
  ApiErrorResponses,
  ApiStandardErrors,
  ApiWrappedResponse,
} from '@common/decorators/api-response.decorator';
import { CurrentUser } from '@common/decorators/current-user.decorator';
import { Public } from '@common/decorators/public.decorator';
import { RequirePermissions } from '@common/decorators/require-permissions.decorator';
import { ResponseMessage } from '@common/decorators/response-message.decorator';
import type { AuthContext } from '@common/interfaces/auth-context.interface';
import { APPEARANCE_SETTINGS_PERMISSIONS as AP } from '@modules/access-control/constants/access-control.constants';

import {
  APPEARANCE_WRITE_THROTTLE,
  MY_APPEARANCE_THROTTLE,
} from './constants/appearance.constants';
import {
  MyAppearanceDto,
  OrgAppearanceAdminDto,
  OrgAppearanceDto,
  UpdateMyAppearanceDto,
  UpdateOrgAppearanceDto,
} from './dto/appearance.dto';
import { AppearanceService } from './services/appearance.service';

const ADMIN =
  'Requires APPEARANCE_SETTINGS_READ (reading) or APPEARANCE_SETTINGS_MANAGE (changing), e.g. the ' +
  'system role APPEARANCE_ADMIN, or the ADMIN role.';

/** The organization's look: defaults for everyone + options users cannot change. */
@ApiTags(API_TAGS.Appearance.name)
@ApiStandardErrors()
@Controller('settings/appearance')
export class OrgAppearanceController {
  constructor(private readonly appearanceService: AppearanceService) {}

  @Get('public')
  @Public()
  @Header('Cache-Control', 'no-cache')
  @ResponseMessage('Organization appearance')
  @ApiOperation({
    summary: 'Organization appearance (no sign-in)',
    description:
      'Defaults and locked options every page applies (also the sign-in pages). version 0 = none set: the built-in defaults apply.',
  })
  @ApiWrappedResponse(OrgAppearanceDto)
  getPublic(): Promise<OrgAppearanceDto> {
    return this.appearanceService.getPublic();
  }

  @Get()
  @RequirePermissions(AP.Read)
  @ApiBearerAuth('access-token')
  @Header('Cache-Control', 'no-store')
  @ResponseMessage('Organization appearance')
  @ApiOperation({
    summary: 'Organization appearance (admin view)',
    description: ADMIN,
  })
  @ApiWrappedResponse(OrgAppearanceAdminDto)
  @ApiErrorResponses(HttpStatus.UNAUTHORIZED, HttpStatus.FORBIDDEN)
  get(): Promise<OrgAppearanceAdminDto> {
    return this.appearanceService.getAdmin();
  }

  @Put()
  @RequirePermissions(AP.Manage)
  @ApiBearerAuth('access-token')
  @Throttle({ default: APPEARANCE_WRITE_THROTTLE })
  @Header('Cache-Control', 'no-store')
  @ResponseMessage('Organization appearance saved')
  @ApiOperation({
    summary: 'Publish the organization appearance',
    description:
      `${ADMIN} Replaces the organization look: mode, preset, appearance options (defaults for everyone) and ` +
      '`locked` (options users cannot change). Pass `version` to avoid overwriting a newer change (409 VERSION_CONFLICT).',
  })
  @ApiWrappedResponse(OrgAppearanceAdminDto)
  @ApiErrorResponses(
    HttpStatus.BAD_REQUEST,
    HttpStatus.UNAUTHORIZED,
    HttpStatus.FORBIDDEN,
    HttpStatus.CONFLICT,
    HttpStatus.TOO_MANY_REQUESTS,
  )
  update(
    @Body() dto: UpdateOrgAppearanceDto,
    @CurrentUser() auth: AuthContext,
  ): Promise<OrgAppearanceAdminDto> {
    return this.appearanceService.updateOrg(dto, auth);
  }

  @Delete()
  @RequirePermissions(AP.Manage)
  @ApiBearerAuth('access-token')
  @Throttle({ default: APPEARANCE_WRITE_THROTTLE })
  @ResponseMessage('Organization appearance removed')
  @ApiOperation({
    summary: 'Remove the organization appearance',
    description: `${ADMIN} Everyone follows the built-in defaults again; nothing is locked.`,
  })
  @ApiWrappedResponse(OrgAppearanceAdminDto)
  @ApiErrorResponses(HttpStatus.UNAUTHORIZED, HttpStatus.FORBIDDEN)
  reset(@CurrentUser() auth: AuthContext): Promise<OrgAppearanceAdminDto> {
    return this.appearanceService.resetOrg(auth);
  }
}

/** The signed-in user's own look, synced across their devices. */
@ApiTags(API_TAGS.Appearance.name)
@ApiStandardErrors()
@ApiBearerAuth('access-token')
@Controller('users/me/appearance')
export class MyAppearanceController {
  constructor(private readonly appearanceService: AppearanceService) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  @ResponseMessage('My appearance')
  @ApiOperation({
    summary: 'My appearance',
    description:
      'Any signed-in user. theme null = follow the organization / defaults.',
  })
  @ApiWrappedResponse(MyAppearanceDto)
  @ApiErrorResponses(HttpStatus.UNAUTHORIZED)
  get(@CurrentUser() auth: AuthContext): Promise<MyAppearanceDto> {
    return this.appearanceService.getMine(auth.userId);
  }

  @Put()
  @Throttle({ default: MY_APPEARANCE_THROTTLE })
  @Header('Cache-Control', 'no-store')
  @ResponseMessage('My appearance saved')
  @ApiOperation({
    summary: 'Save my appearance',
    description:
      'Any signed-in user. `syncEnabled: false` stops syncing and removes the saved look from the server.',
  })
  @ApiWrappedResponse(MyAppearanceDto)
  @ApiErrorResponses(
    HttpStatus.BAD_REQUEST,
    HttpStatus.UNAUTHORIZED,
    HttpStatus.TOO_MANY_REQUESTS,
  )
  update(
    @Body() dto: UpdateMyAppearanceDto,
    @CurrentUser() auth: AuthContext,
  ): Promise<MyAppearanceDto> {
    return this.appearanceService.updateMine(auth.userId, dto);
  }
}
