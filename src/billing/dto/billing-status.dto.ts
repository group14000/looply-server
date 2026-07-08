import { ApiProperty } from '@nestjs/swagger';

export class BillingStatusDto {
  @ApiProperty({
    description:
      'Whether the caller has an active/grace-period Solo subscription',
  })
  isSoloEntitled: boolean;

  @ApiProperty({
    description:
      "Whether the caller's organization has an active/grace-period Growth subscription",
  })
  isOrgEntitled: boolean;

  @ApiProperty({ nullable: true, type: String })
  soloPlanId: string | null;

  @ApiProperty({ nullable: true, type: String })
  soloStatus: string | null;

  @ApiProperty({ nullable: true, type: String })
  orgPlanId: string | null;

  @ApiProperty({ nullable: true, type: String })
  orgStatus: string | null;
}
