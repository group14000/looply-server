import {
  ConflictException,
  ForbiddenException,
  GoneException,
  NotFoundException,
} from '@nestjs/common';
import { FeedbackService } from './feedback.service';
import { ProductsService } from '../products/products.service';
import { UsersService } from '../users/users.service';
import { PrismaService } from '../prisma/prisma.service';
import { ClerkConfigService } from '../config/clerk-config/clerk-config.service';
import { FeedbackConfigService } from './feedback-config/feedback-config.service';

describe('FeedbackService', () => {
  let productsService: { findOne: jest.Mock };
  let usersService: { getOrganizationSnapshot: jest.Mock };
  let prisma: {
    feedbackRequest: {
      create: jest.Mock;
      findMany: jest.Mock;
      findUnique: jest.Mock;
      updateMany: jest.Mock;
      update: jest.Mock;
    };
    feedbackSubmission: { create: jest.Mock };
    organization: { findUnique: jest.Mock };
    product: { findUnique: jest.Mock };
    $transaction: jest.Mock;
  };
  let clerkConfig: { frontendUrl: string };
  let feedbackConfig: { tokenPepper: string; linkTtlDays: number };
  let service: FeedbackService;

  beforeEach(() => {
    productsService = { findOne: jest.fn() };
    usersService = { getOrganizationSnapshot: jest.fn() };
    prisma = {
      feedbackRequest: {
        create: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        updateMany: jest.fn(),
        update: jest.fn(),
      },
      feedbackSubmission: { create: jest.fn() },
      organization: { findUnique: jest.fn() },
      product: { findUnique: jest.fn() },
      $transaction: jest.fn((fn) => fn(prisma)),
    };
    clerkConfig = { frontendUrl: 'https://app.looply.ai' };
    feedbackConfig = { tokenPepper: 'test-pepper', linkTtlDays: 30 };
    service = new FeedbackService(
      prisma as unknown as PrismaService,
      productsService as unknown as ProductsService,
      usersService as unknown as UsersService,
      clerkConfig as unknown as ClerkConfigService,
      feedbackConfig as unknown as FeedbackConfigService,
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

    it('creates a feedback request, returning the raw token and storing only its hash', async () => {
      productsService.findOne.mockResolvedValue({
        id: 'product_1',
        organizationId: 'org_local_1',
      });
      prisma.feedbackRequest.create.mockImplementation(({ data }) =>
        Promise.resolve({ id: 'fr_1', ...data }),
      );

      const { request, token } = await service.create('user_1', {
        customerName: 'Jane',
        companyName: 'Acme',
        email: 'jane@acme.com',
        productId: 'product_1',
      });

      expect(productsService.findOne).toHaveBeenCalledWith(
        'user_1',
        'product_1',
      );
      expect(token).toMatch(/^[0-9a-f]{64}$/);
      // The stored row must never contain the raw token, only its hash.
      expect(request.tokenHash).toMatch(/^[0-9a-f]{64}$/);
      expect(request.tokenHash).not.toBe(token);
      expect(request).not.toHaveProperty('token');
      expect(request.productId).toBe('product_1');
      expect(request.organizationId).toBe('org_local_1');
      expect(request.expiresAt).toBeInstanceOf(Date);
      expect(request.expiresAt.getTime()).toBeGreaterThan(Date.now());
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
      expect(first.request.tokenHash).not.toBe(second.request.tokenHash);
    });
  });

  describe('buildReviewUrl', () => {
    it('composes frontendUrl + /review/ + token', () => {
      expect(service.buildReviewUrl('abc123')).toBe(
        'https://app.looply.ai/review/abc123',
      );
    });
  });

  describe('getPublicView', () => {
    const pending = {
      id: 'fr_1',
      status: 'PENDING',
      expiresAt: null,
      productId: 'product_1',
      companyName: 'Acme',
      customerName: 'Jane',
      optionalMessage: null,
    };

    it('never exposes id/organizationId/productId/email — strict allowlist only', async () => {
      prisma.product.findUnique.mockResolvedValue({
        name: 'Widget Pro',
        organization: { name: 'Aviara Labs' },
      });

      const view = await service.getPublicView(pending as any);

      expect(view).toEqual({
        productName: 'Widget Pro',
        organizationName: 'Aviara Labs',
        companyName: 'Acme',
        customerName: 'Jane',
        optionalMessage: null,
        status: 'OPENED',
        canSubmit: true,
      });
      expect(view).not.toHaveProperty('id');
      expect(view).not.toHaveProperty('organizationId');
      expect(view).not.toHaveProperty('productId');
      expect(view).not.toHaveProperty('email');
      expect(view).not.toHaveProperty('token');
    });

    it('transitions PENDING to OPENED on first view', async () => {
      prisma.product.findUnique.mockResolvedValue({
        name: 'Widget Pro',
        organization: { name: 'Aviara Labs' },
      });

      await service.getPublicView(pending as any);

      expect(prisma.feedbackRequest.updateMany).toHaveBeenCalledWith({
        where: { id: 'fr_1', status: 'PENDING' },
        data: expect.objectContaining({ status: 'OPENED' }),
      });
    });

    it('throws GoneException for a cancelled request', async () => {
      await expect(
        service.getPublicView({ ...pending, status: 'CANCELLED' } as any),
      ).rejects.toThrow(GoneException);
    });

    it('throws GoneException for an expired request regardless of stored status', async () => {
      await expect(
        service.getPublicView({
          ...pending,
          status: 'OPENED',
          expiresAt: new Date(Date.now() - 1000),
        } as any),
      ).rejects.toThrow(GoneException);
    });

    it('returns canSubmit: false for a completed request without erroring', async () => {
      prisma.product.findUnique.mockResolvedValue({
        name: 'Widget Pro',
        organization: { name: 'Aviara Labs' },
      });

      const view = await service.getPublicView({
        ...pending,
        status: 'COMPLETED',
      } as any);

      expect(view.canSubmit).toBe(false);
      expect(view.status).toBe('COMPLETED');
    });
  });

  describe('submitPublic', () => {
    const active = {
      id: 'fr_1',
      status: 'OPENED',
      expiresAt: null,
    };

    it('creates a submission when the conditional update wins the race', async () => {
      prisma.feedbackRequest.updateMany.mockResolvedValue({ count: 1 });

      await service.submitPublic(active as any, {
        rating: 5,
        comment: 'Great!',
      });

      expect(prisma.feedbackRequest.updateMany).toHaveBeenCalledWith({
        where: { id: 'fr_1', status: { in: ['PENDING', 'OPENED'] } },
        data: { status: 'COMPLETED' },
      });
      expect(prisma.feedbackSubmission.create).toHaveBeenCalledWith({
        data: { feedbackRequestId: 'fr_1', rating: 5, comment: 'Great!' },
      });
    });

    it('throws ConflictException when the conditional update affects zero rows (already submitted)', async () => {
      prisma.feedbackRequest.updateMany.mockResolvedValue({ count: 0 });

      await expect(service.submitPublic(active as any, {})).rejects.toThrow(
        ConflictException,
      );
      expect(prisma.feedbackSubmission.create).not.toHaveBeenCalled();
    });

    it('throws GoneException for an expired request without attempting the update', async () => {
      await expect(
        service.submitPublic(
          { ...active, expiresAt: new Date(Date.now() - 1000) } as any,
          {},
        ),
      ).rejects.toThrow(GoneException);
      expect(prisma.feedbackRequest.updateMany).not.toHaveBeenCalled();
    });
  });

  describe('findAll', () => {
    it('throws ForbiddenException when the caller has no organization at all', async () => {
      usersService.getOrganizationSnapshot.mockResolvedValue(null);

      await expect(service.findAll('user_1', {})).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('returns [] when the org exists in Clerk but has no local row yet', async () => {
      usersService.getOrganizationSnapshot.mockResolvedValue({ id: 'org_abc' });
      prisma.organization.findUnique.mockResolvedValue(null);

      await expect(service.findAll('user_1', {})).resolves.toEqual([]);
      expect(prisma.feedbackRequest.findMany).not.toHaveBeenCalled();
    });

    it("scopes the query to the caller's local organization id", async () => {
      usersService.getOrganizationSnapshot.mockResolvedValue({ id: 'org_abc' });
      prisma.organization.findUnique.mockResolvedValue({ id: 'local_org_1' });
      prisma.feedbackRequest.findMany.mockResolvedValue([{ id: 'fr_1' }]);

      await service.findAll('user_1', {});

      expect(prisma.feedbackRequest.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ organizationId: 'local_org_1' }),
        }),
      );
    });
  });

  describe('findOne', () => {
    it('throws NotFoundException for a request belonging to another org', async () => {
      usersService.getOrganizationSnapshot.mockResolvedValue({ id: 'org_abc' });
      prisma.organization.findUnique.mockResolvedValue({ id: 'local_org_1' });
      prisma.feedbackRequest.findUnique.mockResolvedValue({
        id: 'fr_1',
        organizationId: 'someone_elses_org',
      });

      await expect(service.findOne('user_1', 'fr_1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('update', () => {
    it('cancels a PENDING request', async () => {
      usersService.getOrganizationSnapshot.mockResolvedValue({ id: 'org_abc' });
      prisma.organization.findUnique.mockResolvedValue({ id: 'local_org_1' });
      prisma.feedbackRequest.findUnique.mockResolvedValue({
        id: 'fr_1',
        organizationId: 'local_org_1',
        status: 'PENDING',
      });
      prisma.feedbackRequest.update.mockResolvedValue({
        id: 'fr_1',
        status: 'CANCELLED',
      });

      const result = await service.update('user_1', 'fr_1', {
        status: 'CANCELLED',
      });

      expect(prisma.feedbackRequest.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'fr_1' },
          data: expect.objectContaining({ status: 'CANCELLED' }),
        }),
      );
      expect(result.status).toBe('CANCELLED');
    });

    it('rejects cancelling an already-completed request', async () => {
      usersService.getOrganizationSnapshot.mockResolvedValue({ id: 'org_abc' });
      prisma.organization.findUnique.mockResolvedValue({ id: 'local_org_1' });
      prisma.feedbackRequest.findUnique.mockResolvedValue({
        id: 'fr_1',
        organizationId: 'local_org_1',
        status: 'COMPLETED',
      });

      await expect(
        service.update('user_1', 'fr_1', { status: 'CANCELLED' }),
      ).rejects.toThrow(ConflictException);
    });

    it('rejects editing optionalMessage once the request is no longer PENDING', async () => {
      usersService.getOrganizationSnapshot.mockResolvedValue({ id: 'org_abc' });
      prisma.organization.findUnique.mockResolvedValue({ id: 'local_org_1' });
      prisma.feedbackRequest.findUnique.mockResolvedValue({
        id: 'fr_1',
        organizationId: 'local_org_1',
        status: 'OPENED',
      });

      await expect(
        service.update('user_1', 'fr_1', { optionalMessage: 'edited' }),
      ).rejects.toThrow(ConflictException);
    });
  });
});
