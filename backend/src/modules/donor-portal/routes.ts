import { Router } from 'express';

import { requireRole, verifyJwt } from '../../middleware/auth.js';
import { authRateLimiter } from '../../middleware/rate-limiter.js';
import { validateBody, validateParams, validateQuery } from '../../middleware/validate.js';
import { asyncHandler } from '../../shared/async-handler.js';
import { sendSuccess } from '../../shared/response.js';
import {
  adminUpdateUserStatusSchema,
  adminUserIdParamSchema,
  adminUserListQuerySchema,
  forgotPasswordSchema,
  historyIdParamSchema,
  historyListQuerySchema,
  loginSchema,
  registerDonorSchema,
  resetPasswordSchema,
  verifyEmailOtpSchema,
  type AdminUpdateUserStatusInput,
  type AdminUserListQuery,
  type ForgotPasswordInput,
  type HistoryListQuery,
  type LoginInput,
  type RegisterDonorInput,
  type ResetPasswordInput,
  type VerifyEmailOtpInput,
} from './schemas.js';
import {
  generateDonorCertificatePdf,
  getDonorDonationHistory,
  listUsersForAdmin,
  loginAccount,
  registerDonorAccount,
  requestForgotPasswordOtp,
  resetPasswordWithOtp,
  updateAdminUserStatus,
  verifyDonorEmailOtp,
} from './service.js';

export const authRouter = Router();
export const donorPortalRouter = Router();
export const adminUsersRouter = Router();

authRouter.post(
  '/register-donor',
  authRateLimiter,
  validateBody(registerDonorSchema),
  asyncHandler(async (req, res) => {
    const input = req.body as RegisterDonorInput;
    const data = await registerDonorAccount({ input, ip: req.ip ?? null });
    sendSuccess({
      res,
      data,
      statusCode: 201,
      message: 'Đã gửi mã OTP xác minh đến email của bạn',
    });
  }),
);

authRouter.post(
  '/verify-email-otp',
  authRateLimiter,
  validateBody(verifyEmailOtpSchema),
  asyncHandler(async (req, res) => {
    const input = req.body as VerifyEmailOtpInput;
    const data = await verifyDonorEmailOtp({ input, ip: req.ip ?? null });
    sendSuccess({ res, data, message: 'Xác minh tài khoản thành công' });
  }),
);

authRouter.post(
  '/login',
  authRateLimiter,
  validateBody(loginSchema),
  asyncHandler(async (req, res) => {
    const input = req.body as LoginInput;
    const data = await loginAccount(input, req.ip ?? null);
    sendSuccess({ res, data, message: 'Đăng nhập thành công' });
  }),
);

authRouter.post(
  '/forgot-password',
  authRateLimiter,
  validateBody(forgotPasswordSchema),
  asyncHandler(async (req, res) => {
    const input = req.body as ForgotPasswordInput;
    await requestForgotPasswordOtp(input);
    sendSuccess({
      res,
      data: { sent: true },
      message: 'Nếu email tồn tại trong hệ thống, mã OTP đặt lại mật khẩu đã được gửi.',
    });
  }),
);

authRouter.post(
  '/reset-password',
  authRateLimiter,
  validateBody(resetPasswordSchema),
  asyncHandler(async (req, res) => {
    const input = req.body as ResetPasswordInput;
    await resetPasswordWithOtp({ input, ip: req.ip ?? null });
    sendSuccess({ res, data: { updated: true }, message: 'Đổi mật khẩu thành công' });
  }),
);

donorPortalRouter.get(
  '/history',
  verifyJwt,
  requireRole('REGISTERED_DONOR'),
  validateQuery(historyListQuerySchema),
  asyncHandler(async (req, res) => {
    const query = req.query as unknown as HistoryListQuery;
    const result = await getDonorDonationHistory({
      userId: req.user!.userId,
      query,
    });
    sendSuccess({
      res,
      data: { summary: result.summary, items: result.items },
      pagination: result.pagination,
    });
  }),
);

donorPortalRouter.get(
  '/certificate/:historyId/download',
  verifyJwt,
  requireRole('REGISTERED_DONOR'),
  validateParams(historyIdParamSchema),
  asyncHandler(async (req, res) => {
    const pdf = await generateDonorCertificatePdf({
      historyId: String(req.params.historyId),
      userId: req.user!.userId,
    });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${pdf.filename}"`);
    res.status(200).send(pdf.buffer);
  }),
);

adminUsersRouter.use(verifyJwt, requireRole('ADMIN'));

adminUsersRouter.get(
  '/',
  validateQuery(adminUserListQuerySchema),
  asyncHandler(async (req, res) => {
    const query = req.query as unknown as AdminUserListQuery;
    const result = await listUsersForAdmin(query);
    sendSuccess({
      res,
      data: { items: result.items },
      pagination: result.pagination,
    });
  }),
);

adminUsersRouter.patch(
  '/:userId/status',
  validateParams(adminUserIdParamSchema),
  validateBody(adminUpdateUserStatusSchema),
  asyncHandler(async (req, res) => {
    const input = req.body as AdminUpdateUserStatusInput;
    const data = await updateAdminUserStatus({
      adminId: req.user!.userId,
      targetUserId: String(req.params.userId),
      input,
      ip: req.ip ?? null,
    });
    sendSuccess({
      res,
      data,
      message:
        input.trangThai === 'ACTIVE'
          ? 'Đã mở khóa tài khoản thành công'
          : 'Đã khóa tài khoản thành công',
    });
  }),
);
