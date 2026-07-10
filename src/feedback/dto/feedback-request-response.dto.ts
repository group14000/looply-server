import { ApiProperty } from '@nestjs/swagger';

export class FeedbackRequestResponseDto {
  @ApiProperty({ example: 'cljk3x9p10000qzrmn831i7rn' })
  id: string;

  @ApiProperty({ example: 'Jane Smith' })
  customerName: string;

  @ApiProperty({ example: 'Acme Corp' })
  companyName: string;

  @ApiProperty({ example: 'jane@acme.com' })
  email: string;

  @ApiProperty({ example: 'cljk3x9p10001qzrmn831i7rn' })
  productId: string;

  @ApiProperty({ enum: ['PENDING', 'OPENED', 'COMPLETED', 'EXPIRED'] })
  status: string;

  @ApiProperty({ example: 'https://app.looply.ai/review/9f2a...64chars' })
  reviewUrl: string;

  @ApiProperty()
  createdAt: Date;
}
