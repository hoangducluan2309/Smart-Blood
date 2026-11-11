import '../helpers/test-env.js';

import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import type { Server } from 'node:http';
import { after, before, describe, it } from 'node:test';

import {
  apiRequest,
  loginAs,
  startTestServer,
  stopTestServer,
} from '../helpers/http-test-helper.js';
import { connectSocketNamespace } from '../helpers/socket-test-helper.js';

let server: Server;
let baseUrl = '';
let staffToken = '';
let adminToken = '';
let doctorToken = '';

function todayVn(): string {
  return new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10);
}

async function createTodayEvent(): Promise<string> {
  const created = await apiRequest<{ id: string }>(baseUrl, {
    method: 'POST',
    path: '/api/v1/events',
    token: staffToken,
    body: {
      tenSuKien: 'Socket Realtime Drive',
      diaDiem: 'Nha Van Hoa Bien Hoa',
      ngayToChuc: todayVn(),
      gioBatDau: '00:00',
      gioKetThuc: '23:59',
      chiTieuSoLuong: 40,
    },
  });
  const eventId = created.body.data!.id;
  await apiRequest(baseUrl, {
    method: 'PATCH',
    path: `/api/v1/events/${eventId}/status`,
    token: adminToken,
    body: { trangThai: 'ACTIVE' },
  });
  return eventId;
}

before(async () => {
  const started = await startTestServer();
  server = started.server;
  baseUrl = started.baseUrl;
  const pwd = 'SmartBlood@2026';
  staffToken = await loginAs(baseUrl, { identifier: 'staff@redcross-bienhoa.vn', matKhau: pwd });
  adminToken = await loginAs(baseUrl, { identifier: 'admin@redcross-bienhoa.vn', matKhau: pwd });
  doctorToken = await loginAs(baseUrl, { identifier: 'doctor@bvdongnai.vn', matKhau: pwd });
});

after(async () => {
  await stopTestServer(server);
});

describe('e2e: socket.io handshakes, privacy filter & red alert latency', () => {
  it('should reject unauthorized /staff and invalid /donor trackingToken handshakes', async () => {
    await assert.rejects(() =>
      connectSocketNamespace({ baseUrl, namespace: '/staff', auth: {} }),
    );
    await assert.rejects(() =>
      connectSocketNamespace({ baseUrl, namespace: '/staff', auth: { token: doctorToken } }),
    );
    await assert.rejects(() =>
      connectSocketNamespace({
        baseUrl,
        namespace: '/donor',
        auth: { checkInId: crypto.randomUUID(), trackingToken: 'invalid-token' },
      }),
    );
  });

  it('should emit queue/medical updates without PII on /display and /donor', async () => {
    const eventId = await createTodayEvent();
    const staffWs = await connectSocketNamespace({
      baseUrl,
      namespace: '/staff',
      auth: { token: staffToken, eventId },
    });
    const displayWs = await connectSocketNamespace({
      baseUrl,
      namespace: '/display',
      auth: { eventId },
    });

    const staffCheckInPromise = staffWs.waitForEvent('donor:checkin_submitted');
    const displayQueuePromise = displayWs.waitForEvent('queue:updated');

    const submit = await apiRequest<{ checkInId: string; trackingToken: string }>(baseUrl, {
      method: 'POST',
      path: '/api/v1/public/checkin/submit',
      body: {
        clientRequestId: crypto.randomUUID(),
        eventId,
        cccd: `075095${crypto.randomInt(100000, 999999)}`,
        hoTen: 'Le Van Socket',
        ngaySinh: '1995-07-20',
        gioiTinh: 'NAM',
        soDienThoai: '0909888777',
        diaChi: '12 Le Loi, Bien Hoa',
        luongMauDangKy: 350,
        daDongYXuLyDuLieu: true,
        khaiBaoSucKhoe: 'Khoe manh',
      },
    });
    assert.equal(submit.status, 201);
    const { checkInId, trackingToken } = submit.body.data!;

    const staffFrame = await staffCheckInPromise;
    const displayFrame = await displayQueuePromise;
    assert.equal(staffFrame.payload.checkInId, checkInId);
    assert.equal(displayFrame.payload.hoTen, undefined);
    assert.equal(displayFrame.payload.lyDoTamHoan, undefined);

    const donorWs = await connectSocketNamespace({
      baseUrl,
      namespace: '/donor',
      auth: { checkInId, trackingToken },
    });
    const donorStepPromise = donorWs.waitForEvent('medical:step_updated');
    const staffStepPromise = staffWs.waitForEvent('medical:step_updated');
    const displayDeferPromise = displayWs.waitForEvent('queue:updated');

    await apiRequest(baseUrl, {
      method: 'POST',
      path: '/api/v1/medical/exam/clinical',
      token: staffToken,
      body: {
        checkInId,
        huyetApTamThu: 170,
        huyetApTamTruong: 100,
        nhipTim: 90,
        canNang: 60,
        theTichDuocPhep: null,
        ketLuan: 'TAM_HOAN',
        lyDo: 'Bi mat y te khong duoc lo',
      },
    });

    const [staffStep, donorStep, displayDefer] = await Promise.all([
      staffStepPromise,
      donorStepPromise,
      displayDeferPromise,
    ]);
    assert.equal(staffStep.payload.lyDoTamHoan, 'Bi mat y te khong duoc lo');
    assert.equal(donorStep.payload.lyDoTamHoan, undefined);
    assert.equal(displayDefer.payload.lyDoTamHoan, undefined);

    await Promise.all([staffWs.close(), displayWs.close(), donorWs.close()]);
  });

  it('should broadcast emergency:red_alert to /emergency within 1000ms', async () => {
    const emergencyWs = await connectSocketNamespace({
      baseUrl,
      namespace: '/emergency',
      auth: { token: staffToken },
    });
    const alertPromise = emergencyWs.waitForEvent('emergency:red_alert', 2000);
    alertPromise.catch(() => undefined);
    const startMs = Date.now();
    const res = await apiRequest<{ emergency: { id: string } }>(baseUrl, {
      method: 'POST',
      path: '/api/v1/hospital/emergency-alert',
      token: doctorToken,
      body: {
        bloodType: 'AB',
        rhFactor: '-',
        unitsNeeded: 2,
        urgencyLevel: 'NGUY_CAP',
        patientCaseId: 'BA-WS-911',
      },
    });
    assert.equal(res.status, 201, JSON.stringify(res.body));
    const frame = await alertPromise;
    assert.equal(frame.payload.emergencyId, res.body.data!.emergency.id);
    assert.ok(frame.receivedAtMs - startMs < 1000);
    await emergencyWs.close();
  });
});
