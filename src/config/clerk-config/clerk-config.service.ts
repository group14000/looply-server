import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class ClerkConfigService {
  constructor(private configService: ConfigService) {}

  get secretKey(): string {
    const key = this.configService.get<string>('CLERK_SECRET_KEY');
    if (!key) {
      throw new Error('CLERK_SECRET_KEY is not defined');
    }
    return key;
  }

  get webhookSecret(): string {
    const key = this.configService.get<string>('CLERK_WEBHOOK_SECRET');
    if (!key) {
      throw new Error('CLERK_WEBHOOK_SECRET is not defined');
    }
    return key;
  }

  get publishableKey(): string {
    const key = this.configService.get<string>('CLERK_PUBLISHABLE_KEY');
    if (!key) {
      throw new Error('CLERK_PUBLISHABLE_KEY is not defined');
    }
    return key;
  }

  get isDevelopment(): boolean {
    return this.configService.get('NODE_ENV') === 'development';
  }

  get port(): number {
    return parseInt(this.configService.get('PORT') || '5000', 10);
  }

  get frontendUrl(): string {
    return this.configService.get('FRONTEND_URL') || 'http://localhost:3000';
  }

  /**
   * Origins allowed to have issued a session token (checked against the JWT's
   * `azp` claim). Always includes the configured frontend and the app's own
   * origin; extend with CLERK_AUTHORIZED_PARTIES (comma-separated) for other
   * trusted origins — e.g. Clerk's hosted Account Portal
   * (`https://<instance>.accounts.dev`) when testing without a frontend.
   */
  get authorizedParties(): string[] {
    const extra = (
      this.configService.get<string>('CLERK_AUTHORIZED_PARTIES') || ''
    )
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean);

    return [this.frontendUrl, `http://localhost:${this.port}`, ...extra];
  }
}
