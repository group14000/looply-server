import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ProductsModule } from '../products/products.module';
import { ClerkConfigService } from '../config/clerk-config/clerk-config.service';
import { FeedbackService } from './feedback.service';
import { FeedbackController } from './feedback.controller';

@Module({
  // PrismaModule is @Global(), no import needed. ClerkConfigService only
  // depends on the globally-available ConfigService (see AGENTS.md — same
  // pattern ClerkModule uses instead of importing ConfigurationModule,
  // which isn't @Global() and only exports it to AppModule).
  imports: [ConfigModule, ProductsModule],
  controllers: [FeedbackController],
  providers: [FeedbackService, ClerkConfigService],
})
export class FeedbackModule {}
