import { HttpException } from '@nestjs/common';

/** Every handled failure goes through this class so the response shape is always { success:false, error:{code,message,details?} }. */
export class AppError extends HttpException {
  readonly code: string;
  readonly details?: Record<string, unknown>;

  constructor(status: number, code: string, message: string, details?: Record<string, unknown>) {
    super({ code, message, details }, status);
    this.code = code;
    this.details = details;
  }
}
