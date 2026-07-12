import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { FeedbackService } from './feedback.service';
import { ClerkUserId } from '../auth/decorators/clerk-user.decorator';
import { CreateFeedbackRequestDto } from './dto/create-feedback-request.dto';
import { UpdateFeedbackRequestDto } from './dto/update-feedback-request.dto';
import { ListFeedbackRequestsQueryDto } from './dto/list-feedback-requests-query.dto';
import { FeedbackRequestResponseDto } from './dto/feedback-request-response.dto';
import { FeedbackRequestDetailDto } from './dto/feedback-request-detail.dto';
import { PaginatedFeedbackRequestsDto } from './dto/paginated-feedback-requests.dto';
import { ApiStandardResponse } from '../common/decorators/api-standard-response.decorator';
import { WriteRateLimit } from '../rate-limit/decorators/rate-limit.decorators';

type FeedbackRequestWithSubmission = {
  id: string;
  customerName: string;
  companyName: string;
  email: string;
  optionalMessage: string | null;
  productId: string;
  status: string;
  expiresAt: Date | null;
  openedAt: Date | null;
  openCount: number;
  cancelledAt: Date | null;
  createdAt: Date;
  submission: {
    rating: number | null;
    comment: string | null;
    submittedAt: Date;
  } | null;
};

/**
 * Never return the raw Prisma row here — it carries tokenHash/organizationId,
 * neither of which belongs in this response even though the caller is the
 * authenticated owner (tokenHash is an internal security artifact, and
 * organizationId is redundant/internal). This is the one, deliberate mapping
 * boundary between the service's Prisma-shaped return and the API's DTO.
 */
function toDetailDto(
  request: FeedbackRequestWithSubmission,
): FeedbackRequestDetailDto {
  return {
    id: request.id,
    customerName: request.customerName,
    companyName: request.companyName,
    email: request.email,
    optionalMessage: request.optionalMessage,
    productId: request.productId,
    status: request.status,
    expiresAt: request.expiresAt,
    openedAt: request.openedAt,
    openCount: request.openCount,
    cancelledAt: request.cancelledAt,
    createdAt: request.createdAt,
    submission: request.submission
      ? {
          rating: request.submission.rating,
          comment: request.submission.comment,
          submittedAt: request.submission.submittedAt,
        }
      : null,
  };
}

@ApiTags('Feedback')
@ApiBearerAuth('clerk-session')
@Controller('feedback/requests')
export class FeedbackController {
  constructor(private readonly feedbackService: FeedbackService) {}

  @Post()
  @WriteRateLimit()
  @ApiOperation({
    summary: "Generate a feedback review link for one of the caller's products",
    description:
      "productId must belong to the caller's own organization (resolved from " +
      'their Clerk membership) — a product owned by another org, or an invalid ' +
      'id, returns 404.',
  })
  @ApiStandardResponse(FeedbackRequestResponseDto, {
    description: 'Feedback request created',
  })
  async create(
    @ClerkUserId() clerkId: string,
    @Body() dto: CreateFeedbackRequestDto,
  ): Promise<FeedbackRequestResponseDto> {
    const { request, token } = await this.feedbackService.create(clerkId, dto);
    return {
      id: request.id,
      customerName: request.customerName,
      companyName: request.companyName,
      email: request.email,
      productId: request.productId,
      status: request.status,
      reviewUrl: this.feedbackService.buildReviewUrl(token),
      createdAt: request.createdAt,
    };
  }

  @Get()
  @ApiOperation({
    summary: "List/search the caller's organization's feedback requests",
    description:
      "Cursor-paginated (see AGENTS.md) — pass the previous response's " +
      '`nextCursor` back as `cursor` to fetch the next page. `search` matches ' +
      'case-insensitively across customerName/companyName/email.',
  })
  @ApiStandardResponse(PaginatedFeedbackRequestsDto, {
    description: "Caller's organization feedback requests",
  })
  async findAll(
    @ClerkUserId() clerkId: string,
    @Query() query: ListFeedbackRequestsQueryDto,
  ): Promise<PaginatedFeedbackRequestsDto> {
    const { items, nextCursor, hasMore } = await this.feedbackService.findAll(
      clerkId,
      query,
    );
    return {
      items: (items as unknown as FeedbackRequestWithSubmission[]).map(
        toDetailDto,
      ),
      nextCursor,
      hasMore,
    };
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get a single feedback request, including its submission if any',
  })
  @ApiStandardResponse(FeedbackRequestDetailDto, {
    description: 'Feedback request',
  })
  async findOne(
    @ClerkUserId() clerkId: string,
    @Param('id') id: string,
  ): Promise<FeedbackRequestDetailDto> {
    const request = await this.feedbackService.findOne(clerkId, id);
    return toDetailDto(request as unknown as FeedbackRequestWithSubmission);
  }

  @Patch(':id')
  @WriteRateLimit()
  @ApiOperation({
    summary:
      'Cancel a feedback request, or edit its message/expiry while still pending',
    description:
      'Set status to CANCELLED to revoke an outstanding link — rejected with ' +
      '409 if the customer already submitted. optionalMessage/expiresAt are ' +
      'only editable while the request is still PENDING.',
  })
  @ApiStandardResponse(FeedbackRequestDetailDto, {
    description: 'Feedback request updated',
  })
  async update(
    @ClerkUserId() clerkId: string,
    @Param('id') id: string,
    @Body() dto: UpdateFeedbackRequestDto,
  ): Promise<FeedbackRequestDetailDto> {
    const request = await this.feedbackService.update(clerkId, id, dto);
    return toDetailDto(request as unknown as FeedbackRequestWithSubmission);
  }
}
