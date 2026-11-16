import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';

import { API_TAGS } from '@common/constants/api-tags.constants';
import {
  ApiErrorResponses,
  ApiStandardErrors,
  ApiWrappedResponse,
} from '@common/decorators/api-response.decorator';
import { RequirePermissions } from '@common/decorators/require-permissions.decorator';
import { ResponseMessage } from '@common/decorators/response-message.decorator';
import { ParseIdPipe } from '@common/pipes/parse-id.pipe';
import { USER_SCHEMA_PERMISSIONS as S } from '@modules/access-control/constants/access-control.constants';
import { CurrentActor } from '@modules/access-control/decorators/current-actor.decorator';
import type { Actor } from '@modules/access-control/interfaces/actor.interface';

import {
  AttributeListQueryDto,
  AttributeResponseDto,
  CreateAttributeDto,
  SchemaOptionsDto,
  UpdateAttributeDto,
} from './dto/user-attribute.dto';
import { UserSchemaService } from './services/user-schema.service';

const WRITE_THROTTLE = { limit: 60, ttl: 60_000 } as const;
const ERRORS = [
  HttpStatus.BAD_REQUEST,
  HttpStatus.UNAUTHORIZED,
  HttpStatus.FORBIDDEN,
] as const;

/** Schemas: custom user variables (the fields a user profile has). */
@ApiTags(API_TAGS.UserSchema.name)
@ApiBearerAuth('access-token')
@ApiStandardErrors()
@Controller('user-schema')
export class UserSchemaController {
  constructor(private readonly schemaService: UserSchemaService) {}

  @Get('attributes')
  @RequirePermissions(S.Read)
  @Header('Cache-Control', 'no-store')
  @ResponseMessage('User schema variables')
  @ApiOperation({
    summary: 'List variables',
    description:
      'Needs USER_SCHEMA_READ. Tree (groups with `children`, e.g. address) or `flat=true`; `search` by name / label ' +
      '(flat matches). Includes the seeded OpenID Connect claims (isSystem).',
  })
  @ApiWrappedResponse(AttributeResponseDto, { isArray: true })
  @ApiErrorResponses(...ERRORS)
  list(@Query() query: AttributeListQueryDto): Promise<AttributeResponseDto[]> {
    return this.schemaService.list(query);
  }

  @Get('options')
  @RequirePermissions(S.Read)
  @ResponseMessage('User schema options')
  @ApiOperation({
    summary: 'Dropdown values for the variable form',
    description:
      'Needs USER_SCHEMA_READ. Kinds, data types, field group types, scopes, locales, mutability, returned.',
  })
  @ApiWrappedResponse(SchemaOptionsDto)
  @ApiErrorResponses(HttpStatus.UNAUTHORIZED, HttpStatus.FORBIDDEN)
  options(): SchemaOptionsDto {
    return this.schemaService.options();
  }

  @Get('form')
  @Header('Cache-Control', 'no-store')
  @ResponseMessage('Profile form')
  @ApiOperation({
    summary: 'Profile form definition',
    description:
      'Any signed-in user: enabled, non-internal variables as a tree (labels, types, options, required, mutability) to render the profile form.',
  })
  @ApiWrappedResponse(AttributeResponseDto, { isArray: true })
  @ApiErrorResponses(HttpStatus.UNAUTHORIZED)
  form(): Promise<AttributeResponseDto[]> {
    return this.schemaService.form();
  }

  @Get('attributes/:id')
  @RequirePermissions(S.Read)
  @Header('Cache-Control', 'no-store')
  @ResponseMessage('User schema variable')
  @ApiOperation({
    summary: 'Get a variable',
    description: 'Needs USER_SCHEMA_READ. Groups include their children.',
  })
  @ApiWrappedResponse(AttributeResponseDto)
  @ApiErrorResponses(...ERRORS, HttpStatus.NOT_FOUND)
  get(@Param('id', ParseIdPipe) id: string): Promise<AttributeResponseDto> {
    return this.schemaService.get(id);
  }

  @Post('attributes')
  @RequirePermissions(S.Manage)
  @Throttle({ default: WRITE_THROTTLE })
  @ResponseMessage('Variable created')
  @ApiOperation({
    summary: 'Create a variable (field or group)',
    description:
      'Needs USER_SCHEMA_MANAGE. FIELD: dataType (TEXT, TEXTAREA, EMAIL, MOBILE, NUMBER, BOOLEAN, DATE, DATETIME, URL, ' +
      'DROPDOWN, MULTI_SELECT) + options / limits. GROUP: groupType OBJECT or LIST; add children with parentId. ' +
      'Scopes and locales required. Attributes: enabled, required, internal, username, password, unique, match, ' +
      'include in token, include in search filter, mutability, returned.',
  })
  @ApiWrappedResponse(AttributeResponseDto, { status: HttpStatus.CREATED })
  @ApiErrorResponses(...ERRORS, HttpStatus.NOT_FOUND, HttpStatus.CONFLICT)
  create(
    @Body() dto: CreateAttributeDto,
    @CurrentActor() actor: Actor,
  ): Promise<AttributeResponseDto> {
    return this.schemaService.create(dto, actor);
  }

  @Patch('attributes/:id')
  @RequirePermissions(S.Manage)
  @Throttle({ default: WRITE_THROTTLE })
  @ResponseMessage('Variable updated')
  @ApiOperation({
    summary: 'Update a variable',
    description:
      'Needs USER_SCHEMA_MANAGE. name, kind, type and parent are fixed. System variables: structure and security ' +
      'flags are fixed (label, description, scopes, locales, order, token / search flags can change).',
  })
  @ApiWrappedResponse(AttributeResponseDto)
  @ApiErrorResponses(...ERRORS, HttpStatus.NOT_FOUND, HttpStatus.CONFLICT)
  update(
    @Param('id', ParseIdPipe) id: string,
    @Body() dto: UpdateAttributeDto,
    @CurrentActor() actor: Actor,
  ): Promise<AttributeResponseDto> {
    return this.schemaService.update(id, dto, actor);
  }

  @Delete('attributes/:id')
  @RequirePermissions(S.Manage)
  @Throttle({ default: WRITE_THROTTLE })
  @ResponseMessage('Variable deleted')
  @ApiOperation({
    summary: 'Delete a variable',
    description:
      'Needs USER_SCHEMA_MANAGE. Custom variables only; removes the value from every user. Groups must be empty first.',
  })
  @ApiWrappedResponse()
  @ApiErrorResponses(...ERRORS, HttpStatus.NOT_FOUND, HttpStatus.CONFLICT)
  remove(@Param('id', ParseIdPipe) id: string, @CurrentActor() actor: Actor) {
    return this.schemaService.remove(id, actor);
  }
}
