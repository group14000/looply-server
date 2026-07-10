import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ProductsService } from './products.service';
import { ClerkUserId } from '../auth/decorators/clerk-user.decorator';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
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

  @Get()
  @ApiOperation({ summary: "List the caller's organization's products" })
  @ApiStandardResponse(ProductResponseDto, {
    isArray: true,
    description: "Caller's organization products",
  })
  findAll(@ClerkUserId() clerkId: string) {
    return this.productsService.findAll(clerkId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single product by id' })
  @ApiStandardResponse(ProductResponseDto, { description: 'Product' })
  findOne(@ClerkUserId() clerkId: string, @Param('id') id: string) {
    return this.productsService.findOne(clerkId, id);
  }

  @Patch(':id')
  @WriteRateLimit()
  @ApiOperation({ summary: "Edit a product in the caller's organization" })
  @ApiStandardResponse(ProductResponseDto, { description: 'Product updated' })
  update(
    @ClerkUserId() clerkId: string,
    @Param('id') id: string,
    @Body() dto: UpdateProductDto,
  ) {
    return this.productsService.update(clerkId, id, dto);
  }

  @Delete(':id')
  @WriteRateLimit()
  @ApiOperation({ summary: "Delete a product from the caller's organization" })
  @ApiStandardResponse(ProductResponseDto, { description: 'Product deleted' })
  remove(@ClerkUserId() clerkId: string, @Param('id') id: string) {
    return this.productsService.remove(clerkId, id);
  }
}
