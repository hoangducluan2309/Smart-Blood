import QRCode from 'qrcode';

import { evaluateClinicalVitals, MEDICAL_THRESHOLDS } from '../../config/medical-thresholds.js';
import { AppError } from '../../shared/app-error.js';
import { domainEvents } from '../../shared/domain-events.js';
import { buildPaginationMeta } from '../../shared/pagination.js';
import { getEventProgressSummary } from '../event-qr/service.js';
import { sealDonorRareBloodContact } from '../inventory-vault/service.js';
import {
  callProcessBloodBagStockIn,
  callRecordClinicalExam,
  callRecordScreeningTest,
  queryMedicalQueue,
} from './repository.js';
import type {
  ClinicalExamInput,
  CollectBloodBagInput,
  QueueListQuery,
  RapidTestInput,
} from './schemas.js';

function resolveClinicalDecision(input: ClinicalExamInput): {
  finalConclusion: 'DAT' | 'TAM_HOAN';
  reason: string | null;
} {
  const failedReasons = evaluateClinicalVitals({
    huyetApTamThu: input.huyetApTamThu,
    huyetApTamTruong: input.huyetApTamTruong,
    nhipTim: input.nhipTim,
    canNang: input.canNang,
  });
  const finalConclusion =
    input.ketLuan === 'TAM_HOAN' || failedReasons.length > 0 ? 'TAM_HOAN' : 'DAT';
  const reason =
    finalConclusion === 'TAM_HOAN'
      ? input.lyDo ?? (failedReasons.join('; ') || 'Không đạt khám sàng lọc lâm sàng')
      : null;

  if (finalConclusion === 'DAT' && !input.theTichDuocPhep) {
    throw new AppError({
      message: 'Bác sĩ phải xác nhận thể tích máu được phép lấy',
      statusCode: 422,
      code: 'ALLOWED_VOLUME_REQUIRED',
    });
  }
  return { finalConclusion, reason };
}

export async function getMedicalQueue(options: {
  eventId: string;
  query: QueueListQuery;
}) {
  const { rows, total } = await queryMedicalQueue(options);
  return {
    items: rows,
    pagination: buildPaginationMeta({
      page: options.query.page,
      limit: options.query.limit,
      total,
    }),
  };
}

export async function submitClinicalExam(options: {
  input: ClinicalExamInput;
  bacSiId: string;
  ip: string | null;
}) {
  const { input } = options;
  const { finalConclusion, reason } = resolveClinicalDecision(input);
  const updated = await callRecordClinicalExam({
    checkInId: input.checkInId,
    bacSiId: options.bacSiId,
    huyetApTamThu: input.huyetApTamThu,
    huyetApTamTruong: input.huyetApTamTruong,
    nhipTim: input.nhipTim,
    canNang: input.canNang,
    theTichDuocPhep: finalConclusion === 'DAT' ? (input.theTichDuocPhep ?? null) : null,
    ketLuan: finalConclusion,
    lyDoTuChoi: reason,
    ip: options.ip,
  });
  domainEvents.emit('medical:step_updated', {
    eventId: updated.eventId,
    checkInId: updated.checkInId,
    stt: updated.stt,
    buocHienTai: updated.buocHienTai,
    lyDoTamHoan: reason,
  });
  return updated;
}

function evaluateRapidTestFailureReason(input: RapidTestInput): string | null {
  const reasons: string[] = [];
  if (input.hemoglobin < MEDICAL_THRESHOLDS.MIN_HEMOGLOBIN_G_DL) {
    reasons.push(`Hemoglobin thấp (< ${MEDICAL_THRESHOLDS.MIN_HEMOGLOBIN_G_DL} g/dL)`);
  }
  if (
    input.testHbsAg === 'DUONG_TINH' ||
    input.testHCV === 'DUONG_TINH' ||
    input.testHIV === 'DUONG_TINH'
  ) {
    reasons.push('Cần tư vấn y tế riêng về kết quả sàng lọc nhanh');
  }
  return reasons.length > 0 ? reasons.join('; ') : null;
}

export async function submitRapidTest(options: {
  input: RapidTestInput;
  kyThuatVienId: string;
  ip: string | null;
}) {
  const failureReason = evaluateRapidTestFailureReason(options.input);
  const result = await callRecordScreeningTest({
    input: options.input,
    kyThuatVienId: options.kyThuatVienId,
    ketLuan: failureReason ? 'TAM_HOAN' : 'DAT',
    lyDoTamHoan: failureReason,
    ip: options.ip,
  });
  if (result.isRareBloodCandidate) {
    await sealDonorRareBloodContact({
      donorId: result.donorId,
      nhomMauHiem: `${options.input.nhomMauXacNhan}${options.input.rhFactor}`,
      actorId: options.kyThuatVienId,
      ip: options.ip,
    });
  }
  domainEvents.emit('medical:step_updated', {
    eventId: result.eventId,
    checkInId: result.checkInId,
    stt: result.stt,
    buocHienTai: result.buocHienTai,
    lyDoTamHoan: failureReason,
  });
  return result;
}

export async function collectBloodBag(options: {
  input: CollectBloodBagInput;
  collectedBy: string;
  ip: string | null;
}) {
  const bag = await callProcessBloodBagStockIn(options);
  // QR dan tui mau chi chua ma tui (khong chua PII)
  const qrDataUrl = await QRCode.toDataURL(bag.qrPayload, { margin: 1, width: 320 });

  domainEvents.emit('medical:step_updated', {
    eventId: bag.eventId,
    checkInId: bag.checkInId,
    stt: bag.stt,
    buocHienTai: 'HOAN_THANH',
  });

  const progress = await getEventProgressSummary(bag.eventId);
  domainEvents.emit('event:progress_updated', {
    eventId: bag.eventId,
    soLuongThucTe: progress.soLuongThucTe,
  });

  return { ...bag, qrDataUrl };
}
