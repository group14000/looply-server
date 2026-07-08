import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ApiErrorResponse } from '../interfaces/api-response.interface';

/**
 * Single place that turns any thrown error into the standard error envelope
 * and logs it. Replaces per-request logging interceptors — this always runs
 * last, after the error has propagated past everything else.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const statusCode =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const { message, error } = this.normalize(exception, statusCode);

    this.logger.error(
      `${request.method} ${request.url} -> ${statusCode}: ${Array.isArray(message) ? message.join(', ') : message}`,
      exception instanceof HttpException
        ? undefined
        : (exception as Error)?.stack,
    );

    const body: ApiErrorResponse = {
      success: false,
      statusCode,
      message,
      error,
      timestamp: new Date().toISOString(),
      path: request.url,
    };

    response.status(statusCode).json(body);
  }

  private normalize(
    exception: unknown,
    statusCode: number,
  ): { message: string | string[]; error: string } {
    if (exception instanceof HttpException) {
      const response = exception.getResponse();
      if (typeof response === 'string') {
        return { message: response, error: exception.name };
      }
      const body = response as { message?: string | string[]; error?: string };
      return {
        message: body.message ?? exception.message,
        error: body.error ?? exception.name,
      };
    }

    return statusCode === HttpStatus.INTERNAL_SERVER_ERROR
      ? { message: 'Internal server error', error: 'Internal Server Error' }
      : { message: 'Unexpected error', error: 'Error' };
  }
}
