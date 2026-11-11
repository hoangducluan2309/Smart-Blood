import { config as loadDotenv } from 'dotenv';
import { z } from 'zod';

loadDotenv({ path: '../.env' });
loadDotenv();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  APP_BASE_URL: z.string().url().default('https://smartblood.vn'),
  ALLOWED_ORIGINS: z.string().default('http://localhost:5173'),
  DB_SERVER: z.string().min(1).default('localhost'),
  DB_PORT: z.coerce.number().int().positive().default(1433),
  DB_NAME: z.string().min(1).default('HienMauDB'),
  DB_USER: z.string().min(1).default('sa'),
  DB_PASSWORD: z.string().default(''),
  DB_ENCRYPT: z.enum(['true', 'false']).default('false'),
  DB_TRUST_SERVER_CERT: z.enum(['true', 'false']).default('true'),
  JWT_SECRET: z.string().min(16).default('dev-only-secret-change-in-production-1234'),
  JWT_EXPIRES_IN: z.string().default('2h'),
  VAULT_ACTIVE_KEY_VERSION: z.coerce.number().int().positive().default(1),
  VAULT_KEY_V1: z.string().length(64).optional(),
  SMTP_HOST: z.string().default('smtp.gmail.com'),
  SMTP_PORT: z.coerce.number().int().positive().default(587),
  SMTP_USER: z.string().default(''),
  SMTP_PASS: z.string().default(''),
  SMTP_FROM: z.string().default('SmartBlood Red Cross <no-reply@smartblood.vn>'),
  EMERGENCY_ONCALL_EMAILS: z.string().default(''),
  EMERGENCY_ACK_TIMEOUT_MS: z.coerce.number().int().positive().default(120000),
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  const details = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
  throw new Error(`Invalid environment configuration: ${details}`);
}

export const env = {
  ...parsed.data,
  allowedOrigins: parsed.data.ALLOWED_ORIGINS.split(',').map((o) => o.trim()).filter(Boolean),
  emergencyOncallEmails: parsed.data.EMERGENCY_ONCALL_EMAILS
    .split(',')
    .map((e) => e.trim())
    .filter(Boolean),
  dbEncrypt: parsed.data.DB_ENCRYPT === 'true',
  dbTrustServerCert: parsed.data.DB_TRUST_SERVER_CERT === 'true',
} as const;

export function getVaultKeyHex(version: number): string | undefined {
  const key = process.env[`VAULT_KEY_V${version}`];
  return typeof key === 'string' && key.length === 64 ? key : undefined;
}
