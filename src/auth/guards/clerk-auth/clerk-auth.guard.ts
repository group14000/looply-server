import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { ClerkService } from '../../../clerk/clerk/clerk.service';
import { IS_PUBLIC_KEY } from '../../decorators/public.decorator';

@Injectable()
export class ClerkAuthGuard implements CanActivate {
  private readonly logger = new Logger(ClerkAuthGuard.name);

  constructor(
    private clerkService: ClerkService,
    private reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const token = this.extractToken(request);

    if (!token) {
      this.logger.warn('No authentication token provided');
      throw new UnauthorizedException('No authentication token provided');
    }

    const session = await this.clerkService.verifySessionToken(token);
    if (!session) {
      this.logger.warn('Invalid or expired token');
      throw new UnauthorizedException('Invalid or expired token');
    }

    // Attach to request for use in controllers
    request['userId'] = session.userId;
    request['sessionId'] = session.sessionId;

    this.logger.debug(`User ${session.userId} authenticated`);
    return true;
  }

  private extractToken(request: Request): string | undefined {
    const authHeader = request.headers.authorization;
    if (!authHeader) {
      return undefined;
    }

    const [type, token] = authHeader.split(' ');
    if (type !== 'Bearer') {
      return undefined;
    }

    return token;
  }
}
