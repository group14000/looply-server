import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import Redis from 'ioredis';
import { RedisConfigService } from './redis-config/redis-config.service';

/**
 * Owns the cache-purpose Redis connection. Unlike PrismaService, this must
 * never block or fail app boot — Redis is an optional performance layer, not
 * a required dependency. BullMQ (src/queue/) constructs its own separate
 * ioredis connection with opposite options (enableOfflineQueue: true,
 * maxRetriesPerRequest: null) — a queue needs to buffer/wait through an
 * outage, a cache needs to fail fast and fall through to the DB.
 */
@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private redisClient: Redis | null = null;

  constructor(private readonly redisConfig: RedisConfigService) {}

  get client(): Redis {
    if (!this.redisClient) {
      throw new Error('Redis client accessed while disabled');
    }
    return this.redisClient;
  }

  /** Fast-path short-circuit for CacheService — a perf optimization, not the
   * correctness guarantee (the try/catch around every command is that). */
  get isReady(): boolean {
    return this.redisClient?.status === 'ready';
  }

  async onModuleInit() {
    if (!this.redisConfig.isEnabled) {
      this.logger.log(
        'Redis disabled via REDIS_ENABLED=false, caching is a no-op',
      );
      return;
    }

    this.redisClient = new Redis({
      host: this.redisConfig.host,
      port: this.redisConfig.port,
      password: this.redisConfig.password,
      db: this.redisConfig.db,
      keyPrefix: this.redisConfig.keyPrefix,
      lazyConnect: true,
      connectTimeout: this.redisConfig.connectTimeoutMs,
      maxRetriesPerRequest: this.redisConfig.maxRetriesPerRequest,
      enableOfflineQueue: false,
      retryStrategy: (times) => Math.min(times * 200, 5000),
    });

    this.redisClient.on('connect', () => this.logger.log('Redis connected'));
    this.redisClient.on('error', (err) =>
      this.logger.warn(`Redis error: ${err.message}`),
    );

    // Fire-and-forget: never let a failed/pending connection gate Nest's
    // bootstrap or the HTTP server starting.
    this.redisClient.connect().catch((err: Error) => {
      this.logger.warn(
        `Initial Redis connection failed, continuing without cache: ${err.message}`,
      );
    });
  }

  async onModuleDestroy() {
    if (!this.redisClient) {
      return;
    }
    try {
      this.redisClient.disconnect();
    } catch (err) {
      this.logger.warn(
        `Error while disconnecting Redis: ${(err as Error).message}`,
      );
    }
  }
}
