import {
  ConflictException,
  Injectable,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { Product } from '../generated/prisma/client';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';

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

  /**
   * The local Organization row id for the caller, WITHOUT auto-creating it —
   * unlike create(), a read/edit/delete has nothing to do if the row doesn't
   * exist yet (no products could possibly belong to it). Returns null both
   * when the caller has no org at all and when the org has no local row yet;
   * callers distinguish those two cases themselves where it matters (see
   * findAll).
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

  async findAll(clerkId: string): Promise<Product[]> {
    const orgId = await this.resolveCallerOrganizationId(clerkId);
    if (orgId === null) {
      const snapshot = await this.usersService.getOrganizationSnapshot(clerkId);
      if (!snapshot) {
        throw new ForbiddenException(
          'You must belong to an organization to view products',
        );
      }
      // Org exists in Clerk, just no local row/products yet — not an error.
      return [];
    }
    return this.prisma.product.findMany({ where: { organizationId: orgId } });
  }

  /**
   * 404s (never 403) when the product exists but belongs to a different org —
   * from the caller's perspective those are indistinguishable, and a 403
   * would leak that something exists at that id for another tenant.
   */
  async findOne(clerkId: string, id: string): Promise<Product> {
    const orgId = await this.resolveCallerOrganizationId(clerkId);
    const product = orgId
      ? await this.prisma.product.findUnique({ where: { id } })
      : null;
    if (!product || product.organizationId !== orgId) {
      throw new NotFoundException(`Product ${id} not found`);
    }
    return product;
  }

  async update(
    clerkId: string,
    id: string,
    dto: UpdateProductDto,
  ): Promise<Product> {
    await this.findOne(clerkId, id);
    return this.prisma.product.update({ where: { id }, data: dto });
  }

  async remove(clerkId: string, id: string): Promise<Product> {
    await this.findOne(clerkId, id);
    const dependentCount = await this.prisma.feedbackRequest.count({
      where: { productId: id },
    });
    if (dependentCount > 0) {
      throw new ConflictException(
        `Cannot delete this product — it has ${dependentCount} associated feedback request(s). Cancel them first.`,
      );
    }
    return this.prisma.product.delete({ where: { id } });
  }
}
