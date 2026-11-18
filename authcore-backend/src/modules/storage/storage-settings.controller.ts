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
import { RequirePermissions } from '@common/decorators/require-permissions.decorator';
import { ResponseMessage } from '@common/decorators/response-message.decorator';
import type { AuthContext } from '@common/interfaces/auth-context.interface';
import { ParseIdPipe } from '@common/pipes/parse-id.pipe';
import { STORAGE_SETTINGS_PERMISSIONS as SS } from '@modules/access-control/constants/access-control.constants';

import {
  STORAGE_TEST_THROTTLE,
  STORAGE_WRITE_THROTTLE,
} from './constants/storage.constants';
import {
  CreateStorageConfigDto,
  StorageConfigDto,
  StorageProviderDto,
  StorageTestResultDto,
  TestStorageConfigDto,
  UpdateStorageConfigDto,
} from './dto/storage-config.dto';
import { StorageConfigsService } from './services/storage-configs.service';

const ACCESS =
  'Requires STORAGE_SETTINGS_READ (reading) or STORAGE_SETTINGS_MANAGE (changing), e.g. through the ' +
  'system role STORAGE_ADMIN, or the ADMIN role.';

/**
 * File storage settings: the storages (local folder, S3 and S3-compatible buckets) and
 * which one receives new uploads. Credentials are encrypted and never returned.
 */
@ApiTags(API_TAGS.StorageSettings.name)
@ApiStandardErrors()
@ApiBearerAuth('access-token')
@Controller('settings/storage')
export class StorageSettingsController {
  constructor(private readonly configsService: StorageConfigsService) {}

  @Get('providers')
  @RequirePermissions(SS.Read)
  @ResponseMessage('Storage providers')
  @ApiOperation({
    summary: 'Supported providers and their fields',
    description: `${ACCESS} Drives the "Add storage" form: label, description, docs link and the fields (secret fields are encrypted).`,
  })
  @ApiWrappedResponse(StorageProviderDto, { isArray: true })
  @ApiErrorResponses(HttpStatus.UNAUTHORIZED, HttpStatus.FORBIDDEN)
  providers(): StorageProviderDto[] {
    return this.configsService.providers();
  }

  @Get()
  @RequirePermissions(SS.Read)
  @Header('Cache-Control', 'no-store')
  @ResponseMessage('Storages')
  @ApiOperation({
    summary: 'Configured storages',
    description: `${ACCESS} Built-in local folder first. Secrets only as { isSet, hint: "••••last4" }.`,
  })
  @ApiWrappedResponse(StorageConfigDto, { isArray: true })
  @ApiErrorResponses(HttpStatus.UNAUTHORIZED, HttpStatus.FORBIDDEN)
  list(): Promise<StorageConfigDto[]> {
    return this.configsService.list();
  }

  @Post()
  @RequirePermissions(SS.Manage)
  @Throttle({ default: STORAGE_WRITE_THROTTLE })
  @ResponseMessage('Storage added')
  @ApiOperation({
    summary: 'Add a storage',
    description: `${ACCESS} Fields per provider: GET /settings/storage/providers. Not active until activated (which tests it first).`,
  })
  @ApiWrappedResponse(StorageConfigDto, { status: HttpStatus.CREATED })
  @ApiErrorResponses(
    HttpStatus.BAD_REQUEST,
    HttpStatus.UNAUTHORIZED,
    HttpStatus.FORBIDDEN,
  )
  create(
    @Body() dto: CreateStorageConfigDto,
    @CurrentUser() auth: AuthContext,
  ): Promise<StorageConfigDto> {
    return this.configsService.create(dto, auth);
  }

  @Post('test')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(SS.Manage)
  @Throttle({ default: STORAGE_TEST_THROTTLE })
  @ResponseMessage('Connection tested')
  @ApiOperation({
    summary: 'Test values before saving',
    description:
      `${ACCESS} Writes, reads back and deletes a tiny file with the given values. ` +
      'With `id` (editing), secrets left empty use the saved ones. 200 with isSuccess false when the provider refuses.',
  })
  @ApiWrappedResponse(StorageTestResultDto)
  @ApiErrorResponses(
    HttpStatus.BAD_REQUEST,
    HttpStatus.UNAUTHORIZED,
    HttpStatus.FORBIDDEN,
  )
  testValues(@Body() dto: TestStorageConfigDto): Promise<StorageTestResultDto> {
    return this.configsService.testValues(dto);
  }

  @Get(':id')
  @RequirePermissions(SS.Read)
  @Header('Cache-Control', 'no-store')
  @ResponseMessage('Storage')
  @ApiOperation({ summary: 'One storage', description: ACCESS })
  @ApiWrappedResponse(StorageConfigDto)
  @ApiErrorResponses(
    HttpStatus.UNAUTHORIZED,
    HttpStatus.FORBIDDEN,
    HttpStatus.NOT_FOUND,
  )
  get(@Param('id', ParseIdPipe) id: string): Promise<StorageConfigDto> {
    return this.configsService.get(id);
  }

  @Patch(':id')
  @RequirePermissions(SS.Manage)
  @Throttle({ default: STORAGE_WRITE_THROTTLE })
  @ResponseMessage('Storage updated')
  @ApiOperation({
    summary: 'Edit a storage',
    description: `${ACCESS} Secrets left empty keep the saved value. Changing values clears the last test. The local folder is configured on the server.`,
  })
  @ApiWrappedResponse(StorageConfigDto)
  @ApiErrorResponses(
    HttpStatus.BAD_REQUEST,
    HttpStatus.UNAUTHORIZED,
    HttpStatus.FORBIDDEN,
    HttpStatus.NOT_FOUND,
    HttpStatus.CONFLICT,
  )
  update(
    @Param('id', ParseIdPipe) id: string,
    @Body() dto: UpdateStorageConfigDto,
    @CurrentUser() auth: AuthContext,
  ): Promise<StorageConfigDto> {
    return this.configsService.update(id, dto, auth);
  }

  @Post(':id/test')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(SS.Manage)
  @Throttle({ default: STORAGE_TEST_THROTTLE })
  @ResponseMessage('Connection tested')
  @ApiOperation({
    summary: 'Test a saved storage',
    description: `${ACCESS} The result is saved as lastTest.`,
  })
  @ApiWrappedResponse(StorageTestResultDto)
  @ApiErrorResponses(
    HttpStatus.UNAUTHORIZED,
    HttpStatus.FORBIDDEN,
    HttpStatus.NOT_FOUND,
  )
  test(@Param('id', ParseIdPipe) id: string): Promise<StorageTestResultDto> {
    return this.configsService.test(id);
  }

  @Post(':id/activate')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(SS.Manage)
  @Throttle({ default: STORAGE_TEST_THROTTLE })
  @ResponseMessage('Storage activated')
  @ApiOperation({
    summary: 'Make it the storage for new uploads',
    description:
      `${ACCESS} Tests the connection first (400 STORAGE_CONNECTION_FAILED if it fails). ` +
      'Existing files stay where they are and keep working.',
  })
  @ApiWrappedResponse(StorageConfigDto)
  @ApiErrorResponses(
    HttpStatus.BAD_REQUEST,
    HttpStatus.UNAUTHORIZED,
    HttpStatus.FORBIDDEN,
    HttpStatus.NOT_FOUND,
  )
  activate(
    @Param('id', ParseIdPipe) id: string,
    @CurrentUser() auth: AuthContext,
  ): Promise<StorageConfigDto> {
    return this.configsService.activate(id, auth);
  }

  @Delete(':id')
  @RequirePermissions(SS.Manage)
  @Throttle({ default: STORAGE_WRITE_THROTTLE })
  @ResponseMessage('Storage deleted')
  @ApiOperation({
    summary: 'Delete a storage',
    description: `${ACCESS} Not the active one, not the local folder, and only when no file is stored there (409).`,
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
  ): Promise<{ id: string }> {
    return this.configsService.remove(id, auth);
  }
}
