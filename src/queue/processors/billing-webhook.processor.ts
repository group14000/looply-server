import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { QUEUE_NAMES } from '../queue.constants';
import { BillingService } from '../../billing/billing.service';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma } from '../../generated/prisma/client';

interface ClerkBillingPayer {
  user_id?: string;
  organization_id?: string;
}

interface ClerkBillingEvent {
  type: string;
  data: {
    payer?: ClerkBillingPayer;
    payer_id?: string;
  };
}

/**
 * Processes Clerk billing webhook events enqueued by BillingWebhookController.
 * Durable idempotency: the ProcessedWebhookEvent row (unique on svixId, which
 * is also the BullMQ jobId) is written FIRST — a duplicate delivery that
 * slips past BullMQ's own jobId dedupe (e.g. redelivered after the original
 * job was retired) hits the unique-constraint violation here and is skipped
 * before any reconcile runs. Redis/CacheService is explicitly optional and
 * can no-op entirely, so it is never the source of truth for this guarantee.
 */
@Processor(QUEUE_NAMES.BILLING_SYNC)
export class BillingWebhookProcessor extends WorkerHost {
  private readonly logger = new Logger(BillingWebhookProcessor.name);

  constructor(
    private readonly billingService: BillingService,
    private readonly prisma: PrismaService,
  ) {
    super();
  }

  async process(job: Job<ClerkBillingEvent>): Promise<void> {
    const svixId = job.id;
    if (!svixId) {
      this.logger.warn('Billing webhook job has no id — skipping');
      return;
    }

    try {
      await this.prisma.processedWebhookEvent.create({
        data: { svixId, eventType: job.data.type },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        this.logger.log(`Skipping already-processed webhook event ${svixId}`);
        return;
      }
      throw error;
    }

    const orgId = job.data.data.payer?.organization_id;
    const userId = job.data.data.payer?.user_id;

    if (orgId) {
      await this.billingService.reconcileOrgBilling(orgId);
    } else if (userId) {
      await this.billingService.reconcileUserBilling(userId);
    } else {
      this.logger.warn(
        `Billing webhook event ${svixId} (${job.data.type}) has no resolvable payer — skipped`,
      );
    }
  }
}
