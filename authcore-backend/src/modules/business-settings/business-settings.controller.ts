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
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
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
import { BUSINESS_SETTINGS_PERMISSIONS as BS } from '@modules/access-control/constants/access-control.constants';
import { FileUploadInterceptor } from '@modules/files/interceptors/file-upload.interceptor';
import type { IncomingFile } from '@modules/files/services/files.service';

import {
  BRAND_ASSET_SLOTS,
  type BrandAssetSlot,
  SETTINGS_WRITE_THROTTLE,
} from './constants/business-settings.constants';
import {
  BRAND_ASSET_BODY_SCHEMA,
  BusinessSettingsDto,
  PublicBusinessSettingsDto,
  UpdateBusinessSettingsDto,
} from './dto/business-settings.dto';
import { BrandAssetSlotPipe } from './pipes/brand-asset-slot.pipe';
import { BusinessSettingsService } from './services/business-settings.service';

const ADMIN_ONLY =
  'Requires BUSINESS_SETTINGS_READ (reading) or BUSINESS_SETTINGS_MANAGE (changing), e.g. through the ' +
  'default role SUPER_ADMIN, a role holding them, or the ADMIN role (403 FORBIDDEN otherwise).';

const SLOT_PARAM = {
  name: 'slot',
  enum: BRAND_ASSET_SLOTS,
  description:
    'logo = full logo (expanded sidebar) · logo-mark = square mark (collapsed sidebar) · ' +
    'auth-logo = sign-in / sign-up pages · favicon = browser tab icon',
} as const;

/**
 * Business settings: the site's name, description, logos and favicon.
 * Admins edit them; every page (signed in or not) reads the public part.
 */
@ApiTags(API_TAGS.BusinessSettings.name)
@ApiStandardErrors()
@Controller('settings/business')
export class BusinessSettingsController {
  constructor(private readonly settingsService: BusinessSettingsService) {}

  @Get('public')
  @Public()
  // Revalidate every time (ETag → 304 when unchanged): a reload right after an admin saves
  // must never get the old name / logo from the browser cache.
  @Header('Cache-Control', 'no-cache')
  @ResponseMessage('Business settings')
  @ApiOperation({
    summary: 'Public branding (no sign-in)',
    description:
      'Site name, description and image URLs for every page: browser tab, sidebar, sign-in pages. ' +
      'Images that are not set are null (the frontend falls back to its built-in default). ' +
      'Cache-Control: no-cache with an ETag (unchanged → 304).',
  })
  @ApiWrappedResponse(PublicBusinessSettingsDto)
  getPublic(): Promise<PublicBusinessSettingsDto> {
    return this.settingsService.getPublic();
  }

  @Get()
  @RequirePermissions(BS.Read)
  @ApiBearerAuth('access-token')
  @Header('Cache-Control', 'no-store')
  @ResponseMessage('Business settings')
  @ApiOperation({
    summary: 'Business settings with file details',
    description: `${ADMIN_ONLY} Until the first save the project defaults are returned with \`isDefault: true\` and \`version: 0\`.`,
  })
  @ApiWrappedResponse(BusinessSettingsDto)
  @ApiErrorResponses(HttpStatus.UNAUTHORIZED, HttpStatus.FORBIDDEN)
  get(): Promise<BusinessSettingsDto> {
    return this.settingsService.get();
  }

  @Patch()
  @RequirePermissions(BS.Manage)
  @ApiBearerAuth('access-token')
  @Throttle({ default: SETTINGS_WRITE_THROTTLE })
  @Header('Cache-Control', 'no-store')
  @ResponseMessage('Business settings saved')
  @ApiOperation({
    summary: 'Change the site name / description',
    description:
      `${ADMIN_ONLY} Send only what changes. Pass \`version\` from GET to avoid overwriting someone ` +
      "else's change (409 VERSION_CONFLICT). Visible to everyone within 15 s.",
  })
  @ApiWrappedResponse(BusinessSettingsDto)
  @ApiErrorResponses(
    HttpStatus.BAD_REQUEST,
    HttpStatus.UNAUTHORIZED,
    HttpStatus.FORBIDDEN,
    HttpStatus.CONFLICT,
    HttpStatus.TOO_MANY_REQUESTS,
  )
  update(
    @Body() dto: UpdateBusinessSettingsDto,
    @CurrentUser() auth: AuthContext,
  ): Promise<BusinessSettingsDto> {
    return this.settingsService.update(dto, auth);
  }

  @Post('assets/:slot')
  @RequirePermissions(BS.Manage)
  @ApiBearerAuth('access-token')
  @UseInterceptors(FileUploadInterceptor)
  @Throttle({ default: SETTINGS_WRITE_THROTTLE })
  @Header('Cache-Control', 'no-store')
  @ResponseMessage('Image updated')
  @ApiConsumes('multipart/form-data')
  @ApiParam(SLOT_PARAM)
  @ApiBody({ schema: BRAND_ASSET_BODY_SCHEMA })
  @ApiOperation({
    summary: 'Upload or replace a logo / the favicon',
    description:
      `${ADMIN_ONLY} multipart/form-data with \`file\`. PNG, WebP or JPEG (type detected from the content), ` +
      'virus-scanned, metadata removed. Logos are shrunk to fit 1024 × 512; the mark and favicon are ' +
      'placed on a 256 × 256 square (transparent for PNG / WebP). The previous image of the slot is deleted.',
  })
  @ApiWrappedResponse(BusinessSettingsDto, { status: HttpStatus.CREATED })
  @ApiErrorResponses(
    HttpStatus.BAD_REQUEST,
    HttpStatus.UNAUTHORIZED,
    HttpStatus.FORBIDDEN,
    HttpStatus.PAYLOAD_TOO_LARGE,
    HttpStatus.UNSUPPORTED_MEDIA_TYPE,
    HttpStatus.UNPROCESSABLE_ENTITY,
    HttpStatus.TOO_MANY_REQUESTS,
  )
  setAsset(
    @Param('slot', BrandAssetSlotPipe) slot: BrandAssetSlot,
    @UploadedFile() file: IncomingFile | undefined,
    @CurrentUser() auth: AuthContext,
  ): Promise<BusinessSettingsDto> {
    return this.settingsService.setAsset(slot, file, auth);
  }

  @Delete('assets/:slot')
  @RequirePermissions(BS.Manage)
  @ApiBearerAuth('access-token')
  @Throttle({ default: SETTINGS_WRITE_THROTTLE })
  @Header('Cache-Control', 'no-store')
  @ResponseMessage('Image removed')
  @ApiParam(SLOT_PARAM)
  @ApiOperation({
    summary: 'Remove a logo / the favicon',
    description: `${ADMIN_ONLY} Deletes the image; the built-in default is shown again.`,
  })
  @ApiWrappedResponse(BusinessSettingsDto)
  @ApiErrorResponses(
    HttpStatus.BAD_REQUEST,
    HttpStatus.UNAUTHORIZED,
    HttpStatus.FORBIDDEN,
    HttpStatus.TOO_MANY_REQUESTS,
  )
  removeAsset(
    @Param('slot', BrandAssetSlotPipe) slot: BrandAssetSlot,
    @CurrentUser() auth: AuthContext,
  ): Promise<BusinessSettingsDto> {
    return this.settingsService.removeAsset(slot, auth);
  }
}
