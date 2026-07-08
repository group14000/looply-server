import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../redis/redis.service';
import { RedisConfigService } from '../redis/redis-config/redis-config.service';

/**
 * Cache-aside helper. Every method swallows Redis-layer failures and falls
 * through to the caller's own fetch — a cache-layer failure can only ever
 * make a request slightly slower or slightly noisier (a warn log), never a
 * 500. See AGENTS.md's "Redis is optional and non-blocking" section.
 */
@Injectable()
export class CacheService {
  private readonly logger = new Logger(CacheService.name);

  constructor(
    private readonly redis: RedisService,
    private readonly redisConfig: RedisConfigService,
  ) {}

  private get isUsable(): boolean {
    return this.redisConfig.isEnabled && this.redis.isReady;
  }

  async get<T>(key: string): Promise<T | null> {
    if (!this.isUsable) {
      return null;
    }
    try {
      const cached = await this.redis.client.get(key);
      return cached === null ? null : (JSON.parse(cached) as T);
    } catch (err) {
      this.logger.warn(
        `Cache read failed for ${key}: ${(err as Error).message}`,
      );
      return null;
    }
  }

  async set<T>(
    key: string,
    value: T,
    ttlSeconds: number = this.redisConfig.defaultTtlSeconds,
  ): Promise<void> {
    if (!this.isUsable) {
      return;
    }
    try {
      await this.redis.client.set(key, JSON.stringify(value), 'EX', ttlSeconds);
    } catch (err) {
      this.logger.warn(
        `Cache write failed for ${key}: ${(err as Error).message}`,
      );
    }
  }

  async del(key: string): Promise<void> {
    if (!this.isUsable) {
      return;
    }
    try {
      await this.redis.client.del(key);
    } catch (err) {
      this.logger.warn(
        `Cache delete failed for ${key}: ${(err as Error).message}`,
      );
    }
  }

  async getOrSet<T>(
    key: string,
    fn: () => Promise<T>,
    ttlSeconds: number = this.redisConfig.defaultTtlSeconds,
  ): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    // The real fetch always runs outside the cache's own try/catch — a
    // genuine DB/upstream error here must propagate normally, it is not a
    // caching concern.
    const fresh = await fn();

    await this.set(key, fresh, ttlSeconds);

    return fresh;
  }
}
