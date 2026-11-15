import '../helpers/test-env.js';

import assert from 'node:assert/strict';
import type { Server } from 'node:http';
import { after, before, describe, it } from 'node:test';

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
let doctorToken = '';

before(async () => {
  const started = await startTestServer();
  server = started.server;
  baseUrl = started.baseUrl;
  staffToken = await loginAs(baseUrl, {
    identifier: 'staff@redcross-bienhoa.vn',
    matKhau: 'SmartBlood@2026',
  });
  adminToken = await loginAs(baseUrl, {
    identifier: 'admin@redcross-bienhoa.vn',
    matKhau: 'SmartBlood@2026',
  });
  doctorToken = await loginAs(baseUrl, {
    identifier: 'doctor@bvdongnai.vn',
    matKhau: 'SmartBlood@2026',
  });
});

after(async () => {
  await stopTestServer(server);
});

describe('integration: health, validation, auth & RBAC', () => {
  it('should respond 200 on health & ready endpoints and 404 on unknown routes', async () => {
    const health = await apiRequest<{ status: string }>(baseUrl, {
      method: 'GET',
      path: '/api/health',
    });
    assert.equal(health.status, 200);
    assert.equal(health.body.data?.status, 'ok');

    const ready = await apiRequest<{ status: string }>(baseUrl, {
      method: 'GET',
      path: '/api/health/ready',
    });
    assert.equal(ready.status, 200);
    assert.equal(ready.body.data?.status, 'ready');

    const missing = await apiRequest(baseUrl, { method: 'GET', path: '/api/v1/does-not-exist' });
    assert.equal(missing.status, 404);
  });

  it('should enforce 401 unauthorized, 403 RBAC, and 422 Zod validation', async () => {
    const unauth = await apiRequest(baseUrl, {
      method: 'GET',
      path: '/api/v1/inventory/summary',
    });
    assert.equal(unauth.status, 401);

    const forbidden = await apiRequest(baseUrl, {
      method: 'GET',
      path: '/api/v1/vault/donors',
      token: doctorToken,
    });
    assert.equal(forbidden.status, 403);

    const validation = await apiRequest(baseUrl, {
      method: 'POST',
      path: '/api/v1/events',
      token: staffToken,
      body: { tenSuKien: 'A', chiTieuSoLuong: -5 },
    });
    assert.equal(validation.status, 422);
    assert.equal(validation.body.error?.code, 'VALIDATION_ERROR');
  });

  it('should write immutable audit log when login fails', async () => {
    const badLogin = await apiRequest(baseUrl, {
      method: 'POST',
      path: '/api/v1/auth/login',
      body: { identifier: 'doctor@bvthongnhat.vn', matKhau: 'WrongPass999' },
    });
    assert.equal(badLogin.status, 401);

    const logs = await apiRequest<Array<{ hanhDong: string }>>(baseUrl, {
      method: 'GET',
      path: '/api/v1/inventory/audit-logs',
      token: adminToken,
    });
    assert.equal(logs.status, 200);
    const hasFailedLogin = logs.body.data?.some((row) => row.hanhDong === 'LOGIN_FAILED');
    assert.equal(hasFailedLogin, true);
  });
});

describe('integration: public lookup & event QR', () => {
  it('should create event, list events, and serve cached QR PNG asset', async () => {
    const created = await apiRequest<{ id: string }>(baseUrl, {
      method: 'POST',
      path: '/api/v1/events',
      token: staffToken,
      body: {
        tenSuKien: 'Ngay hoi Test Integration',
        diaDiem: 'Trung tam Bien Hoa',
        ngayToChuc: '2026-12-20',
        gioBatDau: '07:30',
        gioKetThuc: '11:30',
        chiTieuSoLuong: 100,
      },
    });
    assert.equal(created.status, 201);
    const eventId = created.body.data!.id;

    const qrRes = await fetch(`${baseUrl}/api/v1/events/${eventId}/qr-download?format=png`);
    assert.equal(qrRes.status, 200);
    assert.equal(qrRes.headers.get('content-type'), 'image/png');
    assert.match(qrRes.headers.get('cache-control') ?? '', /max-age=86400/);
  });

  it('should return isNewDonor=true for unknown CCCD lookup & return inventory view', async () => {
    const lookup = await apiRequest<{ isNewDonor: boolean }>(baseUrl, {
      method: 'POST',
      path: '/api/v1/public/checkin/lookup-cccd',
      body: { cccd: '075000000999', ngaySinh: '1999-09-09' },
    });
    assert.equal(lookup.status, 200);
    assert.equal(lookup.body.data?.isNewDonor, true);

    const summary = await apiRequest<unknown[]>(baseUrl, {
      method: 'GET',
      path: '/api/hospital/inventory-overview'.replace('/api/hospital', '/api/v1/hospital'),
      token: doctorToken,
    });
    assert.equal(summary.status, 200);
    assert.equal(Array.isArray(summary.body.data), true);
  });
});
