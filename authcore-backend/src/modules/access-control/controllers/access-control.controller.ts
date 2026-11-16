import { Controller, Get, Header, HttpStatus, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { API_TAGS } from '@common/constants/api-tags.constants';
import {
  ApiErrorResponses,
  ApiPaginatedResponse,
  ApiStandardErrors,
  ApiWrappedResponse,
} from '@common/decorators/api-response.decorator';
import { CurrentUser } from '@common/decorators/current-user.decorator';
import { RequirePermissions } from '@common/decorators/require-permissions.decorator';
import { ResponseMessage } from '@common/decorators/response-message.decorator';
import type { Paginated } from '@common/interfaces/api-response.interface';
import type { AuthContext } from '@common/interfaces/auth-context.interface';

import { ACCESS_PERMISSIONS as P } from '../constants/access-control.constants';
import {
  AuditEntryDto,
  AuditQueryDto,
  EffectiveAccessDto,
} from '../dto/access-mapping.dto';
import { AccessAuditService } from '../services/access-audit.service';
import { AccessMappingsService } from '../services/access-mappings.service';

@ApiTags(API_TAGS.AccessMappings.name)
@ApiBearerAuth('access-token')
@ApiStandardErrors()
@Controller('access-control')
export class AccessControlController {
  constructor(
    private readonly mappingsService: AccessMappingsService,
    private readonly auditService: AccessAuditService,
  ) {}

  @Get('me')
  @Header('Cache-Control', 'no-store')
  @ResponseMessage('My access')
  @ApiOperation({
    summary: 'My effective access',
    description:
      'Any signed-in user: my groups, roles and permission keys (e.g. to show / hide features in the UI). ' +
      '`isSuperAdmin` users pass every permission check.',
  })
  @ApiWrappedResponse(EffectiveAccessDto)
  @ApiErrorResponses(HttpStatus.UNAUTHORIZED)
  me(@CurrentUser() auth: AuthContext): Promise<EffectiveAccessDto> {
    return this.mappingsService.effectiveAccess(auth.userId);
  }

  @Get('audit-logs')
  @RequirePermissions(P.AuditRead)
  @ResponseMessage('Access-control audit log')
  @ApiOperation({
    summary: 'Access-control change history',
    description:
      'Needs ACCESS_AUDIT_READ. Every create / update / delete of roles, permissions and groups and every ' +
      'assign / revoke, with before / after values, who and from which IP. Newest first.',
  })
  @ApiPaginatedResponse(AuditEntryDto)
  @ApiErrorResponses(
    HttpStatus.BAD_REQUEST,
    HttpStatus.UNAUTHORIZED,
    HttpStatus.FORBIDDEN,
  )
  auditLogs(@Query() query: AuditQueryDto): Promise<Paginated<AuditEntryDto>> {
    return this.auditService.list(query);
  }
}
