import { env } from '../../config/env.js';
import { getCompatibleDonorBloodGroups } from '../../config/medical-thresholds.js';
import { domainEvents } from '../../shared/domain-events.js';
import { logger } from '../../shared/logger.js';
import { sendEmail } from '../../shared/mailer.js';
import { buildPaginationMeta } from '../../shared/pagination.js';
import type { AuthUser } from '../../types/domain.js';
import { getInventoryOverview } from '../inventory-vault/service.js';
import {
  callAcknowledgeEmergencyRequest,
  callCreateEmergencyRequest,
  callDispatchBloodBagsFefo,
  callHospitalReceiveBloodBag,
  findEmergencyAckStatus,
  queryDispatches,
  queryEmergencyRequests,
} from './repository.js';
import type {
  DispatchBloodBagsInput,
  EmergencyAlertInput,
  ListDispatchesQuery,
  VerifyAndReceiveInput,
} from './schemas.js';

interface FallbackEmailOptions {
  emergencyId: string;
  tenBenhVien: string;
  bloodLabel: string;
  unitsNeeded: number;
}

async function sendEmergencyFallbackEmails(options: FallbackEmailOptions): Promise<void> {
  try {
    const status = await findEmergencyAckStatus(options.emergencyId);
    if (!status || status.thoiGianXacNhan !== null || status.trangThaiXuLy !== 'PENDING') {
      return;
    }
    const subject =
      `[KHẨN CẤP - CHƯA XÁC NHẬN] ${options.tenBenhVien} ` +
      `cần ${options.unitsNeeded} túi ${options.bloodLabel}`;
    const html =
      `<p>Lệnh cấp cứu <strong>${options.emergencyId}</strong> ` +
      `từ <strong>${options.tenBenhVien}</strong> chưa được xác nhận sau 2 phút.</p>`;
    await Promise.all(
      env.emergencyOncallEmails.map((email) => sendEmail({ to: email, subject, html })),
    );
  } catch (err) {
    logger.error('emergency_fallback_notify_failed', {
      emergencyId: options.emergencyId,
      errorMessage: err instanceof Error ? err.message : String(err),
    });
  }
}

function scheduleEmergencyAckFallback(options: FallbackEmailOptions): void {
  const timer = setTimeout(() => {
    void sendEmergencyFallbackEmails(options);
  }, env.EMERGENCY_ACK_TIMEOUT_MS);
  timer.unref();
}

export async function getHospitalInventoryOverview() {
  return getInventoryOverview();
}

function dispatchEmergencySideEffects(
  emergency: Awaited<ReturnType<typeof callCreateEmergencyRequest>>,
): void {
  domainEvents.emit('emergency:red_alert', {
    emergencyId: emergency.id,
    hospitalId: emergency.hospitalId,
    tenBenhVien: emergency.tenBenhVien,
    maBenhAn: emergency.maBenhAn,
    nhomMauCan: emergency.nhomMauCan,
    rhFactor: emergency.rhFactor,
    soLuongTui: emergency.soLuongTui,
    mucDoKhan: emergency.mucDoKhan,
    createdAt: emergency.createdAt,
  });
  scheduleEmergencyAckFallback({
    emergencyId: emergency.id,
    tenBenhVien: emergency.tenBenhVien,
    bloodLabel: `${emergency.nhomMauCan}${emergency.rhFactor}`,
    unitsNeeded: emergency.soLuongTui,
  });
}

export async function triggerEmergencyAlert(options: {
  requesterUserId: string;
  input: EmergencyAlertInput;
  ip: string | null;
}) {
  const emergency = await callCreateEmergencyRequest(options);
  const compatibleGroups = getCompatibleDonorBloodGroups({
    nhomMau: options.input.bloodType,
    rhFactor: options.input.rhFactor,
  });
  dispatchEmergencySideEffects(emergency);
  return { emergency, compatibleGroups };
}

export async function acknowledgeEmergencyAlert(options: {
  emergencyId: string;
  staffUserId: string;
  ip: string | null;
}) {
  return callAcknowledgeEmergencyRequest(options);
}

export async function dispatchBloodBagsFefo(options: {
  input: DispatchBloodBagsInput;
  dispatchedBy: string;
  ip: string | null;
}) {
  const result = await callDispatchBloodBagsFefo(options);
  domainEvents.emit('inventory:stock_changed', {
    nhomMau: options.input.bloodType,
    rhFactor: options.input.rhFactor,
    action: 'DISPATCHED',
  });
  return result;
}

async function sendClosedLoopThankYou(options: {
  donorEmail: string | null;
  donorName: string;
  tenBenhVien: string;
  maVachTuiMau: string;
}): Promise<void> {
  if (options.donorEmail) {
    const html =
      `<p>Xin cảm ơn <strong>${options.donorName}</strong>! ` +
      `Túi máu <strong>${options.maVachTuiMau}</strong> của bạn vừa được ` +
      `<strong>${options.tenBenhVien}</strong> tiếp nhận an toàn để phục vụ người bệnh.</p>`;
    await sendEmail({
      to: options.donorEmail,
      subject: '[SmartBlood] Giọt máu của bạn đã đến bệnh viện an toàn',
      html,
    });
  }
  logger.info('closed_loop_thank_you_triggered', {
    maVachTuiMau: options.maVachTuiMau,
    tenBenhVien: options.tenBenhVien,
    hasEmail: Boolean(options.donorEmail),
  });
}

function emitBagReceivedEvents(
  receipt: Awaited<ReturnType<typeof callHospitalReceiveBloodBag>>,
): void {
  domainEvents.emit('hospital:bag_received', {
    bagId: receipt.bagId,
    maVachTuiMau: receipt.maVachTuiMau,
    tenBenhVien: receipt.tenBenhVien,
    nhomMau: receipt.nhomMau,
    rhFactor: receipt.rhFactor,
  });
  domainEvents.emit('inventory:stock_changed', {
    nhomMau: receipt.nhomMau,
    rhFactor: receipt.rhFactor,
    action: 'HOSPITAL_RECEIVED',
  });
}

export async function verifyAndReceiveBloodBag(options: {
  input: VerifyAndReceiveInput;
  receiverUserId: string;
  ip: string | null;
}) {
  const receipt = await callHospitalReceiveBloodBag(options);
  emitBagReceivedEvents(receipt);
  await sendClosedLoopThankYou({
    donorEmail: receipt.donorEmail,
    donorName: receipt.donorName,
    tenBenhVien: receipt.tenBenhVien,
    maVachTuiMau: receipt.maVachTuiMau,
  });
  return {
    bagId: receipt.bagId,
    maVachTuiMau: receipt.maVachTuiMau,
    nhomMau: receipt.nhomMau,
    rhFactor: receipt.rhFactor,
    theTich: receipt.theTich,
    trangThai: receipt.trangThai,
    tenBenhVien: receipt.tenBenhVien,
    thoiGianTiepNhan: receipt.thoiGianTiepNhan,
  };
}

export async function listEmergencyRequestsForUser(user: AuthUser) {
  const hospitalId = user.vaiTro === 'HOSPITAL_STAFF' ? user.hospitalId : null;
  return queryEmergencyRequests(hospitalId);
}

export async function listDispatchesForUser(options: {
  user: AuthUser;
  query: ListDispatchesQuery;
}) {
  const hospitalId = options.user.vaiTro === 'HOSPITAL_STAFF' ? options.user.hospitalId : null;
  const { rows, total } = await queryDispatches({ hospitalId, query: options.query });
  return {
    items: rows,
    pagination: buildPaginationMeta({
      page: options.query.page,
      limit: options.query.limit,
      total,
    }),
  };
}
