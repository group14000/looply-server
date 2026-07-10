import {
  ConflictException,
  ForbiddenException,
  GoneException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ProductsService } from '../products/products.service';
import { UsersService } from '../users/users.service';
import { ClerkConfigService } from '../config/clerk-config/clerk-config.service';
import { FeedbackConfigService } from './feedback-config/feedback-config.service';
import { FeedbackRequest } from '../generated/prisma/client';
import { CreateFeedbackRequestDto } from './dto/create-feedback-request.dto';
import { UpdateFeedbackRequestDto } from './dto/update-feedback-request.dto';
import { ListFeedbackRequestsQueryDto } from './dto/list-feedback-requests-query.dto';
import { SubmitFeedbackDto } from './dto/submit-feedback.dto';
import { PublicFeedbackViewDto } from './dto/public-feedback-view.dto';
import {
  generateFeedbackToken,
  hashFeedbackToken,
} from './feedback-token.util';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function isExpired(feedbackRequest: FeedbackRequest): boolean {
  // Enforced live, never solely by a background sweep — a sweep is a
  // reporting/cleanup convenience only, never load-bearing for access control.
  return !!feedbackRequest.expiresAt && feedbackRequest.expiresAt < new Date();
}

@Injectable()
export class FeedbackService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly productsService: ProductsService,
    private readonly usersService: UsersService,
    private readonly clerkConfig: ClerkConfigService,
    private readonly feedbackConfig: FeedbackConfigService,
  ) {}

  /**
   * Ownership is verified by reusing ProductsService.findOne — it already
   * resolves the caller's org and 404s (never 403) if the product doesn't
   * exist or belongs to a different org, so this never re-derives that
   * check independently. Its return value's organizationId is reused
   * directly to denormalize the org onto FeedbackRequest too (same pattern
   * as Product), instead of a second org-resolution lookup.
   *
   * The raw token is generated here, hashed before storage (see
   * feedback-token.util.ts), and returned ONLY from this method — it is
   * never persisted in recoverable form and never appears in any other
   * response (list/detail omit reviewUrl entirely; see AGENTS.md).
   */
  async create(
    clerkId: string,
    dto: CreateFeedbackRequestDto,
  ): Promise<{ request: FeedbackRequest; token: string }> {
    const product = await this.productsService.findOne(clerkId, dto.productId);

    const token = generateFeedbackToken();
    const tokenHash = hashFeedbackToken(token, this.feedbackConfig.tokenPepper);
    const expiresAt = new Date(
      Date.now() + this.feedbackConfig.linkTtlDays * MS_PER_DAY,
    );

    const request = await this.prisma.feedbackRequest.create({
      data: {
        customerName: dto.customerName,
        companyName: dto.companyName,
        email: dto.email,
        optionalMessage: dto.optionalMessage ?? null,
        productId: dto.productId,
        organizationId: product.organizationId,
        tokenHash,
        expiresAt,
      },
    });

    return { request, token };
  }

  /** Computed, not stored — never drifts if FRONTEND_URL changes across environments. */
  buildReviewUrl(token: string): string {
    return `${this.clerkConfig.frontendUrl}/review/${token}`;
  }

  /**
   * Once a token has resolved to a row (PublicFeedbackTokenGuard already
   * confirmed that), its state IS safe to reveal — the requester has already
   * proven possession of the 256-bit secret. CANCELLED/expired both surface
   * as 410 Gone; a COMPLETED request returns 200 with canSubmit: false rather
   * than an error, so the frontend can render "already submitted."
   */
  async getPublicView(
    feedbackRequest: FeedbackRequest,
  ): Promise<PublicFeedbackViewDto> {
    if (feedbackRequest.status === 'CANCELLED' || isExpired(feedbackRequest)) {
      throw new GoneException();
    }

    const product = await this.prisma.product.findUnique({
      where: { id: feedbackRequest.productId },
      include: { organization: true },
    });

    if (feedbackRequest.status === 'PENDING') {
      await this.prisma.feedbackRequest.updateMany({
        where: { id: feedbackRequest.id, status: 'PENDING' },
        data: {
          status: 'OPENED',
          openedAt: new Date(),
          openCount: { increment: 1 },
        },
      });
    } else {
      await this.prisma.feedbackRequest.update({
        where: { id: feedbackRequest.id },
        data: { openCount: { increment: 1 } },
      });
    }

    return {
      productName: product?.name ?? '',
      organizationName: product?.organization?.name ?? null,
      companyName: feedbackRequest.companyName,
      customerName: feedbackRequest.customerName,
      optionalMessage: feedbackRequest.optionalMessage,
      status:
        feedbackRequest.status === 'PENDING'
          ? 'OPENED'
          : feedbackRequest.status,
      canSubmit: feedbackRequest.status !== 'COMPLETED',
    };
  }

  /**
   * Race-safe single-use submit: the conditional updateMany's WHERE clause is
   * the mutex (Postgres row-locks the single UPDATE statement), not a
   * read-then-write. Of two concurrent submits, exactly one gets count === 1.
   * The FeedbackSubmission's own @unique feedbackRequestId FK is a second,
   * DB-constraint-level idempotency backstop.
   */
  async submitPublic(
    feedbackRequest: FeedbackRequest,
    dto: SubmitFeedbackDto,
  ): Promise<void> {
    if (feedbackRequest.status === 'CANCELLED' || isExpired(feedbackRequest)) {
      throw new GoneException();
    }

    await this.prisma.$transaction(async (tx) => {
      const { count } = await tx.feedbackRequest.updateMany({
        where: {
          id: feedbackRequest.id,
          status: { in: ['PENDING', 'OPENED'] },
        },
        data: { status: 'COMPLETED' },
      });

      if (count === 0) {
        throw new ConflictException(
          'This feedback request was already submitted',
        );
      }

      await tx.feedbackSubmission.create({
        data: {
          feedbackRequestId: feedbackRequest.id,
          rating: dto.rating ?? null,
          comment: dto.comment ?? null,
        },
      });
    });
  }

  /**
   * Mirrors ProductsService's resolveCallerOrganizationId exactly (small
   * enough to duplicate rather than extract a shared org-resolver for two
   * call sites — see AGENTS.md). Null both when the caller has no org at all
   * and when the org has no local row yet; callers distinguish those two
   * cases themselves where it matters (see findAll).
   */
  private async resolveCallerOrganizationId(
    clerkId: string,
  ): Promise<string | null> {
    const snapshot = await this.usersService.getOrganizationSnapshot(clerkId);
    if (!snapshot) {
      return null;
    }
    const org = await this.prisma.organization.findUnique({
      where: { clerkOrgId: snapshot.id },
      select: { id: true },
    });
    return org?.id ?? null;
  }

  async findAll(
    clerkId: string,
    query: ListFeedbackRequestsQueryDto,
  ): Promise<FeedbackRequest[]> {
    const orgId = await this.resolveCallerOrganizationId(clerkId);
    if (orgId === null) {
      const snapshot = await this.usersService.getOrganizationSnapshot(clerkId);
      if (!snapshot) {
        throw new ForbiddenException(
          'You must belong to an organization to view feedback requests',
        );
      }
      return [];
    }
    return this.prisma.feedbackRequest.findMany({
      where: {
        organizationId: orgId,
        ...(query.status
          ? { status: query.status as FeedbackRequest['status'] }
          : {}),
        ...(query.productId ? { productId: query.productId } : {}),
      },
      include: { submission: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  /** 404s (never 403) for cross-tenant access — same convention as ProductsService.findOne. */
  async findOne(
    clerkId: string,
    id: string,
  ): Promise<
    FeedbackRequest & {
      submission: {
        rating: number | null;
        comment: string | null;
        submittedAt: Date;
      } | null;
    }
  > {
    const orgId = await this.resolveCallerOrganizationId(clerkId);
    const request = orgId
      ? await this.prisma.feedbackRequest.findUnique({
          where: { id },
          include: { submission: true },
        })
      : null;
    if (!request || request.organizationId !== orgId) {
      throw new NotFoundException(`Feedback request ${id} not found`);
    }
    return request;
  }

  async update(
    clerkId: string,
    id: string,
    dto: UpdateFeedbackRequestDto,
  ): Promise<FeedbackRequest> {
    const existing = await this.findOne(clerkId, id);

    if (dto.status === 'CANCELLED') {
      if (existing.status === 'COMPLETED') {
        throw new ConflictException(
          'Cannot cancel a feedback request that has already been submitted',
        );
      }
      if (existing.status === 'CANCELLED') {
        return existing;
      }
      return this.prisma.feedbackRequest.update({
        where: { id },
        data: { status: 'CANCELLED', cancelledAt: new Date() },
        include: { submission: true },
      });
    }

    const editsContent =
      dto.optionalMessage !== undefined || dto.expiresAt !== undefined;
    if (editsContent && existing.status !== 'PENDING') {
      throw new ConflictException(
        'This feedback request can no longer be edited',
      );
    }

    return this.prisma.feedbackRequest.update({
      where: { id },
      data: {
        ...(dto.optionalMessage !== undefined
          ? { optionalMessage: dto.optionalMessage }
          : {}),
        ...(dto.expiresAt !== undefined
          ? { expiresAt: new Date(dto.expiresAt) }
          : {}),
      },
      include: { submission: true },
    });
  }
}
