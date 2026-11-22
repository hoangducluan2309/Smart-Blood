import sql from 'mssql';

import { mainPool } from '../../config/database.js';
import { buildOffsetClause } from '../../shared/pagination.js';
import type { BloodType, CheckInStep, RhFactor } from '../../types/domain.js';
import type { CollectBloodBagInput, QueueListQuery, RapidTestInput } from './schemas.js';

export interface MedicalQueueRow {
  checkInId: string;
  eventId: string;
  stt: number;
  hoTen: string;
  nhomMau: BloodType | null;
  rhFactor: RhFactor | null;
  luongMauDangKy: number;
  buocHienTai: CheckInStep;
  lyDoTamHoan: string | null;
  thoiGianCheckIn: Date;
}

const QUEUE_WHERE = `
  WHERE c.eventId = @EventId
    AND (@Buoc IS NULL OR c.buocHienTai = @Buoc)
    AND (@Search IS NULL OR d.hoTen LIKE @Search OR CAST(c.stt AS VARCHAR(10)) = @ExactStt)
`;

function bindQueueInputs(
  req: sql.Request,
  options: { eventId: string; query: QueueListQuery },
): void {
  const { eventId, query } = options;
  req.input('EventId', sql.UniqueIdentifier, eventId);
  req.input('Buoc', sql.VarChar(20), query.buocHienTai ?? null);
  req.input('Search', sql.NVarChar(100), query.search ? `%${query.search}%` : null);
  req.input('ExactStt', sql.VarChar(10), query.search ?? '');
}

export async function queryMedicalQueue(options: {
  eventId: string;
  query: QueueListQuery;
}): Promise<{ rows: MedicalQueueRow[]; total: number }> {
  const countReq = mainPool.request();
  bindQueueInputs(countReq, options);
  const countRes = await countReq.query<{ total: number }>(`
    SELECT COUNT(*) AS total FROM dbo.DonorCheckIns c
    INNER JOIN dbo.Donors d ON d.id = c.donorId ${QUEUE_WHERE};
  `);

  const limitClause = buildOffsetClause(options.query.page, options.query.limit);
  const dir = options.query.sortOrder === 'desc' ? 'DESC' : 'ASC';
  const dataReq = mainPool.request();
  bindQueueInputs(dataReq, options);
  const rowsRes = await dataReq.query<MedicalQueueRow>(`
    SELECT c.id AS checkInId, c.eventId, c.stt, d.hoTen, d.nhomMau, d.rhFactor,
      c.luongMauDangKy, c.buocHienTai, c.lyDoTamHoan, c.thoiGianCheckIn
    FROM dbo.DonorCheckIns c
    INNER JOIN dbo.Donors d ON d.id = c.donorId ${QUEUE_WHERE}
    ORDER BY c.stt ${dir} ${limitClause};
  `);
  return { rows: rowsRes.recordset, total: countRes.recordset[0]?.total ?? 0 };
}

interface ClinicalExamCallOptions {
  checkInId: string;
  bacSiId: string;
  huyetApTamThu: number;
  huyetApTamTruong: number;
  nhipTim: number;
  canNang: number;
  theTichDuocPhep: number | null;
  ketLuan: 'DAT' | 'TAM_HOAN';
  lyDoTuChoi: string | null;
  ip: string | null;
}

export async function callRecordClinicalExam(options: ClinicalExamCallOptions) {
  const req = mainPool.request();
  req.input('CheckInId', sql.UniqueIdentifier, options.checkInId);
  req.input('BacSiId', sql.UniqueIdentifier, options.bacSiId);
  req.input('HuyetApTamThu', sql.Int, options.huyetApTamThu);
  req.input('HuyetApTamTruong', sql.Int, options.huyetApTamTruong);
  req.input('NhipTim', sql.Int, options.nhipTim);
  req.input('CanNang', sql.Decimal(5, 2), options.canNang);
  req.input('TheTichDuocPhep', sql.Int, options.theTichDuocPhep);
  req.input('KetLuan', sql.VarChar(20), options.ketLuan);
  req.input('LyDoTuChoi', sql.NVarChar(500), options.lyDoTuChoi);
  req.input('DiaChiIP', sql.VarChar(45), options.ip);
  const res = await req.execute<{
    checkInId: string;
    eventId: string;
    stt: number;
    buocHienTai: CheckInStep;
  }>('dbo.sp_RecordClinicalExam');
  return res.recordset[0]!;
}

export async function callRecordScreeningTest(options: {
  input: RapidTestInput;
  kyThuatVienId: string;
  ketLuan: 'DAT' | 'TAM_HOAN';
  lyDoTamHoan: string | null;
  ip: string | null;
}) {
  const { input } = options;
  const req = mainPool.request();
  req.input('CheckInId', sql.UniqueIdentifier, input.checkInId);
  req.input('KyThuatVienId', sql.UniqueIdentifier, options.kyThuatVienId);
  req.input('Hemoglobin', sql.Decimal(4, 1), input.hemoglobin);
  req.input('HbsagTest', sql.VarChar(15), input.testHbsAg);
  req.input('HcvTest', sql.VarChar(15), input.testHCV);
  req.input('HivTest', sql.VarChar(15), input.testHIV);
  req.input('NhomMauSoBo', sql.VarChar(2), input.nhomMauXacNhan);
  req.input('RhFactorSoBo', sql.Char(1), input.rhFactor);
  req.input('KetLuan', sql.VarChar(20), options.ketLuan);
  req.input('LyDoTamHoan', sql.NVarChar(500), options.lyDoTamHoan);
  req.input('DiaChiIP', sql.VarChar(45), options.ip);
  const res = await req.execute<{
    checkInId: string;
    eventId: string;
    stt: number;
    buocHienTai: CheckInStep;
    donorId: string;
    isRareBloodCandidate: boolean;
  }>('dbo.sp_RecordScreeningTest');
  return res.recordset[0]!;
}

export async function callProcessBloodBagStockIn(options: {
  input: CollectBloodBagInput;
  collectedBy: string;
  ip: string | null;
}) {
  const req = mainPool.request();
  req.input('CheckInId', sql.UniqueIdentifier, options.input.checkInId);
  req.input('TheTichThucTe', sql.Int, options.input.theTichThucTe);
  req.input('ViTriKhoLanhTamThoi', sql.NVarChar(100), options.input.viTriKhoLanhTamThoi ?? null);
  req.input('CollectedBy', sql.UniqueIdentifier, options.collectedBy);
  req.input('DiaChiIP', sql.VarChar(45), options.ip);

  const res = await req.execute<{
    bloodBagId: string;
    maVachTuiMau: string;
    qrPayload: string;
    nhomMau: BloodType;
    rhFactor: RhFactor;
    theTich: number;
    ngayLayMau: Date;
    ngayHetHan: Date;
    trangThai: string;
    eventId: string;
    checkInId: string;
    stt: number;
  }>('dbo.sp_ProcessBloodBagStockIn');
  return res.recordset[0]!;
}
