import { Router, Request, Response } from 'express';
import { sendSuccess } from '../../utils/response';
import { MOCK_METRICS } from '../../data/mockInvoices';

const router = Router();

/**
 * GET /api/v1/dashboard/metrics
 * Returns overview statistics for total sales, invoices, collection, and outstanding
 */
router.get('/metrics', (_req: Request, res: Response) => {
  return sendSuccess(
    res,
    MOCK_METRICS,
    'Dashboard metrics retrieved successfully (Preview Mode)'
  );
});

export const dashboardRouter = router;
