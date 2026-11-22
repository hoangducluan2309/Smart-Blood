import { z } from 'zod';

const cccdSchema = z
  .string()
  .trim()
  .regex(/^[0-9]{12}$/, 'CCCD phải gồm đúng 12 chữ số');

const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Ngày sinh phải theo định dạng YYYY-MM-DD');

export const lookupCccdSchema = z.object({
  cccd: cccdSchema,
  ngaySinh: dateSchema,
});

export const submitCheckInSchema = z.object({
  clientRequestId: z.string().uuid('clientRequestId phải là UUID hợp lệ'),
  eventId: z.string().uuid('eventId phải là UUID hợp lệ'),
  cccd: cccdSchema,
  hoTen: z.string().trim().min(2, 'Họ tên tối thiểu 2 ký tự').max(150),
  ngaySinh: dateSchema,
  gioiTinh: z.enum(['NAM', 'NU', 'KHAC']),
  soDienThoai: z
    .string()
    .trim()
    .regex(/^[0-9]{9,15}$/, 'Số điện thoại không hợp lệ'),
  diaChi: z.string().trim().min(5, 'Địa chỉ tối thiểu 5 ký tự').max(300),
  luongMauDangKy: z.union([z.literal(250), z.literal(350), z.literal(450)]),
  daDongYXuLyDuLieu: z.literal(true, {
    errorMap: () => ({ message: 'Bạn cần đồng ý xử lý dữ liệu cá nhân để tiếp tục' }),
  }),
  khaiBaoSucKhoe: z.string().trim().min(2, 'Vui lòng hoàn thành khai báo sức khỏe').max(1000),
});

export type LookupCccdInput = z.infer<typeof lookupCccdSchema>;
export type SubmitCheckInInput = z.infer<typeof submitCheckInSchema>;
