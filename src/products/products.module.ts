import { Module } from '@nestjs/common';
import { UsersModule } from '../users/users.module';
import { ProductsService } from './products.service';
import { ProductsController } from './products.controller';

@Module({
  // PrismaModule is @Global(), no import needed.
  imports: [UsersModule],
  controllers: [ProductsController],
  providers: [ProductsService],
})
export class ProductsModule {}
