import {
  Body,
  Controller,
  Header,
  HttpCode,
  HttpStatus,
  Post,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';

import { API_TAGS } from '@common/constants/api-tags.constants';
import {
  ApiErrorResponses,
  ApiStandardErrors,
  ApiWrappedResponse,
} from '@common/decorators/api-response.decorator';
import { ClientInfoParam } from '@common/decorators/client-info.decorator';
import { Public } from '@common/decorators/public.decorator';
import { ResponseMessage } from '@common/decorators/response-message.decorator';
import type { ClientInfo } from '@common/interfaces/client-info.interface';

import { RecoveryConfirmDto, RecoveryRequestDto } from '../dto/account.dto';
import { AccountService } from '../services/account.service';

/** Reactivate an account the user closed themselves (deactivated or pending deletion). */
@ApiTags(API_TAGS.Account.name)
@ApiStandardErrors()
@Controller('account/recovery')
export class AccountRecoveryController {
  constructor(private readonly accountService: AccountService) {}

  @Public()
  @Post('request')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @Header('Cache-Control', 'no-store')
  @ResponseMessage(
    'If this account can be recovered, a code has been sent to its email address',
  )
  @ApiOperation({
    summary: 'Account recovery: send a code',
    description:
      'Public. Same response for every email (nothing reveals whether an account exists). Only accounts the user ' +
      'deactivated or scheduled for deletion themselves get a code; accounts an admin suspended / banned / ' +
      'deactivated cannot be recovered this way.',
  })
  @ApiWrappedResponse()
  @ApiErrorResponses(HttpStatus.BAD_REQUEST, HttpStatus.TOO_MANY_REQUESTS)
  request(
    @Body() dto: RecoveryRequestDto,
    @ClientInfoParam() client: ClientInfo,
  ): null {
    this.accountService.requestRecovery(dto.email, client);
    return null;
  }

  @Public()
  @Post('confirm')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Header('Cache-Control', 'no-store')
  @ResponseMessage('Account reactivated. You can sign in again.')
  @ApiOperation({
    summary: 'Account recovery: confirm with the code',
    description:
      'Reactivates the account and cancels a scheduled deletion. 400 ACCOUNT_INVALID_CODE / ACCOUNT_CODE_ATTEMPTS_EXCEEDED.',
  })
  @ApiWrappedResponse()
  @ApiErrorResponses(HttpStatus.BAD_REQUEST, HttpStatus.TOO_MANY_REQUESTS)
  async confirm(
    @Body() dto: RecoveryConfirmDto,
    @ClientInfoParam() client: ClientInfo,
  ): Promise<null> {
    await this.accountService.confirmRecovery(dto, client);
    return null;
  }
}
