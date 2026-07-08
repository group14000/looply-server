import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { BillingGuard } from './billing.guard';
import { BillingService } from '../../billing.service';
import {
  BillingPlan,
  BILLING_PLANS_KEY,
} from '../../decorators/billing.decorators';

function makeContext(userId?: string): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ userId }),
    }),
    getHandler: () => ({}),
    getClass: () => ({}),
  } as unknown as ExecutionContext;
}

describe('BillingGuard', () => {
  let billingService: { isEntitled: jest.Mock };
  let reflector: Reflector;

  beforeEach(() => {
    billingService = { isEntitled: jest.fn() };
    reflector = new Reflector();
  });

  function makeGuard(requiredPlans: BillingPlan[] | undefined) {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(requiredPlans);
    return new BillingGuard(
      reflector,
      billingService as unknown as BillingService,
    );
  }

  it('allows a route with no @RequirePlan metadata without checking entitlement', async () => {
    const guard = makeGuard(undefined);
    await expect(guard.canActivate(makeContext('user_1'))).resolves.toBe(true);
    expect(billingService.isEntitled).not.toHaveBeenCalled();
  });

  it('allows an entitled user on a gated route', async () => {
    billingService.isEntitled.mockResolvedValue(true);
    const guard = makeGuard([BillingPlan.SOLO]);
    await expect(guard.canActivate(makeContext('user_1'))).resolves.toBe(true);
    expect(billingService.isEntitled).toHaveBeenCalledWith('user_1', [
      BillingPlan.SOLO,
    ]);
  });

  it('throws ForbiddenException for a non-entitled user on a gated route', async () => {
    billingService.isEntitled.mockResolvedValue(false);
    const guard = makeGuard([BillingPlan.ORG]);
    await expect(guard.canActivate(makeContext('user_1'))).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('throws ForbiddenException when userId is missing (auth guard did not run)', async () => {
    const guard = makeGuard([BillingPlan.SOLO]);
    await expect(guard.canActivate(makeContext(undefined))).rejects.toThrow(
      ForbiddenException,
    );
    expect(billingService.isEntitled).not.toHaveBeenCalled();
  });
});
