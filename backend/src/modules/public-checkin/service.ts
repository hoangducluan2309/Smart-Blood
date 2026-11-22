import crypto from 'node:crypto';

import { AppError } from '../../shared/app-error.js';
import { domainEvents } from '../../shared/domain-events.js';
import { memoryStore, TTL_POLICIES } from '../../shared/memory-store.js';
import { sealRareBloodContactValues } from '../inventory-vault/service.js';
import {
  callLookupDonorByCccd,
  callSubmitDonorCheckIn,
  type LookupDonorRow,
} from './repository.js';
import type { LookupCccdInput, SubmitCheckInInput } from './schemas.js';

function formatIsoDate(dateValue: Date | null): string | null {
  return dateValue ? dateValue.toISOString().slice(0, 10) : null;
}

function assertLookupAttemptsAllowed(cccd: string): void {
  const key = `lookup:${cccd}`;
  const attempts = memoryStore.get<number>(key) ?? 0;
  if (attempts >= TTL_POLICIES.CCCD_LOOKUP_MAX_FAILURES) {
    throw new AppError({
      message: 'Bạn đã tra cứu quá số lần cho phép trong giờ. Vui lòng thử lại sau.',
      statusCode: 429,
      code: 'LOOKUP_RATE_LIMIT_EXCEEDED',
    });
  }
}

function buildMatchedLookupResponse(row: LookupDonorRow) {
  if (!row.eligible) {
    return {
      isNewDonor: false,
      eligible: false,
      lastDonationDate: formatIsoDate(row.lastDonationDate),
      nextEligibleDate: formatIsoDate(row.nextEligibleDate),
      daysSinceLastDonation: row.daysSinceLastDonation,
      message: 'Chưa đủ khoảng cách an toàn 84 ngày theo Thông tư 26/2013/TT-BYT.',
      autoFill: null,
    };
  }
  return {
    isNewDonor: false,
    eligible: true,
    autoFill: {
      hoTen: row.hoTen,
      ngaySinh: formatIsoDate(row.ngaySinh),
      gioiTinh: row.gioiTinh,
      soDienThoai: row.soDienThoai,
      diaChi: row.diaChi,
      nhomMau: row.nhomMau,
      rhFactor: row.rhFactor,
      laNhomMauHiem: row.laNhomMauHiem,
    },
  };
}

export async function lookupDonorByCccd(input: LookupCccdInput) {
  assertLookupAttemptsAllowed(input.cccd);
  const row = await callLookupDonorByCccd(input);
  const key = `lookup:${input.cccd}`;

  if (!row.matched) {
    const attempts = (memoryStore.get<number>(key) ?? 0) + 1;
    memoryStore.set<number>(key, {
      value: attempts,
      ttlSeconds: TTL_POLICIES.CCCD_LOOKUP_WINDOW_SECONDS,
    });
    return { isNewDonor: true, eligible: true, autoFill: null };
  }

  memoryStore.delete(key);
  return buildMatchedLookupResponse(row);
}

async function emitAndSealCheckIn(options: {
  input: SubmitCheckInInput;
  row: Awaited<ReturnType<typeof callSubmitDonorCheckIn>>;
  ip: string | null;
}): Promise<void> {
  const { input, row, ip } = options;
  if (row.laNhomMauHiem && row.nhomMau && row.rhFactor) {
    await sealRareBloodContactValues({
      donorId: row.donorId,
      nhomMauHiem: `${row.nhomMau}${row.rhFactor}`,
      soDienThoai: input.soDienThoai,
      diaChi: input.diaChi,
      actorId: null,
      ip,
    });
  }
  domainEvents.emit('donor:checkin_submitted', {
    eventId: input.eventId,
    checkInId: row.checkInId,
    stt: row.stt,
    hoTen: row.hoTen,
    buocHienTai: row.buocHienTai,
    thoiGianCheckIn: row.thoiGianCheckIn,
  });
}

export async function submitDonorCheckIn(input: SubmitCheckInInput, ip: string | null = null) {
  const trackingToken = crypto.randomBytes(24).toString('hex');
  const row = await callSubmitDonorCheckIn({ input, trackingToken });
  if (!row.isDuplicateRequest) {
    await emitAndSealCheckIn({ input, row, ip });
  }
  return {
    stt: row.stt,
    checkInId: row.checkInId,
    thoiGianCheckIn: row.thoiGianCheckIn,
    trackingToken: row.trackingToken,
    buocHienTai: row.buocHienTai,
  };
}
