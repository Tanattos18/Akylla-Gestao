import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from "@nestjs/common";
import type { Request, Response } from "express";
import { captureServerError, type ErrorRequestContext } from "../../monitoring/sentry";

export type ServerErrorReporter = (exception: unknown, request: ErrorRequestContext) => void;

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  /** `reporter` substituível nos testes; padrão: Sentry (no-op sem DSN). */
  constructor(private readonly reporter: ServerErrorReporter = captureServerError) {}

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const exceptionCode =
      typeof exception === "object" && exception !== null
        ? (exception as { code?: unknown }).code
        : undefined;
    const isMulterSizeLimit = exceptionCode === "LIMIT_FILE_SIZE";

    const status = isMulterSizeLimit
      ? HttpStatus.PAYLOAD_TOO_LARGE
      : exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const detail = isMulterSizeLimit
      ? "Arquivo maior que 5 MB"
      : exception instanceof HttpException
        ? exception.getResponse()
        : "Erro interno não tratado";

    const payload =
      typeof detail === "string"
        ? { message: detail }
        : { ...(detail as Record<string, unknown>) };

    if (status >= 500) {
      this.logger.error(
        `${request.method} ${request.url} -> ${status}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
      this.reporter(exception, {
        method: request.method,
        url: request.url,
        auth: (request as Request & { auth?: ErrorRequestContext["auth"] }).auth,
      });
    }

    response.status(status).json({
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      ...payload,
    });
  }
}
