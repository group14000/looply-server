import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class UpdateFeedbackRequestDto {
  @ApiPropertyOptional({
    description: 'Only editable while the request is still PENDING',
  })
  @IsString()
  @IsOptional()
  @MaxLength(1000)
  optionalMessage?: string;

  @ApiPropertyOptional({
    description: 'Only editable while the request is still PENDING',
  })
  @IsDateString()
  @IsOptional()
  expiresAt?: string;

  @ApiPropertyOptional({
    enum: ['CANCELLED'],
    description: "Set to 'CANCELLED' to revoke an outstanding request",
  })
  @IsIn(['CANCELLED'])
  @IsOptional()
  status?: 'CANCELLED';
}
