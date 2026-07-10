import { ApiProperty } from '@nestjs/swagger';

/**
 * Never includes reviewUrl — the token is stored hashed, so the plaintext
 * only ever exists at creation time and cannot be reconstructed here. If a
 * link needs to be re-sent later, that requires minting a new token (a
 * future "regenerate" action), not re-surfacing this one.
 */
export class FeedbackSubmissionDto {
  @ApiProperty({ nullable: true, type: Number })
  rating: number | null;

  @ApiProperty({ nullable: true, type: String })
  comment: string | null;

  @ApiProperty()
  submittedAt: Date;
}

export class FeedbackRequestDetailDto {
  @ApiProperty({ example: 'cljk3x9p10000qzrmn831i7rn' })
  id: string;

  @ApiProperty({ example: 'Jane Smith' })
  customerName: string;

  @ApiProperty({ example: 'Acme Corp' })
  companyName: string;

  @ApiProperty({ example: 'jane@acme.com' })
  email: string;

  @ApiProperty({ nullable: true, type: String })
  optionalMessage: string | null;

  @ApiProperty({ example: 'cljk3x9p10001qzrmn831i7rn' })
  productId: string;

  @ApiProperty({
    enum: ['PENDING', 'OPENED', 'COMPLETED', 'EXPIRED', 'CANCELLED'],
  })
  status: string;

  @ApiProperty({ nullable: true, type: Date })
  expiresAt: Date | null;

  @ApiProperty({ nullable: true, type: Date })
  openedAt: Date | null;

  @ApiProperty()
  openCount: number;

  @ApiProperty({ nullable: true, type: Date })
  cancelledAt: Date | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty({ type: FeedbackSubmissionDto, nullable: true })
  submission: FeedbackSubmissionDto | null;
}
