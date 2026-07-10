import { ApiProperty } from '@nestjs/swagger';

export class ProductResponseDto {
  @ApiProperty({ example: 'cljk3x9p10000qzrmn831i7rn' })
  id: string;

  @ApiProperty({ example: 'Widget Pro' })
  name: string;

  @ApiProperty({
    example: 'A premium widget for professionals',
    nullable: true,
  })
  description: string | null;

  @ApiProperty({ example: 'cljk3x9p10001qzrmn831i7rn' })
  organizationId: string;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
