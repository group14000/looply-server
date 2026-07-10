import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { FeedbackRequest } from '../../generated/prisma/client';

/**
 * Reads the FeedbackRequest attached by PublicFeedbackTokenGuard.
 * Usage: @FeedbackContext() feedbackRequest: FeedbackRequest
 */
export const FeedbackContext = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): FeedbackRequest => {
    const request = ctx.switchToHttp().getRequest();
    return request.feedbackRequest;
  },
);
