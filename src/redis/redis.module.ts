import { Global, Module } from '@nestjs/common';
import { RedisService } from './redis.service';
import { RedisConfigService } from './redis-config/redis-config.service';

@Global()
@Module({
  providers: [RedisConfigService, RedisService],
  exports: [RedisConfigService, RedisService],
})
export class RedisModule {}
