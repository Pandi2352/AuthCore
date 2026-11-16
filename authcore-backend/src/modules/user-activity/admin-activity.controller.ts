import { Controller, Get, Header, HttpStatus, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { API_TAGS } from '@common/constants/api-tags.constants';
import {
  ApiErrorResponses,
  ApiPaginatedResponse,
  ApiStandardErrors,
  ApiWrappedResponse,
} from '@common/decorators/api-response.decorator';
import { RequirePermissions } from '@common/decorators/require-permissions.decorator';
import { ResponseMessage } from '@common/decorators/response-message.decorator';
import type { Paginated } from '@common/interfaces/api-response.interface';
import { USER_PERMISSIONS } from '@modules/access-control/constants/access-control.constants';

import {
  ActivityEventTypeDto,
  AdminActivityDto,
  AdminActivityQueryDto,
  LOGIN_HISTORY_EVENTS,
} from './dto/admin-activity.dto';
import { ActivitySearchService } from './services/activity-search.service';

const ERRORS = [
  HttpStatus.BAD_REQUEST,
  HttpStatus.UNAUTHORIZED,
  HttpStatus.FORBIDDEN,
] as const;

/** Everyone's account activity, for administrators (USER_READ). */
@ApiTags(API_TAGS.UserAdmin.name)
@ApiBearerAuth('access-token')
@ApiStandardErrors()
@Controller('admin/activity')
export class AdminActivityController {
  constructor(private readonly searchService: ActivitySearchService) {}

  @Get()
  @RequirePermissions(USER_PERMISSIONS.Read)
  @Header('Cache-Control', 'no-store')
  @ResponseMessage('Activity')
  @ApiOperation({
    summary: 'Search activity across all users',
    description:
      'Needs USER_READ. Filters: userId, search (email / name), events (comma-separated), isSuccess, ipAddress, ' +
      'deviceType, browser, from / to; newest first unless sortOrder=asc. Each entry includes the user (email, name).',
  })
  @ApiPaginatedResponse(AdminActivityDto)
  @ApiErrorResponses(...ERRORS)
  search(
    @Query() query: AdminActivityQueryDto,
  ): Promise<Paginated<AdminActivityDto>> {
    return this.searchService.search(query);
  }

  @Get('login-history')
  @RequirePermissions(USER_PERMISSIONS.Read)
  @Header('Cache-Control', 'no-store')
  @ResponseMessage('Login history')
  @ApiOperation({
    summary: 'Login history (all users)',
    description:
      'Needs USER_READ. Same filters, limited to sign-in events: LOGIN, LOGIN_FAILED, NEW_DEVICE_LOGIN, ACCOUNT_LOCKED, ' +
      'LOGOUT, LOGOUT_ALL, SESSION_REVOKED. E.g. failed sign-ins from one IP: ?isSuccess=false&ipAddress=…',
  })
  @ApiPaginatedResponse(AdminActivityDto)
  @ApiErrorResponses(...ERRORS)
  loginHistory(
    @Query() query: AdminActivityQueryDto,
  ): Promise<Paginated<AdminActivityDto>> {
    return this.searchService.search(query, LOGIN_HISTORY_EVENTS);
  }

  @Get('event-types')
  @RequirePermissions(USER_PERMISSIONS.Read)
  @ResponseMessage('Activity event types')
  @ApiOperation({
    summary: 'Event types (filter dropdown)',
    description:
      'Needs USER_READ. All event values with labels; isLoginEvent marks the login-history ones.',
  })
  @ApiWrappedResponse(ActivityEventTypeDto, { isArray: true })
  @ApiErrorResponses(HttpStatus.UNAUTHORIZED, HttpStatus.FORBIDDEN)
  eventTypes(): ActivityEventTypeDto[] {
    return this.searchService.eventTypes();
  }
}
