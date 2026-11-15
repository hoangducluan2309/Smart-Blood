import { Router } from 'express';

import { requireRole, verifyJwt } from '../../middleware/auth.js';
import { validateBody, validateParams, validateQuery } from '../../middleware/validate.js';
import { asyncHandler } from '../../shared/async-handler.js';
import { sendSuccess } from '../../shared/response.js';
import {
  createEventSchema,
  eventIdParamSchema,
  listEventsQuerySchema,
  qrDownloadQuerySchema,
  updateEventStatusSchema,
  type CreateEventInput,
  type ListEventsQuery,
  type QrDownloadQuery,
  type UpdateEventStatusInput,
} from './schemas.js';
import {
  createDonationEvent,
  generateEventQrAsset,
  getEventProgressSummary,
  listDonationEvents,
  updateEventStatus,
} from './service.js';

export const eventQrRouter = Router();

eventQrRouter.post(
  '/',
  verifyJwt,
  requireRole('ADMIN', 'RED_CROSS_STAFF'),
  validateBody(createEventSchema),
  asyncHandler(async (req, res) => {
    const input = req.body as CreateEventInput;
    const data = await createDonationEvent({
      input,
      createdBy: req.user!.userId,
      ip: req.ip ?? null,
    });
    sendSuccess({ res, data, statusCode: 201, message: 'Tạo sự kiện hiến máu thành công' });
  }),
);

eventQrRouter.get(
  '/',
  verifyJwt,
  requireRole('ADMIN', 'RED_CROSS_STAFF'),
  validateQuery(listEventsQuerySchema),
  asyncHandler(async (req, res) => {
    const query = req.query as unknown as ListEventsQuery;
    const result = await listDonationEvents(query);
    sendSuccess({ res, data: result.items, pagination: result.pagination });
  }),
);

eventQrRouter.get(
  '/:id/progress',
  verifyJwt,
  requireRole('ADMIN', 'RED_CROSS_STAFF'),
  validateParams(eventIdParamSchema),
  asyncHandler(async (req, res) => {
    const data = await getEventProgressSummary(String(req.params.id));
    sendSuccess({ res, data });
  }),
);

eventQrRouter.get(
  '/:id/qr-download',
  validateParams(eventIdParamSchema),
  validateQuery(qrDownloadQuerySchema),
  asyncHandler(async (req, res) => {
    const query = req.query as unknown as QrDownloadQuery;
    const asset = await generateEventQrAsset({
      eventId: String(req.params.id),
      format: query.format,
    });
    res.setHeader('Cache-Control', 'public, max-age=86400, stale-while-revalidate=3600');
    res.setHeader('Content-Type', asset.contentType);
    res.setHeader('Content-Disposition', `inline; filename="${asset.filename}"`);
    res.status(200).send(asset.body);
  }),
);

eventQrRouter.patch(
  '/:id/status',
  verifyJwt,
  requireRole('ADMIN'),
  validateParams(eventIdParamSchema),
  validateBody(updateEventStatusSchema),
  asyncHandler(async (req, res) => {
    const body = req.body as UpdateEventStatusInput;
    const data = await updateEventStatus({
      eventId: String(req.params.id),
      trangThai: body.trangThai,
      updatedBy: req.user!.userId,
      ip: req.ip ?? null,
    });
    sendSuccess({ res, data });
  }),
);
