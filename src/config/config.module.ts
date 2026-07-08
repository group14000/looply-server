import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ClerkConfigService } from './clerk-config/clerk-config.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
    }),
  ],
  providers: [ClerkConfigService],
  exports: [ClerkConfigService],
})
export class ConfigurationModule {}
