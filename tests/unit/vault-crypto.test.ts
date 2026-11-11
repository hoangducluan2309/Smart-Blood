import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

process.env.VAULT_KEY_V1 = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

const { decryptVaultField, encryptVaultField, maskPhoneNumber, sealRareContact } = await import(
  '../../backend/src/shared/vault-crypto.js'
);

describe('vault-crypto', () => {
  it('should encrypt and decrypt plaintext using AES-256-GCM when keyVersion is valid', () => {
    const encrypted = encryptVaultField('0908123456', 1);
    const decrypted = decryptVaultField(encrypted, 1);
    assert.equal(decrypted, '0908123456');
    assert.equal(encrypted.iv.length, 12);
  });

  it('should generate unique IVs per field when sealing rare blood donor contact', () => {
    const sealed = sealRareContact({
      soDienThoai: '0908123456',
      diaChi: 'Phường Tân Phong, TP. Biên Hòa',
      keyVersion: 1,
    });
    assert.notEqual(sealed.phone.iv.toString('hex'), sealed.address.iv.toString('hex'));
    assert.equal(decryptVaultField(sealed.phone, 1), '0908123456');
    assert.equal(decryptVaultField(sealed.address, 1), 'Phường Tân Phong, TP. Biên Hòa');
  });

  it('should reject decryption when authTag is tampered', () => {
    const encrypted = encryptVaultField('0908123456', 1);
    const tamperedTag = Buffer.from(encrypted.authTag);
    tamperedTag[0] = (tamperedTag[0] ?? 0) ^ 0xff;

    assert.throws(() => {
      decryptVaultField({ ...encrypted, authTag: tamperedTag }, 1);
    });
  });

  it('should mask rare donor phone numbers in regular views', () => {
    assert.equal(maskPhoneNumber('0908111123'), '0908***123');
    assert.equal(maskPhoneNumber('12345'), '***');
  });
});
