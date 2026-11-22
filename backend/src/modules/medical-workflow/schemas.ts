import { z } from 'zod';

export const eventQueueParamSchema = z.object({
  eventId: z.string().uuid('eventId không hợp lệ'),
});

export const queueListQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.enum(['10', '20', '50', 'all']).default('50'),
  buocHienTai: z
    .enum(['CHO_KHAM', 'CHO_XET_NGHIEM', 'CHO_LAY_MAU', 'HOAN_THANH', 'TAM_HOAN'])
    .optional(),
  search: z.string().trim().max(100).optional(),
  sortOrder: z.enum(['asc', 'desc']).default('asc'),
});

export const clinicalExamSchema = z.object({
  checkInId: z.string().uuid('checkInId không hợp lệ'),
  huyetApTamThu: z.coerce.number().int().min(50).max(260),
  huyetApTamTruong: z.coerce.number().int().min(30).max(160),
  nhipTim: z.coerce.number().int().min(30).max(220),
  canNang: z.coerce.number().min(20).max(250),
  theTichDuocPhep: z.union([z.literal(250), z.literal(350), z.literal(450)]).nullable().optional(),
  ketLuan: z.enum(['DAT', 'TAM_HOAN']),
  lyDo: z.string().trim().max(500).optional(),
});

export const rapidTestSchema = z.object({
  checkInId: z.string().uuid('checkInId không hợp lệ'),
  hemoglobin: z.coerce.number().min(4).max(25),
  testHbsAg: z.enum(['AM_TINH', 'DUONG_TINH']),
  testHCV: z.enum(['AM_TINH', 'DUONG_TINH']),
  testHIV: z.enum(['AM_TINH', 'DUONG_TINH']),
  nhomMauXacNhan: z.enum(['A', 'B', 'AB', 'O']),
  rhFactor: z.enum(['+', '-']),
});

export const collectBloodBagSchema = z.object({
  checkInId: z.string().uuid('checkInId không hợp lệ'),
  theTichThucTe: z.union([z.literal(250), z.literal(350), z.literal(450)]),
  viTriKhoLanhTamThoi: z.string().trim().max(100).optional(),
});

export type QueueListQuery = z.infer<typeof queueListQuerySchema>;
export type ClinicalExamInput = z.infer<typeof clinicalExamSchema>;
export type RapidTestInput = z.infer<typeof rapidTestSchema>;
export type CollectBloodBagInput = z.infer<typeof collectBloodBagSchema>;
