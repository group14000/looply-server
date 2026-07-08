import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Same typed-getter pattern as ClerkConfigService: plan IDs are optional
 * (built-in defaults are the real Clerk dashboard plan IDs), the webhook
 * secret is required once the billing webhook route is actually used.
 */
@Injectable()
export class BillingConfigService {
  constructor(private configService: ConfigService) {}

  get soloPlanId(): string {
    return (
      this.configService.get<string>('BILLING_SOLO_PLAN_ID') ??
      'cplan_3Fw9SRoaxH4KJcBEzkprpHZhShu'
    );
  }

  get orgPlanId(): string {
    return (
      this.configService.get<string>('BILLING_ORG_PLAN_ID') ??
      'cplan_3FwAsEw1E5tSxbjnukLVdGXCe95'
    );
  }

  /**
   * Dedicated secret for the billing webhook endpoint — deliberately not
   * ClerkConfigService.webhookSecret, since Clerk issues a distinct signing
   * secret per configured webhook endpoint and billing is its own endpoint.
   */
  get webhookSecret(): string {
    const secret = this.configService.get<string>('BILLING_WEBHOOK_SECRET');
    if (!secret) {
      throw new Error('BILLING_WEBHOOK_SECRET is not defined');
    }
    return secret;
  }
}
