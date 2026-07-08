import {
  Controller,
  Post,
  Req,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import { ApiExcludeEndpoint } from '@nestjs/swagger';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { Request } from 'express';
import { Webhook, WebhookVerificationError } from 'svix';
import { Public } from '../auth/decorators/public.decorator';
import { WebhookRateLimit } from '../rate-limit/decorators/rate-limit.decorators';
import { BillingConfigService } from './billing-config/billing-config.service';
import { QUEUE_NAMES } from '../queue/queue.constants';

interface ClerkBillingEvent {
  type: string;
  data: unknown;
}

/**
 * Server-to-server receiver — no Clerk session token, verified by svix
 * signature instead. @Public() bypasses ClerkAuthGuard explicitly and only
 * for this route; every other route is unaffected. rawBody (enabled in
 * main.ts) is required here since signature verification needs the exact
 * unparsed bytes, not the JSON-parsed req.body.
 */
@Controller('webhooks/clerk/billing')
export class BillingWebhookController {
  private readonly logger = new Logger(BillingWebhookController.name);

  constructor(
    private readonly billingConfig: BillingConfigService,
    @InjectQueue(QUEUE_NAMES.BILLING_SYNC) private readonly queue: Queue,
  ) {}

  @Public()
  @WebhookRateLimit()
  @Post()
  @ApiExcludeEndpoint()
  async handle(@Req() req: RawBodyRequest<Request>) {
    const raw = req.rawBody;
    const svixId = req.headers['svix-id'] as string;
    const svixTimestamp = req.headers['svix-timestamp'] as string;
    const svixSignature = req.headers['svix-signature'] as string;

    if (!raw || !svixId || !svixTimestamp || !svixSignature) {
      throw new BadRequestException('Missing webhook payload or headers');
    }

    let evt: ClerkBillingEvent;
    try {
      const wh = new Webhook(this.billingConfig.webhookSecret);
      evt = wh.verify(raw.toString('utf8'), {
        'svix-id': svixId,
        'svix-timestamp': svixTimestamp,
        'svix-signature': svixSignature,
      }) as ClerkBillingEvent;
    } catch (error) {
      if (error instanceof WebhookVerificationError) {
        this.logger.warn(
          `Webhook signature verification failed: ${error.message}`,
        );
        throw new BadRequestException('Invalid webhook signature');
      }
      throw error;
    }

    // jobId: svixId gives BullMQ itself free dedupe against an immediate
    // redelivery; the processor's ProcessedWebhookEvent unique-constraint
    // write is the durable idempotency guarantee (see AGENTS.md).
    await this.queue.add(evt.type, evt, { jobId: svixId });

    return { received: true };
  }
}
