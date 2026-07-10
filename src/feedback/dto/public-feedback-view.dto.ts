import { ApiProperty } from '@nestjs/swagger';

/**
 * Strict allowlist for the public/anonymous surface — NEVER add id,
 * organizationId, productId, token/tokenHash, or the stored recipient email
 * to this DTO. See AGENTS.md's public-feedback-link section for why.
 */
export class PublicFeedbackViewDto {
  @ApiProperty({ example: 'Widget Pro' })
  productName: string;

  @ApiProperty({ example: 'Aviara Labs', nullable: true, type: String })
  organizationName: string | null;

  @ApiProperty({ example: 'Acme Corp' })
  companyName: string;

  @ApiProperty({ example: 'Jane Smith' })
  customerName: string;

  @ApiProperty({
    example: 'Please share your honest feedback!',
    nullable: true,
    type: String,
  })
  optionalMessage: string | null;

  @ApiProperty({ enum: ['PENDING', 'OPENED', 'COMPLETED'] })
  status: string;

  @ApiProperty({
    description:
      'Whether the submit endpoint will currently accept a submission',
  })
  canSubmit: boolean;
}
