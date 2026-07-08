import { ApiProperty } from '@nestjs/swagger';
import { OrganizationDto } from './organization.dto';

export class UserResponseDto {
  @ApiProperty({ example: 'cljk3x9p10000qzrmn831i7rn' })
  id: string;

  @ApiProperty({ example: 'user_2abcXYZ123' })
  clerkId: string;

  @ApiProperty({ example: 'jane@example.com', nullable: true })
  email: string | null;

  @ApiProperty({ example: 'Jane', nullable: true })
  firstName: string | null;

  @ApiProperty({ example: 'Doe', nullable: true })
  lastName: string | null;

  @ApiProperty({ example: 'https://img.clerk.com/...', nullable: true })
  imageUrl: string | null;

  @ApiProperty({
    type: OrganizationDto,
    nullable: true,
    description: "The caller's first Clerk organization membership, if any",
  })
  organization: OrganizationDto | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
