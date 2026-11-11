import http from 'node:http';

import { createApp } from './app.js';
import { closeDatabasePools, connectDatabasePools } from './config/database.js';
import { env } from './config/env.js';
import { logger } from './shared/logger.js';
import { memoryStore } from './shared/memory-store.js';
import { attachSocketServer } from './sockets/index.js';

async function bootstrap(): Promise<void> {
  await connectDatabasePools();
  logger.info('mssql_pools_connected', { database: env.DB_NAME });

  const app = createApp();
  const httpServer = http.createServer(app);
  const io = attachSocketServer(httpServer);

  httpServer.listen(env.PORT, () => {
    logger.info('server_started', { port: env.PORT, env: env.NODE_ENV });
  });

  const shutdown = (signal: string): void => {
    logger.info('graceful_shutdown_started', { signal });
    httpServer.close(() => {
      void (async () => {
        await io.close();
        await closeDatabasePools();
        memoryStore.dispose();
        logger.info('graceful_shutdown_completed');
        process.exit(0);
      })();
    });
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

bootstrap().catch((err: unknown) => {
  logger.error('bootstrap_failed', {
    errorMessage: err instanceof Error ? err.message : String(err),
  });
  process.exit(1);
});
