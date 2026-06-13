var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
import { Catch, HttpException, HttpStatus, } from "@nestjs/common";
import { ZodError } from "zod";
let AllExceptionsFilter = class AllExceptionsFilter {
    catch(exception, host) {
        const ctx = host.switchToHttp();
        const response = ctx.getResponse();
        const request = ctx.getRequest();
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
};
AllExceptionsFilter = __decorate([
    Catch()
], AllExceptionsFilter);
export { AllExceptionsFilter };
