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
import { Public } from '@common/decorators/public.decorator';
import { RequirePermissions } from '@common/decorators/require-permissions.decorator';
import { ResponseMessage } from '@common/decorators/response-message.decorator';
import type { Paginated } from '@common/interfaces/api-response.interface';
import type { ClientInfo } from '@common/interfaces/client-info.interface';
import { ParseIdPipe } from '@common/pipes/parse-id.pipe';
import { USER_PERMISSIONS as U } from '@modules/access-control/constants/access-control.constants';
import { CurrentActor } from '@modules/access-control/decorators/current-actor.decorator';
import type { Actor } from '@modules/access-control/interfaces/actor.interface';

import {
  AcceptInviteDto,
  AcceptInviteResponseDto,
  BulkInviteDto,
  BulkInviteResultDto,
  CreateInviteDto,
  InviteListQueryDto,
  InvitePublicInfoDto,
  InviteResponseDto,
  InviteStatsDto,
  InviteTokenDto,
} from './dto/user-invite.dto';
import { UserInvitesService } from './services/user-invites.service';

const WRITE_THROTTLE = { limit: 60, ttl: 60_000 } as const;
const ERRORS = [
  HttpStatus.BAD_REQUEST,
  HttpStatus.UNAUTHORIZED,
  HttpStatus.FORBIDDEN,
] as const;

@ApiTags(API_TAGS.UserInvites.name)
@ApiStandardErrors()
@Controller('user-invites')
export class UserInvitesController {
  constructor(private readonly invitesService: UserInvitesService) {}

  @Post()
  @ApiBearerAuth('access-token')
  @RequirePermissions(U.Invite)
  @Throttle({ default: WRITE_THROTTLE })
  @ResponseMessage('Invite sent')
  @ApiOperation({
    summary: 'Invite a person',
    description:
      'Needs USER_INVITE. Emails a link (INVITE_ACCEPT_URL?token=…) valid INVITE_TTL_DAYS. Optional groups they join ' +
      'on acceptance (you can only grant permissions you hold) and a message. 409 if the email has an account or a pending invite.',
  })
  @ApiWrappedResponse(InviteResponseDto, { status: HttpStatus.CREATED })
  @ApiErrorResponses(...ERRORS, HttpStatus.NOT_FOUND, HttpStatus.CONFLICT)
  create(
    @Body() dto: CreateInviteDto,
    @CurrentActor() actor: Actor,
  ): Promise<InviteResponseDto> {
    return this.invitesService.create(dto, actor);
  }

  @Post('bulk')
  @ApiBearerAuth('access-token')
  @RequirePermissions(U.Invite)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ResponseMessage('Invites processed')
  @ApiOperation({
    summary: 'Invite several people',
    description:
      'Needs USER_INVITE. Up to 100 people, same groups / message. Registered, already-invited and repeated emails are skipped and reported.',
  })
  @ApiWrappedResponse(BulkInviteResultDto, { status: HttpStatus.CREATED })
  @ApiErrorResponses(...ERRORS, HttpStatus.NOT_FOUND)
  bulk(
    @Body() dto: BulkInviteDto,
    @CurrentActor() actor: Actor,
  ): Promise<BulkInviteResultDto> {
    return this.invitesService.bulkCreate(dto, actor);
  }

  @Get('stats')
  @ApiBearerAuth('access-token')
  @RequirePermissions(U.Read)
  @Header('Cache-Control', 'no-store')
  @ResponseMessage('Invite statistics')
  @ApiOperation({
    summary: 'Counts for the invites page',
    description:
      'Needs USER_READ. Invites by status (pending = link still valid), sent in the last 7 days, self-registered accounts and the acceptance rate.',
  })
  @ApiWrappedResponse(InviteStatsDto)
  @ApiErrorResponses(...ERRORS)
  stats(): Promise<InviteStatsDto> {
    return this.invitesService.stats();
  }

  @Get()
  @ApiBearerAuth('access-token')
  @RequirePermissions(U.Read)
  @Header('Cache-Control', 'no-store')
  @ResponseMessage('Invites')
  @ApiOperation({
    summary: 'List invites',
    description:
      'Needs USER_READ. Filter status (PENDING / ACCEPTED / REVOKED / EXPIRED), invitedBy, search (email, names), dates; sort; pagination.',
  })
  @ApiPaginatedResponse(InviteResponseDto)
  @ApiErrorResponses(...ERRORS)
  list(
    @Query() query: InviteListQueryDto,
  ): Promise<Paginated<InviteResponseDto>> {
    return this.invitesService.list(query);
  }

  @Public()
  @Post('public/info')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Header('Cache-Control', 'no-store')
  @ResponseMessage('Invite')
  @ApiOperation({
    summary: 'Invite details for the accept page (public)',
    description:
      'The token from the link (in the body, never in the URL). Email, names, who invited, expiry, status, isAcceptable. 404 INVITE_INVALID for unknown tokens.',
  })
  @ApiWrappedResponse(InvitePublicInfoDto)
  @ApiErrorResponses(
    HttpStatus.BAD_REQUEST,
    HttpStatus.NOT_FOUND,
    HttpStatus.TOO_MANY_REQUESTS,
  )
  publicInfo(@Body() dto: InviteTokenDto): Promise<InvitePublicInfoDto> {
    return this.invitesService.publicInfo(dto.token);
  }

  @Public()
  @Post('accept')
  @HttpCode(HttpStatus.CREATED)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Header('Cache-Control', 'no-store')
  @ResponseMessage('Invitation accepted. You can sign in now.')
  @ApiOperation({
    summary: 'Accept an invite (public)',
    description:
      "Creates an ACTIVE account with a verified email (password policy applies) and joins the invite's groups. " +
      'Works once. 400 INVITE_INVALID (expired / used / revoked), 409 if the email or username is taken.',
  })
  @ApiWrappedResponse(AcceptInviteResponseDto, { status: HttpStatus.CREATED })
  @ApiErrorResponses(
    HttpStatus.BAD_REQUEST,
    HttpStatus.CONFLICT,
    HttpStatus.TOO_MANY_REQUESTS,
  )
  accept(
    @Body() dto: AcceptInviteDto,
    @ClientInfoParam() client: ClientInfo,
  ): Promise<AcceptInviteResponseDto> {
    return this.invitesService.accept(dto, client);
  }

  @Get(':id')
  @ApiBearerAuth('access-token')
  @RequirePermissions(U.Read)
  @Header('Cache-Control', 'no-store')
  @ResponseMessage('Invite')
  @ApiOperation({ summary: 'Get an invite', description: 'Needs USER_READ.' })
  @ApiWrappedResponse(InviteResponseDto)
  @ApiErrorResponses(...ERRORS, HttpStatus.NOT_FOUND)
  get(@Param('id', ParseIdPipe) id: string): Promise<InviteResponseDto> {
    return this.invitesService.get(id);
  }

  @Post(':id/resend')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('access-token')
  @RequirePermissions(U.Invite)
  @Throttle({ default: WRITE_THROTTLE })
  @ResponseMessage('Invite sent again')
  @ApiOperation({
    summary: 'Resend an invite',
    description:
      'Needs USER_INVITE. Pending or expired invites: new link (the old one stops working) and new expiry. 429 within INVITE_RESEND_COOLDOWN_SECONDS.',
  })
  @ApiWrappedResponse(InviteResponseDto)
  @ApiErrorResponses(
    ...ERRORS,
    HttpStatus.NOT_FOUND,
    HttpStatus.CONFLICT,
    HttpStatus.TOO_MANY_REQUESTS,
  )
  resend(
    @Param('id', ParseIdPipe) id: string,
    @CurrentActor() actor: Actor,
  ): Promise<InviteResponseDto> {
    return this.invitesService.resend(id, actor);
  }

  @Post(':id/revoke')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('access-token')
  @RequirePermissions(U.Invite)
  @ResponseMessage('Invite revoked')
  @ApiOperation({
    summary: 'Revoke an invite',
    description:
      'Needs USER_INVITE. Pending invites only; the link stops working.',
  })
  @ApiWrappedResponse(InviteResponseDto)
  @ApiErrorResponses(...ERRORS, HttpStatus.NOT_FOUND, HttpStatus.CONFLICT)
  revoke(
    @Param('id', ParseIdPipe) id: string,
    @CurrentActor() actor: Actor,
  ): Promise<InviteResponseDto> {
    return this.invitesService.revoke(id, actor);
  }

  @Delete(':id')
  @ApiBearerAuth('access-token')
  @RequirePermissions(U.Invite)
  @ResponseMessage('Invite deleted')
  @ApiOperation({
    summary: 'Delete an invite',
    description:
      'Needs USER_INVITE. Accepted invites are kept as history (409).',
  })
  @ApiWrappedResponse()
  @ApiErrorResponses(...ERRORS, HttpStatus.NOT_FOUND, HttpStatus.CONFLICT)
  remove(
    @Param('id', ParseIdPipe) id: string,
    @CurrentActor() actor: Actor,
  ): Promise<{ id: string }> {
    return this.invitesService.remove(id, actor);
  }
}
