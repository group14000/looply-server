import { Injectable } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { ProductsService } from '../products/products.service';
import { ClerkConfigService } from '../config/clerk-config/clerk-config.service';
import { FeedbackRequest } from '../generated/prisma/client';
import { CreateFeedbackRequestDto } from './dto/create-feedback-request.dto';

@Injectable()
export class FeedbackService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly productsService: ProductsService,
    private readonly clerkConfig: ClerkConfigService,
  ) {}

  /**
   * Ownership is verified by reusing ProductsService.findOne — it already
   * resolves the caller's org and 404s (never 403) if the product doesn't
   * exist or belongs to a different org, so this never re-derives that
   * check independently. Its return value's organizationId is reused
   * directly to denormalize the org onto FeedbackRequest too (same pattern
   * as Product), instead of a second org-resolution lookup.
   */
  async create(
    clerkId: string,
    dto: CreateFeedbackRequestDto,
  ): Promise<FeedbackRequest> {
    const product = await this.productsService.findOne(clerkId, dto.productId);

    const token = randomBytes(32).toString('hex');

    return this.prisma.feedbackRequest.create({
      data: {
        customerName: dto.customerName,
        companyName: dto.companyName,
        email: dto.email,
        optionalMessage: dto.optionalMessage ?? null,
        productId: dto.productId,
        organizationId: product.organizationId,
        token,
      },
    });
  }

  /** Computed, not stored — never drifts if FRONTEND_URL changes across environments. */
  buildReviewUrl(token: string): string {
    return `${this.clerkConfig.frontendUrl}/review/${token}`;
  }
}
