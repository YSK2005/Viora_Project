import { Request, Response, NextFunction } from 'express';
import { sendError } from '../utils/response';
import { env } from '../config/env';
import { Prisma } from '../generated/prisma-client';

export class AppError extends Error {
  public statusCode: number;
  public code: string;
  public details?: any;

  constructor(
    message: string,
    statusCode: number = 500,
    code: string = 'ERR_INTERNAL',
    details?: any
  ) {
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
  let statusCode = err.statusCode || (err.status ? Number(err.status) : 500);
  let code = err.code || `ERR_${statusCode}`;
  let message = err.message || 'Internal Server Error';
  let details = err.details;

  // Handle Prisma Database constraint errors cleanly with 4xx client errors
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      statusCode = 409;
      code = 'ERR_UNIQUE_CONSTRAINT_VIOLATION';
      const target = Array.isArray(err.meta?.target) ? err.meta.target.join(', ') : 'field';
      message = `A record with this ${target} already exists`;
    } else if (err.code === 'P2025') {
      statusCode = 404;
      code = 'ERR_RECORD_NOT_FOUND';
      message = 'The requested record was not found';
    } else if (err.code === 'P2003') {
      statusCode = 409;
      code = 'ERR_FOREIGN_KEY_VIOLATION';
      message = 'Operation violates a relational data constraint';
    } else {
      statusCode = 400;
      code = `ERR_DB_${err.code}`;
      message = 'Database constraint error';
    }
  } else if (err instanceof Prisma.PrismaClientValidationError) {
    statusCode = 400;
    code = 'ERR_DB_VALIDATION';
    message = 'Invalid data provided for database operation';
  } else if (err.name === 'SyntaxError' && 'body' in err) {
    statusCode = 400;
    code = 'ERR_MALFORMED_JSON';
    message = 'Malformed JSON payload provided in request';
  }

  // Never leak internal filesystem paths, sql queries, or stack traces in responses
  if (typeof details === 'string' && (details.includes('node_modules') || details.includes(':\\') || details.includes('/'))) {
    details = undefined;
  }
  if (typeof message === 'string' && (message.includes(':\\') || message.includes('node_modules'))) {
    message = 'Invalid request parameters';
  }

  if (env.NODE_ENV !== 'test') {
    console.error(`[Error] ${req.method} ${req.url} [${code} - ${statusCode}]:`, err.message);
  }

  return sendError(res, message, statusCode, code, details);
}
