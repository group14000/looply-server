import { ExecutionContext, Injectable, Logger } from '@nestjs/common';
import { ThrottlerGuard, ThrottlerLimitDetail } from '@nestjs/throttler';
import { Request, Response } from 'express';

/**
 * Keys rate-limit buckets by the authenticated Clerk user (request.userId,
 * set by ClerkAuthGuard) when present, falling back to the client IP for
 * anonymous requests. ClerkAuthGuard MUST run before this guard — see the
 * AuthModule-before-RateLimitModule import order in app.module.ts.
 */
@Injectable()
export class AppThrottlerGuard extends ThrottlerGuard {
  private readonly logger = new Logger(AppThrottlerGuard.name);

  protected async getTracker(req: Record<string, any>): Promise<string> {
    if (req.userId) {
      return `user:${req.userId}`;
    }

    // Trust CF-Connecting-IP only if the app is verified reachable exclusively
    // through Cloudflare (network-level guarantee, not enforced here). Falls
    // back to req.ips (populated only once `trust proxy` is configured) then
    // req.ip.
    const cfIp = req.headers?.['cf-connecting-ip'];
    const ip = cfIp || (req.ips?.length ? req.ips[0] : req.ip);
    return `ip:${ip}`;
  }

  protected async throwThrottlingException(
    context: ExecutionContext,
    throttlerLimitDetail: ThrottlerLimitDetail,
  ): Promise<void> {
    const http = context.switchToHttp();
    const response = http.getResponse<Response>();
    const request = http.getRequest<Request>();

    const retryAfterSeconds = Math.ceil(
      throttlerLimitDetail.timeToBlockExpire ??
        throttlerLimitDetail.timeToExpire,
    );
    response.setHeader('Retry-After', String(retryAfterSeconds));

    this.logger.warn(
      `Rate limit exceeded for ${throttlerLimitDetail.tracker} on ` +
        `${request.method} ${request.url} ` +
        `(limit=${throttlerLimitDetail.limit}, ttl=${throttlerLimitDetail.ttl}ms)`,
    );

    await super.throwThrottlingException(context, throttlerLimitDetail);
  }
}
