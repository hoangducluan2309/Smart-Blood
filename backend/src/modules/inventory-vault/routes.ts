import { Router } from 'express';

import { requireApprover, requireRole, verifyJwt } from '../../middleware/auth.js';
import { validateBody, validateParams, validateQuery } from '../../middleware/validate.js';
import { asyncHandler } from '../../shared/async-handler.js';
import { sendSuccess } from '../../shared/response.js';
import {
  approveVaultUnlockSchema,
  bagIdParamSchema,
  fefoListQuerySchema,
  quarantineListQuerySchema,
  recordLabResultSchema,
  requestIdParamSchema,
  requestVaultUnlockSchema,
  type ApproveVaultUnlockInput,
  type FefoListQuery,
  type QuarantineListQuery,
  type RecordLabResultInput,
  type RequestVaultUnlockInput,
} from './schemas.js';
import {
  approveRareBloodVaultUnlock,
  getInventoryOverview,
  listFefoBloodBags,
  listMaskedRareDonors,
  listQuarantineBloodBags,
  listSecurityAuditLogs,
  recordBloodBagLabResult,
  requestRareBloodVaultUnlock,
  revealRareBloodVaultContact,
} from './service.js';

export const inventoryRouter = Router();
export const vaultRouter = Router();

inventoryRouter.get(
  '/summary',
  verifyJwt,
  requireRole('ADMIN', 'RED_CROSS_STAFF'),
  asyncHandler(async (_req, res) => {
    const data = await getInventoryOverview();
    sendSuccess({ res, data });
  }),
);

inventoryRouter.get(
  '/fefo-list',
  verifyJwt,
  requireRole('ADMIN', 'RED_CROSS_STAFF'),
  validateQuery(fefoListQuerySchema),
  asyncHandler(async (req, res) => {
    const query = req.query as unknown as FefoListQuery;
    const result = await listFefoBloodBags(query);
    sendSuccess({ res, data: result.items, pagination: result.pagination });
  }),
);

inventoryRouter.get(
  '/quarantine',
  verifyJwt,
  requireRole('ADMIN', 'RED_CROSS_STAFF'),
  validateQuery(quarantineListQuerySchema),
  asyncHandler(async (req, res) => {
    const query = req.query as unknown as QuarantineListQuery;
    const result = await listQuarantineBloodBags(query);
    sendSuccess({ res, data: result.items, pagination: result.pagination });
  }),
);

inventoryRouter.post(
  '/blood-bag/:id/lab-result',
  verifyJwt,
  requireRole('ADMIN', 'RED_CROSS_STAFF'),
  validateParams(bagIdParamSchema),
  validateBody(recordLabResultSchema),
  asyncHandler(async (req, res) => {
    const input = req.body as RecordLabResultInput;
    const data = await recordBloodBagLabResult({
      bloodBagId: String(req.params.id),
      input,
      reviewedBy: req.user!.userId,
      ip: req.ip ?? null,
    });
    sendSuccess({ res, data, message: 'Cập nhật kết quả xét nghiệm sàng lọc thành công' });
  }),
);

inventoryRouter.get(
  '/audit-logs',
  verifyJwt,
  requireRole('ADMIN'),
  asyncHandler(async (_req, res) => {
    const data = await listSecurityAuditLogs();
    sendSuccess({ res, data });
  }),
);

vaultRouter.get(
  '/donors',
  verifyJwt,
  requireRole('ADMIN'),
  asyncHandler(async (_req, res) => {
    const data = await listMaskedRareDonors();
    sendSuccess({ res, data });
  }),
);

vaultRouter.post(
  '/request-unlock',
  verifyJwt,
  requireRole('ADMIN'),
  validateBody(requestVaultUnlockSchema),
  asyncHandler(async (req, res) => {
    const input = req.body as RequestVaultUnlockInput;
    const data = await requestRareBloodVaultUnlock({
      requesterId: req.user!.userId,
      input,
      ip: req.ip ?? null,
    });
    sendSuccess({
      res,
      data,
      statusCode: 201,
      message: 'Đã gửi yêu cầu mở két và phát mã OTP riêng cho lãnh đạo phê duyệt',
    });
  }),
);

vaultRouter.post(
  '/approve',
  verifyJwt,
  requireApprover,
  validateBody(approveVaultUnlockSchema),
  asyncHandler(async (req, res) => {
    const input = req.body as ApproveVaultUnlockInput;
    const data = await approveRareBloodVaultUnlock({
      approverId: req.user!.userId,
      input,
      ip: req.ip ?? null,
    });
    sendSuccess({ res, data, message: 'Phê duyệt mở két máu hiếm thành công (hiệu lực 15 phút)' });
  }),
);

vaultRouter.get(
  '/:requestId/reveal',
  verifyJwt,
  requireRole('ADMIN'),
  validateParams(requestIdParamSchema),
  asyncHandler(async (req, res) => {
    const data = await revealRareBloodVaultContact({
      requestId: String(req.params.requestId),
      viewerId: req.user!.userId,
      ip: req.ip ?? null,
    });
    sendSuccess({ res, data });
  }),
);
