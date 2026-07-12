import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

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

  @ApiPropertyOptional({
    description:
      'Case-insensitive search across customerName/companyName/email',
  })
  @IsString()
  @IsOptional()
  @MaxLength(200)
  search?: string;

  @ApiPropertyOptional({
    description: "Opaque cursor from a previous response's nextCursor",
  })
  @IsString()
  @IsOptional()
  cursor?: string;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  limit?: number;
}
