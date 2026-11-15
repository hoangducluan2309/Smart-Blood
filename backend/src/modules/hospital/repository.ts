import sql from 'mssql';

import { mainPool, priorityPool } from '../../config/database.js';
import { buildOffsetClause } from '../../shared/pagination.js';
import type { BloodType, RhFactor } from '../../types/domain.js';
import type {
  DispatchBloodBagsInput,
  EmergencyAlertInput,
  ListDispatchesQuery,
  VerifyAndReceiveInput,
} from './schemas.js';

const DISPATCH_WHERE = `
  WHERE (@HospitalId IS NULL OR d.hospitalId = @HospitalId)
    AND (@TrangThaiGiao IS NULL OR d.trangThaiGiao = @TrangThaiGiao)
`;

function bindDispatchInputs(
  req: sql.Request,
  options: { hospitalId: string | null; query: ListDispatchesQuery },
): void {
  req.input('HospitalId', sql.UniqueIdentifier, options.hospitalId);
  req.input('TrangThaiGiao', sql.VarChar(20), options.query.trangThaiGiao ?? null);
}

export async function callCreateEmergencyRequest(options: {
  requesterUserId: string;
  input: EmergencyAlertInput;
  ip: string | null;
}) {
  const req = priorityPool.request();
  req.input('RequesterUserId', sql.UniqueIdentifier, options.requesterUserId);
  req.input('MaBenhAn', sql.NVarChar(50), options.input.patientCaseId);
  req.input('NhomMauCan', sql.VarChar(2), options.input.bloodType);
  req.input('RhFactor', sql.Char(1), options.input.rhFactor);
  req.input('SoLuongTui', sql.Int, options.input.unitsNeeded);
  req.input('MucDoKhan', sql.VarChar(20), options.input.urgencyLevel);
  req.input('DiaChiIP', sql.VarChar(45), options.ip);

  const res = await req.execute<{
    id: string;
    hospitalId: string;
    tenBenhVien: string;
    maBenhAn: string;
    nhomMauCan: BloodType;
    rhFactor: RhFactor;
    soLuongTui: number;
    mucDoKhan: string;
    trangThaiXuLy: string;
    createdAt: Date;
  }>('dbo.sp_CreateEmergencyRequest');
  return res.recordset[0]!;
}

export async function findEmergencyAckStatus(emergencyId: string): Promise<{
  id: string;
  trangThaiXuLy: string;
  thoiGianXacNhan: Date | null;
} | null> {
  const req = priorityPool.request();
  req.input('Id', sql.UniqueIdentifier, emergencyId);
  const res = await req.query<{
    id: string;
    trangThaiXuLy: string;
    thoiGianXacNhan: Date | null;
  }>(`
    SELECT id, trangThaiXuLy, thoiGianXacNhan
    FROM dbo.EmergencyRequests WHERE id = @Id;
  `);
  return res.recordset[0] ?? null;
}

export async function callAcknowledgeEmergencyRequest(options: {
  emergencyId: string;
  staffUserId: string;
  ip: string | null;
}) {
  const req = priorityPool.request();
  req.input('EmergencyRequestId', sql.UniqueIdentifier, options.emergencyId);
  req.input('StaffUserId', sql.UniqueIdentifier, options.staffUserId);
  req.input('DiaChiIP', sql.VarChar(45), options.ip);

  const res = await req.execute<{
    id: string;
    trangThaiXuLy: string;
    thoiGianXacNhan: Date | null;
    nguoiXacNhanId: string | null;
  }>('dbo.sp_AcknowledgeEmergencyRequest');
  return res.recordset[0]!;
}

export async function callDispatchBloodBagsFefo(options: {
  input: DispatchBloodBagsInput;
  dispatchedBy: string;
  ip: string | null;
}) {
  const req = priorityPool.request();
  req.input('HospitalId', sql.UniqueIdentifier, options.input.hospitalId);
  req.input('BloodType', sql.VarChar(2), options.input.bloodType);
  req.input('RhFactor', sql.Char(1), options.input.rhFactor);
  req.input('UnitsNeeded', sql.Int, options.input.unitsNeeded);
  req.input('BienSoXe', sql.NVarChar(20), options.input.bienSoXe);
  req.input('TaiXeHotline', sql.VarChar(15), options.input.taiXeHotline);
  req.input('EmergencyRequestId', sql.UniqueIdentifier, options.input.emergencyRequestId ?? null);
  req.input('DispatchedBy', sql.UniqueIdentifier, options.dispatchedBy);
  req.input('DiaChiIP', sql.VarChar(45), options.ip);

  const res = await req.execute('dbo.sp_DispatchBloodBagsFEFO');
  const recordsets = res.recordsets as unknown as [
    Array<{ dispatchId: string; hospitalId: string; bienSoXe: string; taiXeHotline: string }>,
    Array<{ bagId: string; maVachTuiMau: string; ngayHetHan: Date }>,
  ];
  return { dispatch: recordsets[0][0]!, bags: recordsets[1] ?? [] };
}

export async function callHospitalReceiveBloodBag(options: {
  input: VerifyAndReceiveInput;
  receiverUserId: string;
  ip: string | null;
}) {
  const req = priorityPool.request();
  req.input('BagCode', sql.VarChar(30), options.input.bagCode);
  req.input('ReceiverUserId', sql.UniqueIdentifier, options.receiverUserId);
  req.input('NhietDo', sql.Decimal(4, 1), options.input.temperatureRecorded);
  req.input('DiaChiIP', sql.VarChar(45), options.ip);

  const res = await req.execute<{
    bagId: string;
    maVachTuiMau: string;
    nhomMau: BloodType;
    rhFactor: RhFactor;
    theTich: number;
    trangThai: string;
    tenBenhVien: string;
    thoiGianTiepNhan: Date;
    donorName: string;
    laNhomMauHiem: boolean;
    donorPhone: string | null;
    donorEmail: string | null;
  }>('dbo.sp_HospitalReceiveBloodBag');
  return res.recordset[0]!;
}

export async function queryEmergencyRequests(hospitalId: string | null) {
  const req = mainPool.request();
  req.input('HospitalId', sql.UniqueIdentifier, hospitalId);
  const res = await req.query(`
    SELECT e.id, e.hospitalId, h.tenBenhVien, e.maBenhAn, e.nhomMauCan,
      e.rhFactor, e.soLuongTui, e.mucDoKhan, e.trangThaiXuLy,
      e.thoiGianXacNhan, e.createdAt
    FROM dbo.EmergencyRequests e
    INNER JOIN dbo.Hospitals h ON h.id = e.hospitalId
    WHERE (@HospitalId IS NULL OR e.hospitalId = @HospitalId)
    ORDER BY e.createdAt DESC;
  `);
  return res.recordset;
}

export async function queryDispatches(options: {
  hospitalId: string | null;
  query: ListDispatchesQuery;
}) {
  const countReq = mainPool.request();
  bindDispatchInputs(countReq, options);
  const countRes = await countReq.query<{ total: number }>(
    `SELECT COUNT(*) AS total FROM dbo.HospitalDispatches d ${DISPATCH_WHERE};`,
  );
  const limitClause = buildOffsetClause(options.query.page, options.query.limit);
  const dataReq = mainPool.request();
  bindDispatchInputs(dataReq, options);
  const rowsRes = await dataReq.query(`
    SELECT d.id, d.hospitalId, h.tenBenhVien, d.emergencyRequestId, d.bienSoXe,
      d.taiXeHotline, d.thoiGianXuatKho, d.trangThaiGiao, COUNT(b.id) AS soTuiMau
    FROM dbo.HospitalDispatches d
    INNER JOIN dbo.Hospitals h ON h.id = d.hospitalId
    LEFT JOIN dbo.HospitalDispatchBags b ON b.dispatchId = d.id
    ${DISPATCH_WHERE}
    GROUP BY d.id, d.hospitalId, h.tenBenhVien, d.emergencyRequestId,
      d.bienSoXe, d.taiXeHotline, d.thoiGianXuatKho, d.trangThaiGiao
    ORDER BY d.thoiGianXuatKho DESC ${limitClause};
  `);
  return { rows: rowsRes.recordset, total: countRes.recordset[0]?.total ?? 0 };
}
