import winston from 'winston';

import { env } from '../config/env.js';

const SENSITIVE_KEYS = new Set([
  'cccd',
  'matKhau',
  'matKhauHash',
  'password',
  'jwt',
  'token',
  'authorization',
  'otp',
  'soDienThoai',
  'diaChi',
  'lyDoTamHoan',
  'lyDoTuChoi',
]);

function redactSensitiveFields(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(redactSensitiveFields);
  }
  if (value !== null && typeof value === 'object') {
    const output: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value)) {
      output[key] = SENSITIVE_KEYS.has(key) ? '[REDACTED]' : redactSensitiveFields(item);
    }
    return output;
  }
  return value;
}

const redactFormat = winston.format((info) => {
  return redactSensitiveFields(info) as winston.Logform.TransformableInfo;
});

export const logger = winston.createLogger({
  level: env.NODE_ENV === 'production' ? 'info' : 'debug',
  defaultMeta: { service: 'smartblood-api' },
  format: winston.format.combine(
    winston.format.timestamp(),
    redactFormat(),
    winston.format.json(),
  ),
  transports: [new winston.transports.Console()],
});
