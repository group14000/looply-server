import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class FeedbackConfigService {
  constructor(private configService: ConfigService) {}

  /**
   * HMAC key for hashing feedback tokens (see feedback-token.util.ts) — never
   * used for anything else. Throws only when actually read (token
   * creation/verification), not at DI/boot time, same pattern as
   * BillingConfigService.webhookSecret.
   */
  get tokenPepper(): string {
    const pepper = this.configService.get<string>('FEEDBACK_TOKEN_PEPPER');
    if (!pepper) {
      throw new Error('FEEDBACK_TOKEN_PEPPER is not defined');
    }
    return pepper;
  }

  /** How long a generated review link stays valid. Optional, safe default. */
  get linkTtlDays(): number {
    return parseInt(
      this.configService.get('FEEDBACK_LINK_TTL_DAYS') || '30',
      10,
    );
  }
}
