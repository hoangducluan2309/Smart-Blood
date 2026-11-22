import rateLimit from 'express-rate-limit';
import type { Request } from 'express';

function buildLimitResponse(message: string) {
  return {
    success: false,
    error: {
      code: 'TOO_MANY_REQUESTS',
      message,
    },
  };
}

export const publicCheckInLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: buildLimitResponse('Quá nhiều lượt truy cập cùng lúc, vui lòng thử lại sau ít phút.'),
});

export const lookupCccdIpLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: buildLimitResponse('Tốc độ tra cứu vượt giới hạn cho phép, vui lòng chờ 1 phút.'),
});

export const authRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: buildLimitResponse('Thao tác xác thực quá nhanh, vui lòng thử lại sau 1 phút.'),
});

export const emergencyAlertLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  // Chi bypass bang vai tro HOSPITAL_STAFF trong JWT da xac thuc, khong bypass theo IP
  skip: (req: Request): boolean => req.user?.vaiTro === 'HOSPITAL_STAFF',
  message: buildLimitResponse('Vượt giới hạn gửi yêu cầu khẩn cấp.'),
});
