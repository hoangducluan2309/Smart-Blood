import '../helpers/test-env.js';

import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import crypto from 'node:crypto';
import type { Server } from 'node:http';
import { after, before, describe, it } from 'node:test';

import { mainPool } from '../../backend/src/config/database.js';
import { memoryStore } from '../../backend/src/shared/memory-store.js';
import {
  apiRequest,
  loginAs,
  startTestServer,
  stopTestServer,
} from '../helpers/http-test-helper.js';

let server: Server;
let baseUrl = '';
let staffToken = '';
let adminToken = '';
let directorToken = '';
let doctorDongNaiToken = '';
let doctorThongNhatToken = '';

function todayVn(): string {
  return new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10);
}

function runAdminSql(query: string): void {
  const args = ['-S', '127.0.0.1,1433', '-d', 'HienMauDB', '-E', '-I', '-b', '-Q', query];
  execFileSync('sqlcmd', args);
}

async function createActiveEvent(): Promise<string> {
  const created = await apiRequest<{ id: string }>(baseUrl, {
    method: 'POST',
    path: '/api/v1/events',
    token: staffToken,
    body: {
      tenSuKien: 'Security Test Drive',
      diaDiem: 'Bien Hoa Center',
      ngayToChuc: todayVn(),
      gioBatDau: '00:00',
      gioKetThuc: '23:59',
      chiTieuSoLuong: 30,
    },
  });
  assert.equal(created.status, 201);
  const eventId = created.body.data!.id;
  await apiRequest(baseUrl, {
    method: 'PATCH',
    path: `/api/v1/events/${eventId}/status`,
    token: adminToken,
    body: { trangThai: 'ACTIVE' },
  });
  return eventId;
}

async function submitDonor(options: {
  eventId: string;
  cccd: string;
  hoTen?: string;
  ngaySinh?: string;
}): Promise<{ status: number; checkInId?: string; code?: string }> {
  const res = await apiRequest<{ checkInId: string }>(baseUrl, {
    method: 'POST',
    path: '/api/v1/public/checkin/submit',
    body: {
      clientRequestId: crypto.randomUUID(),
      eventId: options.eventId,
      cccd: options.cccd,
      hoTen: options.hoTen ?? 'Tran Thi Minh',
      ngaySinh: options.ngaySinh ?? '1993-04-10',
      gioiTinh: 'NU',
      soDienThoai: '0908111222',
      diaChi: '45 Vo Thi Sau, Bien Hoa',
      luongMauDangKy: 350,
      daDongYXuLyDuLieu: true,
      khaiBaoSucKhoe: 'Suc khoe binh thuong',
    },
  });
  return { status: res.status, checkInId: res.body.data?.checkInId, code: res.body.error?.code };
}

async function runClinicalAndRapid(checkInId: string): Promise<string> {
  const clinBody = {
    checkInId, huyetApTamThu: 115, huyetApTamTruong: 75, nhipTim: 72,
    canNang: 56, theTichDuocPhep: 350, ketLuan: 'DAT',
  };
  await apiRequest(baseUrl, {
    method: 'POST', path: '/api/v1/medical/exam/clinical', token: staffToken, body: clinBody,
  });
  const rapidBody = {
    checkInId, hemoglobin: 13.5, testHbsAg: 'AM_TINH', testHCV: 'AM_TINH',
    testHIV: 'AM_TINH', nhomMauXacNhan: 'AB', rhFactor: '-',
  };
  const rapid = await apiRequest<{ donorId: string }>(baseUrl, {
    method: 'POST', path: '/api/v1/medical/exam/rapid-test', token: staffToken, body: rapidBody,
  });
  return rapid.body.data!.donorId;
}

async function completeRareBloodDonation(eventId: string, cccd: string) {
  const sub = await submitDonor({ eventId, cccd });
  assert.equal(sub.status, 201);
  const checkInId = sub.checkInId!;
  const donorId = await runClinicalAndRapid(checkInId);
  const bag = await apiRequest<{ bloodBagId: string; maVachTuiMau: string }>(baseUrl, {
    method: 'POST',
    path: '/api/v1/medical/blood-bag/collect',
    token: staffToken,
    body: { checkInId, theTichThucTe: 350 },
  });
  await apiRequest(baseUrl, {
    method: 'POST',
    path: `/api/v1/inventory/blood-bag/${bag.body.data!.bloodBagId}/lab-result`,
    token: staffToken,
    body: { ketQuaSangLoc: 'DAT', nhomMauChinhThuc: 'AB', rhFactorChinhThuc: '-' },
  });
  return { donorId, maVachTuiMau: bag.body.data!.maVachTuiMau };
}

before(async () => {
  const started = await startTestServer();
  server = started.server;
  baseUrl = started.baseUrl;
  const pwd = 'SmartBlood@2026';
  staffToken = await loginAs(baseUrl, { identifier: 'staff@redcross-bienhoa.vn', matKhau: pwd });
  adminToken = await loginAs(baseUrl, { identifier: 'admin@redcross-bienhoa.vn', matKhau: pwd });
  directorToken = await loginAs(baseUrl, {
    identifier: 'director@redcross-bienhoa.vn',
    matKhau: pwd,
  });
  doctorDongNaiToken = await loginAs(baseUrl, {
    identifier: 'doctor@bvdongnai.vn',
    matKhau: pwd,
  });
  doctorThongNhatToken = await loginAs(baseUrl, {
    identifier: 'doctor@bvthongnhat.vn',
    matKhau: pwd,
  });
});

after(async () => {
  await stopTestServer(server);
});

describe('integration: medical rules, 84-day boundary & wrong DOB', () => {
  it('should enforce 83-day rejection, 84-day acceptance, and wrong DOB protection', async () => {
    const event1 = await createActiveEvent();
    const cccd = `075093${crypto.randomInt(100000, 999999)}`;
    const { donorId } = await completeRareBloodDonation(event1, cccd);

    const wrongLookup = await apiRequest<{ isNewDonor: boolean }>(baseUrl, {
      method: 'POST',
      path: '/api/v1/public/checkin/lookup-cccd',
      body: { cccd, ngaySinh: '1999-01-01' },
    });
    assert.equal(wrongLookup.body.data?.isNewDonor, true);

    const event2 = await createActiveEvent();
    const mismatch = await submitDonor({
      eventId: event2,
      cccd,
      hoTen: 'Fake Name',
      ngaySinh: '1999-01-01',
    });
    assert.equal(mismatch.status, 409);
    assert.equal(mismatch.code, 'DONOR_IDENTITY_MISMATCH');

    runAdminSql(`UPDATE dbo.DonationHistory SET ngayHien = DATEADD(DAY, -83, SYSUTCDATETIME())
      WHERE donorId = '${donorId}';`);
    const day83 = await submitDonor({ eventId: event2, cccd });
    assert.equal(day83.status, 409);
    assert.equal(day83.code, 'DONATION_INTERVAL_NOT_MET');

    runAdminSql(`UPDATE dbo.DonationHistory SET ngayHien = DATEADD(DAY, -84, SYSUTCDATETIME())
      WHERE donorId = '${donorId}';`);
    const day84 = await submitDonor({ eventId: event2, cccd });
    assert.equal(day84.status, 201);
  });

  it('should transition clinical fail to TAM_HOAN and support rapid-test pass', async () => {
    const eventId = await createActiveEvent();
    const cccd = `075092${crypto.randomInt(100000, 999999)}`;
    const sub = await submitDonor({ eventId, cccd });
    const deferRes = await apiRequest<{ buocHienTai: string }>(baseUrl, {
      method: 'POST',
      path: '/api/v1/medical/exam/clinical',
      token: staffToken,
      body: {
        checkInId: sub.checkInId,
        huyetApTamThu: 175,
        huyetApTamTruong: 105,
        nhipTim: 96,
        canNang: 58,
        theTichDuocPhep: null,
        ketLuan: 'TAM_HOAN',
        lyDo: 'Huyet ap cao tam thoi',
      },
    });
    assert.equal(deferRes.status, 200);
    assert.equal(deferRes.body.data?.buocHienTai, 'TAM_HOAN');
  });
});

describe('integration: vault zero-trust & cross-hospital IDOR', () => {
  it('should seal rare contact info, reject self-approve, and block expired grant', async () => {
    const eventId = await createActiveEvent();
    const cccd = `075091${crypto.randomInt(100000, 999999)}`;
    const { donorId, maVachTuiMau } = await completeRareBloodDonation(eventId, cccd);

    const donorRow = await mainPool.request()
      .input('DonorId', donorId)
      .query<{ soDienThoai: string | null; diaChi: string | null }>(
        'SELECT soDienThoai, diaChi FROM dbo.Donors WHERE id = CAST(@DonorId AS UNIQUEIDENTIFIER);',
      );
    assert.equal(donorRow.recordset[0]?.soDienThoai, null);
    assert.equal(donorRow.recordset[0]?.diaChi, null);

    const reqUnlock = await apiRequest<{ requestId: string }>(baseUrl, {
      method: 'POST',
      path: '/api/v1/vault/request-unlock',
      token: adminToken,
      body: { donorId, maBenhAn: 'BA-SEC-01' },
    });
    const requestId = reqUnlock.body.data!.requestId;
    const otp = memoryStore.get<{ otp: string }>(`otp:vault:${requestId}`)!.otp;

    const nonApprover = await apiRequest(baseUrl, {
      method: 'POST',
      path: '/api/v1/vault/approve',
      token: adminToken,
      body: { requestId, otp },
    });
    assert.equal(nonApprover.status, 403);
    assert.equal(nonApprover.body.error?.code, 'APPROVER_REQUIRED');

    const okApprove = await apiRequest(baseUrl, {
      method: 'POST',
      path: '/api/v1/vault/approve',
      token: directorToken,
      body: { requestId, otp },
    });
    assert.equal(okApprove.status, 200);

    const soloApproverReq = await apiRequest(baseUrl, {
      method: 'POST',
      path: '/api/v1/vault/request-unlock',
      token: directorToken,
      body: { donorId, maBenhAn: 'BA-SEC-02' },
    });
    assert.equal(soloApproverReq.status, 409);
    assert.equal(soloApproverReq.body.error?.code, 'NO_AVAILABLE_APPROVER');

    runAdminSql(
      `UPDATE dbo.VaultUnlockRequests SET expiresAt = DATEADD(MINUTE, -1, SYSUTCDATETIME())`
        + ` WHERE id = '${requestId}';`,
    );
    const expiredReveal = await apiRequest(baseUrl, {
      method: 'GET',
      path: `/api/v1/vault/${requestId}/reveal`,
      token: adminToken,
    });
    assert.equal(expiredReveal.status, 403);
    assert.equal(expiredReveal.body.error?.code, 'VAULT_GRANT_EXPIRED');

    await verifyHospitalIdor(maVachTuiMau);
  });
});

async function dispatchEmergencyBag(): Promise<string> {
  const alert = await apiRequest<{ emergency: { id: string } }>(baseUrl, {
    method: 'POST',
    path: '/api/v1/hospital/emergency-alert',
    token: doctorDongNaiToken,
    body: {
      bloodType: 'AB',
      rhFactor: '-',
      unitsNeeded: 1,
      urgencyLevel: 'RAT_KHAN',
      patientCaseId: 'BA-IDOR-01',
    },
  });
  assert.equal(alert.status, 201, JSON.stringify(alert.body));
  const dispatch = await apiRequest<{ bags: Array<{ maVachTuiMau: string }> }>(baseUrl, {
    method: 'POST',
    path: '/api/v1/hospital/dispatch',
    token: staffToken,
    body: {
      hospitalId: '11111111-1111-1111-1111-111111111101',
      bloodType: 'AB',
      rhFactor: '-',
      unitsNeeded: 1,
      bienSoXe: '60B-999.01',
      taiXeHotline: '0909123456',
      emergencyRequestId: alert.body.data!.emergency.id,
    },
  });
  return dispatch.body.data!.bags[0]!.maVachTuiMau;
}

async function verifyHospitalIdor(_bagCode: string): Promise<void> {
  const dispatchedCode = await dispatchEmergencyBag();
  const wrongHospital = await apiRequest(baseUrl, {
    method: 'POST',
    path: '/api/v1/hospital/verify-and-receive',
    token: doctorThongNhatToken,
    body: { bagCode: dispatchedCode, temperatureRecorded: 4.1 },
  });
  assert.equal(wrongHospital.status, 400);
  assert.equal(wrongHospital.body.error?.code, 'WRONG_DESTINATION_HOSPITAL');
}

describe('integration: brute-force lock & admin user unlock management', () => {
  it('should temporarily lock after 5 bad logins and allow admin unlock', async () => {
    const cccd = `075090${crypto.randomInt(100000, 999999)}`;
    const email = `locktest.${cccd}@smartblood-test.vn`;
    const eventId = await createActiveEvent();
    await submitDonor({ eventId, cccd });
    await apiRequest(baseUrl, {
      method: 'POST',
      path: '/api/v1/auth/register-donor',
      body: { cccd, ngaySinh: '1993-04-10', email, matKhau: 'RightPass@2026' },
    });
    const otp = memoryStore.get<{ otp: string }>(`otp:verify:${email}`)!.otp;
    const verified = await apiRequest<{ user: { userId: string } }>(baseUrl, {
      method: 'POST',
      path: '/api/v1/auth/verify-email-otp',
      body: { email, cccd, ngaySinh: '1993-04-10', otp },
    });
    const userId = verified.body.data!.user.userId;

    for (let i = 0; i < 4; i += 1) {
      const fail = await apiRequest(baseUrl, {
        method: 'POST',
        path: '/api/v1/auth/login',
        body: { identifier: email, matKhau: 'WrongPass!123' },
      });
      assert.equal(fail.status, 401);
    }
    const fifth = await apiRequest(baseUrl, {
      method: 'POST',
      path: '/api/v1/auth/login',
      body: { identifier: email, matKhau: 'WrongPass!123' },
    });
    assert.equal(fifth.status, 429);
    assert.equal(fifth.body.error?.code, 'ACCOUNT_TEMPORARILY_LOCKED');

    const users = await apiRequest<{
      items: Array<{ id: string; trangThai: string; tempLocked: boolean }>;
    }>(baseUrl, { method: 'GET', path: '/api/v1/admin/users?limit=all', token: adminToken });
    const listed = users.body.data?.items.find((u) => u.id === userId);
    assert.equal(listed?.trangThai, 'ACTIVE');
    assert.equal(listed?.tempLocked, true);

    const adminUnlock = await apiRequest(baseUrl, {
      method: 'PATCH',
      path: `/api/v1/admin/users/${userId}/status`,
      token: adminToken,
      body: { trangThai: 'ACTIVE' },
    });
    assert.equal(adminUnlock.status, 200);
    const okLogin = await apiRequest(baseUrl, {
      method: 'POST',
      path: '/api/v1/auth/login',
      body: { identifier: email, matKhau: 'RightPass@2026' },
    });
    assert.equal(okLogin.status, 200);

    const lockedRes = await apiRequest(baseUrl, {
      method: 'PATCH',
      path: `/api/v1/admin/users/${userId}/status`,
      token: adminToken,
      body: { trangThai: 'LOCKED' },
    });
    assert.equal(lockedRes.status, 200);
    const blockedLogin = await apiRequest(baseUrl, {
      method: 'POST',
      path: '/api/v1/auth/login',
      body: { identifier: email, matKhau: 'RightPass@2026' },
    });
    assert.equal(blockedLogin.status, 403);
    assert.equal(blockedLogin.body.error?.code, 'ACCOUNT_LOCKED_BY_ADMIN');
  });
});
