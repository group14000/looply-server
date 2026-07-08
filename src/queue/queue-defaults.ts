import { JobsOptions } from 'bullmq';
import { QUEUE_NAMES, QueueName } from './queue.constants';

/**
 * Per-queue overrides on top of QueueModule's global defaultJobOptions.
 * Kept in one greppable place rather than scattered across `.add()` call
 * sites; per-call overrides remain possible via `.add()`'s third argument
 * for one-off cases.
 */
export const JOB_OPTIONS_BY_QUEUE: Partial<Record<QueueName, JobsOptions>> = {
  // Talks to Clerk's API — transient-failure-tolerant, so more attempts and
  // a longer backoff than the global default.
  [QUEUE_NAMES.USER_SYNC]: {
    attempts: 5,
    backoff: { type: 'exponential', delay: 3000 },
  },
  // Redelivery-tolerant by design (idempotent via ProcessedWebhookEvent), so
  // the same transient-failure-tolerant profile as USER_SYNC applies.
  [QUEUE_NAMES.BILLING_SYNC]: {
    attempts: 5,
    backoff: { type: 'exponential', delay: 3000 },
  },
};
