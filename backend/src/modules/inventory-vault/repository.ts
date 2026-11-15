import sql from 'mssql';

import { mainPool, priorityPool } from '../../config/database.js';
import { buildOffsetClause } from '../../shared/pagination.js';
import type { BloodBagStatus, BloodType, RhFactor } from '../../types/domain.js';
import type {
  FefoListQuery,
  QuarantineListQuery,
  RecordLabResultInput,
} from './schemas.js';

export interface InventorySummaryRow {
  nhomMau: BloodType;
  rhFactor: RhFactor;
  soLuongTui: number;
  tongTheTichMl: number;
  hanDungGanNhat: Date;
}

export interface BloodBagRow {
  id: string;
  checkInId: string;
  maVachTuiMau: string;
  nhomMau: BloodType;
  rhFactor: RhFactor;
  theTich: number;
  ngayLayMau: Date;
  ngayHetHan: Date;
  trangThai: BloodBagStatus;
  ketQuaSangLoc: string | null;
  viTriKhoLanh: string | null;
  daysRemaining: number;
}

export interface RareDonorEncryptedRow {
  donorId: string;
  hoTen: string;
  nhomMauHiem: string;
  keyVersion: number;
  encryptedPhone: Buffer;
  ivPhone: Buffer;
  authTagPhone: Buffer;
  encryptedAddress: Buffer;
  ivAddress: Buffer;
  authTagAddress: Buffer;
  expiresAt?: Date;
}

const FEFO_WHERE = `
  WHERE trangThai = 'IN_STOCK' AND ngayHetHan > SYSUTCDATETIME()
    AND (@NhomMau IS NULL OR nhomMau = @NhomMau)
    AND (@RhFactor IS NULL OR rhFactor = @RhFactor)
    AND (@Search IS NULL OR maVachTuiMau LIKE @Search)
    AND (@ExpiryLevel IS NULL
      OR (@ExpiryLevel = 'RED' AND DATEDIFF(DAY, SYSUTCDATETIME(), ngayHetHan) < 7)
      OR (@ExpiryLevel = 'YELLOW'
        AND DATEDIFF(DAY, SYSUTCDATETIME(), ngayHetHan) BETWEEN 7 AND 15)
      OR (@ExpiryLevel = 'GREEN' AND DATEDIFF(DAY, SYSUTCDATETIME(), ngayHetHan) > 15))
`;

const QUARANTINE_WHERE = `
  WHERE trangThai = 'QUARANTINE'
    AND (@NhomMau IS NULL OR nhomMau = @NhomMau)
    AND (@RhFactor IS NULL OR rhFactor = @RhFactor)
    AND (@Search IS NULL OR maVachTuiMau LIKE @Search)
`;

function bindFefoInputs(req: sql.Request, query: FefoListQuery): void {
  req.input('NhomMau', sql.VarChar(2), query.nhomMau ?? null);
  req.input('RhFactor', sql.Char(1), query.rhFactor ?? null);
  req.input('ExpiryLevel', sql.VarChar(10), query.expiryLevel ?? null);
  req.input('Search', sql.VarChar(60), query.search ? `%${query.search}%` : null);
}

function bindQuarantineInputs(req: sql.Request, query: QuarantineListQuery): void {
  req.input('NhomMau', sql.VarChar(2), query.nhomMau ?? null);
  req.input('RhFactor', sql.Char(1), query.rhFactor ?? null);
  req.input('Search', sql.VarChar(60), query.search ? `%${query.search}%` : null);
}

export async function queryInventorySummary(): Promise<InventorySummaryRow[]> {
  const result = await priorityPool.request().query<InventorySummaryRow>(`
    SELECT nhomMau, rhFactor, soLuongTui, tongTheTichMl, hanDungGanNhat
    FROM dbo.vw_BloodInventorySummary
    ORDER BY nhomMau, rhFactor;
  `);
  return result.recordset;
}

export async function queryFefoBags(query: FefoListQuery): Promise<{
  rows: BloodBagRow[];
  total: number;
}> {
  const countReq = mainPool.request();
  bindFefoInputs(countReq, query);
  const countRes = await countReq.query<{ total: number }>(
    `SELECT COUNT(*) AS total FROM dbo.BloodBags ${FEFO_WHERE};`,
  );
  const limitClause = buildOffsetClause(query.page, query.limit);
  const dir = query.sortOrder === 'desc' ? 'DESC' : 'ASC';
  const dataReq = mainPool.request();
  bindFefoInputs(dataReq, query);
  const rowsRes = await dataReq.query<BloodBagRow>(`
    SELECT id, checkInId, maVachTuiMau, nhomMau, rhFactor, theTich,
      ngayLayMau, ngayHetHan, trangThai, ketQuaSangLoc, viTriKhoLanh,
      DATEDIFF(DAY, SYSUTCDATETIME(), ngayHetHan) AS daysRemaining
    FROM dbo.BloodBags ${FEFO_WHERE}
    ORDER BY ngayHetHan ${dir} ${limitClause};
  `);
  return { rows: rowsRes.recordset, total: countRes.recordset[0]?.total ?? 0 };
}

export async function queryQuarantineBags(query: QuarantineListQuery): Promise<{
  rows: BloodBagRow[];
  total: number;
}> {
  const countReq = mainPool.request();
  bindQuarantineInputs(countReq, query);
  const countRes = await countReq.query<{ total: number }>(
    `SELECT COUNT(*) AS total FROM dbo.BloodBags ${QUARANTINE_WHERE};`,
  );
  const limitClause = buildOffsetClause(query.page, query.limit);
  const dataReq = mainPool.request();
  bindQuarantineInputs(dataReq, query);
  const rowsRes = await dataReq.query<BloodBagRow>(`
    SELECT id, checkInId, maVachTuiMau, nhomMau, rhFactor, theTich,
      ngayLayMau, ngayHetHan, trangThai, ketQuaSangLoc, viTriKhoLanh,
      DATEDIFF(DAY, SYSUTCDATETIME(), ngayHetHan) AS daysRemaining
    FROM dbo.BloodBags ${QUARANTINE_WHERE}
    ORDER BY ngayLayMau ASC ${limitClause};
  `);
  return { rows: rowsRes.recordset, total: countRes.recordset[0]?.total ?? 0 };
}

export async function callRecordBloodBagLabResult(options: {
  bloodBagId: string;
  input: RecordLabResultInput;
  reviewedBy: string;
  ip: string | null;
}) {
  const req = mainPool.request();
  req.input('BloodBagId', sql.UniqueIdentifier, options.bloodBagId);
  req.input('KetQuaSangLoc', sql.VarChar(20), options.input.ketQuaSangLoc);
  req.input('NhomMauChinhThuc', sql.VarChar(2), options.input.nhomMauChinhThuc);
  req.input('RhFactorChinhThuc', sql.Char(1), options.input.rhFactorChinhThuc);
  req.input('ViTriKhoLanh', sql.NVarChar(100), options.input.viTriKhoLanh ?? null);
  req.input('ReviewedBy', sql.UniqueIdentifier, options.reviewedBy);
  req.input('DiaChiIP', sql.VarChar(45), options.ip);

  const result = await req.execute<{
    id: string;
    donorId: string;
    maVachTuiMau: string;
    nhomMau: BloodType;
    rhFactor: RhFactor;
    trangThai: BloodBagStatus;
    ketQuaSangLoc: string;
    ngayHetHan: Date;
  }>('dbo.sp_RecordBloodBagLabResult');
  return result.recordset[0]!;
}

export async function findDonorPlaintextContact(donorId: string): Promise<{
  id: string;
  soDienThoai: string | null;
  diaChi: string | null;
  nhomMau: BloodType | null;
  rhFactor: RhFactor | null;
  laNhomMauHiem: boolean;
} | null> {
  const req = mainPool.request();
  req.input('DonorId', sql.UniqueIdentifier, donorId);
  const res = await req.query<{
    id: string;
    soDienThoai: string | null;
    diaChi: string | null;
    nhomMau: BloodType | null;
    rhFactor: RhFactor | null;
    laNhomMauHiem: boolean;
  }>(`
    SELECT id, soDienThoai, diaChi, nhomMau, rhFactor, laNhomMauHiem
    FROM dbo.Donors WHERE id = @DonorId;
  `);
  return res.recordset[0] ?? null;
}

export async function callUpsertRareBloodVault(options: {
  donorId: string;
  nhomMauHiem: string;
  keyVersion: number;
  encryptedPhone: Buffer;
  ivPhone: Buffer;
  authTagPhone: Buffer;
  encryptedAddress: Buffer;
  ivAddress: Buffer;
  authTagAddress: Buffer;
  actorId: string | null;
  ip: string | null;
}): Promise<void> {
  const req = mainPool.request();
  req.input('DonorId', sql.UniqueIdentifier, options.donorId);
  req.input('NhomMauHiem', sql.VarChar(20), options.nhomMauHiem);
  req.input('KeyVersion', sql.Int, options.keyVersion);
  req.input('EncryptedPhone', sql.VarBinary(512), options.encryptedPhone);
  req.input('IvPhone', sql.VarBinary(16), options.ivPhone);
  req.input('AuthTagPhone', sql.VarBinary(32), options.authTagPhone);
  req.input('EncryptedAddress', sql.VarBinary(1024), options.encryptedAddress);
  req.input('IvAddress', sql.VarBinary(16), options.ivAddress);
  req.input('AuthTagAddress', sql.VarBinary(32), options.authTagAddress);
  req.input('ActorId', sql.UniqueIdentifier, options.actorId);
  req.input('DiaChiIP', sql.VarChar(45), options.ip);
  await req.execute('dbo.sp_UpsertRareBloodVault');
}

export async function queryRareVaultDonors(): Promise<RareDonorEncryptedRow[]> {
  const res = await mainPool.request().query<RareDonorEncryptedRow>(`
    SELECT v.donorId, d.hoTen, v.nhomMauHiem, v.keyVersion,
      v.encryptedPhone, v.ivPhone, v.authTagPhone,
      v.encryptedAddress, v.ivAddress, v.authTagAddress
    FROM dbo.RareBloodVault v
    INNER JOIN dbo.Donors d ON d.id = v.donorId
    ORDER BY d.hoTen ASC;
  `);
  return res.recordset;
}

export async function findActiveApproversExcluding(
  requesterId: string,
): Promise<{ id: string; email: string }[]> {
  const req = mainPool.request();
  req.input('RequesterId', sql.UniqueIdentifier, requesterId);
  const res = await req.query<{ id: string; email: string }>(`
    SELECT id, email FROM dbo.Users
    WHERE vaiTro = 'ADMIN' AND laNguoiPheDuyet = 1
      AND trangThai = 'ACTIVE' AND id <> @RequesterId;
  `);
  return res.recordset;
}

export async function callRequestVaultUnlock(options: {
  requesterId: string;
  donorId: string;
  maBenhAn: string;
  ip: string | null;
}) {
  const req = priorityPool.request();
  req.input('RequesterId', sql.UniqueIdentifier, options.requesterId);
  req.input('DonorId', sql.UniqueIdentifier, options.donorId);
  req.input('MaBenhAn', sql.NVarChar(50), options.maBenhAn);
  req.input('DiaChiIP', sql.VarChar(45), options.ip);

  const res = await req.execute<{
    requestId: string;
    requesterId: string;
    donorId: string;
    maBenhAn: string;
    trangThai: string;
    createdAt: Date;
  }>('dbo.sp_RequestRareBloodVaultUnlock');
  return res.recordset[0]!;
}

export async function callApproveVaultUnlock(options: {
  requestId: string;
  approverId: string;
  ip: string | null;
}) {
  const req = priorityPool.request();
  req.input('RequestId', sql.UniqueIdentifier, options.requestId);
  req.input('ApproverId', sql.UniqueIdentifier, options.approverId);
  req.input('GrantMinutes', sql.Int, 15);
  req.input('DiaChiIP', sql.VarChar(45), options.ip);

  const res = await req.execute<{
    requestId: string;
    requesterId: string;
    approverId: string;
    donorId: string;
    maBenhAn: string;
    trangThai: string;
    approvedAt: Date;
    expiresAt: Date;
  }>('dbo.sp_ApproveVaultUnlock');
  return res.recordset[0]!;
}

export async function callGetRareBloodVaultForReveal(options: {
  requestId: string;
  viewerId: string;
  ip: string | null;
}): Promise<RareDonorEncryptedRow & { expiresAt: Date }> {
  const req = priorityPool.request();
  req.input('RequestId', sql.UniqueIdentifier, options.requestId);
  req.input('ViewerId', sql.UniqueIdentifier, options.viewerId);
  req.input('DiaChiIP', sql.VarChar(45), options.ip);

  const res = await req.execute<RareDonorEncryptedRow & { expiresAt: Date }>(
    'dbo.sp_GetRareBloodVaultForReveal',
  );
  return res.recordset[0]!;
}

export async function queryAuditLogs(limit = 50) {
  const req = mainPool.request();
  req.input('Limit', sql.Int, limit);
  const res = await req.query(`
    SELECT TOP (@Limit) id, userId, hanhDong, chiTiet,
      diaChiIP, thoiGianTao, hashTruoc, [hash]
    FROM dbo.AuditLogs
    ORDER BY thoiGianTao DESC, id DESC;
  `);
  return res.recordset;
}
