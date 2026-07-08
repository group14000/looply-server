import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { BillingService } from './billing.service';
import { ClerkUserId } from '../auth/decorators/clerk-user.decorator';
import { BillingStatusDto } from './dto/billing-status.dto';
import { ApiStandardResponse } from '../common/decorators/api-standard-response.decorator';

@ApiTags('Billing')
@ApiBearerAuth('clerk-session')
@Controller('billing')
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

  @Get('status')
  @ApiOperation({
    summary: "Get the caller's own Solo/Organization plan entitlement",
    description:
      'Always accessible regardless of plan — this is how a client knows ' +
      'whether to show upgrade prompts, not a gated feature itself.',
  })
  @ApiStandardResponse(BillingStatusDto, {
    description: 'Entitlement snapshot',
  })
  status(@ClerkUserId() clerkId: string) {
    return this.billingService.getStatus(clerkId);
  }
}
