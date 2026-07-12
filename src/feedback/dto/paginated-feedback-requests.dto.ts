import { ApiProperty } from '@nestjs/swagger';
import { FeedbackRequestDetailDto } from './feedback-request-detail.dto';

export class PaginatedFeedbackRequestsDto {
  @ApiProperty({ type: [FeedbackRequestDetailDto] })
  items: FeedbackRequestDetailDto[];

  @ApiProperty({
    nullable: true,
    type: String,
    description:
      'Pass as `cursor` on the next request to get the next page; null when there are no more results',
  })
  nextCursor: string | null;

  @ApiProperty()
  hasMore: boolean;
}
