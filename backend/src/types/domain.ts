export type UserRole =
  | 'ADMIN'
  | 'RED_CROSS_STAFF'
  | 'HOSPITAL_STAFF'
  | 'REGISTERED_DONOR';

export type UserStatus = 'PENDING_VERIFY' | 'ACTIVE' | 'LOCKED';

export type BloodType = 'A' | 'B' | 'AB' | 'O';
export type RhFactor = '+' | '-';

export type CheckInStep =
  | 'CHO_KHAM'
  | 'CHO_XET_NGHIEM'
  | 'CHO_LAY_MAU'
  | 'HOAN_THANH'
  | 'TAM_HOAN';

export type BloodBagStatus =
  | 'QUARANTINE'
  | 'IN_STOCK'
  | 'IN_TRANSIT'
  | 'HOSPITAL_RECEIVED'
  | 'DISCARDED'
  | 'EXPIRED';

export type EventStatus = 'UPCOMING' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
export type UrgencyLevel = 'NGUY_CAP' | 'RAT_KHAN';

export interface AuthUser {
  userId: string;
  email: string;
  vaiTro: UserRole;
  hospitalId: string | null;
  laNguoiPheDuyet: boolean;
}

export interface DonorProfile {
  donorId: string;
  cccd: string;
  hoTen: string;
  ngaySinh: string;
  gioiTinh: string;
  soDienThoai: string | null;
  diaChi: string | null;
  nhomMau: BloodType | null;
  rhFactor: RhFactor | null;
  laNhomMauHiem: boolean;
}

export interface HospitalProfile {
  hospitalId: string;
  tenBenhVien: string;
  diaChi: string;
  soDienThoai: string;
}

export interface UserProfileResponse {
  user: AuthUser;
  profile: DonorProfile | HospitalProfile | null;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}
