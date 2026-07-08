import { SetMetadata } from '@nestjs/common';

export enum BillingPlan {
  SOLO = 'solo',
  ORG = 'org',
}

export const BILLING_PLANS_KEY = 'billing:requiredPlans';

/** Gates a route behind one or more plans (OR logic — any listed plan grants access). */
export const RequirePlan = (...plans: BillingPlan[]) =>
  SetMetadata(BILLING_PLANS_KEY, plans);

export const RequireSoloPlan = () => RequirePlan(BillingPlan.SOLO);
export const RequireOrgPlan = () => RequirePlan(BillingPlan.ORG);
