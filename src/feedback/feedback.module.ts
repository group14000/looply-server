import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ProductsModule } from '../products/products.module';
import { UsersModule } from '../users/users.module';
import { ClerkConfigService } from '../config/clerk-config/clerk-config.service';
import { FeedbackConfigService } from './feedback-config/feedback-config.service';
import { FeedbackService } from './feedback.service';
import { FeedbackController } from './feedback.controller';
import { FeedbackPublicController } from './feedback-public.controller';
import { PublicFeedbackTokenGuard } from './guards/public-feedback-token/public-feedback-token.guard';

@Module({
  // PrismaModule is @Global(), no import needed. ClerkConfigService only
  // depends on the globally-available ConfigService (see AGENTS.md — same
  // pattern ClerkModule uses instead of importing ConfigurationModule,
  // which isn't @Global() and only exports it to AppModule). FeedbackConfigService
  // follows the same shape (own provider, only needs the global ConfigService).
  imports: [ConfigModule, ProductsModule, UsersModule],
  controllers: [FeedbackController, FeedbackPublicController],
  providers: [
    FeedbackService,
    ClerkConfigService,
    FeedbackConfigService,
    PublicFeedbackTokenGuard,
  ],
})
export class FeedbackModule {}
