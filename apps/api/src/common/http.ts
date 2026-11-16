import {
  ArgumentsHost,
  CallHandler,
  Catch,
  ExceptionFilter,
  ExecutionContext,
  HttpException,
  Injectable,
  Logger,
  NestInterceptor,
  PipeTransform,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { Observable, map, tap } from 'rxjs';
import { ZodError, ZodSchema } from 'zod';
import { AppError } from './app-error';

/** Validates a request body/param with a zod schema. Unknown keys are stripped. */
export class ZodPipe<T> implements PipeTransform {
  constructor(private readonly schema: ZodSchema<T>) {}
  transform(value: unknown): T {
    const r = this.schema.safeParse(value ?? {});
    if (!r.success) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Ma’lumotlar noto‘g‘ri kiritilgan', {
        fields: r.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
      });
    }
    return r.data;
  }
}

/** Wraps successful responses: { success:true, data }. */
@Injectable()
export class ResponseInterceptor implements NestInterceptor {
  intercept(_ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(map((data) => ({ success: true, data: data ?? null })));
  }
}

/** Logs method, route and timing only. Never bodies, headers, cookies or query strings (they can hold secrets). */
@Injectable()
export class AccessLogInterceptor implements NestInterceptor {
  private readonly log = new Logger('http');
  intercept(ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = ctx.switchToHttp().getRequest<Request>();
    const res = ctx.switchToHttp().getResponse<Response>();
    const started = Date.now();
    const path = (req.originalUrl || req.url).split('?')[0];
    return next.handle().pipe(tap({ next: () => this.log.log(`${req.method} ${path} ${res.statusCode} ${Date.now() - started}ms`) }));
  }
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly log = new Logger('errors');

  catch(exception: unknown, host: ArgumentsHost): void {
    const res = host.switchToHttp().getResponse<Response>();
    const req = host.switchToHttp().getRequest<Request>();
    const path = (req.originalUrl || req.url).split('?')[0];

    let status = 500;
    let code = 'INTERNAL_ERROR';
    let message = 'Ichki xatolik. Keyinroq qayta urinib ko‘ring.';
    let details: Record<string, unknown> | undefined;

    if (exception instanceof AppError) {
      status = exception.getStatus();
      code = exception.code;
      message = (exception.getResponse() as { message: string }).message;
      details = exception.details;
    } else if (exception instanceof ZodError) {
      status = 400;
      code = 'VALIDATION_ERROR';
      message = 'Ma’lumotlar noto‘g‘ri kiritilgan';
    } else if (exception instanceof HttpException) {
      status = exception.getStatus();
      code = status === 429 ? 'RATE_LIMITED' : status === 404 ? 'NOT_FOUND' : status === 401 ? 'UNAUTHORIZED' : status === 403 ? 'FORBIDDEN' : `HTTP_${status}`;
      message = status === 429 ? 'Juda ko‘p so‘rov. Birozdan keyin urinib ko‘ring.' : exception.message;
    }

    if (status >= 500) {
      // Log the error name and stack for debugging, never request data.
      const e = exception as Error;
      this.log.error(`${req.method} ${path} -> ${status} ${code}: ${e?.name ?? 'Error'}: ${e?.message ?? ''}`, e?.stack);
    }
    res.status(status).json({ success: false, error: { code, message, ...(details ? { details } : {}) } });
  }
}
