import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  ClerkService,
  ClerkOrganizationSummary,
} from '../clerk/clerk/clerk.service';
import { Prisma, User } from '../generated/prisma/client';
import { CacheService } from '../cache/cache.service';
import { buildCacheKey } from '../cache/cache-key.util';

const USER_CACHE_TTL_SECONDS = 300;

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly clerkService: ClerkService,
    private readonly cache: CacheService,
  ) {}

  /**
   * Pulls the given Clerk user's current profile and upserts it locally.
   * Called with the authenticated caller's own clerkId so a user can only sync themselves.
   */
  async syncFromClerk(clerkId: string): Promise<User> {
    const clerkUser = await this.clerkService.getUserById(clerkId);
    if (!clerkUser) {
      throw new NotFoundException(`Clerk user ${clerkId} not found`);
    }

    const organization =
      await this.clerkService.getUserPrimaryOrganization(clerkId);

    const data = {
      email: clerkUser.primaryEmailAddress?.emailAddress ?? null,
      firstName: clerkUser.firstName,
      lastName: clerkUser.lastName,
      imageUrl: clerkUser.imageUrl,
      organization: organization ?? Prisma.DbNull,
    };

    const user = await this.prisma.user.upsert({
      where: { clerkId },
      create: { clerkId, ...data },
      update: data,
    });

    // Write-through: syncFromClerk always has the freshest value in hand
    // right here, so caching it now (rather than invalidating and relying on
    // a future read to repopulate) keeps any future read-through method
    // immediately consistent with this sync, with no stale-read window.
    await this.cache.set(
      buildCacheKey('user', clerkId),
      user,
      USER_CACHE_TTL_SECONDS,
    );

    this.logger.log(`Synced user ${clerkId} from Clerk`);
    return user;
  }

  /**
   * The caller's own org snapshot (id/name/slug/imageUrl), from the cached
   * User row's organization JSON field — the shared org-resolution lookup
   * used by both BillingService (entitlement checks) and ProductsService
   * (scoping new products to the caller's org).
   */
  async getOrganizationSnapshot(
    clerkId: string,
  ): Promise<ClerkOrganizationSummary | null> {
    const user = await this.cache.getOrSet(
      buildCacheKey('user', clerkId),
      () => this.prisma.user.findUnique({ where: { clerkId } }),
      USER_CACHE_TTL_SECONDS,
    );
    return (user?.organization as ClerkOrganizationSummary | null) ?? null;
  }
}
