import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { QueueConfigService } from './queue-config/queue-config.service';
import { QUEUE_NAMES } from './queue.constants';
import { JOB_OPTIONS_BY_QUEUE } from './queue-defaults';
import { UserSyncProcessor } from './processors/user-sync.processor';
import { BillingWebhookProcessor } from './processors/billing-webhook.processor';
import { UsersModule } from '../users/users.module';
import { BillingModule } from '../billing/billing.module';

@Module({
  imports: [
    ConfigModule,
    // BullModule.forRootAsync's internal dynamic module can't see sibling
    // providers, so QueueConfigService is constructed directly from the
    // global ConfigService here — same reason RateLimitModule does this for
    // RateLimitConfigService.
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const queueConfig = new QueueConfigService(configService);
        queueConfig.logIfDisabled();
        return {
          connection: {
            host: queueConfig.host,
            port: queueConfig.port,
            password: queueConfig.password,
            db: queueConfig.db,
            // Required by BullMQ — ioredis's default (20) throws
            // MaxRetriesPerRequestError otherwise, short-circuiting
            // BullMQ's own blocking-reconnect retry logic.
            maxRetriesPerRequest: null,
            enableReadyCheck: false,
          },
          defaultJobOptions: queueConfig.defaultJobOptions,
        };
      },
    }),
    BullModule.registerQueue({
      name: QUEUE_NAMES.USER_SYNC,
      defaultJobOptions: JOB_OPTIONS_BY_QUEUE[QUEUE_NAMES.USER_SYNC],
    }),
    BullModule.registerQueue({
      name: QUEUE_NAMES.BILLING_SYNC,
      defaultJobOptions: JOB_OPTIONS_BY_QUEUE[QUEUE_NAMES.BILLING_SYNC],
    }),
    UsersModule,
    // Not a cycle: BillingModule registers its own producer-only access to
    // BILLING_SYNC (BullModule.registerQueue against this module's
    // forRootAsync connection, which is global) without importing QueueModule.
    BillingModule,
  ],
  providers: [QueueConfigService, UserSyncProcessor, BillingWebhookProcessor],
  exports: [BullModule],
})
export class QueueModule {}
