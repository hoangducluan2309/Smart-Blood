process.env.NODE_ENV = 'test';
process.env.PORT = '4001';
process.env.APP_BASE_URL = process.env.APP_BASE_URL ?? 'http://localhost:5173';
process.env.ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS ?? 'http://localhost:5173';
process.env.DB_SERVER = process.env.DB_SERVER ?? '127.0.0.1';
process.env.DB_PORT = process.env.DB_PORT ?? '1433';
process.env.DB_NAME = process.env.DB_NAME ?? 'HienMauDB';
process.env.DB_USER = process.env.DB_USER ?? 'hienmau_app';
process.env.DB_PASSWORD = process.env.DB_PASSWORD ?? 'ChangeThisStrongAppPass!2026';
process.env.DB_ENCRYPT = 'false';
process.env.DB_TRUST_SERVER_CERT = 'true';
process.env.JWT_SECRET =
  process.env.JWT_SECRET ?? 'smartblood-test-jwt-secret-key-min-32-chars!';
process.env.VAULT_ACTIVE_KEY_VERSION = '1';
process.env.VAULT_KEY_V1 =
  process.env.VAULT_KEY_V1 ??
  '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
process.env.EMERGENCY_ACK_TIMEOUT_MS = '60000';
