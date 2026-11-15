import { Router } from 'express';

import { lookupCccdIpLimiter, publicCheckInLimiter } from '../../middleware/rate-limiter.js';
import { validateBody } from '../../middleware/validate.js';
import { asyncHandler } from '../../shared/async-handler.js';
import { sendSuccess } from '../../shared/response.js';
import {
  lookupCccdSchema,
  submitCheckInSchema,
  type LookupCccdInput,
  type SubmitCheckInInput,
} from './schemas.js';
import { lookupDonorByCccd, submitDonorCheckIn } from './service.js';

export const publicCheckInRouter = Router();

publicCheckInRouter.post(
  '/lookup-cccd',
  lookupCccdIpLimiter,
  validateBody(lookupCccdSchema),
  asyncHandler(async (req, res) => {
    const input = req.body as LookupCccdInput;
    const data = await lookupDonorByCccd(input);
    sendSuccess({ res, data });
  }),
);

publicCheckInRouter.post(
  '/submit',
  publicCheckInLimiter,
  validateBody(submitCheckInSchema),
  asyncHandler(async (req, res) => {
    const input = req.body as SubmitCheckInInput;
    const data = await submitDonorCheckIn(input, req.ip ?? null);
    sendSuccess({ res, data, statusCode: 201, message: 'Đăng ký hiến máu thành công' });
  }),
);
