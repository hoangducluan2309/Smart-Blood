import sql from 'mssql';

import { mainPool } from '../../config/database.js';
import { buildOffsetClause } from '../../shared/pagination.js';
import type { EventStatus } from '../../types/domain.js';
import type { CreateEventInput, ListEventsQuery } from './schemas.js';

export interface EventRow {
  id: string;
  maSuKien: string;
  tenSuKien: string;
  diaDiem: string;
  diaChiChiTiet: string | null;
  ngayToChuc: Date;
  gioBatDau: string;
  gioKetThuc: string;
  chiTieuSoLuong: number;
  soLuongThucTe: number;
  qrCodeUrl: string | null;
  ghiChu: string | null;
  trangThai: EventStatus;
  createdAt: Date;
}

export interface EventProgressRow {
  id: string;
  maSuKien: string;
  tenSuKien: string;
  chiTieuSoLuong: number;
  soLuongThucTe: number;
  soLuongDangKy: number;
  trangThai: EventStatus;
}

const EVENT_WHERE_CLAUSE = `
  WHERE (@TrangThai IS NULL OR trangThai = @TrangThai)
    AND (@Search IS NULL OR tenSuKien LIKE @Search
      OR diaDiem LIKE @Search OR maSuKien LIKE @Search)
`;

function bindEventFilterParams(req: sql.Request, query: ListEventsQuery): void {
  req.input('TrangThai', sql.VarChar(20), query.trangThai ?? null);
  req.input('Search', sql.NVarChar(100), query.search ? `%${query.search}%` : null);
}

export async function insertDonationEvent(options: {
  input: CreateEventInput;
  createdBy: string;
  ip: string | null;
}): Promise<EventRow> {
  const { input, createdBy, ip } = options;
  const req = mainPool.request();
  req.input('TenSuKien', sql.NVarChar(200), input.tenSuKien);
  req.input('DiaDiem', sql.NVarChar(200), input.diaDiem);
  req.input('DiaChiChiTiet', sql.NVarChar(300), input.diaChiChiTiet ?? null);
  req.input('NgayToChuc', sql.Date, input.ngayToChuc);
  req.input('GioBatDau', sql.VarChar(8), input.gioBatDau);
  req.input('GioKetThuc', sql.VarChar(8), input.gioKetThuc);
  req.input('ChiTieuSoLuong', sql.Int, input.chiTieuSoLuong);
  req.input('GhiChu', sql.NVarChar(500), input.ghiChu ?? null);
  req.input('CreatedBy', sql.UniqueIdentifier, createdBy);
  req.input('DiaChiIP', sql.VarChar(45), ip);
  const result = await req.execute<EventRow>('dbo.sp_CreateDonationEvent');
  return result.recordset[0]!;
}

export async function queryEvents(query: ListEventsQuery): Promise<{
  rows: EventRow[];
  total: number;
}> {
  const countReq = mainPool.request();
  bindEventFilterParams(countReq, query);
  const countResult = await countReq.query<{ total: number }>(
    `SELECT COUNT(*) AS total FROM dbo.DonationEvents ${EVENT_WHERE_CLAUSE};`,
  );

  const orderDir = query.sortOrder === 'asc' ? 'ASC' : 'DESC';
  const limitClause = buildOffsetClause(query.page, query.limit);
  const dataReq = mainPool.request();
  bindEventFilterParams(dataReq, query);
  const rowsResult = await dataReq.query<EventRow>(`
    SELECT id, maSuKien, tenSuKien, diaDiem, diaChiChiTiet, ngayToChuc,
      CONVERT(VARCHAR(8), gioBatDau, 108) AS gioBatDau,
      CONVERT(VARCHAR(8), gioKetThuc, 108) AS gioKetThuc,
      chiTieuSoLuong, soLuongThucTe, qrCodeUrl, ghiChu, trangThai, createdAt
    FROM dbo.DonationEvents ${EVENT_WHERE_CLAUSE}
    ORDER BY ngayToChuc ${orderDir}, createdAt DESC ${limitClause};
  `);
  return { rows: rowsResult.recordset, total: countResult.recordset[0]?.total ?? 0 };
}

export async function findEventById(eventId: string): Promise<EventRow | null> {
  const req = mainPool.request();
  req.input('EventId', sql.UniqueIdentifier, eventId);
  const result = await req.query<EventRow>(`
    SELECT id, maSuKien, tenSuKien, diaDiem, diaChiChiTiet, ngayToChuc,
      CONVERT(VARCHAR(8), gioBatDau, 108) AS gioBatDau,
      CONVERT(VARCHAR(8), gioKetThuc, 108) AS gioKetThuc,
      chiTieuSoLuong, soLuongThucTe, qrCodeUrl, ghiChu, trangThai, createdAt
    FROM dbo.DonationEvents WHERE id = @EventId;
  `);
  return result.recordset[0] ?? null;
}

export async function findEventProgress(eventId: string): Promise<EventProgressRow | null> {
  const req = mainPool.request();
  req.input('EventId', sql.UniqueIdentifier, eventId);
  const result = await req.query<EventProgressRow>(`
    SELECT e.id, e.maSuKien, e.tenSuKien, e.chiTieuSoLuong,
      e.soLuongThucTe, e.trangThai, COUNT(c.id) AS soLuongDangKy
    FROM dbo.DonationEvents e
    LEFT JOIN dbo.DonorCheckIns c ON c.eventId = e.id
    WHERE e.id = @EventId
    GROUP BY e.id, e.maSuKien, e.tenSuKien,
      e.chiTieuSoLuong, e.soLuongThucTe, e.trangThai;
  `);
  return result.recordset[0] ?? null;
}

export async function changeEventStatus(options: {
  eventId: string;
  trangThai: EventStatus;
  updatedBy: string;
  ip: string | null;
}): Promise<{ id: string; maSuKien: string; trangThai: EventStatus; updatedAt: Date }> {
  const req = mainPool.request();
  req.input('EventId', sql.UniqueIdentifier, options.eventId);
  req.input('TrangThai', sql.VarChar(20), options.trangThai);
  req.input('UpdatedBy', sql.UniqueIdentifier, options.updatedBy);
  req.input('DiaChiIP', sql.VarChar(45), options.ip);
  const result = await req.execute<{
    id: string;
    maSuKien: string;
    trangThai: EventStatus;
    updatedAt: Date;
  }>('dbo.sp_UpdateDonationEventStatus');
  return result.recordset[0]!;
}
