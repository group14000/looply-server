import { NotFoundException } from '@nestjs/common';
import { FeedbackService } from './feedback.service';
import { ProductsService } from '../products/products.service';
import { PrismaService } from '../prisma/prisma.service';
import { ClerkConfigService } from '../config/clerk-config/clerk-config.service';

describe('FeedbackService', () => {
  let productsService: { findOne: jest.Mock };
  let prisma: { feedbackRequest: { create: jest.Mock } };
  let clerkConfig: { frontendUrl: string };
  let service: FeedbackService;

  beforeEach(() => {
    productsService = { findOne: jest.fn() };
    prisma = { feedbackRequest: { create: jest.fn() } };
    clerkConfig = { frontendUrl: 'https://app.looply.ai' };
    service = new FeedbackService(
      prisma as unknown as PrismaService,
      productsService as unknown as ProductsService,
      clerkConfig as unknown as ClerkConfigService,
    );
  });

  describe('create', () => {
    it('propagates NotFoundException when the product is missing or not owned', async () => {
      productsService.findOne.mockRejectedValue(
        new NotFoundException('Product x not found'),
      );

      await expect(
        service.create('user_1', {
          customerName: 'Jane',
          companyName: 'Acme',
          email: 'jane@acme.com',
          productId: 'someone_elses_product',
        }),
      ).rejects.toThrow(NotFoundException);
      expect(prisma.feedbackRequest.create).not.toHaveBeenCalled();
    });

    it('creates a feedback request with a unique token after verifying ownership', async () => {
      productsService.findOne.mockResolvedValue({
        id: 'product_1',
        organizationId: 'org_local_1',
      });
      prisma.feedbackRequest.create.mockImplementation(({ data }) =>
        Promise.resolve({ id: 'fr_1', ...data }),
      );

      const result = await service.create('user_1', {
        customerName: 'Jane',
        companyName: 'Acme',
        email: 'jane@acme.com',
        productId: 'product_1',
      });

      expect(productsService.findOne).toHaveBeenCalledWith(
        'user_1',
        'product_1',
      );
      expect(result.token).toMatch(/^[0-9a-f]{64}$/);
      expect(result.productId).toBe('product_1');
      expect(result.organizationId).toBe('org_local_1');
    });

    it('runs two creates with different tokens (not derived from a sequential id)', async () => {
      productsService.findOne.mockResolvedValue({ id: 'product_1' });
      prisma.feedbackRequest.create.mockImplementation(({ data }) =>
        Promise.resolve({ id: 'fr_x', ...data }),
      );

      const dto = {
        customerName: 'Jane',
        companyName: 'Acme',
        email: 'jane@acme.com',
        productId: 'product_1',
      };
      const first = await service.create('user_1', dto);
      const second = await service.create('user_1', dto);

      expect(first.token).not.toBe(second.token);
    });
  });

  describe('buildReviewUrl', () => {
    it('composes frontendUrl + /review/ + token', () => {
      expect(service.buildReviewUrl('abc123')).toBe(
        'https://app.looply.ai/review/abc123',
      );
    });
  });
});
