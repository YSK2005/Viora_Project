import { Request, Response, NextFunction } from 'express';
import { sendError } from '../utils/response';
import { env } from '../config/env';

export class AppError extends Error {
  public statusCode: number;
  public code: string;
  public details?: any;

  constructor(message: string, statusCode: number = 500, code: string = 'ERR_INTERNAL', details?: any) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export function errorHandler(
  err: any,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  next: NextFunction
) {
  const statusCode = err.statusCode || (err.status ? Number(err.status) : 500);
  const message = err.message || 'Internal Server Error';
  const code = err.code || `ERR_${statusCode}`;
  const details = env.NODE_ENV === 'development' ? err.stack : err.details;

  console.error(`[Error] ${req.method} ${req.url}:`, err);

  return sendError(res, message, statusCode, code, details);
}
