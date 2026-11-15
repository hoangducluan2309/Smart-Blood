import { z } from 'zod';

export const bagIdParamSchema = z.object({
  id: z.string().uuid('Mã túi máu không hợp lệ'),
});

export const requestIdParamSchema = z.object({
  requestId: z.string().uuid('Mã yêu cầu mở két không hợp lệ'),
});

export const fefoListQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.enum(['10', '20', '50', 'all']).default('20'),
  nhomMau: z.enum(['A', 'B', 'AB', 'O']).optional(),
  rhFactor: z.enum(['+', '-']).optional(),
  expiryLevel: z.enum(['RED', 'YELLOW', 'GREEN']).optional(),
  search: z.string().trim().max(50).optional(),
  sortOrder: z.enum(['asc', 'desc']).default('asc'),
});

export const quarantineListQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.enum(['10', '20', '50', 'all']).default('20'),
  nhomMau: z.enum(['A', 'B', 'AB', 'O']).optional(),
  rhFactor: z.enum(['+', '-']).optional(),
  search: z.string().trim().max(50).optional(),
});

export const recordLabResultSchema = z.object({
  ketQuaSangLoc: z.enum(['DAT', 'KHONG_DAT']),
  nhomMauChinhThuc: z.enum(['A', 'B', 'AB', 'O']),
  rhFactorChinhThuc: z.enum(['+', '-']),
  viTriKhoLanh: z.string().trim().max(100).optional(),
});

export const requestVaultUnlockSchema = z.object({
  donorId: z.string().uuid('donorId không hợp lệ'),
  maBenhAn: z.string().trim().min(2, 'Mã bệnh án tối thiểu 2 ký tự').max(50),
});

export const approveVaultUnlockSchema = z.object({
  requestId: z.string().uuid('requestId không hợp lệ'),
  otp: z.string().trim().regex(/^[0-9]{6}$/, 'Mã OTP gồm đúng 6 chữ số'),
});

export type FefoListQuery = z.infer<typeof fefoListQuerySchema>;
export type QuarantineListQuery = z.infer<typeof quarantineListQuerySchema>;
export type RecordLabResultInput = z.infer<typeof recordLabResultSchema>;
export type RequestVaultUnlockInput = z.infer<typeof requestVaultUnlockSchema>;
export type ApproveVaultUnlockInput = z.infer<typeof approveVaultUnlockSchema>;
