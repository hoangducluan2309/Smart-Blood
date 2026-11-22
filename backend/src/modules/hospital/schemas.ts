import { z } from 'zod';

export const emergencyIdParamSchema = z.object({
  id: z.string().uuid('Mã lệnh cấp cứu không hợp lệ'),
});

export const emergencyAlertSchema = z.object({
  bloodType: z.enum(['A', 'B', 'AB', 'O']),
  rhFactor: z.enum(['+', '-']),
  unitsNeeded: z.coerce.number().int().min(1).max(50),
  urgencyLevel: z.enum(['NGUY_CAP', 'RAT_KHAN']),
  patientCaseId: z.string().trim().min(2, 'Mã bệnh án tối thiểu 2 ký tự').max(50),
});

export const dispatchBloodBagsSchema = z.object({
  hospitalId: z.string().uuid('hospitalId không hợp lệ'),
  bloodType: z.enum(['A', 'B', 'AB', 'O']),
  rhFactor: z.enum(['+', '-']),
  unitsNeeded: z.coerce.number().int().min(1).max(50),
  bienSoXe: z.string().trim().min(4, 'Biển số xe không hợp lệ').max(20),
  taiXeHotline: z.string().trim().regex(/^[0-9]{9,15}$/, 'Số điện thoại tài xế không hợp lệ'),
  emergencyRequestId: z.string().uuid().optional(),
});

export const verifyAndReceiveSchema = z.object({
  bagCode: z.string().trim().min(5, 'Mã túi máu không hợp lệ').max(30),
  temperatureRecorded: z.coerce.number().min(-40).max(40),
});

export const listDispatchesQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.enum(['10', '20', '50', 'all']).default('20'),
  trangThaiGiao: z.enum(['IN_TRANSIT', 'PARTIAL_RECEIVED', 'DELIVERED']).optional(),
});

export type EmergencyAlertInput = z.infer<typeof emergencyAlertSchema>;
export type DispatchBloodBagsInput = z.infer<typeof dispatchBloodBagsSchema>;
export type VerifyAndReceiveInput = z.infer<typeof verifyAndReceiveSchema>;
export type ListDispatchesQuery = z.infer<typeof listDispatchesQuerySchema>;
