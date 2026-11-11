import crypto from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';

import { logger } from '../shared/logger.js';

export function requestContext(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const start = process.hrtime.bigint();
  const requestId = crypto.randomUUID();
  req.requestId = requestId;
  res.setHeader('X-Request-Id', requestId);

  res.on('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - start) / 1_000_000;
    logger.info('http_request', {
      requestId,
      userId: req.user?.userId ?? null,
      method: req.method,
      path: req.baseUrl + req.path,
      statusCode: res.statusCode,
      durationMs: Math.round(durationMs * 100) / 100,
    });
  });

  next();
}
