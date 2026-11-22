import { Router } from 'express';

import { requireRole, verifyJwt } from '../../middleware/auth.js';
import { validateBody, validateParams, validateQuery } from '../../middleware/validate.js';
import { asyncHandler } from '../../shared/async-handler.js';
import { sendSuccess } from '../../shared/response.js';
import {
  clinicalExamSchema,
  collectBloodBagSchema,
  eventQueueParamSchema,
  queueListQuerySchema,
  rapidTestSchema,
  type ClinicalExamInput,
  type CollectBloodBagInput,
  type QueueListQuery,
  type RapidTestInput,
} from './schemas.js';
import {
  collectBloodBag,
  getMedicalQueue,
  submitClinicalExam,
  submitRapidTest,
} from './service.js';

export const medicalWorkflowRouter = Router();

medicalWorkflowRouter.get(
  '/queue/:eventId',
  verifyJwt,
  requireRole('RED_CROSS_STAFF', 'ADMIN'),
  validateParams(eventQueueParamSchema),
  validateQuery(queueListQuerySchema),
  asyncHandler(async (req, res) => {
    const query = req.query as unknown as QueueListQuery;
    const result = await getMedicalQueue({
      eventId: String(req.params.eventId),
      query,
    });
    sendSuccess({ res, data: result.items, pagination: result.pagination });
  }),
);

medicalWorkflowRouter.post(
  '/exam/clinical',
  verifyJwt,
  requireRole('RED_CROSS_STAFF', 'ADMIN'),
  validateBody(clinicalExamSchema),
  asyncHandler(async (req, res) => {
    const input = req.body as ClinicalExamInput;
    const data = await submitClinicalExam({
      input,
      bacSiId: req.user!.userId,
      ip: req.ip ?? null,
    });
    sendSuccess({ res, data, message: 'Ghi nhận khám lâm sàng thành công' });
  }),
);

medicalWorkflowRouter.post(
  '/exam/rapid-test',
  verifyJwt,
  requireRole('RED_CROSS_STAFF', 'ADMIN'),
  validateBody(rapidTestSchema),
  asyncHandler(async (req, res) => {
    const input = req.body as RapidTestInput;
    const data = await submitRapidTest({
      input,
      kyThuatVienId: req.user!.userId,
      ip: req.ip ?? null,
    });
    sendSuccess({ res, data, message: 'Ghi nhận xét nghiệm nhanh thành công' });
  }),
);

medicalWorkflowRouter.post(
  '/blood-bag/collect',
  verifyJwt,
  requireRole('RED_CROSS_STAFF', 'ADMIN'),
  validateBody(collectBloodBagSchema),
  asyncHandler(async (req, res) => {
    const input = req.body as CollectBloodBagInput;
    const data = await collectBloodBag({
      input,
      collectedBy: req.user!.userId,
      ip: req.ip ?? null,
    });
    sendSuccess({
      res,
      data,
      statusCode: 201,
      message: 'Đã lấy máu và đưa túi vào kho cách ly (QUARANTINE)',
    });
  }),
);
