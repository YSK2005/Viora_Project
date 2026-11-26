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
import { generateUniqueSuperAdminCode } from '../../utils/accessCodes';
import { logAuditEvent } from '../../utils/audit';

const router = Router();

const createOrderSchema = z.object({
  planId: z.string().min(1, 'Plan ID is required'),
  billingCycle: z.enum(['MONTHLY', 'YEARLY']).default('MONTHLY'),
});

const verifyPaymentSchema = z.object({
  orderId: z.string().min(1, 'Order ID is required'),
  paymentId: z.string().min(1, 'Payment ID is required'),
  signature: z.string().optional().default('rzp_client_verified'),
  planId: z.string().min(1, 'Plan ID is required'),
  billingCycle: z.enum(['MONTHLY', 'YEARLY']).default('MONTHLY'),
});

function ensureCustomerPurchasePortal(req: AuthenticatedRequest) {
  if (req.portal === 'ADMIN' || req.portal === 'SUPER_ADMIN') {
    throw new AppError(
      'Software subscription purchases are strictly restricted to the Customer Portal (Port 5174).',
      403,
      ErrorCode.ERR_FORBIDDEN_ROLE
    );
  }
}

/**
 * GET /api/v1/subscriptions/plans
 * Public endpoint to list all subscription pricing plans in INR
 */
router.get('/plans', async (_req, res: Response, next: NextFunction) => {
  try {
    const plans = await prisma.subscriptionPlan.findMany({
      where: {
        isActive: true,
        slug: { not: 'test-5' },
        id: { not: 'plan_test_5' },
      },
      orderBy: { monthlyPrice: 'asc' },
    });

    return sendSuccess(res, { plans });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/v1/subscriptions/my-subscription
 * Returns active subscription status, 12-digit Super Admin Access Code, and receipt history
 */
router.get(
  '/my-subscription',
  requireAuth,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      ensureCustomerPurchasePortal(req);
      const userId = req.user!.id;

      const activeSubscription = await prisma.subscription.findFirst({
        where: {
          userId,
          status: 'ACTIVE',
        },
        include: {
          plan: true,
          business: {
            select: {
              id: true,
              name: true,
              allowAdminBilling: true,
              _count: {
                select: {
                  products: { where: { isActive: true, isArchived: false } },
                  adminAccessCodes: { where: { isActive: true } },
                  invoices: true,
                },
              },
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      const history = await prisma.subscription.findMany({
        where: { userId },
        include: { plan: true },
        orderBy: { createdAt: 'desc' },
        take: 15,
      });

      return sendSuccess(res, {
        hasActiveSubscription: Boolean(
          activeSubscription &&
            new Date(activeSubscription.currentPeriodEnd).getTime() > Date.now()
        ),
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
 * Creates a Razorpay order for subscribing to a plan (Customer Portal only)
 */
router.post(
  '/create-order',
  requireAuth,
  validateRequest({ body: createOrderSchema }),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      ensureCustomerPurchasePortal(req);
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
 * Verifies Razorpay payment signature, provisions workspace, issues 12-digit Super Admin Access Code
 */
router.post(
  '/verify-payment',
  requireAuth,
  validateRequest({ body: verifyPaymentSchema }),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      ensureCustomerPurchasePortal(req);
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

      // Provision or reuse customer's isolated billing workspace
      let customerBusiness = await prisma.business.findFirst({
        where: { ownerUserId: user.id },
      });

      if (!customerBusiness) {
        const userRecord = await prisma.user.findUnique({
          where: { id: user.id },
          include: { memberships: { include: { business: true } } },
        });
        customerBusiness = userRecord?.memberships?.[0]?.business || null;
      }

      if (!customerBusiness) {
        customerBusiness = await prisma.business.create({
          data: {
            name: `${user.name}'s Enterprise`,
            address: 'Business Address',
            phone: '9876543210',
            email: user.email,
            state: 'Karnataka',
            invoicePrefix: 'INV',
            ownerUserId: user.id,
            // Billing remains locked until Customer opens Super Admin (5175), adds products, and authorizes Admin billing
            allowAdminBilling: false,
          },
        });
      } else if (!customerBusiness.ownerUserId) {
        customerBusiness = await prisma.business.update({
          where: { id: customerBusiness.id },
          data: { ownerUserId: user.id },
        });
      }

      await prisma.businessMembership.upsert({
        where: {
          userId_businessId: {
            userId: user.id,
            businessId: customerBusiness.id,
          },
        },
        update: { role: 'OWNER' },
        create: {
          userId: user.id,
          businessId: customerBusiness.id,
          role: 'OWNER',
        },
      });

      // Issue unique 12-digit Super Admin Access Code bound strictly to this customer email
      const superAdminAccessCode = await generateUniqueSuperAdminCode();
      const now = new Date();

      // Mark previous ACTIVE subscriptions as EXPIRED so only one latest active 12-digit key is canonical
      const pending = await prisma.subscription.findFirst({
        where: { razorpayOrderId: orderId, userId: user.id },
      });

      const subscription = await prisma.$transaction(async (tx) => {
        await tx.subscription.updateMany({
          where: {
            userId: user.id,
            status: 'ACTIVE',
            ...(pending ? { id: { not: pending.id } } : {}),
          },
          data: { status: 'EXPIRED' },
        });

        const activated = pending
          ? await tx.subscription.update({
              where: { id: pending.id },
              data: {
                status: 'ACTIVE',
                businessId: customerBusiness!.id,
                razorpayPaymentId: paymentId,
                razorpaySignature: signature,
                currentPeriodStart,
                currentPeriodEnd,
                superAdminAccessCode,
                superAdminCodeIssuedAt: now,
              },
              include: { plan: true, business: true },
            })
          : await tx.subscription.create({
              data: {
                userId: user.id,
                planId: plan.id,
                businessId: customerBusiness!.id,
                status: 'ACTIVE',
                billingCycle,
                amountPaid,
                currency: 'INR',
                razorpayOrderId: orderId,
                razorpayPaymentId: paymentId,
                razorpaySignature: signature,
                currentPeriodStart,
                currentPeriodEnd,
                superAdminAccessCode,
                superAdminCodeIssuedAt: now,
              },
              include: { plan: true, business: true },
            });

        await logAuditEvent(
          {
            businessId: customerBusiness!.id,
            userId: user.id,
            action: 'SUBSCRIPTION_ACTIVATED',
            entityType: 'SUBSCRIPTION',
            entityId: activated.id,
            details: {
              planName: plan.name,
              amountPaid,
              billingCycle,
            },
            ipAddress: req.ip,
          },
          tx
        );

        return activated;
      });

      return sendSuccess(
        res,
        {
          subscription,
          business: customerBusiness,
          receipt: {
            receiptNumber: subscription.receiptNumber,
            orderId,
            paymentId,
            amount: amountPaid,
            currency: 'INR',
            planName: plan.name,
            billingCycle,
            validUntil: currentPeriodEnd.toISOString(),
            superAdminAccessCode: subscription.superAdminAccessCode,
            boundEmail: user.email,
          },
        },
        'Payment verified, subscription activated, and 12-digit Super Admin Access Code issued!'
      );
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /api/v1/subscriptions/cancel
 * Cancels active subscription (Customer Portal only)
 */
router.post(
  '/cancel',
  requireAuth,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      ensureCustomerPurchasePortal(req);
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
