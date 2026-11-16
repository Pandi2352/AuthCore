import {
  Controller,
  Delete,
  Get,
  Header,
  HttpStatus,
  Param,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { API_TAGS } from '@common/constants/api-tags.constants';
import {
  ApiErrorResponses,
  ApiStandardErrors,
  ApiWrappedResponse,
} from '@common/decorators/api-response.decorator';
import { CurrentUser } from '@common/decorators/current-user.decorator';
import { ResponseMessage } from '@common/decorators/response-message.decorator';
import type { AuthContext } from '@common/interfaces/auth-context.interface';
import { ParseIdPipe } from '@common/pipes/parse-id.pipe';

import { ForgetDeviceResultDto, KnownDeviceDto } from './dto/known-device.dto';
import { LoginAlertsService } from './services/login-alerts.service';

/** Devices the signed-in user has used (for new-device sign-in alerts). */
@ApiTags(API_TAGS.Account.name)
@ApiBearerAuth('access-token')
@ApiStandardErrors()
@Controller('users/me/devices')
export class KnownDevicesController {
  constructor(private readonly loginAlertsService: LoginAlertsService) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  @ResponseMessage('My known devices')
  @ApiOperation({
    summary: 'My known devices',
    description:
      'Browsers / devices you have signed in from (most recent first). A sign-in from a device not in this list ' +
      'records NEW_DEVICE_LOGIN and sends a "new sign-in" email (preferences.notifications.loginAlerts). ' +
      'Unused devices drop off after KNOWN_DEVICE_RETENTION_DAYS. Active sign-ins are in /auth/sessions.',
  })
  @ApiWrappedResponse(KnownDeviceDto, { isArray: true })
  @ApiErrorResponses(HttpStatus.UNAUTHORIZED)
  list(@CurrentUser() auth: AuthContext): Promise<KnownDeviceDto[]> {
    return this.loginAlertsService.listDevices(auth.userId);
  }

  @Delete(':id')
  @ResponseMessage('Device forgotten')
  @ApiOperation({
    summary: 'Forget a device',
    description:
      'The next sign-in from it counts as a new device (alert again). Does not sign it out: use DELETE /auth/sessions/:id.',
  })
  @ApiWrappedResponse(ForgetDeviceResultDto)
  @ApiErrorResponses(HttpStatus.UNAUTHORIZED, HttpStatus.NOT_FOUND)
  forget(
    @CurrentUser() auth: AuthContext,
    @Param('id', ParseIdPipe) id: string,
  ): Promise<ForgetDeviceResultDto> {
    return this.loginAlertsService.forgetDevice(auth.userId, id);
  }
}
