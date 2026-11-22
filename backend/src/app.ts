import cors from 'cors';
import express, { type Express } from 'express';
import helmet from 'helmet';

import { checkDatabaseReadiness } from './config/database.js';
import { env } from './config/env.js';
import { errorHandler } from './middleware/error-handler.js';
import { requestContext } from './middleware/request-context.js';
import {
  adminUsersRouter,
  authRouter,
  donorPortalRouter,
} from './modules/donor-portal/routes.js';
import { eventQrRouter } from './modules/event-qr/routes.js';
import { emergencyRouter, hospitalRouter } from './modules/hospital/routes.js';
import { inventoryRouter, vaultRouter } from './modules/inventory-vault/routes.js';
import { medicalWorkflowRouter } from './modules/medical-workflow/routes.js';
import { publicCheckInRouter } from './modules/public-checkin/routes.js';
import { AppError } from './shared/app-error.js';
import { asyncHandler } from './shared/async-handler.js';

function registerHealthRoutes(app: Express): void {
  app.get('/api/health', (_req, res) => {
    res.status(200).json({
      success: true,
      data: {
        status: 'ok',
        service: 'smartblood-api',
        timestamp: new Date().toISOString(),
      },
    });
  });

  app.get(
    '/api/health/ready',
    asyncHandler(async (_req, res) => {
      const ready = await checkDatabaseReadiness();
      if (!ready) {
        res.status(503).json({
          success: false,
          error: { code: 'DATABASE_NOT_READY', message: 'Kết nối CSDL chưa sẵn sàng' },
        });
        return;
      }
      res.status(200).json({ success: true, data: { status: 'ready' } });
    }),
  );
}

function registerApiRouters(app: Express): void {
  app.use('/api/v1/events', eventQrRouter);
  app.use('/api/v1/public/checkin', publicCheckInRouter);
  app.use('/api/v1/medical', medicalWorkflowRouter);
  app.use('/api/v1/inventory', inventoryRouter);
  app.use('/api/v1/vault', vaultRouter);
  app.use('/api/v1/hospital', hospitalRouter);
  app.use('/api/v1/emergency', emergencyRouter);
  app.use('/api/v1/auth', authRouter);
  app.use('/api/v1/donor', donorPortalRouter);
  app.use('/api/v1/admin/users', adminUsersRouter);
}

function registerNotFoundHandler(app: Express): void {
  app.use((_req, _res, next) => {
    next(
      new AppError({
        message: 'Không tìm thấy đường dẫn API yêu cầu',
        statusCode: 404,
        code: 'NOT_FOUND',
      }),
    );
  });
}

export function createApp(): Express {
  const app = express();
  app.set('trust proxy', 1);
  app.use(helmet());
  app.use(cors({ origin: env.allowedOrigins, credentials: true }));
  app.use(express.json({ limit: '1mb' }));
  app.use(requestContext);

  registerHealthRoutes(app);
  registerApiRouters(app);
  registerNotFoundHandler(app);
  app.use(errorHandler);
  return app;
}
