import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AppService } from './app.service';
import { ApiStandardResponse } from './common/decorators/api-standard-response.decorator';

@ApiTags('App')
@ApiBearerAuth('clerk-session')
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  @ApiOperation({ summary: 'Health check' })
  @ApiStandardResponse(String, { description: 'Service is up' })
  getHello(): string {
    return this.appService.getHello();
  }
}
