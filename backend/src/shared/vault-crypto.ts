import crypto from 'node:crypto';

import { env, getVaultKeyHex } from '../config/env.js';
import { AppError } from './app-error.js';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH_BYTES = 12;

export interface EncryptedField {
  ciphertext: Buffer;
  iv: Buffer;
  authTag: Buffer;
}

export interface SealedRareContact {
  keyVersion: number;
  phone: EncryptedField;
  address: EncryptedField;
}

function resolveKeyBuffer(keyVersion: number): Buffer {
  const keyHex = getVaultKeyHex(keyVersion);
  if (!keyHex) {
    throw new AppError({
      message: 'Thiếu khóa giải mã Két máu hiếm cho phiên bản khóa yêu cầu',
      statusCode: 500,
      code: 'VAULT_KEY_MISSING',
    });
  }
  return Buffer.from(keyHex, 'hex');
}

export function encryptVaultField(plaintext: string, keyVersion: number): EncryptedField {
  const key = resolveKeyBuffer(keyVersion);
  // Luon sinh IV 12-byte ngau nhien moi cho tung truong de dam bao an toan GCM
  const iv = crypto.randomBytes(IV_LENGTH_BYTES);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return { ciphertext, iv, authTag };
}

export function decryptVaultField(
  encrypted: EncryptedField,
  keyVersion: number,
): string {
  const key = resolveKeyBuffer(keyVersion);
  const decipher = crypto.createDecipheriv(ALGORITHM, key, encrypted.iv);
  decipher.setAuthTag(encrypted.authTag);
  const plaintext = Buffer.concat([
    decipher.update(encrypted.ciphertext),
    decipher.final(),
  ]);
  return plaintext.toString('utf8');
}

export function sealRareContact(options: {
  soDienThoai: string;
  diaChi: string;
  keyVersion?: number;
}): SealedRareContact {
  const keyVersion = options.keyVersion ?? env.VAULT_ACTIVE_KEY_VERSION;
  return {
    keyVersion,
    phone: encryptVaultField(options.soDienThoai, keyVersion),
    address: encryptVaultField(options.diaChi, keyVersion),
  };
}

export function maskPhoneNumber(phone: string): string {
  if (phone.length < 7) {
    return '***';
  }
  return `${phone.slice(0, 4)}***${phone.slice(-3)}`;
}
