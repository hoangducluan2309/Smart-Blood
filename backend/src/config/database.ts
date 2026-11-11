import sql from 'mssql';

import { env } from './env.js';

function createPoolConfig(maxConnections: number): sql.config {
  return {
    server: env.DB_SERVER,
    port: env.DB_PORT,
    database: env.DB_NAME,
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    pool: {
      max: maxConnections,
      min: 0,
      idleTimeoutMillis: 30000,
    },
    options: {
      encrypt: env.dbEncrypt,
      trustServerCertificate: env.dbTrustServerCert,
    },
  };
}

// Tach 2 pool doc lap: cao diem check-in (main) khong lam nghen luong cap cuu (priority)
export const mainPool = new sql.ConnectionPool(createPoolConfig(40));
export const priorityPool = new sql.ConnectionPool(createPoolConfig(10));

export async function connectDatabasePools(): Promise<void> {
  await Promise.all([mainPool.connect(), priorityPool.connect()]);
}

export async function checkDatabaseReadiness(): Promise<boolean> {
  if (!mainPool.connected || !priorityPool.connected) {
    return false;
  }
  await Promise.all([
    mainPool.request().query('SELECT 1 AS ok'),
    priorityPool.request().query('SELECT 1 AS ok'),
  ]);
  return true;
}

export async function closeDatabasePools(): Promise<void> {
  await Promise.allSettled([mainPool.close(), priorityPool.close()]);
}
