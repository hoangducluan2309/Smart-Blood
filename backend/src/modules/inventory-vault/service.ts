import crypto from 'node:crypto';

import { AppError } from '../../shared/app-error.js';
import { domainEvents } from '../../shared/domain-events.js';
import { buildOtpEmailHtml, sendEmail } from '../../shared/mailer.js';
import { memoryStore, TTL_POLICIES } from '../../shared/memory-store.js';
import { buildPaginationMeta } from '../../shared/pagination.js';
import {
  decryptVaultField,
  maskPhoneNumber,
  sealRareContact,
} from '../../shared/vault-crypto.js';
import {
  callApproveVaultUnlock,
  callGetRareBloodVaultForReveal,
  callRecordBloodBagLabResult,
  callRequestVaultUnlock,
  callUpsertRareBloodVault,
  findActiveApproversExcluding,
  findDonorPlaintextContact,
  queryAuditLogs,
  queryFefoBags,
  queryInventorySummary,
  queryQuarantineBags,
  queryRareVaultDonors,
} from './repository.js';
import type {
  ApproveVaultUnlockInput,
  FefoListQuery,
  QuarantineListQuery,
  RecordLabResultInput,
  RequestVaultUnlockInput,
} from './schemas.js';

interface VaultOtpRecord {
  otp: string;
  attempts: number;
}

function classifyFefoLevel(daysRemaining: number): 'RED' | 'YELLOW' | 'GREEN' {
  if (daysRemaining < 7) {
    return 'RED';
  }
  if (daysRemaining <= 15) {
    return 'YELLOW';
  }
  return 'GREEN';
}

export async function getInventoryOverview() {
  return queryInventorySummary();
}

export async function listFefoBloodBags(query: FefoListQuery) {
  const { rows, total } = await queryFefoBags(query);
  const items = rows.map((row) => ({
    ...row,
    expiryLevel: classifyFefoLevel(row.daysRemaining),
  }));
  return {
    items,
    pagination: buildPaginationMeta({ page: query.page, limit: query.limit, total }),
  };
}

export async function listQuarantineBloodBags(query: QuarantineListQuery) {
  const { rows, total } = await queryQuarantineBags(query);
  return {
    items: rows,
    pagination: buildPaginationMeta({ page: query.page, limit: query.limit, total }),
  };
}

export async function sealRareBloodContactValues(options: {
  donorId: string;
  nhomMauHiem: string;
  soDienThoai: string;
  diaChi: string;
  actorId: string | null;
  ip: string | null;
}): Promise<void> {
  const sealed = sealRareContact({
    soDienThoai: options.soDienThoai,
    diaChi: options.diaChi,
  });
  await callUpsertRareBloodVault({
    donorId: options.donorId,
    nhomMauHiem: options.nhomMauHiem,
    keyVersion: sealed.keyVersion,
    encryptedPhone: sealed.phone.ciphertext,
    ivPhone: sealed.phone.iv,
    authTagPhone: sealed.phone.authTag,
    encryptedAddress: sealed.address.ciphertext,
    ivAddress: sealed.address.iv,
    authTagAddress: sealed.address.authTag,
    actorId: options.actorId,
    ip: options.ip,
  });
}

export async function sealDonorRareBloodContact(options: {
  donorId: string;
  nhomMauHiem: string;
  actorId: string | null;
  ip: string | null;
}): Promise<void> {
  const donor = await findDonorPlaintextContact(options.donorId);
  if (!donor || !donor.soDienThoai || !donor.diaChi) {
    return;
  }
  await sealRareBloodContactValues({
    donorId: options.donorId,
    nhomMauHiem: options.nhomMauHiem,
    soDienThoai: donor.soDienThoai,
    diaChi: donor.diaChi,
    actorId: options.actorId,
    ip: options.ip,
  });
}

export async function recordBloodBagLabResult(options: {
  bloodBagId: string;
  input: RecordLabResultInput;
  reviewedBy: string;
  ip: string | null;
}) {
  const updated = await callRecordBloodBagLabResult(options);
  if (updated.ketQuaSangLoc === 'DAT' && updated.rhFactor === '-') {
    await sealDonorRareBloodContact({
      donorId: updated.donorId,
      nhomMauHiem: `${updated.nhomMau}${updated.rhFactor}`,
      actorId: options.reviewedBy,
      ip: options.ip,
    });
  }
  domainEvents.emit('inventory:stock_changed', {
    nhomMau: updated.nhomMau,
    rhFactor: updated.rhFactor,
    action: updated.trangThai,
  });
  return updated;
}

export async function listMaskedRareDonors() {
  const rows = await queryRareVaultDonors();
  return rows.map((row) => {
    const phone = decryptVaultField(
      { ciphertext: row.encryptedPhone, iv: row.ivPhone, authTag: row.authTagPhone },
      row.keyVersion,
    );
    return {
      donorId: row.donorId,
      hoTen: row.hoTen,
      nhomMauHiem: row.nhomMauHiem,
      maskedPhone: maskPhoneNumber(phone),
    };
  });
}

async function notifyApproversWithOtp(options: {
  approvers: { id: string; email: string }[];
  requestId: string;
  maBenhAn: string;
  otp: string;
}): Promise<void> {
  const desc =
    `Mã bệnh án cấp cứu: <strong>${options.maBenhAn}</strong>. ` +
    'Vui lòng tự đăng nhập để nhập mã OTP này trong phiên của bạn.';
  // Chi gui OTP cho lanh dao phe duyet, tuyet doi khong tra ve cho nguoi yeu cau
  await Promise.all(
    options.approvers.map((approver) =>
      sendEmail({
        to: approver.email,
        subject: `[SmartBlood] Phê duyệt mở Két Máu Hiếm - Ca ${options.maBenhAn}`,
        html: buildOtpEmailHtml({
          title: `Yêu cầu mở Két Máu Hiếm (Mã yêu cầu: ${options.requestId})`,
          otp: options.otp,
          description: desc,
        }),
      }),
    ),
  );
}

async function dispatchVaultUnlockOtp(options: {
  approvers: { id: string; email: string }[];
  requestId: string;
  maBenhAn: string;
}): Promise<void> {
  const otp = String(crypto.randomInt(100000, 1000000));
  memoryStore.set<VaultOtpRecord>(`otp:vault:${options.requestId}`, {
    value: { otp, attempts: 0 },
    ttlSeconds: TTL_POLICIES.VAULT_OTP_SECONDS,
  });
  await notifyApproversWithOtp({ ...options, otp });
}

export async function requestRareBloodVaultUnlock(options: {
  requesterId: string;
  input: RequestVaultUnlockInput;
  ip: string | null;
}) {
  const approvers = await findActiveApproversExcluding(options.requesterId);
  if (approvers.length === 0) {
    throw new AppError({
      message: 'Hiện không có tài khoản lãnh đạo phê duyệt khác khả dụng.',
      statusCode: 409,
      code: 'NO_AVAILABLE_APPROVER',
    });
  }
  const request = await callRequestVaultUnlock({
    requesterId: options.requesterId,
    donorId: options.input.donorId,
    maBenhAn: options.input.maBenhAn,
    ip: options.ip,
  });
  await dispatchVaultUnlockOtp({
    approvers,
    requestId: request.requestId,
    maBenhAn: options.input.maBenhAn,
  });
  return request;
}

function handleInvalidVaultOtp(key: string, otpRecord: VaultOtpRecord): never {
  const nextAttempts = otpRecord.attempts + 1;
  if (nextAttempts >= TTL_POLICIES.VAULT_OTP_MAX_ATTEMPTS) {
    memoryStore.delete(key);
  } else {
    memoryStore.set<VaultOtpRecord>(key, {
      value: { otp: otpRecord.otp, attempts: nextAttempts },
      ttlSeconds: TTL_POLICIES.VAULT_OTP_SECONDS,
    });
  }
  throw new AppError({
    message: 'Mã OTP phê duyệt không chính xác.',
    statusCode: 403,
    code: 'VAULT_OTP_INVALID',
  });
}

export async function approveRareBloodVaultUnlock(options: {
  approverId: string;
  input: ApproveVaultUnlockInput;
  ip: string | null;
}) {
  const key = `otp:vault:${options.input.requestId}`;
  const otpRecord = memoryStore.get<VaultOtpRecord>(key);
  if (!otpRecord) {
    throw new AppError({
      message: 'Mã OTP mở két đã hết hạn hoặc không tồn tại.',
      statusCode: 403,
      code: 'VAULT_OTP_EXPIRED',
    });
  }
  if (otpRecord.otp !== options.input.otp) {
    handleInvalidVaultOtp(key, otpRecord);
  }
  memoryStore.delete(key);
  return callApproveVaultUnlock({
    requestId: options.input.requestId,
    approverId: options.approverId,
    ip: options.ip,
  });
}

export async function revealRareBloodVaultContact(options: {
  requestId: string;
  viewerId: string;
  ip: string | null;
}) {
  const row = await callGetRareBloodVaultForReveal(options);
  const soDienThoai = decryptVaultField(
    { ciphertext: row.encryptedPhone, iv: row.ivPhone, authTag: row.authTagPhone },
    row.keyVersion,
  );
  const diaChi = decryptVaultField(
    { ciphertext: row.encryptedAddress, iv: row.ivAddress, authTag: row.authTagAddress },
    row.keyVersion,
  );
  return {
    donorId: row.donorId,
    hoTen: row.hoTen,
    nhomMauHiem: row.nhomMauHiem,
    soDienThoai,
    diaChi,
    expiresAt: row.expiresAt,
  };
}

export async function listSecurityAuditLogs() {
  return queryAuditLogs(50);
}
