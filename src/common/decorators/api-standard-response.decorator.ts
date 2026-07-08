import { applyDecorators, Type } from '@nestjs/common';
import {
  ApiExtraModels,
  ApiOkResponse,
  ApiResponse,
  ApiUnauthorizedResponse,
  getSchemaPath,
} from '@nestjs/swagger';
import { ApiErrorResponseDto } from '../dto/api-response.dto';

const PRIMITIVES = new Map<unknown, string>([
  [String, 'string'],
  [Number, 'number'],
  [Boolean, 'boolean'],
]);

/**
 * Documents a route's response as the real envelope shape (see
 * TransformInterceptor) instead of the bare DTO — `data` holds `model`,
 * wrapped in { success, statusCode, data, timestamp, path }. Every route also
 * gets a 401 documented since ClerkAuthGuard is global, and a 429 documented
 * since AppThrottlerGuard is global too.
 */
export const ApiStandardResponse = <TModel extends Type<unknown>>(
  model: TModel,
  options?: { description?: string; isArray?: boolean },
) => {
  const primitive = PRIMITIVES.get(model);
  const dataSchema = primitive
    ? { type: primitive }
    : { $ref: getSchemaPath(model) };

  return applyDecorators(
    ApiExtraModels(
      ...(primitive ? [ApiErrorResponseDto] : [model, ApiErrorResponseDto]),
    ),
    ApiOkResponse({
      description: options?.description,
      schema: {
        properties: {
          success: { type: 'boolean', example: true },
          statusCode: { type: 'number', example: 200 },
          data: options?.isArray
            ? { type: 'array', items: dataSchema }
            : dataSchema,
          timestamp: { type: 'string', format: 'date-time' },
          path: { type: 'string' },
        },
      },
    }),
    ApiUnauthorizedResponse({ type: ApiErrorResponseDto }),
    ApiResponse({
      status: 429,
      description: 'Too many requests — rate limit exceeded.',
      type: ApiErrorResponseDto,
      headers: {
        'Retry-After': {
          description: 'Seconds until the rate limit resets.',
          schema: { type: 'integer' },
        },
      },
    }),
  );
};
