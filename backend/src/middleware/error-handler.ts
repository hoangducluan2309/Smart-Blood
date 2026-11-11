import type { NextFunction, Request, Response } from 'express';

import { env } from '../config/env.js';
import { AppError } from '../shared/app-error.js';
import { logger } from '../shared/logger.js';

interface SqlErrorLike {
  number?: number;
  message?: string;
}

const SP_ERROR_MAP: Readonly<Record<number, { statusCode: number; code: string }>> = {
  50001: { statusCode: 409, code: 'INSUFFICIENT_BLOOD_STOCK' },
  50010: { statusCode: 422, code: 'EVENT_DATE_IN_PAST' },
  50011: { statusCode: 422, code: 'INVALID_EVENT_TIME_RANGE' },
  50012: { statusCode: 404, code: 'EVENT_NOT_FOUND' },
  50020: { statusCode: 422, code: 'DATA_CONSENT_REQUIRED' },
  50021: { statusCode: 404, code: 'EVENT_NOT_FOUND' },
  50022: { statusCode: 409, code: 'EVENT_CLOSED' },
  50023: { statusCode: 409, code: 'OUTSIDE_EVENT_WINDOW' },
  50024: { statusCode: 409, code: 'DONOR_IDENTITY_MISMATCH' },
  50025: { statusCode: 409, code: 'DONATION_INTERVAL_NOT_MET' },
  50026: { statusCode: 409, code: 'DUPLICATE_CHECKIN' },
  50030: { statusCode: 404, code: 'CHECKIN_NOT_FOUND' },
  50031: { statusCode: 409, code: 'INVALID_CHECKIN_STEP' },
  50032: { statusCode: 422, code: 'ALLOWED_VOLUME_REQUIRED' },
  50033: { statusCode: 409, code: 'INVALID_CHECKIN_STEP' },
  50034: { statusCode: 409, code: 'INVALID_CHECKIN_STEP' },
  50035: { statusCode: 409, code: 'MISSING_PRELIMINARY_BLOOD_TYPE' },
  50040: { statusCode: 404, code: 'BLOOD_BAG_NOT_FOUND' },
  50041: { statusCode: 409, code: 'BLOOD_BAG_NOT_IN_QUARANTINE' },
  50042: { statusCode: 404, code: 'DONOR_NOT_FOUND' },
  50043: { statusCode: 404, code: 'RARE_VAULT_RECORD_NOT_FOUND' },
  50044: { statusCode: 404, code: 'VAULT_REQUEST_NOT_FOUND' },
  50045: { statusCode: 403, code: 'DUAL_CUSTODY_VIOLATION' },
  50046: { statusCode: 409, code: 'VAULT_REQUEST_NOT_PENDING' },
  50047: { statusCode: 403, code: 'VAULT_ACCESS_DENIED' },
  50048: { statusCode: 403, code: 'VAULT_GRANT_EXPIRED' },
  50050: { statusCode: 403, code: 'INVALID_HOSPITAL_ACCOUNT' },
  50051: { statusCode: 404, code: 'EMERGENCY_REQUEST_NOT_FOUND' },
  50052: { statusCode: 404, code: 'HOSPITAL_NOT_FOUND' },
  50053: { statusCode: 404, code: 'BLOOD_BAG_NOT_FOUND' },
  50054: { statusCode: 409, code: 'BLOOD_BAG_NOT_IN_TRANSIT' },
  50055: { statusCode: 400, code: 'WRONG_DESTINATION_HOSPITAL' },
  50060: { statusCode: 409, code: 'EMAIL_ALREADY_EXISTS' },
  50061: { statusCode: 400, code: 'DONOR_VERIFICATION_FAILED' },
  50062: { statusCode: 400, code: 'DONOR_VERIFICATION_FAILED' },
  50063: { statusCode: 409, code: 'ACCOUNT_NOT_PENDING_VERIFY' },
  50064: { statusCode: 404, code: 'USER_NOT_FOUND' },
  50065: { statusCode: 400, code: 'CANNOT_LOCK_SELF' },
  50066: { statusCode: 403, code: 'FORBIDDEN_ADMIN_ACTION' },
};

function mapDatabaseError(err: unknown): AppError | null {
  if (err === null || typeof err !== 'object') {
    return null;
  }
  const sqlErr = err as SqlErrorLike;
  if (typeof sqlErr.number !== 'number') {
    return null;
  }
  const mapped = SP_ERROR_MAP[sqlErr.number];
  if (!mapped) {
    return null;
  }
  return new AppError({
    message: sqlErr.message ?? 'Lỗi nghiệp vụ dữ liệu',
    statusCode: mapped.statusCode,
    code: mapped.code,
  });
}

function sendOperationalError(res: Response, operational: AppError): void {
  res.status(operational.statusCode).json({
    success: false,
    error: {
      code: operational.code,
      message: operational.message,
      ...(operational.details ? { details: operational.details } : {}),
    },
  });
}

export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  const operational = err instanceof AppError ? err : mapDatabaseError(err);
  if (operational) {
    sendOperationalError(res, operational);
    return;
  }

  logger.error('unhandled_system_error', {
    requestId: req.requestId ?? null,
    errorName: err instanceof Error ? err.name : 'UnknownError',
    errorMessage: err instanceof Error ? err.message : String(err),
    ...(env.NODE_ENV !== 'production' && err instanceof Error ? { stack: err.stack } : {}),
  });

  res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: 'Hệ thống đang gặp sự cố, vui lòng thử lại sau.',
    },
  });
}
