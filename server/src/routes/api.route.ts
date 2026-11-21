import {creditsRouter} from './v1/credits.route';
import { recurringRouter } from './v1/recurring.route';
import { subscriptionsRouter } from './v1/subscriptions.route';
import { superAdminRouter } from './v1/superadmin.route';
import { Router } from 'express';
import { healthRouter } from './health.route';
import { authRouter } from './v1/auth.route';
import { businessRouter } from './v1/business.route';
import { customersRouter } from './v1/customers.route';
import { productsRouter } from './v1/products.route';
import { invoicesRouter } from './v1/invoices.route';
import { paymentsRouter } from './v1/payments.route';
import { dashboardRouter } from './v1/dashboard.route';
import { reportsRouter } from './v1/reports.route';
import { searchRouter } from './v1/search.route';
import { requireAuth } from '../middlewares/auth';

const router = Router();

// Health check endpoint mounted at /health (accessible as /api/health)
router.use('/health', healthRouter);

// Authentication & Session endpoints (public)
router.use('/auth', authRouter);
router.use('/v1/auth', authRouter);

// Subscriptions & Razorpay Payment Gateway (public plans, protected subscriptions)
router.use('/subscriptions', subscriptionsRouter);
router.use('/v1/subscriptions', subscriptionsRouter);

// Super Admin System Management Portal
router.use('/superadmin', superAdminRouter);
router.use('/v1/superadmin', superAdminRouter);

router.use('/credit-notes', requireAuth, creditsRouter);
router.use('/v1/credit-notes', requireAuth, creditsRouter);

router.use('/recurring', requireAuth, recurringRouter);
router.use('/v1/recurring', requireAuth, recurringRouter);

// Core business endpoints protected by requireAuth
router.use('/business', requireAuth, businessRouter);
router.use('/customers', requireAuth, customersRouter);
router.use('/products', requireAuth, productsRouter);
router.use('/invoices', requireAuth, invoicesRouter);
router.use('/payments', requireAuth, paymentsRouter);
router.use('/dashboard', requireAuth, dashboardRouter);
router.use('/reports', requireAuth, reportsRouter);
router.use('/search', requireAuth, searchRouter);

// Versioned aliases (/api/v1/...) for backwards compatibility
router.use('/v1/business', requireAuth, businessRouter);
router.use('/v1/customers', requireAuth, customersRouter);
router.use('/v1/products', requireAuth, productsRouter);
router.use('/v1/invoices', requireAuth, invoicesRouter);
router.use('/v1/payments', requireAuth, paymentsRouter);
router.use('/v1/dashboard', requireAuth, dashboardRouter);
router.use('/v1/reports', requireAuth, reportsRouter);
router.use('/v1/search', requireAuth, searchRouter);

export const apiRouter = router;
