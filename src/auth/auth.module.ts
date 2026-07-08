import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ClerkModule } from '../clerk/clerk.module';
import { ClerkAuthGuard } from './guards/clerk-auth/clerk-auth.guard';

@Module({
  imports: [ClerkModule],
  providers: [ClerkAuthGuard, { provide: APP_GUARD, useClass: ClerkAuthGuard }],
  exports: [ClerkAuthGuard],
})
export class AuthModule {}
