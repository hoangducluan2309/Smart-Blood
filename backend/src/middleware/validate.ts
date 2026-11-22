import type { NextFunction, Request, RequestHandler, Response } from 'express';
import type { ZodTypeAny } from 'zod';

import { AppError } from '../shared/app-error.js';

function formatZodIssues(issues: readonly { path: (string | number)[]; message: string }[]) {
  return issues.map((issue) => ({
    field: issue.path.join('.'),
    message: issue.message,
  }));
}

export function validateBody<T extends ZodTypeAny>(schema: T): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      next(
        new AppError({
          message: 'Dữ liệu gửi lên không hợp lệ',
          statusCode: 422,
          code: 'VALIDATION_ERROR',
          details: formatZodIssues(parsed.error.issues),
        }),
      );
      return;
    }
    req.body = parsed.data;
    next();
  };
}

export function validateQuery<T extends ZodTypeAny>(schema: T): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const parsed = schema.safeParse(req.query);
    if (!parsed.success) {
      next(
        new AppError({
          message: 'Tham số truy vấn không hợp lệ',
          statusCode: 422,
          code: 'VALIDATION_ERROR',
          details: formatZodIssues(parsed.error.issues),
        }),
      );
      return;
    }
    req.query = parsed.data as Request['query'];
    next();
  };
}

export function validateParams<T extends ZodTypeAny>(schema: T): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const parsed = schema.safeParse(req.params);
    if (!parsed.success) {
      next(
        new AppError({
          message: 'Tham số đường dẫn không hợp lệ',
          statusCode: 422,
          code: 'VALIDATION_ERROR',
          details: formatZodIssues(parsed.error.issues),
        }),
      );
      return;
    }
    req.params = parsed.data as Request['params'];
    next();
  };
}
