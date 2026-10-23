import { Router } from 'express';
import { healthRouter } from './health.route';
import { invoicesRouter } from './v1/invoices.route';
import { dashboardRouter } from './v1/dashboard.route';

const router = Router();

// Health check endpoint mounted at /health (accessible as /api/health)
router.use('/health', healthRouter);

// Version 1 routes
router.use('/v1/invoices', invoicesRouter);
router.use('/v1/dashboard', dashboardRouter);

export const apiRouter = router;
