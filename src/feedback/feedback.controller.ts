import { Body, Controller, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { FeedbackService } from './feedback.service';
import { ClerkUserId } from '../auth/decorators/clerk-user.decorator';
import { CreateFeedbackRequestDto } from './dto/create-feedback-request.dto';
import { FeedbackRequestResponseDto } from './dto/feedback-request-response.dto';
import { ApiStandardResponse } from '../common/decorators/api-standard-response.decorator';
import { WriteRateLimit } from '../rate-limit/decorators/rate-limit.decorators';

@ApiTags('Feedback')
@ApiBearerAuth('clerk-session')
@Controller('feedback')
export class FeedbackController {
  constructor(private readonly feedbackService: FeedbackService) {}

  @Post('request')
  @WriteRateLimit()
  @ApiOperation({
    summary: "Generate a feedback review link for one of the caller's products",
    description:
      "productId must belong to the caller's own organization (resolved from " +
      'their Clerk membership) — a product owned by another org, or an invalid ' +
      'id, returns 404.',
  })
  @ApiStandardResponse(FeedbackRequestResponseDto, {
    description: 'Feedback request created',
  })
  async create(
    @ClerkUserId() clerkId: string,
    @Body() dto: CreateFeedbackRequestDto,
  ): Promise<FeedbackRequestResponseDto> {
    const request = await this.feedbackService.create(clerkId, dto);
    return {
      id: request.id,
      customerName: request.customerName,
      companyName: request.companyName,
      email: request.email,
      productId: request.productId,
      status: request.status,
      reviewUrl: this.feedbackService.buildReviewUrl(request.token),
      createdAt: request.createdAt,
    };
  }
}
