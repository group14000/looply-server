import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ClerkModule } from './clerk/clerk.module';
import { AuthModule } from './auth/auth.module';
import { ConfigurationModule } from './config/config.module';
import { PrismaModule } from './prisma/prisma.module';
import { UsersModule } from './users/users.module';
import { RateLimitModule } from './rate-limit/rate-limit.module';
import { RedisModule } from './redis/redis.module';
import { CacheModule } from './cache/cache.module';
import { QueueModule } from './queue/queue.module';
import { BillingModule } from './billing/billing.module';
import { ProductsModule } from './products/products.module';

@Module({
  imports: [
    ConfigurationModule,
    PrismaModule,
    // Infra, before feature modules — neither reads request.userId nor
    // registers a guard, so order relative to Auth/RateLimit doesn't matter,
    // unlike RateLimitModule/BillingModule below.
    RedisModule,
    CacheModule,
    ClerkModule,
    AuthModule,
    // Must come after AuthModule: both AppThrottlerGuard.getTracker and
    // BillingGuard.canActivate read request.userId, which only exists once
    // ClerkAuthGuard's global guard has already run and set it. NestJS runs
    // multiple APP_GUARD providers in the order their owning modules appear
    // here — reordering this silently breaks per-user rate-limit tracking
    // (falls back to IP) or plan-gating (userId undefined, always denied)
    // with no error. See AGENTS.md.
    RateLimitModule,
    BillingModule,
    UsersModule,
    ProductsModule,
    QueueModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
