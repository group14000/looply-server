import { Injectable, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { Product } from '../generated/prisma/client';
import { CreateProductDto } from './dto/create-product.dto';

@Injectable()
export class ProductsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly usersService: UsersService,
  ) {}

  /**
   * Scopes the new product to the caller's own organization (resolved from
   * their cached User.organization snapshot, the same lookup BillingService
   * uses for entitlement checks). The local Organization row is auto-created
   * on demand if this is the first org-scoped write for it — product
   * creation must never be blocked by whether a billing webhook has synced
   * this org yet.
   */
  async create(clerkId: string, dto: CreateProductDto): Promise<Product> {
    const orgSnapshot =
      await this.usersService.getOrganizationSnapshot(clerkId);
    if (!orgSnapshot) {
      throw new ForbiddenException(
        'You must belong to an organization to add products',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const org = await tx.organization.upsert({
        where: { clerkOrgId: orgSnapshot.id },
        create: {
          clerkOrgId: orgSnapshot.id,
          name: orgSnapshot.name,
          slug: orgSnapshot.slug,
          imageUrl: orgSnapshot.imageUrl,
        },
        // Auto-create only — doesn't overwrite billing fields or refresh
        // display data on every product add (reconcileOrgBilling owns that).
        update: {},
      });

      return tx.product.create({
        data: {
          name: dto.name,
          description: dto.description ?? null,
          organizationId: org.id,
        },
      });
    });
  }
}
