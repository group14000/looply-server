import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { ClerkModule } from '../clerk/clerk.module';
import { QUEUE_NAMES } from '../queue/queue.constants';
import { BillingConfigService } from './billing-config/billing-config.service';
import { BillingService } from './billing.service';
import { BillingGuard } from './guards/billing/billing.guard';
import { BillingWebhookController } from './billing-webhook.controller';
import { BillingController } from './billing.controller';

@Module({
  // PrismaModule and CacheModule are @Global(), no import needed.
  // registerQueue here only grants producer access (@InjectQueue in the
  // controller) against the shared connection QueueModule's forRootAsync
  // already established globally — QueueModule itself is not imported, which
  // would create a cycle (QueueModule imports BillingModule for the
  // processor's BillingService dependency).
  imports: [
    ConfigModule,
    ClerkModule,
    BullModule.registerQueue({ name: QUEUE_NAMES.BILLING_SYNC }),
  ],
  controllers: [BillingWebhookController, BillingController],
  providers: [
    BillingConfigService,
    BillingService,
    BillingGuard,
    { provide: APP_GUARD, useClass: BillingGuard },
  ],
  exports: [BillingService, BillingConfigService],
})
export class BillingModule {}
