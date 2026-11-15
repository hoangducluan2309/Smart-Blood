import { z } from 'zod';

export const eventIdParamSchema = z.object({
  id: z.string().uuid('Mã sự kiện không hợp lệ'),
});

export const createEventSchema = z.object({
  tenSuKien: z.string().trim().min(3, 'Tên sự kiện tối thiểu 3 ký tự').max(200),
  diaDiem: z.string().trim().min(3, 'Địa điểm tối thiểu 3 ký tự').max(200),
  diaChiChiTiet: z.string().trim().max(300).optional(),
  ngayToChuc: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Ngày tổ chức theo định dạng YYYY-MM-DD'),
  gioBatDau: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/, 'Giờ bắt đầu theo định dạng HH:mm'),
  gioKetThuc: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/, 'Giờ kết thúc theo định dạng HH:mm'),
  chiTieuSoLuong: z.coerce.number().int().positive('Chỉ tiêu phải lớn hơn 0'),
  ghiChu: z.string().trim().max(500).optional(),
});

export const listEventsQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.enum(['10', '20', '50', 'all']).default('20'),
  trangThai: z.enum(['UPCOMING', 'ACTIVE', 'COMPLETED', 'CANCELLED']).optional(),
  search: z.string().trim().max(100).optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export const updateEventStatusSchema = z.object({
  trangThai: z.enum(['UPCOMING', 'ACTIVE', 'COMPLETED', 'CANCELLED']),
});

export const qrDownloadQuerySchema = z.object({
  format: z.enum(['png', 'svg', 'pdf']).default('png'),
});

export type CreateEventInput = z.infer<typeof createEventSchema>;
export type ListEventsQuery = z.infer<typeof listEventsQuerySchema>;
export type UpdateEventStatusInput = z.infer<typeof updateEventStatusSchema>;
export type QrDownloadQuery = z.infer<typeof qrDownloadQuerySchema>;
