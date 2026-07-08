import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ClerkService } from './clerk/clerk.service';
import { ClerkConfigService } from '../config/clerk-config/clerk-config.service';

@Module({
  imports: [ConfigModule],
  providers: [ClerkService, ClerkConfigService],
  exports: [ClerkService],
})
export class ClerkModule {}
