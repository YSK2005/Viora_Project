import {ErrorCode} from '../utils/errorCodes';
import { Request, Response, NextFunction } from 'express';
import { ZodTypeAny, ZodError } from 'zod';
import { sendError } from '../utils/response';

export const validateRequest = (schema: {
  body?: ZodTypeAny;
  query?: ZodTypeAny;
  params?: ZodTypeAny;
}) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (schema.body) {
        req.body = await schema.body.parseAsync(req.body);
      }
      if (schema.query) {
        req.query = (await schema.query.parseAsync(req.query)) as any;
      }
      if (schema.params) {
        req.params = (await schema.params.parseAsync(req.params)) as any;
      }
      return next();
    } catch (error) {
      if (error instanceof ZodError) {
        const issues = (error as any).issues || (error as any).errors || [];
        return sendError(
          res,
          'Validation failed',
          400,
          ErrorCode.ERR_VALIDATION,
          issues.map((err: any) => ({
            field: Array.isArray(err.path) ? err.path.join('.') : String(err.path || ''),
            message: err.message,
          }))
        );
      }
      return next(error);
    }
  };
};
