import { ApiProperty } from '@nestjs/swagger';

export class FeedbackSubmissionResponseDto {
  @ApiProperty({ example: true })
  received: boolean;
}
