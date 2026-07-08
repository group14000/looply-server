import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JobsOptions } from 'bullmq';

/**
 * Shares the same Redis instance/host/port/password as RedisConfigService
 * (cache), but a distinct logical DB index (QUEUE_REDIS_DB) — see AGENTS.md.
 * Unlike RedisConfigService, queue connection details fail fast at boot when
 * QUEUE_ENABLED is true: a queue that silently never connects is worse than
 * a crash, since (unlike a cache) there's no safe silent-degrade story for
 * "please process this job later."
 */
@Injectable()
export class QueueConfigService {
  private readonly logger = new Logger(QueueConfigService.name);

  constructor(private configService: ConfigService) {}

  get isEnabled(): boolean {
    return this.configService.get('QUEUE_ENABLED') !== 'false';
  }

  get host(): string {
    const host = this.configService.get<string>('REDIS_HOST');
    if (this.isEnabled && !host) {
      throw new Error(
        'REDIS_HOST is not defined but QUEUE_ENABLED is true — queues cannot silently no-op',
      );
    }
    return host || 'localhost';
  }

  get port(): number {
    return parseInt(this.configService.get('REDIS_PORT') || '6379', 10);
  }

  get password(): string | undefined {
    return this.configService.get('REDIS_PASSWORD') || undefined;
  }

  /** Logical DB index for queue data — distinct from the cache's REDIS_DB so
   * a debugging FLUSHDB against the cache can never wipe in-flight jobs. */
  get db(): number {
    return parseInt(this.configService.get('QUEUE_REDIS_DB') || '1', 10);
  }

  get defaultJobOptions(): JobsOptions {
    return {
      attempts: 3,
      backoff: { type: 'exponential', delay: 2000 },
      removeOnComplete: { age: 24 * 3600, count: 1000 },
      removeOnFail: { age: 7 * 24 * 3600 },
    };
  }

  logIfDisabled() {
    if (!this.isEnabled) {
      this.logger.log('Queues disabled via QUEUE_ENABLED=false');
    }
  }
}
