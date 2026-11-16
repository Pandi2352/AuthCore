import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import { API_TAGS } from '@common/constants/api-tags.constants';
import {
  ApiStandardErrors,
  ApiWrappedResponse,
} from '@common/decorators/api-response.decorator';
import { Public } from '@common/decorators/public.decorator';

import { AppService } from './app.service';

@ApiTags(API_TAGS.App.name)
@ApiStandardErrors()
@Public()
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  @ApiOperation({ summary: 'Welcome message' })
  @ApiWrappedResponse(String)
  getHello(): string {
    return this.appService.getHello();
  }
}
