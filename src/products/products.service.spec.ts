import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { ProductsService } from './products.service';
import { UsersService } from '../users/users.service';
import { PrismaService } from '../prisma/prisma.service';

describe('ProductsService', () => {
  let usersService: { getOrganizationSnapshot: jest.Mock };
  let prisma: {
    $transaction: jest.Mock;
    organization: { upsert: jest.Mock; findUnique: jest.Mock };
    product: {
      create: jest.Mock;
      findMany: jest.Mock;
      findUnique: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
    };
  };
  let service: ProductsService;

  beforeEach(() => {
    usersService = { getOrganizationSnapshot: jest.fn() };
    prisma = {
      organization: { upsert: jest.fn(), findUnique: jest.fn() },
      product: {
        create: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
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

  describe('findAll', () => {
    it('throws ForbiddenException when the caller has no organization at all', async () => {
      usersService.getOrganizationSnapshot.mockResolvedValue(null);

      await expect(service.findAll('user_1')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('returns [] when the org exists in Clerk but has no local row yet', async () => {
      usersService.getOrganizationSnapshot.mockResolvedValue({ id: 'org_abc' });
      prisma.organization.findUnique.mockResolvedValue(null);

      await expect(service.findAll('user_1')).resolves.toEqual([]);
      expect(prisma.product.findMany).not.toHaveBeenCalled();
    });

    it("returns only the caller's org products", async () => {
      usersService.getOrganizationSnapshot.mockResolvedValue({ id: 'org_abc' });
      prisma.organization.findUnique.mockResolvedValue({ id: 'local_org_1' });
      prisma.product.findMany.mockResolvedValue([{ id: 'product_1' }]);

      const result = await service.findAll('user_1');

      expect(prisma.product.findMany).toHaveBeenCalledWith({
        where: { organizationId: 'local_org_1' },
      });
      expect(result).toEqual([{ id: 'product_1' }]);
    });
  });

  describe('findOne', () => {
    it('throws NotFoundException for a product belonging to another org', async () => {
      usersService.getOrganizationSnapshot.mockResolvedValue({ id: 'org_abc' });
      prisma.organization.findUnique.mockResolvedValue({ id: 'local_org_1' });
      prisma.product.findUnique.mockResolvedValue({
        id: 'product_1',
        organizationId: 'someone_elses_org',
      });

      await expect(service.findOne('user_1', 'product_1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws NotFoundException for a nonexistent product', async () => {
      usersService.getOrganizationSnapshot.mockResolvedValue({ id: 'org_abc' });
      prisma.organization.findUnique.mockResolvedValue({ id: 'local_org_1' });
      prisma.product.findUnique.mockResolvedValue(null);

      await expect(service.findOne('user_1', 'nope')).rejects.toThrow(
        NotFoundException,
      );
    });

    it("returns the product when it belongs to the caller's org", async () => {
      usersService.getOrganizationSnapshot.mockResolvedValue({ id: 'org_abc' });
      prisma.organization.findUnique.mockResolvedValue({ id: 'local_org_1' });
      prisma.product.findUnique.mockResolvedValue({
        id: 'product_1',
        organizationId: 'local_org_1',
      });

      await expect(service.findOne('user_1', 'product_1')).resolves.toEqual({
        id: 'product_1',
        organizationId: 'local_org_1',
      });
    });
  });

  describe('update', () => {
    it('throws NotFoundException before updating a product from another org', async () => {
      usersService.getOrganizationSnapshot.mockResolvedValue({ id: 'org_abc' });
      prisma.organization.findUnique.mockResolvedValue({ id: 'local_org_1' });
      prisma.product.findUnique.mockResolvedValue({
        id: 'product_1',
        organizationId: 'someone_elses_org',
      });

      await expect(
        service.update('user_1', 'product_1', { description: 'x' }),
      ).rejects.toThrow(NotFoundException);
      expect(prisma.product.update).not.toHaveBeenCalled();
    });

    it("updates a product belonging to the caller's org", async () => {
      usersService.getOrganizationSnapshot.mockResolvedValue({ id: 'org_abc' });
      prisma.organization.findUnique.mockResolvedValue({ id: 'local_org_1' });
      prisma.product.findUnique.mockResolvedValue({
        id: 'product_1',
        organizationId: 'local_org_1',
      });
      prisma.product.update.mockResolvedValue({
        id: 'product_1',
        description: 'updated',
      });

      const result = await service.update('user_1', 'product_1', {
        description: 'updated',
      });

      expect(prisma.product.update).toHaveBeenCalledWith({
        where: { id: 'product_1' },
        data: { description: 'updated' },
      });
      expect(result.description).toBe('updated');
    });
  });

  describe('remove', () => {
    it('throws NotFoundException before deleting a product from another org', async () => {
      usersService.getOrganizationSnapshot.mockResolvedValue({ id: 'org_abc' });
      prisma.organization.findUnique.mockResolvedValue({ id: 'local_org_1' });
      prisma.product.findUnique.mockResolvedValue({
        id: 'product_1',
        organizationId: 'someone_elses_org',
      });

      await expect(service.remove('user_1', 'product_1')).rejects.toThrow(
        NotFoundException,
      );
      expect(prisma.product.delete).not.toHaveBeenCalled();
    });

    it("deletes a product belonging to the caller's org", async () => {
      usersService.getOrganizationSnapshot.mockResolvedValue({ id: 'org_abc' });
      prisma.organization.findUnique.mockResolvedValue({ id: 'local_org_1' });
      prisma.product.findUnique.mockResolvedValue({
        id: 'product_1',
        organizationId: 'local_org_1',
      });
      prisma.product.delete.mockResolvedValue({ id: 'product_1' });

      await expect(service.remove('user_1', 'product_1')).resolves.toEqual({
        id: 'product_1',
      });
      expect(prisma.product.delete).toHaveBeenCalledWith({
        where: { id: 'product_1' },
      });
    });
  });
});
