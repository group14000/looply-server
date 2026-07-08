/**
 * Queue names, `<domain>.<action>`. Never inline a queue-name string at a
 * call site — always reference these constants.
 */
export const QUEUE_NAMES = {
  USER_SYNC: 'user.sync',
  BILLING_SYNC: 'billing.sync',
} as const;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];
