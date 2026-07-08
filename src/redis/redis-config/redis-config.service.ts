import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class RedisConfigService {
  constructor(private configService: ConfigService) {}

  get isEnabled(): boolean {
    return this.configService.get('REDIS_ENABLED') !== 'false';
  }

  get host(): string {
    return this.configService.get('REDIS_HOST') || 'localhost';
  }

  get port(): number {
    return parseInt(this.configService.get('REDIS_PORT') || '6379', 10);
  }

  get password(): string | undefined {
    return this.configService.get('REDIS_PASSWORD') || undefined;
  }

  /** Logical Redis DB index used by the cache — kept separate from the queue's
   * DB index (QUEUE_REDIS_DB) so a debugging FLUSHDB against one can never
   * wipe the other. */
  get db(): number {
    return parseInt(this.configService.get('REDIS_DB') || '0', 10);
  }

  get keyPrefix(): string {
    return this.configService.get('REDIS_KEY_PREFIX') || 'looply:';
  }

  get defaultTtlSeconds(): number {
    return parseInt(
      this.configService.get('REDIS_DEFAULT_TTL_SECONDS') || '300',
      10,
    );
  }

  get connectTimeoutMs(): number {
    return parseInt(
      this.configService.get('REDIS_CONNECT_TIMEOUT_MS') || '2000',
      10,
    );
  }

  /** Bounds how long a single command blocks/retries before failing — keeps
   * a cache-miss-due-to-outage fast (tens of ms) instead of hanging. */
  get maxRetriesPerRequest(): number {
    return parseInt(
      this.configService.get('REDIS_MAX_RETRIES_PER_REQUEST') || '1',
      10,
    );
  }
}
