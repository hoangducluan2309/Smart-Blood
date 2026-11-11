import '../helpers/test-env.js';

import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import type { Server } from 'node:http';
import { after, before, describe, it } from 'node:test';

import { memoryStore } from '../../backend/src/shared/memory-store.js';
import {
  apiRequest,
  loginAs,
  startTestServer,
  stopTestServer,
} from '../helpers/http-test-helper.js';

interface Tokens {
  admin: string;
  director: string;
  staff: string;
  doctor: string;
}

let server: Server;
let baseUrl = '';
let tokens: Tokens;

function getTodayVnIso(): string {
  return new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10);
}

before(async () => {
  const started = await startTestServer();
  server = started.server;
  baseUrl = started.baseUrl;
  const pwd = 'SmartBlood@2026';
  tokens = {
    admin: await loginAs(baseUrl, { identifier: 'admin@redcross-bienhoa.vn', matKhau: pwd }),
    director: await loginAs(baseUrl, { identifier: 'director@redcross-bienhoa.vn', matKhau: pwd }),
    staff: await loginAs(baseUrl, { identifier: 'staff@redcross-bienhoa.vn', matKhau: pwd }),
    doctor: await loginAs(baseUrl, { identifier: 'doctor@bvdongnai.vn', matKhau: pwd }),
  };
});

after(async () => {
  await stopTestServer(server);
});

async function createTodayActiveEvent(): Promise<string> {
  const eventRes = await apiRequest<{ id: string }>(baseUrl, {
    method: 'POST',
    path: '/api/v1/events',
    token: tokens.staff,
    body: {
      tenSuKien: 'E2E Blood Drive Dong Nai',
      diaDiem: 'Quang truong Tinh Dong Nai',
      ngayToChuc: getTodayVnIso(),
      gioBatDau: '00:00',
      gioKetThuc: '23:59',
      chiTieuSoLuong: 50,
    },
  });
  assert.equal(eventRes.status, 201, JSON.stringify(eventRes.body));
  const eventId = eventRes.body.data!.id;
  await apiRequest(baseUrl, {
    method: 'PATCH',
    path: `/api/v1/events/${eventId}/status`,
    token: tokens.admin,
    body: { trangThai: 'ACTIVE' },
  });
  return eventId;
}

async function submitIdempotentCheckIn(eventId: string, cccd: string) {
  const payload = {
    clientRequestId: crypto.randomUUID(),
    eventId,
    cccd,
    hoTen: 'Nguyen Van Hiem',
    ngaySinh: '1994-06-15',
    gioiTinh: 'NAM',
    soDienThoai: '0912345678',
    diaChi: '120 Nguyen Ai Quoc, Bien Hoa',
    luongMauDangKy: 350,
    daDongYXuLyDuLieu: true,
    khaiBaoSucKhoe: 'Khong benh ly, ngu du giac',
  };
  const first = await apiRequest<{ checkInId: string; stt: number }>(baseUrl, {
    method: 'POST',
    path: '/api/v1/public/checkin/submit',
    body: payload,
  });
  assert.equal(first.status, 201, JSON.stringify(first.body));
  const retry = await apiRequest<{ checkInId: string; stt: number }>(baseUrl, {
    method: 'POST',
    path: '/api/v1/public/checkin/submit',
    body: payload,
  });
  assert.equal(retry.body.data?.checkInId, first.body.data?.checkInId);
  assert.equal(retry.body.data?.stt, first.body.data?.stt);
  return { checkInId: first.body.data!.checkInId };
}

async function runClinicalStage(checkInId: string): Promise<void> {
  const clinical = await apiRequest<{ buocHienTai: string }>(baseUrl, {
    method: 'POST',
    path: '/api/v1/medical/exam/clinical',
    token: tokens.staff,
    body: {
      checkInId,
      huyetApTamThu: 120,
      huyetApTamTruong: 80,
      nhipTim: 74,
      canNang: 65,
      theTichDuocPhep: 350,
      ketLuan: 'DAT',
    },
  });
  assert.equal(clinical.status, 200);
  assert.equal(clinical.body.data?.buocHienTai, 'CHO_XET_NGHIEM');
}

async function runRapidTestStage(checkInId: string): Promise<string> {
  const rapid = await apiRequest<{ donorId: string; isRareBloodCandidate: boolean }>(baseUrl, {
    method: 'POST',
    path: '/api/v1/medical/exam/rapid-test',
    token: tokens.staff,
    body: {
      checkInId,
      hemoglobin: 14.2,
      testHbsAg: 'AM_TINH',
      testHCV: 'AM_TINH',
      testHIV: 'AM_TINH',
      nhomMauXacNhan: 'O',
      rhFactor: '-',
    },
  });
  assert.equal(rapid.status, 200);
  assert.equal(rapid.body.data?.isRareBloodCandidate, true);
  return rapid.body.data!.donorId;
}

async function runCollectAndLabRelease(checkInId: string): Promise<string> {
  const collect = await apiRequest<{ bloodBagId: string; maVachTuiMau: string }>(baseUrl, {
    method: 'POST',
    path: '/api/v1/medical/blood-bag/collect',
    token: tokens.staff,
    body: { checkInId, theTichThucTe: 350, viTriKhoLanhTamThoi: 'Tu Lanh A1' },
  });
  assert.equal(collect.status, 201);
  const lab = await apiRequest<{ trangThai: string }>(baseUrl, {
    method: 'POST',
    path: `/api/v1/inventory/blood-bag/${collect.body.data!.bloodBagId}/lab-result`,
    token: tokens.staff,
    body: {
      ketQuaSangLoc: 'DAT',
      nhomMauChinhThuc: 'O',
      rhFactorChinhThuc: '-',
      viTriKhoLanh: 'Ke-ORhMinus-01',
    },
  });
  assert.equal(lab.status, 200);
  assert.equal(lab.body.data?.trangThai, 'IN_STOCK');
  return collect.body.data!.maVachTuiMau;
}

async function verifyMaskedAndRequestUnlock(donorId: string): Promise<string> {
  const masked = await apiRequest<Array<{ donorId: string; maskedPhone: string }>>(baseUrl, {
    method: 'GET',
    path: '/api/v1/vault/donors',
    token: tokens.admin,
  });
  const entry = masked.body.data?.find((d) => d.donorId === donorId);
  assert.ok(entry && entry.maskedPhone.includes('***'));
  const unlockReq = await apiRequest<{ requestId: string }>(baseUrl, {
    method: 'POST',
    path: '/api/v1/vault/request-unlock',
    token: tokens.admin,
    body: { donorId, maBenhAn: 'BA-E2E-115' },
  });
  assert.equal(unlockReq.status, 201);
  return unlockReq.body.data!.requestId;
}

async function verifyVaultApproveAndReveal(requestId: string): Promise<void> {
  const otpRecord = memoryStore.get<{ otp: string }>(`otp:vault:${requestId}`);
  assert.ok(otpRecord?.otp);
  const approve = await apiRequest<{ trangThai: string }>(baseUrl, {
    method: 'POST',
    path: '/api/v1/vault/approve',
    token: tokens.director,
    body: { requestId, otp: otpRecord.otp },
  });
  assert.equal(approve.body.data?.trangThai, 'APPROVED');
  const reveal = await apiRequest<{ soDienThoai: string }>(baseUrl, {
    method: 'GET',
    path: `/api/v1/vault/${requestId}/reveal`,
    token: tokens.admin,
  });
  assert.equal(reveal.body.data?.soDienThoai, '0912345678');
}

async function verifyEmergencyAlertAndAck(): Promise<string> {
  const alert = await apiRequest<{ emergency: { id: string } }>(baseUrl, {
    method: 'POST',
    path: '/api/v1/hospital/emergency-alert',
    token: tokens.doctor,
    body: {
      bloodType: 'O',
      rhFactor: '-',
      unitsNeeded: 1,
      urgencyLevel: 'NGUY_CAP',
      patientCaseId: 'CC-2026-009',
    },
  });
  assert.equal(alert.status, 201);
  const emergencyId = alert.body.data!.emergency.id;
  const ack = await apiRequest(baseUrl, {
    method: 'POST',
    path: `/api/v1/hospital/emergency/${emergencyId}/acknowledge`,
    token: tokens.staff,
  });
  assert.equal(ack.status, 200);
  return emergencyId;
}

async function verifyDispatchAndReceive(emergencyId: string, bagCode: string): Promise<void> {
  const dispatch = await apiRequest<{ bags: Array<{ maVachTuiMau: string }> }>(baseUrl, {
    method: 'POST',
    path: '/api/v1/hospital/dispatch',
    token: tokens.staff,
    body: {
      hospitalId: '11111111-1111-1111-1111-111111111101',
      bloodType: 'O',
      rhFactor: '-',
      unitsNeeded: 1,
      bienSoXe: '60A-115.99',
      taiXeHotline: '0987654321',
      emergencyRequestId: emergencyId,
    },
  });
  assert.equal(dispatch.status, 201);
  assert.ok(dispatch.body.data?.bags.some((b) => b.maVachTuiMau === bagCode));
  const receive = await apiRequest<{ trangThai: string }>(baseUrl, {
    method: 'POST',
    path: '/api/v1/hospital/verify-and-receive',
    token: tokens.doctor,
    body: { bagCode, temperatureRecorded: 4.0 },
  });
  assert.equal(receive.status, 200, JSON.stringify(receive.body));
  assert.equal(receive.body.data?.trangThai, 'HOSPITAL_RECEIVED');
}

async function registerAndVerifyDonor(cccd: string): Promise<string> {
  const email = `donor.${cccd}@smartblood-test.vn`;
  const reg = await apiRequest(baseUrl, {
    method: 'POST',
    path: '/api/v1/auth/register-donor',
    body: { cccd, ngaySinh: '1994-06-15', email, matKhau: 'DonorPass@2026' },
  });
  assert.equal(reg.status, 201, JSON.stringify(reg.body));
  const otpState = memoryStore.get<{ otp: string }>(`otp:verify:${email}`);
  const verify = await apiRequest<{ accessToken: string }>(baseUrl, {
    method: 'POST',
    path: '/api/v1/auth/verify-email-otp',
    body: { email, cccd, ngaySinh: '1994-06-15', otp: otpState!.otp },
  });
  return verify.body.data!.accessToken;
}

async function verifyDonorHistoryAndCert(donorToken: string): Promise<void> {
  const history = await apiRequest<{ items: Array<{ historyId: string }> }>(baseUrl, {
    method: 'GET',
    path: '/api/v1/donor/history',
    token: donorToken,
  });
  assert.equal(history.status, 200);
  const historyId = history.body.data!.items[0]!.historyId;
  const certRes = await fetch(`${baseUrl}/api/v1/donor/certificate/${historyId}/download`, {
    headers: { Authorization: `Bearer ${donorToken}` },
  });
  assert.equal(certRes.status, 200);
  assert.equal(certRes.headers.get('content-type'), 'application/pdf');
}

describe('e2e: full SmartBlood medical & vault & hospital & donor journey', () => {
  it('should execute complete blood lifecycle end-to-end against MSSQL 2019', async () => {
    const cccd = `075094${crypto.randomInt(100000, 999999)}`;
    const eventId = await createTodayActiveEvent();
    const { checkInId } = await submitIdempotentCheckIn(eventId, cccd);
    await runClinicalStage(checkInId);
    const donorId = await runRapidTestStage(checkInId);
    const bagCode = await runCollectAndLabRelease(checkInId);
    const requestId = await verifyMaskedAndRequestUnlock(donorId);
    await verifyVaultApproveAndReveal(requestId);
    const emergencyId = await verifyEmergencyAlertAndAck();
    await verifyDispatchAndReceive(emergencyId, bagCode);
    const donorToken = await registerAndVerifyDonor(cccd);
    await verifyDonorHistoryAndCert(donorToken);
  });
});
