import { Injectable, Logger } from '@nestjs/common';
import {
  createClerkClient,
  verifyToken,
  User as ClerkUser,
  BillingSubscription,
} from '@clerk/backend';
import { ClerkConfigService } from '../../config/clerk-config/clerk-config.service';

export interface ClerkOrganizationSummary {
  id: string;
  name: string;
  slug: string;
  imageUrl: string;
  // Index signature so this satisfies Prisma's InputJsonObject when stored
  // directly on User.organization (a Json? column).
  [key: string]: string;
}

@Injectable()
export class ClerkService {
  private readonly logger = new Logger(ClerkService.name);
  private clerkClient;

  private getErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }

    if (typeof error === 'string') {
      return error;
    }

    return 'Unknown error';
  }

  constructor(private clerkConfig: ClerkConfigService) {
    this.clerkClient = createClerkClient({
      secretKey: this.clerkConfig.secretKey,
    });
  }

  /**
   * Verify a session token from the frontend
   * Called by ClerkAuthGuard
   *
   * Uses verifyToken (JWT signature + claims check against Clerk's JWKS), not
   * clerkClient.sessions.verifySession — that endpoint is deprecated and now
   * returns 410 Gone for every call.
   */
  async verifySessionToken(token: string) {
    try {
      const payload = await verifyToken(token, {
        secretKey: this.clerkConfig.secretKey,
        authorizedParties: this.clerkConfig.authorizedParties,
      });

      return {
        userId: payload.sub,
        sessionId: payload.sid,
      };
    } catch (error) {
      this.logger.warn(
        `Session verification failed: ${this.getErrorMessage(error)}`,
      );
      return null;
    }
  }

  /**
   * Get user by ID
   */
  async getUserById(userId: string): Promise<ClerkUser | null> {
    try {
      return await this.clerkClient.users.getUser(userId);
    } catch (error) {
      this.logger.error(
        `Failed to fetch user ${userId}: ${this.getErrorMessage(error)}`,
      );
      return null;
    }
  }

  /**
   * The user's first organization membership, if any (most users belong to
   * at most one org today; extend to a list if multi-org support is needed).
   */
  async getUserPrimaryOrganization(
    userId: string,
  ): Promise<ClerkOrganizationSummary | null> {
    try {
      const memberships =
        await this.clerkClient.users.getOrganizationMembershipList({
          userId,
          limit: 1,
        });
      const organization = memberships.data[0]?.organization;
      if (!organization) {
        return null;
      }

      return {
        id: organization.id,
        name: organization.name,
        slug: organization.slug,
        imageUrl: organization.imageUrl,
      };
    } catch (error) {
      this.logger.error(
        `Failed to fetch organization for user ${userId}: ${this.getErrorMessage(error)}`,
      );
      return null;
    }
  }

  /**
   * The user's own (Solo/B2C) billing subscription, if any.
   * @experimental wraps @clerk/backend's billing API — public beta, subject to change.
   */
  async getUserBillingSubscription(
    userId: string,
  ): Promise<BillingSubscription | null> {
    try {
      return await this.clerkClient.billing.getUserBillingSubscription(userId);
    } catch (error) {
      this.logger.error(
        `Failed to fetch billing subscription for user ${userId}: ${this.getErrorMessage(error)}`,
      );
      return null;
    }
  }

  /**
   * An organization's (Org/B2B) billing subscription, if any.
   * @experimental wraps @clerk/backend's billing API — public beta, subject to change.
   */
  async getOrganizationBillingSubscription(
    organizationId: string,
  ): Promise<BillingSubscription | null> {
    try {
      return await this.clerkClient.billing.getOrganizationBillingSubscription(
        organizationId,
      );
    } catch (error) {
      this.logger.error(
        `Failed to fetch billing subscription for organization ${organizationId}: ${this.getErrorMessage(error)}`,
      );
      return null;
    }
  }

  /**
   * Get user by email
   */
  async getUserByEmail(email: string): Promise<ClerkUser | null> {
    try {
      const users = await this.clerkClient.users.getUserList({
        emailAddress: [email],
      });
      return users.data && users.data.length > 0 ? users.data[0] : null;
    } catch (error) {
      this.logger.error(
        `Failed to fetch user by email: ${this.getErrorMessage(error)}`,
      );
      return null;
    }
  }

  /**
   * Create a new user in Clerk
   */
  async createUser(email: string, firstName?: string, lastName?: string) {
    try {
      return await this.clerkClient.users.createUser({
        emailAddress: [email],
        firstName,
        lastName,
      });
    } catch (error) {
      this.logger.error(
        `Failed to create user: ${this.getErrorMessage(error)}`,
      );
      throw error;
    }
  }

  /**
   * Update user metadata
   */
  async updateUserMetadata(
    userId: string,
    publicMetadata: Record<string, any>,
  ) {
    try {
      return await this.clerkClient.users.updateUser(userId, {
        publicMetadata,
      });
    } catch (error) {
      this.logger.error(
        `Failed to update user metadata: ${this.getErrorMessage(error)}`,
      );
      throw error;
    }
  }

  /**
   * Delete a user from Clerk
   */
  async deleteUser(userId: string) {
    try {
      await this.clerkClient.users.deleteUser(userId);
      this.logger.log(`User ${userId} deleted`);
    } catch (error) {
      this.logger.error(
        `Failed to delete user: ${this.getErrorMessage(error)}`,
      );
      throw error;
    }
  }

  /**
   * Revoke all sessions for a user
   */
  async revokeAllSessions(userId: string) {
    try {
      const sessions = await this.clerkClient.sessions.getSessionList({
        userId,
      });

      await Promise.all(
        sessions.data.map((session) =>
          this.clerkClient.sessions.revokeSession(session.id),
        ),
      );

      this.logger.log(`All sessions revoked for user ${userId}`);
    } catch (error) {
      this.logger.error(
        `Failed to revoke sessions: ${this.getErrorMessage(error)}`,
      );
      throw error;
    }
  }
}
