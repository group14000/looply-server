import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiExcludeEndpoint } from '@nestjs/swagger';
import { FeedbackService } from './feedback.service';
import { Public } from '../auth/decorators/public.decorator';
import { PublicFeedbackTokenGuard } from './guards/public-feedback-token/public-feedback-token.guard';
import { FeedbackContext } from './decorators/feedback-context.decorator';
import { SubmitFeedbackDto } from './dto/submit-feedback.dto';
import type { FeedbackRequest } from '../generated/prisma/client';
import {
  PublicRateLimit,
  PublicSubmitRateLimit,
} from '../rate-limit/decorators/rate-limit.decorators';

/**
 * Anonymous, capability-token-authenticated surface — the customer has no
 * Clerk account and never logs in. @Public() bypasses the global
 * ClerkAuthGuard; PublicFeedbackTokenGuard is the actual gate (resolves the
 * :token path param, 404s if it doesn't match any row). See AGENTS.md for
 * why @Public() without an accompanying resolving guard would be a bug.
 */
@Controller('public/feedback')
export class FeedbackPublicController {
  constructor(private readonly feedbackService: FeedbackService) {}

  @Get(':token')
  @Public()
  @PublicRateLimit()
  @UseGuards(PublicFeedbackTokenGuard)
  @ApiExcludeEndpoint()
  view(@FeedbackContext() feedbackRequest: FeedbackRequest) {
    return this.feedbackService.getPublicView(feedbackRequest);
  }

  @Post(':token/submit')
  @Public()
  @PublicSubmitRateLimit()
  @UseGuards(PublicFeedbackTokenGuard)
  @ApiExcludeEndpoint()
  async submit(
    @FeedbackContext() feedbackRequest: FeedbackRequest,
    @Body() dto: SubmitFeedbackDto,
  ) {
    await this.feedbackService.submitPublic(feedbackRequest, dto);
    return { received: true };
  }
}
