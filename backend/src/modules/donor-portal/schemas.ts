import { z } from 'zod';

export const historyIdParamSchema = z.object({
  historyId: z.string().uuid('Mã lịch sử hiến máu không hợp lệ'),
});

export const registerDonorSchema = z.object({
  cccd: z.string().trim().regex(/^[0-9]{12}$/, 'CCCD phải gồm đúng 12 chữ số'),
  ngaySinh: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Ngày sinh theo định dạng YYYY-MM-DD'),
  email: z.string().trim().email('Email không hợp lệ').max(255),
  matKhau: z.string().min(8, 'Mật khẩu tối thiểu 8 ký tự').max(128),
});

export const verifyEmailOtpSchema = z.object({
  email: z.string().trim().email('Email không hợp lệ'),
  cccd: z.string().trim().regex(/^[0-9]{12}$/, 'CCCD phải gồm đúng 12 chữ số'),
  ngaySinh: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Ngày sinh theo định dạng YYYY-MM-DD'),
  otp: z.string().trim().regex(/^[0-9]{6}$/, 'Mã OTP gồm đúng 6 chữ số'),
});

export const loginSchema = z.object({
  identifier: z.string().trim().min(3, 'Vui lòng nhập email hoặc số CCCD').max(255),
  matKhau: z.string().min(1, 'Vui lòng nhập mật khẩu').max(128),
});

export const forgotPasswordSchema = z.object({
  email: z.string().trim().email('Email không hợp lệ').max(255),
});

export const resetPasswordSchema = z.object({
  email: z.string().trim().email('Email không hợp lệ').max(255),
  otp: z.string().trim().regex(/^[0-9]{6}$/, 'Mã OTP gồm đúng 6 chữ số'),
  matKhauMoi: z.string().min(8, 'Mật khẩu mới tối thiểu 8 ký tự').max(128),
});

export const historyListQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.enum(['10', '20', '50', 'all']).default('20'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export const adminUserIdParamSchema = z.object({
  userId: z.string().uuid('Mã tài khoản không hợp lệ'),
});

export const adminUserListQuerySchema = z.object({
  vaiTro: z
    .enum(['ADMIN', 'RED_CROSS_STAFF', 'HOSPITAL_STAFF', 'REGISTERED_DONOR'])
    .optional(),
  trangThai: z.enum(['PENDING_VERIFY', 'ACTIVE', 'LOCKED']).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.enum(['10', '20', '50', 'all']).default('20'),
});

export const adminUpdateUserStatusSchema = z.object({
  trangThai: z.enum(['ACTIVE', 'LOCKED']),
});

export type RegisterDonorInput = z.infer<typeof registerDonorSchema>;
export type VerifyEmailOtpInput = z.infer<typeof verifyEmailOtpSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type HistoryListQuery = z.infer<typeof historyListQuerySchema>;
export type AdminUserListQuery = z.infer<typeof adminUserListQuerySchema>;
export type AdminUpdateUserStatusInput = z.infer<typeof adminUpdateUserStatusSchema>;
