import sql from 'mssql';

import { mainPool } from '../../config/database.js';
import { buildOffsetClause } from '../../shared/pagination.js';
import type { BloodType, RhFactor, UserRole, UserStatus } from '../../types/domain.js';
import type { AdminUserListQuery, HistoryListQuery } from './schemas.js';

export interface AdminUserSummaryRow {
  id: string;
  email: string;
  vaiTro: UserRole;
  hospitalId: string | null;
  laNguoiPheDuyet: boolean;
  emailDaXacThuc: boolean;
  trangThai: UserStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserAuthRow {
  id: string;
  email: string;
  matKhauHash: string;
  vaiTro: UserRole;
  hospitalId: string | null;
  laNguoiPheDuyet: boolean;
  emailDaXacThuc: boolean;
  trangThai: UserStatus;
}

export interface DonorHistoryRow {
  historyId: string;
  ngayHien: Date;
  theTich: number;
  trangThai: string;
  maSuKien: string;
  tenSuKien: string;
  diaDiem: string;
  maVachTuiMau: string;
  nhomMau: BloodType;
  rhFactor: RhFactor;
  trangThaiTuiMau: string;
  tenBenhVienNhan: string | null;
}

export interface CertificateRow {
  historyId: string;
  ngayHien: Date;
  theTich: number;
  hoTen: string;
  cccd: string;
  ngaySinh: Date;
  nhomMau: BloodType;
  rhFactor: RhFactor;
  maSuKien: string;
  tenSuKien: string;
  diaDiem: string;
  maVachTuiMau: string;
}

export async function callRegisterDonorAccount(options: {
  cccd: string;
  ngaySinh: string;
  email: string;
  matKhauHash: string;
  ip: string | null;
}) {
  const req = mainPool.request();
  req.input('CCCD', sql.Char(12), options.cccd);
  req.input('NgaySinh', sql.Date, options.ngaySinh);
  req.input('Email', sql.NVarChar(255), options.email);
  req.input('MatKhauHash', sql.VarChar(255), options.matKhauHash);
  req.input('DiaChiIP', sql.VarChar(45), options.ip);

  const res = await req.execute<{
    userId: string;
    donorId: string;
    email: string;
    trangThai: UserStatus;
  }>('dbo.sp_RegisterDonorAccount');
  return res.recordset[0]!;
}

export async function callActivateDonorAccount(options: {
  userId: string;
  cccd: string;
  ngaySinh: string;
  ip: string | null;
}) {
  const req = mainPool.request();
  req.input('UserId', sql.UniqueIdentifier, options.userId);
  req.input('CCCD', sql.Char(12), options.cccd);
  req.input('NgaySinh', sql.Date, options.ngaySinh);
  req.input('DiaChiIP', sql.VarChar(45), options.ip);

  const res = await req.execute<{
    userId: string;
    donorId: string;
    trangThai: UserStatus;
  }>('dbo.sp_ActivateDonorAccount');
  return res.recordset[0]!;
}

export async function findUserByEmailOrCccd(identifier: string): Promise<UserAuthRow | null> {
  const req = mainPool.request();
  req.input('Identifier', sql.NVarChar(255), identifier);
  const res = await req.query<UserAuthRow>(`
    SELECT TOP 1 u.id, u.email, u.matKhauHash, u.vaiTro, u.hospitalId,
      u.laNguoiPheDuyet, u.emailDaXacThuc, u.trangThai
    FROM dbo.Users u
    LEFT JOIN dbo.Donors d ON d.userId = u.id
    WHERE u.email = @Identifier OR d.cccd = @Identifier;
  `);
  return res.recordset[0] ?? null;
}

export async function findUserByEmail(email: string): Promise<UserAuthRow | null> {
  const req = mainPool.request();
  req.input('Email', sql.NVarChar(255), email);
  const res = await req.query<UserAuthRow>(`
    SELECT id, email, matKhauHash, vaiTro, hospitalId,
      laNguoiPheDuyet, emailDaXacThuc, trangThai
    FROM dbo.Users WHERE email = @Email;
  `);
  return res.recordset[0] ?? null;
}

export async function callUpdateUserPassword(options: {
  userId: string;
  matKhauHash: string;
  ip: string | null;
}): Promise<void> {
  const req = mainPool.request();
  req.input('UserId', sql.UniqueIdentifier, options.userId);
  req.input('MatKhauHash', sql.VarChar(255), options.matKhauHash);
  req.input('DiaChiIP', sql.VarChar(45), options.ip);
  await req.execute('dbo.sp_UpdateUserPassword');
}

export async function callRecordAuthAudit(options: {
  userId: string | null;
  hanhDong: string;
  chiTiet: string;
  ip: string | null;
}): Promise<void> {
  const req = mainPool.request();
  req.input('UserId', sql.UniqueIdentifier, options.userId);
  req.input('HanhDong', sql.VarChar(60), options.hanhDong);
  req.input('ChiTiet', sql.NVarChar(2000), options.chiTiet);
  req.input('DiaChiIP', sql.VarChar(45), options.ip);
  await req.execute('dbo.sp_WriteAuditLog');
}

async function queryDonorHistorySummary(userId: string): Promise<{
  total: number;
  totalVolumeMl: number;
  lastDonationDate: Date | null;
}> {
  const req = mainPool.request();
  req.input('UserId', sql.UniqueIdentifier, userId);
  const summaryRes = await req.query<{
    total: number;
    totalVolumeMl: number | null;
    lastDonationDate: Date | null;
  }>(`
    SELECT COUNT(*) AS total, SUM(dh.theTich) AS totalVolumeMl,
      MAX(dh.ngayHien) AS lastDonationDate
    FROM dbo.DonationHistory dh
    INNER JOIN dbo.Donors d ON d.id = dh.donorId
    WHERE d.userId = @UserId AND dh.trangThai = 'HOAN_THANH';
  `);
  const summary = summaryRes.recordset[0];
  return {
    total: summary?.total ?? 0,
    totalVolumeMl: summary?.totalVolumeMl ?? 0,
    lastDonationDate: summary?.lastDonationDate ?? null,
  };
}

async function fetchDonorHistoryRows(options: {
  userId: string;
  query: HistoryListQuery;
}): Promise<DonorHistoryRow[]> {
  const limitClause = buildOffsetClause(options.query.page, options.query.limit);
  const dir = options.query.sortOrder === 'asc' ? 'ASC' : 'DESC';
  const dataReq = mainPool.request();
  dataReq.input('UserId', sql.UniqueIdentifier, options.userId);
  const rowsRes = await dataReq.query<DonorHistoryRow>(`
    SELECT dh.id AS historyId, dh.ngayHien, dh.theTich, dh.trangThai,
      e.maSuKien, e.tenSuKien, e.diaDiem, b.maVachTuiMau,
      b.nhomMau, b.rhFactor, b.trangThai AS trangThaiTuiMau,
      h.tenBenhVien AS tenBenhVienNhan
    FROM dbo.DonationHistory dh
    INNER JOIN dbo.Donors d ON d.id = dh.donorId
    INNER JOIN dbo.DonorCheckIns c ON c.id = dh.checkInId
    INNER JOIN dbo.DonationEvents e ON e.id = c.eventId
    INNER JOIN dbo.BloodBags b ON b.id = dh.bloodBagId
    LEFT JOIN dbo.Hospitals h
      ON h.id = b.destinationHospitalId AND b.trangThai = 'HOSPITAL_RECEIVED'
    WHERE d.userId = @UserId
    ORDER BY dh.ngayHien ${dir} ${limitClause};
  `);
  return rowsRes.recordset;
}

export async function queryDonorHistory(options: {
  userId: string;
  query: HistoryListQuery;
}): Promise<{
  rows: DonorHistoryRow[];
  total: number;
  totalVolumeMl: number;
  lastDonationDate: Date | null;
}> {
  const summary = await queryDonorHistorySummary(options.userId);
  const rows = await fetchDonorHistoryRows(options);
  return { rows, ...summary };
}

export async function findDonorCertificateRecord(options: {
  historyId: string;
  userId: string;
}): Promise<CertificateRow | null> {
  const req = mainPool.request();
  req.input('HistoryId', sql.UniqueIdentifier, options.historyId);
  req.input('UserId', sql.UniqueIdentifier, options.userId);

  const res = await req.query<CertificateRow>(`
    SELECT dh.id AS historyId, dh.ngayHien, dh.theTich,
      d.hoTen, d.cccd, d.ngaySinh, b.nhomMau, b.rhFactor,
      e.maSuKien, e.tenSuKien, e.diaDiem, b.maVachTuiMau
    FROM dbo.DonationHistory dh
    INNER JOIN dbo.Donors d ON d.id = dh.donorId
    INNER JOIN dbo.DonorCheckIns c ON c.id = dh.checkInId
    INNER JOIN dbo.DonationEvents e ON e.id = c.eventId
    INNER JOIN dbo.BloodBags b ON b.id = dh.bloodBagId
    WHERE dh.id = @HistoryId
      AND d.userId = @UserId
      AND dh.trangThai = 'HOAN_THANH';
  `);
  return res.recordset[0] ?? null;
}

export async function queryAdminUsers(query: AdminUserListQuery): Promise<{
  rows: AdminUserSummaryRow[];
  total: number;
}> {
  const limitClause = buildOffsetClause(query.page, query.limit);
  const req = mainPool.request();
  req.input('VaiTro', sql.VarChar(30), query.vaiTro ?? null);
  req.input('TrangThai', sql.VarChar(20), query.trangThai ?? null);

  const res = await req.query<AdminUserSummaryRow & { totalCount: number }>(`
    SELECT id, email, vaiTro, hospitalId, laNguoiPheDuyet, emailDaXacThuc,
      trangThai, createdAt, updatedAt, COUNT(*) OVER() AS totalCount
    FROM dbo.Users
    WHERE (@VaiTro IS NULL OR vaiTro = @VaiTro)
      AND (@TrangThai IS NULL OR trangThai = @TrangThai)
    ORDER BY createdAt DESC ${limitClause};
  `);
  const total = res.recordset[0]?.totalCount ?? 0;
  const rows = res.recordset.map(({ totalCount: _count, ...user }) => user);
  return { rows, total };
}

export async function callAdminUpdateUserStatus(options: {
  adminId: string;
  targetUserId: string;
  trangThai: 'ACTIVE' | 'LOCKED';
  ip: string | null;
}) {
  const req = mainPool.request();
  req.input('AdminId', sql.UniqueIdentifier, options.adminId);
  req.input('TargetUserId', sql.UniqueIdentifier, options.targetUserId);
  req.input('TrangThai', sql.VarChar(20), options.trangThai);
  req.input('DiaChiIP', sql.VarChar(45), options.ip);
  const res = await req.execute<{
    id: string;
    email: string;
    vaiTro: UserRole;
    hospitalId: string | null;
    laNguoiPheDuyet: boolean;
    emailDaXacThuc: boolean;
    trangThai: UserStatus;
  }>('dbo.sp_AdminUpdateUserStatus');
  return res.recordset[0]!;
}
