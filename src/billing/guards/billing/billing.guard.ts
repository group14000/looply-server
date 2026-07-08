import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { BillingService } from '../../billing.service';
import {
  BILLING_PLANS_KEY,
  BillingPlan,
} from '../../decorators/billing.decorators';

/**
 * Global APP_GUARD that no-ops on any route without @RequirePlan(...)
 * metadata — mirrors AppThrottlerGuard's global-but-only-overrides-decorated-
 * routes shape. Reads request.userId, so BillingModule must be imported
 * after AuthModule in AppModule (same ordering hazard as RateLimitModule).
 */
@Injectable()
export class BillingGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private billingService: BillingService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredPlans = this.reflector.getAllAndOverride<BillingPlan[]>(
      BILLING_PLANS_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredPlans?.length) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const userId = request['userId'] as string | undefined;

    const entitled =
      !!userId && (await this.billingService.isEntitled(userId, requiredPlans));

    if (!entitled) {
      throw new ForbiddenException('This feature requires an active plan');
    }

    return true;
  }
}
