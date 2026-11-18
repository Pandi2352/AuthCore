import { Body, Controller, Get, Header, HttpStatus, Put } from '@nestjs/common';
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

import { APPEARANCE_WRITE_THROTTLE } from './constants/appearance.constants';
import {
  AppearanceAdminDto,
  AppearanceDto,
  UpdateAppearanceDto,
} from './dto/appearance.dto';
import { AppearanceService } from './services/appearance.service';

const ADMIN =
  'Requires APPEARANCE_SETTINGS_READ (reading) or APPEARANCE_SETTINGS_MANAGE (changing) — the super admin (ADMIN role) always has them.';

/** The application's look: set by the super admin, applied to every user. */
@ApiTags(API_TAGS.Appearance.name)
@ApiStandardErrors()
@Controller('settings/appearance')
export class AppearanceController {
  constructor(private readonly appearanceService: AppearanceService) {}

  @Get('public')
  @Public()
  @Header('Cache-Control', 'no-cache')
  @ResponseMessage('Appearance')
  @ApiOperation({
    summary: 'The application look (no sign-in)',
    description:
      'Applied by every page, including the sign-in pages. version 0 = never saved: the built-in defaults apply.',
  })
  @ApiWrappedResponse(AppearanceDto)
  getPublic(): Promise<AppearanceDto> {
    return this.appearanceService.getPublic();
  }

  @Get()
  @RequirePermissions(AP.Read)
  @ApiBearerAuth('access-token')
  @Header('Cache-Control', 'no-store')
  @ResponseMessage('Appearance')
  @ApiOperation({
    summary: 'The application look (admin view)',
    description: ADMIN,
  })
  @ApiWrappedResponse(AppearanceAdminDto)
  @ApiErrorResponses(HttpStatus.UNAUTHORIZED, HttpStatus.FORBIDDEN)
  get(): Promise<AppearanceAdminDto> {
    return this.appearanceService.getAdmin();
  }

  @Put()
  @RequirePermissions(AP.Manage)
  @ApiBearerAuth('access-token')
  @Throttle({ default: APPEARANCE_WRITE_THROTTLE })
  @Header('Cache-Control', 'no-store')
  @ResponseMessage('Appearance saved')
  @ApiOperation({
    summary: 'Save the application look',
    description:
      `${ADMIN} Mode (default), color preset and appearance options for every user. ` +
      'Pass `version` to avoid overwriting a newer change (409 VERSION_CONFLICT).',
  })
  @ApiWrappedResponse(AppearanceAdminDto)
  @ApiErrorResponses(
    HttpStatus.BAD_REQUEST,
    HttpStatus.UNAUTHORIZED,
    HttpStatus.FORBIDDEN,
    HttpStatus.CONFLICT,
    HttpStatus.TOO_MANY_REQUESTS,
  )
  update(
    @Body() dto: UpdateAppearanceDto,
    @CurrentUser() auth: AuthContext,
  ): Promise<AppearanceAdminDto> {
    return this.appearanceService.update(dto, auth);
  }
}
