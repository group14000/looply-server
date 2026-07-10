import {
  Injectable,
  CanActivate,
  ExecutionContext,
  NotFoundException,
} from '@nestjs/common';
import { Request } from 'express';
import { PrismaService } from '../../../prisma/prisma.service';
import { FeedbackConfigService } from '../../feedback-config/feedback-config.service';
import { hashFeedbackToken } from '../../feedback-token.util';

/**
 * Mirrors ClerkAuthGuard's shape — resolves the caller's identity and
 * attaches it to the request — but keyed on a path-param capability token
 * instead of a session header. A token that doesn't resolve to any row
 * throws a byte-identical, message-less NotFoundException whether it's a
 * typo, a wrong guess, or never existed — enumeration must stay opaque.
 * Once a token DOES resolve, the resolved row's state (expired/cancelled/
 * completed) is safe to reveal downstream, since the requester has already
 * proven possession of the 256-bit secret (see AGENTS.md).
 */
@Injectable()
export class PublicFeedbackTokenGuard implements CanActivate {
  constructor(
    private readonly prisma: PrismaService,
    private readonly feedbackConfig: FeedbackConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const token = request.params.token;

    if (!token || typeof token !== 'string') {
      throw new NotFoundException();
    }

    const tokenHash = hashFeedbackToken(token, this.feedbackConfig.tokenPepper);
    const feedbackRequest = await this.prisma.feedbackRequest.findUnique({
      where: { tokenHash },
    });

    if (!feedbackRequest) {
      throw new NotFoundException();
    }

    request['feedbackRequest'] = feedbackRequest;
    return true;
  }
}
