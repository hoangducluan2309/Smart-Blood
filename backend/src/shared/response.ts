import type { Response } from 'express';

import type { PaginationMeta } from '../types/domain.js';

export function sendSuccess<T>(options: {
  res: Response;
  data: T;
  statusCode?: number;
  message?: string;
  pagination?: PaginationMeta;
}): void {
  const { res, data, statusCode = 200, message, pagination } = options;
  const payload: Record<string, unknown> = { success: true, data };
  if (message) {
    payload.message = message;
  }
  if (pagination) {
    payload.pagination = pagination;
  }
  res.status(statusCode).json(payload);
}
