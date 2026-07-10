import { ExecutionContext, NotFoundException } from '@nestjs/common';
import { PublicFeedbackTokenGuard } from './public-feedback-token.guard';
import { PrismaService } from '../../../prisma/prisma.service';
import { FeedbackConfigService } from '../../feedback-config/feedback-config.service';
import { hashFeedbackToken } from '../../feedback-token.util';

function makeContext(params: Record<string, string>, req: any = {}) {
  const request = { params, ...req };
  return {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

describe('PublicFeedbackTokenGuard', () => {
  let prisma: { feedbackRequest: { findUnique: jest.Mock } };
  let feedbackConfig: { tokenPepper: string };
  let guard: PublicFeedbackTokenGuard;

  beforeEach(() => {
    prisma = { feedbackRequest: { findUnique: jest.fn() } };
    feedbackConfig = { tokenPepper: 'test-pepper' };
    guard = new PublicFeedbackTokenGuard(
      prisma as unknown as PrismaService,
      feedbackConfig as unknown as FeedbackConfigService,
    );
  });

  it('throws a generic NotFoundException when no token param is present', async () => {
    await expect(guard.canActivate(makeContext({}))).rejects.toThrow(
      NotFoundException,
    );
    expect(prisma.feedbackRequest.findUnique).not.toHaveBeenCalled();
  });

  it('throws a generic NotFoundException when the token resolves to no row (wrong guess)', async () => {
    prisma.feedbackRequest.findUnique.mockResolvedValue(null);

    await expect(
      guard.canActivate(makeContext({ token: 'wrong-guess' })),
    ).rejects.toThrow(NotFoundException);
  });

  it('looks up by the HMAC hash of the token, never the plaintext', async () => {
    prisma.feedbackRequest.findUnique.mockResolvedValue(null);
    const token = 'a-real-looking-token';

    await expect(guard.canActivate(makeContext({ token }))).rejects.toThrow(
      NotFoundException,
    );

    expect(prisma.feedbackRequest.findUnique).toHaveBeenCalledWith({
      where: { tokenHash: hashFeedbackToken(token, 'test-pepper') },
    });
  });

  it('attaches the resolved row to the request and returns true when found', async () => {
    const row = { id: 'fr_1', status: 'PENDING' };
    prisma.feedbackRequest.findUnique.mockResolvedValue(row);
    const request = { params: { token: 'valid-token' } };

    const context = {
      switchToHttp: () => ({ getRequest: () => request }),
    } as unknown as ExecutionContext;

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect((request as any).feedbackRequest).toBe(row);
  });
});
