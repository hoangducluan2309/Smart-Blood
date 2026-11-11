import '../helpers/test-env.js';

import assert from 'node:assert/strict';
import { after, describe, it } from 'node:test';

import { signAccessToken, verifyTokenString } from '../../backend/src/middleware/auth.js';
import {
  forgotPasswordSchema,
  loginSchema,
  registerDonorSchema,
} from '../../backend/src/modules/donor-portal/schemas.js';
import {
  approveRareBloodVaultUnlock,
} from '../../backend/src/modules/inventory-vault/service.js';
import {
  lookupDonorByCccd,
} from '../../backend/src/modules/public-checkin/service.js';
import { submitCheckInSchema } from '../../backend/src/modules/public-checkin/schemas.js';
import {
  requestForgotPasswordOtp,
  resetPasswordWithOtp,
  verifyDonorEmailOtp,
} from '../../backend/src/modules/donor-portal/service.js';
import { AppError } from '../../backend/src/shared/app-error.js';
import { memoryStore, TTL_POLICIES } from '../../backend/src/shared/memory-store.js';
import { buildOffsetClause, buildPaginationMeta } from '../../backend/src/shared/pagination.js';

after(() => {
  memoryStore.dispose();
});

describe('pagination & jwt helpers', () => {
  it('should compute pagination meta and SQL offset clauses', () => {
    const meta = buildPaginationMeta({ page: 2, limit: '10', total: 25 });
    assert.deepEqual(meta, { page: 2, limit: 10, total: 25, totalPages: 3 });
    assert.equal(buildOffsetClause(2, '10'), 'OFFSET 10 ROWS FETCH NEXT 10 ROWS ONLY');

    const allMeta = buildPaginationMeta({ page: 4, limit: 'all', total: 0 });
    assert.deepEqual(allMeta, { page: 1, limit: 1, total: 0, totalPages: 1 });
    assert.equal(buildOffsetClause(4, 'all'), '');
  });

  it('should sign and verify JWT payload cleanly', () => {
    const token = signAccessToken({
      userId: '11111111-1111-4111-8111-111111111111',
      email: 'staff@smartblood.vn',
      vaiTro: 'RED_CROSS_STAFF',
      hospitalId: null,
      laNguoiPheDuyet: false,
    });
    const decoded = verifyTokenString(token);
    assert.equal(decoded.vaiTro, 'RED_CROSS_STAFF');
    assert.throws(() => verifyTokenString(`${token}tampered`));
  });
});

describe('zod schemas & service OTP guards', () => {
  it('should reject invalid CCCD and consent false in check-in schema', () => {
    const invalid = submitCheckInSchema.safeParse({
      clientRequestId: '11111111-1111-4111-8111-111111111111',
      eventId: '22222222-2222-4222-8222-222222222222',
      cccd: '123',
      hoTen: 'Nguyen Van A',
      ngaySinh: '1999-01-01',
      gioiTinh: 'NAM',
      soDienThoai: '0901234567',
      diaChi: 'Bien Hoa, Dong Nai',
      luongMauDangKy: 350,
      daDongYXuLyDuLieu: false,
      khaiBaoSucKhoe: 'Khoe manh',
    });
    assert.equal(invalid.success, false);
    assert.equal(registerDonorSchema.safeParse({ cccd: '1', email: 'bad' }).success, false);
    assert.equal(loginSchema.safeParse({ identifier: 'a', matKhau: '' }).success, false);
    assert.equal(forgotPasswordSchema.safeParse({ email: 'not-email' }).success, false);
  });

  it('should block lookupDonorByCccd when brute-force failure threshold reached', async () => {
    memoryStore.set('lookup:075099999999', {
      value: TTL_POLICIES.CCCD_LOOKUP_MAX_FAILURES,
      ttlSeconds: 60,
    });
    await assert.rejects(
      () => lookupDonorByCccd({ cccd: '075099999999', ngaySinh: '1995-05-05' }),
      (err: unknown) => err instanceof AppError && err.code === 'LOOKUP_RATE_LIMIT_EXCEEDED',
    );
  });

  it('should enforce forgot-password cooldown & OTP retry eviction', async () => {
    memoryStore.set('cooldown:reset:cool@smartblood.vn', { value: true, ttlSeconds: 60 });
    await assert.rejects(
      () => requestForgotPasswordOtp({ email: 'cool@smartblood.vn' }),
      (err: unknown) => err instanceof AppError && err.code === 'OTP_RESEND_COOLDOWN',
    );

    memoryStore.set('otp:reset:otp@smartblood.vn', {
      value: { otp: '111222', userId: 'u1', attempts: TTL_POLICIES.EMAIL_OTP_MAX_ATTEMPTS - 1 },
      ttlSeconds: 60,
    });
    await assert.rejects(
      () =>
        resetPasswordWithOtp({
          input: { email: 'otp@smartblood.vn', otp: '999999', matKhauMoi: 'ValidPass123' },
          ip: null,
        }),
      (err: unknown) => err instanceof AppError && err.code === 'INVALID_OTP',
    );
    assert.equal(memoryStore.get('otp:reset:otp@smartblood.vn'), null);
  });

  it('should reject missing OTPs for donor verification and vault unlock', async () => {
    await assert.rejects(
      () =>
        verifyDonorEmailOtp({
          input: {
            email: 'missing@smartblood.vn',
            cccd: '075098000001',
            ngaySinh: '1998-01-01',
            otp: '123456',
          },
          ip: null,
        }),
      (err: unknown) => err instanceof AppError && err.code === 'OTP_EXPIRED_OR_NOT_FOUND',
    );

    await assert.rejects(
      () =>
        approveRareBloodVaultUnlock({
          approverId: '33333333-3333-4333-8333-333333333333',
          input: { requestId: '44444444-4444-4444-8444-444444444444', otp: '123456' },
          ip: null,
        }),
      (err: unknown) => err instanceof AppError && err.code === 'VAULT_OTP_EXPIRED',
    );
  });
});
