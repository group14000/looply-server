import { Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { ClerkUserId } from '../auth/decorators/clerk-user.decorator';
import { UserResponseDto } from './dto/user-response.dto';
import { ApiStandardResponse } from '../common/decorators/api-standard-response.decorator';
import { WriteRateLimit } from '../rate-limit/decorators/rate-limit.decorators';

@ApiTags('Users')
@ApiBearerAuth('clerk-session')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post('sync')
  @HttpCode(HttpStatus.OK)
  @WriteRateLimit()
  @ApiOperation({
    summary: "Sync the caller's own Clerk profile into the local database",
    description:
      "Fetches the authenticated user's profile from Clerk (using the identity in " +
      'the bearer token, never a client-supplied ID) and upserts it into the local ' +
      'users table.',
  })
  @ApiStandardResponse(UserResponseDto, { description: 'User synced' })
  sync(@ClerkUserId() clerkId: string) {
    return this.usersService.syncFromClerk(clerkId);
  }
}
