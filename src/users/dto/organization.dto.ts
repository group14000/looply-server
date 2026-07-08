import { ApiProperty } from '@nestjs/swagger';

export class OrganizationDto {
  @ApiProperty({ example: 'org_2abcXYZ123' })
  id: string;

  @ApiProperty({ example: 'Acme Inc' })
  name: string;

  @ApiProperty({ example: 'acme-inc' })
  slug: string;

  @ApiProperty({ example: 'https://img.clerk.com/...' })
  imageUrl: string;
}
