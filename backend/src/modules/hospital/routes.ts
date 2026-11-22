import { Router } from 'express';

import { requireRole, verifyJwt } from '../../middleware/auth.js';
import { emergencyAlertLimiter } from '../../middleware/rate-limiter.js';
import { validateBody, validateParams, validateQuery } from '../../middleware/validate.js';
import { asyncHandler } from '../../shared/async-handler.js';
import { sendSuccess } from '../../shared/response.js';
import {
  dispatchBloodBagsSchema,
  emergencyAlertSchema,
  emergencyIdParamSchema,
  listDispatchesQuerySchema,
  verifyAndReceiveSchema,
  type DispatchBloodBagsInput,
  type EmergencyAlertInput,
  type ListDispatchesQuery,
  type VerifyAndReceiveInput,
} from './schemas.js';
import {
  acknowledgeEmergencyAlert,
  dispatchBloodBagsFefo,
  getHospitalInventoryOverview,
  listDispatchesForUser,
  listEmergencyRequestsForUser,
  triggerEmergencyAlert,
  verifyAndReceiveBloodBag,
} from './service.js';

export const hospitalRouter = Router();
export const emergencyRouter = Router();

emergencyRouter.post(
  '/:id/acknowledge',
  verifyJwt,
  requireRole('RED_CROSS_STAFF', 'ADMIN'),
  validateParams(emergencyIdParamSchema),
  asyncHandler(async (req, res) => {
    const data = await acknowledgeEmergencyAlert({
      emergencyId: String(req.params.id),
      staffUserId: req.user!.userId,
      ip: req.ip ?? null,
    });
    sendSuccess({ res, data, message: 'Đã xác nhận tiếp nhận lệnh cấp cứu' });
  }),
);

hospitalRouter.get(
  '/inventory-overview',
  verifyJwt,
  requireRole('HOSPITAL_STAFF', 'ADMIN'),
  asyncHandler(async (_req, res) => {
    const data = await getHospitalInventoryOverview();
    sendSuccess({ res, data });
  }),
);

hospitalRouter.post(
  '/emergency-alert',
  verifyJwt,
  requireRole('HOSPITAL_STAFF'),
  emergencyAlertLimiter,
  validateBody(emergencyAlertSchema),
  asyncHandler(async (req, res) => {
    const input = req.body as EmergencyAlertInput;
    const data = await triggerEmergencyAlert({
      requesterUserId: req.user!.userId,
      input,
      ip: req.ip ?? null,
    });
    sendSuccess({ res, data, statusCode: 201, message: 'Đã phát lệnh báo động đỏ cấp cứu' });
  }),
);

hospitalRouter.get(
  '/emergency-requests',
  verifyJwt,
  requireRole('HOSPITAL_STAFF', 'RED_CROSS_STAFF', 'ADMIN'),
  asyncHandler(async (req, res) => {
    const data = await listEmergencyRequestsForUser(req.user!);
    sendSuccess({ res, data });
  }),
);

hospitalRouter.post(
  '/emergency/:id/acknowledge',
  verifyJwt,
  requireRole('RED_CROSS_STAFF', 'ADMIN'),
  validateParams(emergencyIdParamSchema),
  asyncHandler(async (req, res) => {
    const data = await acknowledgeEmergencyAlert({
      emergencyId: String(req.params.id),
      staffUserId: req.user!.userId,
      ip: req.ip ?? null,
    });
    sendSuccess({ res, data, message: 'Đã xác nhận tiếp nhận lệnh cấp cứu' });
  }),
);

hospitalRouter.post(
  '/dispatch',
  verifyJwt,
  requireRole('ADMIN', 'RED_CROSS_STAFF'),
  validateBody(dispatchBloodBagsSchema),
  asyncHandler(async (req, res) => {
    const input = req.body as DispatchBloodBagsInput;
    const data = await dispatchBloodBagsFefo({
      input,
      dispatchedBy: req.user!.userId,
      ip: req.ip ?? null,
    });
    sendSuccess({ res, data, statusCode: 201, message: 'Xuất kho FEFO thành công' });
  }),
);

hospitalRouter.get(
  '/dispatches',
  verifyJwt,
  requireRole('ADMIN', 'RED_CROSS_STAFF', 'HOSPITAL_STAFF'),
  validateQuery(listDispatchesQuerySchema),
  asyncHandler(async (req, res) => {
    const query = req.query as unknown as ListDispatchesQuery;
    const result = await listDispatchesForUser({ user: req.user!, query });
    sendSuccess({ res, data: result.items, pagination: result.pagination });
  }),
);

hospitalRouter.post(
  '/verify-and-receive',
  verifyJwt,
  requireRole('HOSPITAL_STAFF'),
  validateBody(verifyAndReceiveSchema),
  asyncHandler(async (req, res) => {
    const input = req.body as VerifyAndReceiveInput;
    const data = await verifyAndReceiveBloodBag({
      input,
      receiverUserId: req.user!.userId,
      ip: req.ip ?? null,
    });
    sendSuccess({
      res,
      data,
      message: 'Xác nhận nhập kho bệnh viện thành công và đã gửi lời cảm ơn người hiến',
    });
  }),
);
