import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from "@nestjs/common";
import { ZodError } from "zod";

type RequestLike = {
  header(name: string): string | undefined;
  requestId?: string;
};

type ResponseLike = {
  status(code: number): ResponseLike;
  json(body: unknown): void;
};

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<ResponseLike>();
    const request = ctx.getRequest<RequestLike>();
    const requestId = request.requestId ?? request.header("x-request-id") ?? "";

    if (exception instanceof ZodError) {
      response.status(HttpStatus.BAD_REQUEST).json({
        ok: false,
        error: "validation_error",
        requestId,
        issues: exception.flatten(),
      });
      return;
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const payload = exception.getResponse();
      response.status(status).json({
        ok: false,
        error: typeof payload === "string" ? payload : "http_error",
        requestId,
        details: typeof payload === "string" ? undefined : payload,
      });
      return;
    }

    const message = exception instanceof Error ? exception.message : "internal_server_error";
    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      ok: false,
      error: message,
      requestId,
    });
  }
}
