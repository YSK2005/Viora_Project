import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import { AuthenticatedRequest, requireRole } from '../../middlewares/auth';
import { validateRequest } from '../../middlewares/validate';
import { sendSuccess } from '../../utils/response';
import {
  listRecurringSchedules,
  createRecurringSchedule,
  triggerRecurringSchedule,
  toggleRecurringSchedule,
  deleteRecurringSchedule,
  isValidISODateString,
} from '../../repositories/recurring.repository';

const router = Router();

const createScheduleSchema = z.object({
  invoiceId: z.string().uuid('Valid invoice ID required'),
  frequency: z.enum(['WEEKLY', 'MONTHLY', 'QUARTERLY', 'ANNUALLY']).default('MONTHLY'),
  startDate: z
    .string()
    .refine((val) => isValidISODateString(val), {
      message: 'Invalid start date format or non-existent calendar date (expected YYYY-MM-DD)',
    })
    .optional(),
});

const triggerScheduleSchema = z.object({
  requestKey: z.string().max(128).optional(),
});

/**
 * GET /api/v1/recurring
 * List all recurring invoice schedules for the active business
 */
router.get('/', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const schedules = await listRecurringSchedules(req.business.id);
    return sendSuccess(res, { schedules });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/recurring
 * Create a new recurring schedule from an existing template invoice
 */
router.post(
  '/',
  requireRole(['OWNER', 'ACCOUNTANT']),
  validateRequest({ body: createScheduleSchema }),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { invoiceId, frequency, startDate } = req.body;
      const schedule = await createRecurringSchedule(
        req.business.id,
        req.user?.id,
        invoiceId,
        frequency,
        startDate
      );
      return sendSuccess(res, { schedule }, 'Recurring invoice profile created successfully', 201);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/v1/recurring/:id/trigger
 * Manually trigger the recurring schedule to generate the next draft invoice
 * Supports idempotency via Idempotency-Key header or requestKey in body
 */
router.post(
  '/:id/trigger',
  requireRole(['OWNER', 'ACCOUNTANT']),
  validateRequest({ body: triggerScheduleSchema.optional() }),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const idempotencyKey =
        (req.headers['idempotency-key'] as string) ||
        (req.headers['x-idempotency-key'] as string) ||
        req.body?.requestKey;

      const result = await triggerRecurringSchedule(
        req.business.id,
        req.user?.id,
        id,
        idempotencyKey
      );

      const message = result.isIdempotentReplay
        ? `Idempotent replay: Draft invoice ${result.invoice.invoiceNumber} previously generated`
        : `Generated draft invoice ${result.invoice.invoiceNumber} for recurring schedule`;

      return sendSuccess(res, result, message);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * PATCH /api/v1/recurring/:id/toggle
 * Toggle recurring schedule active / paused
 */
router.patch(
  '/:id/toggle',
  requireRole(['OWNER', 'ACCOUNTANT']),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const schedule = await toggleRecurringSchedule(req.business.id, req.user?.id, id);
      return sendSuccess(res, { schedule }, `Recurring schedule is now ${schedule.status}`);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * DELETE /api/v1/recurring/:id
 * Delete a recurring schedule
 */
router.delete(
  '/:id',
  requireRole(['OWNER', 'ACCOUNTANT']),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      await deleteRecurringSchedule(req.business.id, req.user?.id, id);
      return sendSuccess(res, { id }, 'Recurring schedule deleted');
    } catch (error) {
      next(error);
    }
  }
);

export const recurringRouter = router;
