import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString } from 'class-validator';

export class ListFeedbackRequestsQueryDto {
  @ApiPropertyOptional({
    enum: ['PENDING', 'OPENED', 'COMPLETED', 'EXPIRED', 'CANCELLED'],
  })
  @IsIn(['PENDING', 'OPENED', 'COMPLETED', 'EXPIRED', 'CANCELLED'])
  @IsOptional()
  status?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  productId?: string;
}
