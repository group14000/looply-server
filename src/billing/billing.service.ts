import { Injectable, Logger } from '@nestjs/common';
import type { BillingSubscription } from '@clerk/backend';
import { PrismaService } from '../prisma/prisma.service';
import { ClerkService } from '../clerk/clerk/clerk.service';
import { CacheService } from '../cache/cache.service';
import { buildCacheKey } from '../cache/cache-key.util';
import { BillingConfigService } from './billing-config/billing-config.service';
import { BillingPlan } from './decorators/billing.decorators';

const BILLING_CACHE_TTL_SECONDS = 300;

/** Statuses that still mean "keep serving the plan" — active, or within the
 * grace period covered separately by billingPeriodEnd. */
const ACTIVE_STATUSES = new Set(['active']);

export interface BillingState {
  planId: string | null;
  status: string | null;
  subscriptionId: string | null;
  periodEnd: Date | null;
  syncedAt: Date | null;
}

function isEntitledFromState(state: BillingState | null): boolean {
  if (!state || !state.planId) {
    return false;
  }
  if (state.status && ACTIVE_STATUSES.has(state.status)) {
    return true;
  }
  // Grace period: a canceled/past_due subscription still grants access until
  // the paid period actually ends (confirmed product decision, not a default
  // Clerk behavior).
  return !!state.periodEnd && state.periodEnd.getTime() > Date.now();
}

@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);

  constructor(
    private readonly clerk: ClerkService,
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
    private readonly billingConfig: BillingConfigService,
  ) {}

  /** Picks the subscription item matching one of our two known plan IDs, if any. */
  private pickKnownItem(subscription: BillingSubscription | null) {
    if (!subscription) {
      return null;
    }
    return (
      subscription.subscriptionItems.find(
        (item) =>
          item.planId === this.billingConfig.soloPlanId ||
          item.planId === this.billingConfig.orgPlanId,
      ) ?? null
    );
  }

  async getUserBilling(clerkId: string): Promise<BillingState> {
    return this.cache.getOrSet(
      buildCacheKey('billing:user', clerkId),
      async () => {
        const user = await this.prisma.user.findUnique({
          where: { clerkId },
        });
        if (!user?.billingSyncedAt) {
          return this.reconcileUserBilling(clerkId);
        }
        return this.toBillingState(user);
      },
      BILLING_CACHE_TTL_SECONDS,
    );
  }

  async getOrgBilling(clerkOrgId: string): Promise<BillingState> {
    return this.cache.getOrSet(
      buildCacheKey('billing:org', clerkOrgId),
      async () => {
        const org = await this.prisma.organization.findUnique({
          where: { clerkOrgId },
        });
        if (!org?.billingSyncedAt) {
          return this.reconcileOrgBilling(clerkOrgId);
        }
        return this.toBillingState(org);
      },
      BILLING_CACHE_TTL_SECONDS,
    );
  }

  async reconcileUserBilling(clerkId: string): Promise<BillingState> {
    const subscription = await this.clerk.getUserBillingSubscription(clerkId);
    const item = this.pickKnownItem(subscription);

    const data = {
      billingPlanId: item?.planId ?? null,
      billingStatus: item?.status ?? null,
      billingSubscriptionId: subscription?.id ?? null,
      billingPeriodEnd: item?.periodEnd ? new Date(item.periodEnd) : null,
      billingSyncedAt: new Date(),
    };

    const user = await this.prisma.user.update({
      where: { clerkId },
      data,
    });

    const state = this.toBillingState(user);
    await this.cache.set(
      buildCacheKey('billing:user', clerkId),
      state,
      BILLING_CACHE_TTL_SECONDS,
    );
    this.logger.log(`Reconciled billing for user ${clerkId}`);
    return state;
  }

  async reconcileOrgBilling(clerkOrgId: string): Promise<BillingState> {
    const subscription =
      await this.clerk.getOrganizationBillingSubscription(clerkOrgId);
    const item = this.pickKnownItem(subscription);

    const data = {
      billingPlanId: item?.planId ?? null,
      billingStatus: item?.status ?? null,
      billingSubscriptionId: subscription?.id ?? null,
      billingPeriodEnd: item?.periodEnd ? new Date(item.periodEnd) : null,
      billingSyncedAt: new Date(),
    };

    const org = await this.prisma.organization.upsert({
      where: { clerkOrgId },
      create: { clerkOrgId, ...data },
      update: data,
    });

    const state = this.toBillingState(org);
    await this.cache.set(
      buildCacheKey('billing:org', clerkOrgId),
      state,
      BILLING_CACHE_TTL_SECONDS,
    );
    this.logger.log(`Reconciled billing for organization ${clerkOrgId}`);
    return state;
  }

  /** The Clerk org id from the user's existing organization JSON snapshot, if any. */
  private async resolveOrgId(clerkId: string): Promise<string | null> {
    const user = await this.cache.getOrSet(
      buildCacheKey('user', clerkId),
      () => this.prisma.user.findUnique({ where: { clerkId } }),
      BILLING_CACHE_TTL_SECONDS,
    );
    const orgSnapshot = user?.organization as { id?: string } | null;
    return orgSnapshot?.id ?? null;
  }

  /**
   * OR-logic entitlement: a personal Solo subscription and org membership in
   * a Growth-plan org each independently grant access — no precedence rules.
   */
  async isEntitled(
    clerkId: string,
    requiredPlans: BillingPlan[],
  ): Promise<boolean> {
    if (!requiredPlans.length) {
      return true;
    }

    if (requiredPlans.includes(BillingPlan.SOLO)) {
      const userState = await this.getUserBilling(clerkId);
      if (
        userState.planId === this.billingConfig.soloPlanId &&
        isEntitledFromState(userState)
      ) {
        return true;
      }
    }

    if (requiredPlans.includes(BillingPlan.ORG)) {
      const orgId = await this.resolveOrgId(clerkId);
      if (orgId) {
        const orgState = await this.getOrgBilling(orgId);
        if (
          orgState.planId === this.billingConfig.orgPlanId &&
          isEntitledFromState(orgState)
        ) {
          return true;
        }
      }
    }

    return false;
  }

  /** Caller-facing snapshot of their own entitlement — always accessible, never gated. */
  async getStatus(clerkId: string) {
    const soloState = await this.getUserBilling(clerkId);
    const orgId = await this.resolveOrgId(clerkId);
    const orgState = orgId ? await this.getOrgBilling(orgId) : null;

    return {
      isSoloEntitled:
        soloState.planId === this.billingConfig.soloPlanId &&
        isEntitledFromState(soloState),
      isOrgEntitled:
        !!orgState &&
        orgState.planId === this.billingConfig.orgPlanId &&
        isEntitledFromState(orgState),
      soloPlanId: soloState.planId,
      soloStatus: soloState.status,
      orgPlanId: orgState?.planId ?? null,
      orgStatus: orgState?.status ?? null,
    };
  }

  private toBillingState(row: {
    billingPlanId: string | null;
    billingStatus: string | null;
    billingSubscriptionId: string | null;
    billingPeriodEnd: Date | null;
    billingSyncedAt: Date | null;
  }): BillingState {
    return {
      planId: row.billingPlanId,
      status: row.billingStatus,
      subscriptionId: row.billingSubscriptionId,
      periodEnd: row.billingPeriodEnd,
      syncedAt: row.billingSyncedAt,
    };
  }
}
