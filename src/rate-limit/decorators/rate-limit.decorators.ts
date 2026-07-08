import { applyDecorators } from '@nestjs/common';
import { SkipThrottle, Throttle } from '@nestjs/throttler';

/**
 * ThrottlerModule registers exactly one named throttler ('default'). These
 * decorators override its limit/ttl for a specific route/controller by
 * category, reading from the same RATE_LIMIT_<NAME>_* env vars
 * RateLimitConfigService uses (resolved per-request, not at decoration time,
 * since @nestjs/throttler's `Resolvable<number>` accepts a function).
 * Routes without one of these keep the `default` profile.
 */
function categoryOverride(
  envPrefix: string,
  defaultLimit: number,
  defaultTtl: number,
) {
  return applyDecorators(
    Throttle({
      default: {
        limit: () =>
          parseInt(
            process.env[`RATE_LIMIT_${envPrefix}_LIMIT`] ||
              String(defaultLimit),
            10,
          ),
        ttl: () =>
          parseInt(
            process.env[`RATE_LIMIT_${envPrefix}_TTL_MS`] || String(defaultTtl),
            10,
          ),
      },
    }),
  );
}

export const AuthRateLimit = () => categoryOverride('AUTH', 10, 60000);
export const WriteRateLimit = () => categoryOverride('WRITE', 30, 60000);
export const AdminRateLimit = () => categoryOverride('ADMIN', 20, 60000);
export const AiRateLimit = () => categoryOverride('AI', 15, 60000);
export const UploadRateLimit = () => categoryOverride('UPLOAD', 10, 60000);
export const WebhookRateLimit = () => categoryOverride('WEBHOOK', 60, 60000);

/** Full rate-limit bypass — reserved for internal/ops routes. */
export const SkipRateLimit = () => applyDecorators(SkipThrottle());
