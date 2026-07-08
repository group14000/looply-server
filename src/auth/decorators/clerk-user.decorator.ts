import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/**
 * Extracts the Clerk user ID from the request
 * Usage: @ClerkUserId() userId: string
 */
export const ClerkUserId = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    return request.userId;
  },
);

/**
 * Extracts the Clerk session ID from the request
 * Usage: @ClerkSessionId() sessionId: string
 */
export const ClerkSessionId = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    return request.sessionId;
  },
);
