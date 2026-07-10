import { ForbiddenException } from '@nestjs/common';
import { ProductsService } from './products.service';
import { UsersService } from '../users/users.service';
import { PrismaService } from '../prisma/prisma.service';

describe('ProductsService', () => {
  let usersService: { getOrganizationSnapshot: jest.Mock };
  let prisma: {
    $transaction: jest.Mock;
    organization: { upsert: jest.Mock };
    product: { create: jest.Mock };
  };
  let service: ProductsService;

  beforeEach(() => {
    usersService = { getOrganizationSnapshot: jest.fn() };
    prisma = {
      organization: { upsert: jest.fn() },
      product: { create: jest.fn() },
      $transaction: jest.fn((fn) => fn(prisma)),
    };
    service = new ProductsService(
      prisma as unknown as PrismaService,
      usersService as unknown as UsersService,
    );
  });

  it('throws ForbiddenException when the caller has no organization', async () => {
    usersService.getOrganizationSnapshot.mockResolvedValue(null);

    await expect(service.create('user_1', { name: 'Widget' })).rejects.toThrow(
      ForbiddenException,
    );
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('auto-creates the Organization row and scopes the product to it', async () => {
    usersService.getOrganizationSnapshot.mockResolvedValue({
      id: 'org_abc',
      name: 'Acme',
      slug: 'acme',
      imageUrl: 'https://img',
    });
    prisma.organization.upsert.mockResolvedValue({ id: 'local_org_1' });
    prisma.product.create.mockResolvedValue({
      id: 'product_1',
      name: 'Widget',
      description: null,
      organizationId: 'local_org_1',
    });

    const result = await service.create('user_1', { name: 'Widget' });

    expect(prisma.organization.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { clerkOrgId: 'org_abc' },
        create: expect.objectContaining({ clerkOrgId: 'org_abc' }),
      }),
    );
    expect(prisma.product.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          name: 'Widget',
          organizationId: 'local_org_1',
        }),
      }),
    );
    expect(result.organizationId).toBe('local_org_1');
  });
});
