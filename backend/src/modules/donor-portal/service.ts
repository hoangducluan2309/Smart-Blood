import crypto from 'node:crypto';
import bcrypt from 'bcrypt';
import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';

import { env } from '../../config/env.js';
import { MEDICAL_THRESHOLDS } from '../../config/medical-thresholds.js';
import { signAccessToken } from '../../middleware/auth.js';
import { AppError } from '../../shared/app-error.js';
import { buildOtpEmailHtml, sendEmail } from '../../shared/mailer.js';
import { memoryStore, TTL_POLICIES } from '../../shared/memory-store.js';
import { buildPaginationMeta } from '../../shared/pagination.js';
import type { AuthUser } from '../../types/domain.js';
import {
  callActivateDonorAccount,
  callAdminUpdateUserStatus,
  callRecordAuthAudit,
  callRegisterDonorAccount,
  callUpdateUserPassword,
  findDonorCertificateRecord,
  findUserByEmail,
  findUserByEmailOrCccd,
  queryAdminUsers,
  queryDonorHistory,
  type CertificateRow,
  type UserAuthRow,
} from './repository.js';
import type {
  AdminUpdateUserStatusInput,
  AdminUserListQuery,
  ForgotPasswordInput,
  HistoryListQuery,
  LoginInput,
  RegisterDonorInput,
  ResetPasswordInput,
  VerifyEmailOtpInput,
} from './schemas.js';

const BCRYPT_SALT_ROUNDS = 10;

interface EmailOtpState {
  otp: string;
  userId: string;
  attempts: number;
}

interface LoginLockState {
  failures: number;
  lockLevel: number;
  lockedUntilMs: number;
}

function generateSixDigitOtp(): string {
  return String(crypto.randomInt(100000, 1000000));
}

function recordInvalidOtpAttempt(key: string, state: EmailOtpState): never {
  const nextAttempts = state.attempts + 1;
  if (nextAttempts >= TTL_POLICIES.EMAIL_OTP_MAX_ATTEMPTS) {
    memoryStore.delete(key);
  } else {
    memoryStore.set<EmailOtpState>(key, {
      value: { ...state, attempts: nextAttempts },
      ttlSeconds: TTL_POLICIES.EMAIL_OTP_SECONDS,
    });
  }
  throw new AppError({ message: 'Mã OTP không chính xác.', statusCode: 400, code: 'INVALID_OTP' });
}

function consumeOtpCode(options: {
  key: string;
  otp: string;
  expiredMessage: string;
}): EmailOtpState {
  const state = memoryStore.get<EmailOtpState>(options.key);
  if (!state) {
    throw new AppError({
      message: options.expiredMessage,
      statusCode: 400,
      code: 'OTP_EXPIRED_OR_NOT_FOUND',
    });
  }
  if (state.otp !== options.otp) {
    recordInvalidOtpAttempt(options.key, state);
  }
  memoryStore.delete(options.key);
  return state;
}

export async function registerDonorAccount(options: {
  input: RegisterDonorInput;
  ip: string | null;
}) {
  const matKhauHash = await bcrypt.hash(options.input.matKhau, BCRYPT_SALT_ROUNDS);
  const created = await callRegisterDonorAccount({
    cccd: options.input.cccd,
    ngaySinh: options.input.ngaySinh,
    email: options.input.email,
    matKhauHash,
    ip: options.ip,
  });
  const otp = generateSixDigitOtp();
  memoryStore.set<EmailOtpState>(`otp:verify:${options.input.email}`, {
    value: { otp, userId: created.userId, attempts: 0 },
    ttlSeconds: TTL_POLICIES.EMAIL_OTP_SECONDS,
  });
  await sendEmail({
    to: options.input.email,
    subject: '[SmartBlood] Mã OTP xác minh tài khoản người hiến máu',
    html: buildOtpEmailHtml({
      title: 'Xác minh địa chỉ email của bạn',
      otp,
      description: 'Nhập mã OTP dưới đây để kích hoạt tài khoản và liên kết lịch sử hiến máu.',
    }),
  });
  return { userId: created.userId, email: created.email, trangThai: created.trangThai };
}

export async function verifyDonorEmailOtp(options: {
  input: VerifyEmailOtpInput;
  ip: string | null;
}) {
  const state = consumeOtpCode({
    key: `otp:verify:${options.input.email}`,
    otp: options.input.otp,
    expiredMessage: 'Mã OTP xác minh đã hết hạn hoặc không tồn tại.',
  });
  const activated = await callActivateDonorAccount({
    userId: state.userId,
    cccd: options.input.cccd,
    ngaySinh: options.input.ngaySinh,
    ip: options.ip,
  });
  const authUser: AuthUser = {
    userId: activated.userId,
    email: options.input.email,
    vaiTro: 'REGISTERED_DONOR',
    hospitalId: null,
    laNguoiPheDuyet: false,
  };
  return { accessToken: signAccessToken(authUser), user: authUser };
}

async function notifyTempLockWarning(options: {
  email: string;
  lockLevel: number;
  mins: number;
}): Promise<void> {
  if (options.lockLevel < 1) {
    return;
  }
  await sendEmail({
    to: options.email,
    subject: '[SmartBlood] Cảnh báo đăng nhập sai nhiều lần',
    html: `<p>Tài khoản vừa bị tạm khóa ${options.mins} phút do nhập sai mật khẩu.</p>`,
  });
}

async function lockAccountTemporarily(options: {
  userId: string;
  email: string;
  lockLevel: number;
  ip: string | null;
}): Promise<never> {
  const levels = TTL_POLICIES.LOGIN_LOCK_LEVELS_SECONDS;
  const durationSec = levels[Math.min(options.lockLevel, levels.length - 1)]!;
  const mins = Math.round(durationSec / 60);
  memoryStore.set<LoginLockState>(`lock:user:${options.userId}`, {
    value: {
      failures: 0,
      lockLevel: options.lockLevel + 1,
      lockedUntilMs: Date.now() + durationSec * 1000,
    },
    ttlSeconds: Math.max(durationSec, 3600),
  });
  await callRecordAuthAudit({
    userId: options.userId,
    hanhDong: 'LOGIN_TEMP_LOCKED',
    chiTiet: JSON.stringify({ durationSec, lockLevel: options.lockLevel + 1 }),
    ip: options.ip,
  });
  await notifyTempLockWarning({ email: options.email, lockLevel: options.lockLevel, mins });
  throw new AppError({
    message: `Đăng nhập sai quá nhiều lần. Tài khoản tạm khóa ${mins} phút.`,
    statusCode: 429,
    code: 'ACCOUNT_TEMPORARILY_LOCKED',
  });
}

const DEFAULT_LOCK_STATE: LoginLockState = { failures: 0, lockLevel: 0, lockedUntilMs: 0 };

async function handleFailedLogin(options: {
  userId: string;
  email: string;
  ip: string | null;
}): Promise<never> {
  const lockKey = `lock:user:${options.userId}`;
  const current = memoryStore.get<LoginLockState>(lockKey) ?? DEFAULT_LOCK_STATE;
  const nextFailures = current.failures + 1;
  if (nextFailures >= TTL_POLICIES.LOGIN_MAX_FAILURES) {
    return lockAccountTemporarily({ ...options, lockLevel: current.lockLevel });
  }
  memoryStore.set<LoginLockState>(lockKey, {
    value: { ...current, failures: nextFailures },
    ttlSeconds: TTL_POLICIES.LOGIN_LOCK_LEVELS_SECONDS[2],
  });
  await callRecordAuthAudit({
    userId: options.userId,
    hanhDong: 'LOGIN_FAILED',
    chiTiet: JSON.stringify({ failures: nextFailures }),
    ip: options.ip,
  });
  throw new AppError({
    message: 'Thông tin đăng nhập không chính xác.',
    statusCode: 401,
    code: 'INVALID_CREDENTIALS',
  });
}

function assertAccountNotLocked(user: UserAuthRow): void {
  if (user.trangThai === 'LOCKED') {
    throw new AppError({
      message: 'Tài khoản đã bị quản trị viên khóa. Vui lòng liên hệ Hội Chữ Thập Đỏ.',
      statusCode: 403,
      code: 'ACCOUNT_LOCKED_BY_ADMIN',
    });
  }
  const lockState = memoryStore.get<LoginLockState>(`lock:user:${user.id}`);
  if (lockState && lockState.lockedUntilMs > Date.now()) {
    const waitSec = Math.ceil((lockState.lockedUntilMs - Date.now()) / 1000);
    throw new AppError({
      message: `Tài khoản đang tạm khóa. Vui lòng thử lại sau ${waitSec} giây.`,
      statusCode: 429,
      code: 'ACCOUNT_TEMPORARILY_LOCKED',
    });
  }
}

function buildLoginResponse(user: UserAuthRow) {
  const authUser: AuthUser = {
    userId: user.id,
    email: user.email,
    vaiTro: user.vaiTro,
    hospitalId: user.hospitalId,
    laNguoiPheDuyet: user.laNguoiPheDuyet,
  };
  return { accessToken: signAccessToken(authUser), user: authUser };
}

export async function loginAccount(input: LoginInput, ip: string | null = null) {
  const user = await findUserByEmailOrCccd(input.identifier);
  if (!user) {
    throw new AppError({
      message: 'Thông tin đăng nhập không chính xác.',
      statusCode: 401,
      code: 'INVALID_CREDENTIALS',
    });
  }
  assertAccountNotLocked(user);
  const passwordMatch = await bcrypt.compare(input.matKhau, user.matKhauHash);
  if (!passwordMatch) {
    return handleFailedLogin({ userId: user.id, email: user.email, ip });
  }
  if (user.trangThai === 'PENDING_VERIFY') {
    throw new AppError({
      message: 'Tài khoản chưa xác minh email OTP.',
      statusCode: 403,
      code: 'EMAIL_NOT_VERIFIED',
    });
  }
  memoryStore.delete(`lock:user:${user.id}`);
  return buildLoginResponse(user);
}

async function issueForgotPasswordOtp(email: string, userId: string): Promise<void> {
  const otp = generateSixDigitOtp();
  memoryStore.set<EmailOtpState>(`otp:reset:${email}`, {
    value: { otp, userId, attempts: 0 },
    ttlSeconds: TTL_POLICIES.EMAIL_OTP_SECONDS,
  });
  await sendEmail({
    to: email,
    subject: '[SmartBlood] Mã OTP đặt lại mật khẩu',
    html: buildOtpEmailHtml({
      title: 'Yêu cầu đặt lại mật khẩu',
      otp,
      description: 'Sử dụng mã OTP bên dưới để thiết lập mật khẩu mới cho tài khoản SmartBlood.',
    }),
  });
}

export async function requestForgotPasswordOtp(input: ForgotPasswordInput): Promise<void> {
  const cooldownKey = `cooldown:reset:${input.email}`;
  if (memoryStore.get<boolean>(cooldownKey)) {
    throw new AppError({
      message: 'Vui lòng chờ 60 giây trước khi yêu cầu gửi lại mã OTP.',
      statusCode: 429,
      code: 'OTP_RESEND_COOLDOWN',
    });
  }
  const user = await findUserByEmail(input.email);
  memoryStore.set<boolean>(cooldownKey, {
    value: true,
    ttlSeconds: TTL_POLICIES.EMAIL_OTP_COOLDOWN_SECONDS,
  });
  if (user) {
    await issueForgotPasswordOtp(user.email, user.id);
  }
}

export async function resetPasswordWithOtp(options: {
  input: ResetPasswordInput;
  ip: string | null;
}): Promise<void> {
  const state = consumeOtpCode({
    key: `otp:reset:${options.input.email}`,
    otp: options.input.otp,
    expiredMessage: 'Mã OTP đặt lại mật khẩu đã hết hạn hoặc không tồn tại.',
  });
  const newHash = await bcrypt.hash(options.input.matKhauMoi, BCRYPT_SALT_ROUNDS);
  await callUpdateUserPassword({
    userId: state.userId,
    matKhauHash: newHash,
    ip: options.ip,
  });
  memoryStore.delete(`lock:user:${state.userId}`);
}

function computeRecoveryStatus(lastDonationDate: Date | null): {
  recoveryPercent: number;
  daysRemaining: number;
} {
  if (!lastDonationDate) {
    return { recoveryPercent: 100, daysRemaining: 0 };
  }
  const minDays = MEDICAL_THRESHOLDS.MIN_DONATION_INTERVAL_DAYS;
  const elapsedDays = Math.floor(
    (Date.now() - lastDonationDate.getTime()) / (24 * 60 * 60 * 1000),
  );
  return {
    daysRemaining: Math.max(0, minDays - elapsedDays),
    recoveryPercent: Math.min(100, Math.round((elapsedDays / minDays) * 100)),
  };
}

export async function getDonorDonationHistory(options: {
  userId: string;
  query: HistoryListQuery;
}) {
  const result = await queryDonorHistory(options);
  const recovery = computeRecoveryStatus(result.lastDonationDate);
  const pagination = buildPaginationMeta({
    page: options.query.page,
    limit: options.query.limit,
    total: result.total,
  });
  return {
    summary: {
      totalDonations: result.total,
      totalVolumeMl: result.totalVolumeMl,
      ...recovery,
    },
    items: result.rows,
    pagination,
  };
}

function drawCertificateContent(
  doc: PDFKit.PDFDocument,
  options: { cert: CertificateRow; qrBuffer: Buffer },
): void {
  const { cert, qrBuffer } = options;
  doc.rect(24, 24, doc.page.width - 48, doc.page.height - 48).lineWidth(3).stroke('#00558F');
  doc.fillColor('#BA1C1D').fontSize(26).text('GIAY CHUNG NHAN HIEN MAU NHAN DAO', {
    align: 'center',
  });
  doc.moveDown(0.4);
  doc.fillColor('#0F172A').fontSize(14).text('HOI CHU THAP DO TP. BIEN HOA - TINH DONG NAI', {
    align: 'center',
  });
  doc.moveDown(1.5);
  doc.fontSize(16).text(`Chung nhan Ong/Ba: ${cert.hoTen}`);
  doc.text(`So CCCD: ${cert.cccd}   |   Nhom mau: ${cert.nhomMau}${cert.rhFactor}`);
  doc.text(`Da tham gia hien mau tinh nguyen tai: ${cert.tenSuKien} (${cert.diaDiem})`);
  doc.text(`The tich: ${cert.theTich} ml   |   Ma tui mau: ${cert.maVachTuiMau}`);
  doc.text(`Ngay hien: ${cert.ngayHien.toISOString().slice(0, 10)}`);
  doc.image(qrBuffer, doc.page.width - 210, doc.page.height - 210, { width: 130 });
  doc.circle(150, doc.page.height - 135, 42).lineWidth(2).stroke('#BA1C1D');
  doc.fillColor('#BA1C1D').fontSize(10).text(
    'DAU DO DIEN TU\nSMARTBLOOD',
    105,
    doc.page.height - 148,
    { width: 90, align: 'center' },
  );
}

async function renderCertificatePdf(cert: CertificateRow): Promise<Buffer> {
  const verifyUrl = `${env.APP_BASE_URL}/verify-certificate/${cert.historyId}`;
  const qrBuffer = await QRCode.toBuffer(verifyUrl, { margin: 1, width: 160 });

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 48 });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    drawCertificateContent(doc, { cert, qrBuffer });
    doc.end();
  });
}

export async function generateDonorCertificatePdf(options: {
  historyId: string;
  userId: string;
}): Promise<{ filename: string; buffer: Buffer }> {
  const cert = await findDonorCertificateRecord(options);
  if (!cert) {
    throw new AppError({
      message: 'Không tìm thấy giấy chứng nhận hiến máu phù hợp.',
      statusCode: 404,
      code: 'CERTIFICATE_NOT_FOUND',
    });
  }
  const buffer = await renderCertificatePdf(cert);
  return { filename: `SmartBlood-ChungNhan-${cert.maVachTuiMau}.pdf`, buffer };
}

export async function listUsersForAdmin(query: AdminUserListQuery) {
  const result = await queryAdminUsers(query);
  const now = Date.now();
  const items = result.rows.map((user) => {
    const lock = memoryStore.get<LoginLockState>(`lock:user:${user.id}`);
    const tempLocked = Boolean(lock && lock.lockedUntilMs > now);
    return { ...user, tempLocked };
  });
  const pagination = buildPaginationMeta({
    page: query.page,
    limit: query.limit,
    total: result.total,
  });
  return { items, pagination };
}

export async function updateAdminUserStatus(options: {
  adminId: string;
  targetUserId: string;
  input: AdminUpdateUserStatusInput;
  ip: string | null;
}) {
  const updated = await callAdminUpdateUserStatus({
    adminId: options.adminId,
    targetUserId: options.targetUserId,
    trangThai: options.input.trangThai,
    ip: options.ip,
  });
  if (options.input.trangThai === 'ACTIVE') {
    memoryStore.delete(`lock:user:${options.targetUserId}`);
  }
  return { ...updated, tempLocked: false };
}
