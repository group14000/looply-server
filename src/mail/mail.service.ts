import { Injectable, Logger } from '@nestjs/common';
import { MailerService } from '@nestjs-modules/mailer';

export interface FeedbackInvitePayload {
  to: string;
  customerName: string;
  companyName: string;
  productName: string;
  optionalMessage?: string | null;
  reviewUrl: string;
  expiresAt: Date;
}

@Injectable()
export class FeedbackMailService {
  private readonly logger = new Logger(FeedbackMailService.name);

  constructor(private readonly mailerService: MailerService) {}

  async sendFeedbackInvite(payload: FeedbackInvitePayload): Promise<void> {
    await this.mailerService.sendMail({
      to: payload.to,
      subject: `${payload.customerName}, your feedback is requested for ${payload.productName}`,
      template: 'feedback-review',
      context: {
        customerName: payload.customerName,
        companyName: payload.companyName,
        productName: payload.productName,
        optionalMessage: payload.optionalMessage ?? null,
        reviewUrl: payload.reviewUrl,
        expiresAt: payload.expiresAt.toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        }),
      },
    });
    this.logger.log(
      `Feedback invite sent to ${payload.to} for product "${payload.productName}"`,
    );
  }
}
