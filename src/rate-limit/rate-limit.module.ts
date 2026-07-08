import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { RateLimitConfigService } from './rate-limit-config/rate-limit-config.service';
import { AppThrottlerGuard } from './guards/app-throttler/app-throttler.guard';

@Module({
  imports: [
    ConfigModule,
    // ThrottlerModule.forRootAsync's internal dynamic module only sees
    // providers reachable through its own `imports`/`inject` — not
    // RateLimitModule's `providers` list below — so RateLimitConfigService is
    // constructed directly from the global ConfigService here rather than
    // injected, matching how ClerkModule treats ClerkConfigService as a
    // plain wrapper class rather than something shared via module exports.
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const rateLimitConfig = new RateLimitConfigService(configService);
        // A single named throttler ('default'). ThrottlerGuard applies every
        // registered named throttler to every request unconditionally (they
        // AND together), so registering all seven profiles here would mean
        // every route is capped by the tightest one. Category decorators
        // (rate-limit.decorators.ts) instead override this one throttler's
        // limit/ttl per-route via `@Throttle({ default: { limit, ttl } })`.
        const { default: defaultProfile } = rateLimitConfig.profiles;
        return {
          throttlers: [{ name: 'default', ...defaultProfile }],
          skipIf: () => !rateLimitConfig.isEnabled,
          errorMessage: 'Too many requests, please try again later.',
          setHeaders: true,
        };
      },
    }),
  ],
  providers: [
    RateLimitConfigService,
    AppThrottlerGuard,
    { provide: APP_GUARD, useClass: AppThrottlerGuard },
  ],
  exports: [RateLimitConfigService],
})
export class RateLimitModule {}
