import sql from 'mssql';

import { mainPool } from '../../config/database.js';
import { MEDICAL_THRESHOLDS } from '../../config/medical-thresholds.js';
import type { BloodType, CheckInStep, RhFactor } from '../../types/domain.js';
import type { LookupCccdInput, SubmitCheckInInput } from './schemas.js';

export interface LookupDonorRow {
  matched: boolean;
  isNewDonor: boolean;
  eligible: boolean;
  lastDonationDate: Date | null;
  nextEligibleDate: Date | null;
  daysSinceLastDonation: number | null;
  hoTen: string | null;
  ngaySinh: Date | null;
  gioiTinh: 'NAM' | 'NU' | 'KHAC' | null;
  soDienThoai: string | null;
  diaChi: string | null;
  nhomMau: BloodType | null;
  rhFactor: RhFactor | null;
  laNhomMauHiem: boolean;
}

export interface SubmitCheckInRow {
  checkInId: string;
  stt: number;
  thoiGianCheckIn: Date;
  trackingToken: string;
  buocHienTai: CheckInStep;
  donorId: string;
  hoTen: string;
  nhomMau: BloodType | null;
  rhFactor: RhFactor | null;
  laNhomMauHiem: boolean;
  isDuplicateRequest: boolean;
}

export async function callLookupDonorByCccd(
  input: LookupCccdInput,
): Promise<LookupDonorRow> {
  const req = mainPool.request();
  req.input('CCCD', sql.Char(12), input.cccd);
  req.input('NgaySinh', sql.Date, input.ngaySinh);
  req.input('MinIntervalDays', sql.Int, MEDICAL_THRESHOLDS.MIN_DONATION_INTERVAL_DAYS);

  const result = await req.execute<LookupDonorRow>('dbo.sp_LookupDonorByCCCD');
  return result.recordset[0]!;
}

export async function callSubmitDonorCheckIn(options: {
  input: SubmitCheckInInput;
  trackingToken: string;
}): Promise<SubmitCheckInRow> {
  const { input, trackingToken } = options;
  const req = mainPool.request();
  req.input('ClientRequestId', sql.UniqueIdentifier, input.clientRequestId);
  req.input('EventId', sql.UniqueIdentifier, input.eventId);
  req.input('CCCD', sql.Char(12), input.cccd);
  req.input('HoTen', sql.NVarChar(150), input.hoTen);
  req.input('NgaySinh', sql.Date, input.ngaySinh);
  req.input('GioiTinh', sql.NVarChar(10), input.gioiTinh);
  req.input('SoDienThoai', sql.VarChar(15), input.soDienThoai);
  req.input('DiaChi', sql.NVarChar(300), input.diaChi);
  req.input('LuongMauDangKy', sql.Int, input.luongMauDangKy);
  req.input('DaDongYXuLyDuLieu', sql.Bit, input.daDongYXuLyDuLieu ? 1 : 0);
  req.input('KhaiBaoSucKhoe', sql.NVarChar(1000), input.khaiBaoSucKhoe);
  req.input('TrackingToken', sql.VarChar(128), trackingToken);
  req.input('MinIntervalDays', sql.Int, MEDICAL_THRESHOLDS.MIN_DONATION_INTERVAL_DAYS);

  const result = await req.execute<SubmitCheckInRow>('dbo.sp_SubmitDonorCheckIn');
  return result.recordset[0]!;
}
