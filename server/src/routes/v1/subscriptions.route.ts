import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../../config/prisma';
import { AuthenticatedRequest, requireAuth } from '../../middlewares/auth';
import { validateRequest } from '../../middlewares/validate';
import { AppError } from '../../middlewares/errorHandler';
import { ErrorCode } from '../../utils/errorCodes';
import { sendSuccess } from '../../utils/response';
import {
  createRazorpayOrder,
  verifyRazorpaySignature,
} from '../../services/razorpay.service';

const router = Router();

const createOrderSchema = z.object({
  planId: z.string().min(1, 'Plan ID is required'),
  billingCycle: z.enum(['MONTHLY', 'YEARLY']).default('MONTHLY'),
});

const verifyPaymentSchema = z.object({
  orderId: z.string().min(1, 'Order ID is required'),
  paymentId: z.string().min(1, 'Payment ID is required'),
  signature: z.string().min(1, 'Signature is required'),
  planId: z.string().min(1, 'Plan ID is required'),
  billingCycle: z.enum(['MONTHLY', 'YEARLY']).default('MONTHLY'),
});

/**
 * GET /api/v1/subscriptions/plans
 * Public endpoint to list all subscription pricing plans in INR
 */
router.get('/plans', async (_req, res: Response, next: NextFunction) => {
  try {
    const plans = await prisma.subscriptionPlan.findMany({
      where: { isActive: true },
      orderBy: { monthlyPrice: 'asc' },
    });

    return sendSuccess(res, { plans });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/v1/subscriptions/my-subscription
 * Returns active subscription status and details for logged-in user
 */
router.get(
  '/my-subscription',
  requireAuth,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.id;

      const activeSubscription = await prisma.subscription.findFirst({
        where: {
          userId,
          status: 'ACTIVE',
        },
        include: {
          plan: true,
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      const history = await prisma.subscription.findMany({
        where: { userId },
        include: { plan: true },
        orderBy: { createdAt: 'desc' },
        take: 10,
      });

      return sendSuccess(res, {
        hasActiveSubscription: !!activeSubscription,
        subscription: activeSubscription,
        history,
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /api/v1/subscriptions/create-order
 * Creates a Razorpay order for subscribing to a plan
 */
router.post(
  '/create-order',
  requireAuth,
  validateRequest({ body: createOrderSchema }),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { planId, billingCycle } = req.body;
      const user = req.user!;

      const plan = await prisma.subscriptionPlan.findUnique({
        where: { id: planId },
      });

      if (!plan || !plan.isActive) {
        throw new AppError('Selected subscription plan not found or inactive', 404, ErrorCode.ERR_NOT_FOUND);
      }

      const amountInRupees =
        billingCycle === 'YEARLY'
          ? Number(plan.yearlyPrice)
          : Number(plan.monthlyPrice);

      const order = await createRazorpayOrder({
        amountInRupees,
        planName: plan.name,
        notes: {
          userId: user.id,
          planId: plan.id,
          billingCycle,
        },
      });

      // Track pending subscription entry
      await prisma.subscription.create({
        data: {
          userId: user.id,
          planId: plan.id,
          status: 'PENDING',
          billingCycle,
          amountPaid: amountInRupees,
          currency: 'INR',
          razorpayOrderId: order.orderId,
          currentPeriodStart: new Date(),
          currentPeriodEnd: new Date(
            Date.now() + (billingCycle === 'YEARLY' ? 365 : 30) * 86400000
          ),
        },
      });

      return sendSuccess(
        res,
        {
          orderId: order.orderId,
          amount: order.amount,
          amountInRupees: order.amountInRupees,
          currency: order.currency,
          keyId: order.keyId,
          isTestMode: order.isTestMode,
          plan: {
            id: plan.id,
            name: plan.name,
            billingCycle,
          },
        },
        'Order created successfully',
        201
      );
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /api/v1/subscriptions/verify-payment
 * Verifies Razorpay payment signature and activates the subscription
 */
router.post(
  '/verify-payment',
  requireAuth,
  validateRequest({ body: verifyPaymentSchema }),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { orderId, paymentId, signature, planId, billingCycle } = req.body;
      const user = req.user!;

      const isValid = await verifyRazorpaySignature({
        orderId,
        paymentId,
        signature,
      });

      if (!isValid) {
        throw new AppError('Payment signature verification failed', 400, ErrorCode.ERR_VALIDATION);
      }

      const plan = await prisma.subscriptionPlan.findUnique({
        where: { id: planId },
      });

      if (!plan) {
        throw new AppError('Plan not found', 404, ErrorCode.ERR_NOT_FOUND);
      }

      const amountPaid =
        billingCycle === 'YEARLY'
          ? Number(plan.yearlyPrice)
          : Number(plan.monthlyPrice);

      const periodDays = billingCycle === 'YEARLY' ? 365 : 30;
      const currentPeriodStart = new Date();
      const currentPeriodEnd = new Date(Date.now() + periodDays * 86400000);

      // Find pending subscription record or create new active subscription
      const pending = await prisma.subscription.findFirst({
        where: { razorpayOrderId: orderId },
      });

      let subscription;
      if (pending) {
        subscription = await prisma.subscription.update({
          where: { id: pending.id },
          data: {
            status: 'ACTIVE',
            razorpayPaymentId: paymentId,
            razorpaySignature: signature,
            currentPeriodStart,
            currentPeriodEnd,
          },
          include: { plan: true },
        });
      } else {
        subscription = await prisma.subscription.create({
          data: {
            userId: user.id,
            planId: plan.id,
            status: 'ACTIVE',
            billingCycle,
            amountPaid,
            currency: 'INR',
            razorpayOrderId: orderId,
            razorpayPaymentId: paymentId,
            razorpaySignature: signature,
            currentPeriodStart,
            currentPeriodEnd,
          },
          include: { plan: true },
        });
      }

      // If user is CUSTOMER and has no business, provision a workspace so they can access the software
      const userRecord = await prisma.user.findUnique({
        where: { id: user.id },
        include: { memberships: true },
      });

      if (userRecord && userRecord.memberships.length === 0) {
        const newBiz = await prisma.business.create({
          data: {
            name: `${user.name}'s Enterprise`,
            address: 'Business Address',
            phone: '9876543210',
            email: user.email,
            state: 'Karnataka',
            invoicePrefix: 'INV',
          },
        });

        await prisma.businessMembership.create({
          data: {
            userId: user.id,
            businessId: newBiz.id,
            role: 'OWNER',
          },
        });
      }

      return sendSuccess(
        res,
        {
          subscription,
          receipt: {
            receiptNumber: subscription.receiptNumber,
            orderId,
            paymentId,
            amount: amountPaid,
            currency: 'INR',
            planName: plan.name,
            billingCycle,
            validUntil: currentPeriodEnd.toISOString(),
          },
        },
        'Payment verified and subscription activated successfully'
      );
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /api/v1/subscriptions/cancel
 * Cancels active subscription
 */
router.post(
  '/cancel',
  requireAuth,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.id;

      const active = await prisma.subscription.findFirst({
        where: { userId, status: 'ACTIVE' },
      });

      if (!active) {
        throw new AppError('No active subscription found to cancel', 404, ErrorCode.ERR_NOT_FOUND);
      }

      const updated = await prisma.subscription.update({
        where: { id: active.id },
        data: {
          status: 'CANCELLED',
          cancelledAt: new Date(),
        },
      });

      return sendSuccess(res, { subscription: updated }, 'Subscription cancelled successfully');
    } catch (err) {
      next(err);
    }
  }
);

export const subscriptionsRouter = router;
