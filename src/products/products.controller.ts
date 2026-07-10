import { Body, Controller, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ProductsService } from './products.service';
import { ClerkUserId } from '../auth/decorators/clerk-user.decorator';
import { CreateProductDto } from './dto/create-product.dto';
import { ProductResponseDto } from './dto/product-response.dto';
import { ApiStandardResponse } from '../common/decorators/api-standard-response.decorator';
import { WriteRateLimit } from '../rate-limit/decorators/rate-limit.decorators';

@ApiTags('Products')
@ApiBearerAuth('clerk-session')
@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Post()
  @WriteRateLimit()
  @ApiOperation({
    summary: "Add a product to the caller's organization",
    description:
      "Scoped to the caller's own organization (resolved from their Clerk " +
      'membership) — requires the caller to belong to an organization.',
  })
  @ApiStandardResponse(ProductResponseDto, { description: 'Product created' })
  create(@ClerkUserId() clerkId: string, @Body() dto: CreateProductDto) {
    return this.productsService.create(clerkId, dto);
  }
}
