import type { NextFunction, Request, RequestHandler, Response } from 'express';
import jwt from 'jsonwebtoken';
import { z } from 'zod';

import { env } from '../config/env.js';
import { AppError } from '../shared/app-error.js';
import type { AuthUser, UserRole } from '../types/domain.js';

const jwtPayloadSchema = z.object({
  userId: z.string().uuid(),
  email: z.string().email(),
  vaiTro: z.enum(['ADMIN', 'RED_CROSS_STAFF', 'HOSPITAL_STAFF', 'REGISTERED_DONOR']),
  hospitalId: z.string().uuid().nullable(),
  laNguoiPheDuyet: z.boolean(),
});

export function signAccessToken(user: AuthUser): string {
  return jwt.sign(user, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'],
  });
}

export function verifyTokenString(token: string): AuthUser {
  const decoded = jwt.verify(token, env.JWT_SECRET);
  const parsed = jwtPayloadSchema.safeParse(decoded);
  if (!parsed.success) {
    throw new AppError({
      message: 'Token xác thực không hợp lệ',
      statusCode: 401,
      code: 'INVALID_TOKEN',
    });
  }
  return parsed.data;
}

export function verifyJwt(req: Request, _res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    next(
      new AppError({
        message: 'Yêu cầu đăng nhập để truy cập tài nguyên này',
        statusCode: 401,
        code: 'UNAUTHORIZED',
      }),
    );
    return;
  }

  const token = authHeader.slice(7).trim();
  try {
    req.user = verifyTokenString(token);
    next();
  } catch {
    next(
      new AppError({
        message: 'Phiên đăng nhập đã hết hạn hoặc không hợp lệ',
        statusCode: 401,
        code: 'TOKEN_EXPIRED_OR_INVALID',
      }),
    );
  }
}

export function requireRole(...roles: UserRole[]): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(
        new AppError({
          message: 'Chưa xác thực người dùng',
          statusCode: 401,
          code: 'UNAUTHORIZED',
        }),
      );
      return;
    }

    if (!roles.includes(req.user.vaiTro)) {
      next(
        new AppError({
          message: 'Bạn không có quyền thực hiện thao tác này',
          statusCode: 403,
          code: 'FORBIDDEN',
        }),
      );
      return;
    }
    next();
  };
}

export function requireApprover(req: Request, _res: Response, next: NextFunction): void {
  if (!req.user || req.user.vaiTro !== 'ADMIN' || !req.user.laNguoiPheDuyet) {
    next(
      new AppError({
        message: 'Chỉ tài khoản lãnh đạo có quyền phê duyệt mới thực hiện được bước này',
        statusCode: 403,
        code: 'APPROVER_REQUIRED',
      }),
    );
    return;
  }
  next();
}
