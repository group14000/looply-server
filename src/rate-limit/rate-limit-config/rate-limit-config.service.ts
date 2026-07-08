import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface RateLimitProfile {
  ttl: number;
  limit: number;
}

const PROFILE_DEFAULTS: Record<string, RateLimitProfile> = {
  default: { ttl: 60000, limit: 100 },
  auth: { ttl: 60000, limit: 10 },
  write: { ttl: 60000, limit: 30 },
  admin: { ttl: 60000, limit: 20 },
  ai: { ttl: 60000, limit: 15 },
  upload: { ttl: 60000, limit: 10 },
  webhook: { ttl: 60000, limit: 60 },
};

@Injectable()
export class RateLimitConfigService {
  constructor(private configService: ConfigService) {}

  get isEnabled(): boolean {
    return this.configService.get('RATE_LIMIT_ENABLED') !== 'false';
  }

  /**
   * Express `trust proxy` hop count (see main.ts). 0 = off. Never trust an
   * unbounded/`true` value in production — see AGENTS.md gotcha on spoofed
   * X-Forwarded-For headers.
   */
  get trustProxyHops(): number {
    return parseInt(this.configService.get('TRUST_PROXY_HOPS') || '0', 10);
  }

  /**
   * One entry per rate-limit category, keyed by name. `default` is the only
   * one actually registered as a ThrottlerModule throttler (see
   * RateLimitModule) — the rest are read directly from the matching env vars
   * by the category decorators (rate-limit.decorators.ts), which override
   * the `default` throttler's limit/ttl per-route. This getter stays the one
   * place documenting all category defaults even though only `default` is
   * consumed here directly.
   */
  get profiles(): Record<string, RateLimitProfile> {
    const profiles: Record<string, RateLimitProfile> = {};
    for (const [name, defaults] of Object.entries(PROFILE_DEFAULTS)) {
      const prefix = `RATE_LIMIT_${name.toUpperCase()}`;
      profiles[name] = {
        ttl: parseInt(
          this.configService.get(`${prefix}_TTL_MS`) || String(defaults.ttl),
          10,
        ),
        limit: parseInt(
          this.configService.get(`${prefix}_LIMIT`) || String(defaults.limit),
          10,
        ),
      };
    }
    return profiles;
  }
}
