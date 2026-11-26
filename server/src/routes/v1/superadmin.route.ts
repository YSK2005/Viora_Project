import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../../config/prisma';
import { AuthenticatedRequest, requireAuth } from '../../middlewares/auth';
import { validateRequest } from '../../middlewares/validate';
import { AppError } from '../../middlewares/errorHandler';
import { ErrorCode } from '../../utils/errorCodes';
import { sendSuccess } from '../../utils/response';
import { generateUniqueAdminCode } from '../../utils/accessCodes';
import { hashPassword } from '../../utils/auth';
import { logAuditEvent } from '../../utils/audit';

const router = Router();

// Strictly allow only verified SUPER_ADMIN sessions (with 12-digit code + matching customer email)
router.use(requireAuth);
router.use((req: AuthenticatedRequest, _res: Response, next: NextFunction) => {
  const isAllowed =
    req.portal === 'SUPER_ADMIN' ||
    (req.portal === 'API_LEGACY' && req.role === 'SUPER_ADMIN');

  if (!isAllowed) {
    return next(
      new AppError(
        'Access Denied: Super Admin privileges require signing into Super Admin Control (Port 5175) with your subscription email and 12-digit Super Admin Access Code.',
        403,
        ErrorCode.ERR_FORBIDDEN_ROLE
      )
    );
  }
  if (!req.business) {
    return next(
      new AppError(
        'No active workspace associated with this Super Admin subscription.',
        403,
        ErrorCode.ERR_NO_MEMBERSHIP
      )
    );
  }
  next();
});

const billingAuthSchema = z.object({
  allowAdminBilling: z.boolean(),
});

const createAdminCodeSchema = z.object({
  label: z.string().trim().min(2, 'Terminal or Admin label must be at least 2 characters').max(80),
  assignedEmail: z.string().trim().email('Valid email address required').toLowerCase().optional().or(z.literal('')),
  password: z.string().min(12, 'Password must be at least 12 characters').max(128).optional().or(z.literal('')),
  name: z.string().trim().min(2).max(100).optional(),
  role: z.enum(['OWNER', 'ACCOUNTANT', 'VIEWER']).default('OWNER'),
  canGenerateBills: z.boolean().optional().default(true),
  enableBusinessBilling: z.boolean().optional().default(false),
});

const updateAdminCodeSchema = z.object({
  label: z.string().trim().min(2).max(80).optional(),
  canGenerateBills: z.boolean().optional(),
  isActive: z.boolean().optional(),
  rotateCode: z.boolean().optional(),
});

/**
 * GET /api/v1/superadmin/overview
 * Tenant-scoped overview for the verified customer's business, products, billing permission, and setup progress
 */
router.get('/overview', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const businessId = req.business.id;

    const [
      business,
      activeProductsCount,
      totalProductsCount,
      activeAdminCodesCount,
      totalInvoicesCount,
      issuedInvoicesCount,
      invoiceSums,
      recentInvoices,
      recentAuditLogs,
    ] = await Promise.all([
      prisma.business.findUnique({ where: { id: businessId } }),
      prisma.product.count({ where: { businessId, isActive: true, isArchived: false } }),
      prisma.product.count({ where: { businessId, isArchived: false } }),
      prisma.adminAccessCode.count({ where: { businessId, isActive: true } }),
      prisma.invoice.count({ where: { businessId } }),
      prisma.invoice.count({ where: { businessId, status: 'ISSUED' } }),
      prisma.invoice.aggregate({
        where: { businessId, status: 'ISSUED' },
        _sum: { grandTotal: true },
      }),
      prisma.invoice.findMany({
        where: { businessId },
        orderBy: { createdAt: 'desc' },
        take: 10,
        include: {
          customer: { select: { name: true, email: true } },
        },
      }),
      prisma.auditLog.findMany({
        where: { businessId },
        orderBy: { createdAt: 'desc' },
        take: 20,
        include: {
          user: { select: { name: true, email: true } },
        },
      }),
    ]);

    return sendSuccess(res, {
      business,
      subscription: req.subscription
        ? {
            id: req.subscription.id,
            planName: req.subscription.plan?.name,
            invoiceLimit: req.subscription.plan?.invoiceLimit ?? -1,
            status: req.subscription.status,
            billingCycle: req.subscription.billingCycle,
            validUntil: req.subscription.currentPeriodEnd,
          }
        : null,
      stats: {
        activeProductsCount,
        totalProductsCount,
        activeAdminCodesCount,
        totalInvoicesCount,
        issuedInvoicesCount,
        totalBilledRevenue: Number(invoiceSums._sum.grandTotal || 0),
      },
      setupChecklist: {
        hasActiveSubscription: Boolean(req.subscription),
        hasActiveProducts: activeProductsCount > 0,
        hasActiveAdminCode: activeAdminCodesCount > 0,
        isAdminBillingAllowed: Boolean(business?.allowAdminBilling),
      },
      recentInvoices: recentInvoices.map((inv) => ({
        id: inv.id,
        invoiceNumber: inv.invoiceNumber,
        customerName: inv.customerNameSnapshot || inv.customer?.name || 'Customer',
        status: inv.status,
        grandTotal: Number(inv.grandTotal),
        invoiceDate: inv.invoiceDate.toISOString().split('T')[0],
      })),
      recentAuditLogs,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * PUT /api/v1/superadmin/billing-authorization
 * Master switch allowing / pausing bill generation by Admins for this customer's workspace
 */
router.put(
  '/billing-authorization',
  validateRequest({ body: billingAuthSchema }),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const businessId = req.business.id;
      const { allowAdminBilling } = req.body;

      const updated = await prisma.business.update({
        where: { id: businessId },
        data: { allowAdminBilling },
      });

      await logAuditEvent({
        businessId,
        userId: req.user?.id,
        action: allowAdminBilling ? 'ADMIN_BILLING_AUTHORIZED' : 'ADMIN_BILLING_PAUSED',
        entityType: 'BUSINESS',
        entityId: businessId,
        details: { allowAdminBilling },
        ipAddress: req.ip,
      });

      return sendSuccess(
        res,
        { business: updated },
        allowAdminBilling
          ? 'Admin billing authorized! Operators with valid access codes can now generate GST bills.'
          : 'Admin billing paused. Bill creation and issuance are locked.'
      );
    } catch (err) {
      next(err);
    }
  }
);

/**
 * GET /api/v1/superadmin/admin-codes
 * Lists all Admin Access Codes created by Super Admin for this workspace
 */
router.get('/admin-codes', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const codes = await prisma.adminAccessCode.findMany({
      where: { businessId: req.business.id },
      orderBy: { createdAt: 'desc' },
    });
    return sendSuccess(res, { codes });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/v1/superadmin/admin-codes
 * Generates a unique 12-digit Admin Access Code (optionally provisioning a dedicated staff operator account)
 */
router.post(
  '/admin-codes',
  validateRequest({ body: createAdminCodeSchema }),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const businessId = req.business.id;
      const {
        label,
        assignedEmail,
        password,
        name,
        role,
        canGenerateBills,
        enableBusinessBilling,
      } = req.body;

      const cleanEmail = assignedEmail?.trim() ? assignedEmail.trim().toLowerCase() : null;
      const code = await generateUniqueAdminCode();

      const result = await prisma.$transaction(async (tx) => {
        if (cleanEmail) {
          let operator = await tx.user.findUnique({ where: { email: cleanEmail } });
          if (!operator) {
            if (!password || password.length < 12) {
              throw new AppError(
                `Password (min 12 characters) is required to create a new Admin login for ${cleanEmail}.`,
                400,
                ErrorCode.ERR_VALIDATION
              );
            }
            operator = await tx.user.create({
              data: {
                email: cleanEmail,
                name: name?.trim() || label,
                passwordHash: hashPassword(password),
                role,
              },
            });
          }

          await tx.businessMembership.upsert({
            where: {
              userId_businessId: {
                userId: operator.id,
                businessId,
              },
            },
            update: { role },
            create: {
              userId: operator.id,
              businessId,
              role,
            },
          });
        }

        const adminCode = await tx.adminAccessCode.create({
          data: {
            businessId,
            code,
            label,
            assignedEmail: cleanEmail,
            role,
            canGenerateBills,
            isActive: true,
            createdByUserId: req.user?.id,
          },
        });

        let updatedBusiness = req.business;
        if (enableBusinessBilling) {
          updatedBusiness = await tx.business.update({
            where: { id: businessId },
            data: { allowAdminBilling: true },
          });
        }

        await logAuditEvent(
          {
            businessId,
            userId: req.user?.id,
            action: 'ADMIN_ACCESS_CODE_GENERATED',
            entityType: 'ADMIN_ACCESS_CODE',
            entityId: adminCode.id,
            details: {
              label,
              assignedEmail: cleanEmail,
              role,
              canGenerateBills,
            },
            ipAddress: req.ip,
          },
          tx
        );

        return { adminCode, business: updatedBusiness };
      });

      return sendSuccess(
        res,
        result,
        `12-digit Admin Access Code generated for ${label}`,
        201
      );
    } catch (err) {
      next(err);
    }
  }
);

/**
 * PATCH /api/v1/superadmin/admin-codes/:id
 * Toggles bill generation permission, rotates code, or revokes an Admin Access Code (immediately invalidating sessions)
 */
router.patch(
  '/admin-codes/:id',
  validateRequest({ body: updateAdminCodeSchema }),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const businessId = req.business.id;
      const { label, canGenerateBills, isActive, rotateCode } = req.body;

      const existing = await prisma.adminAccessCode.findFirst({
        where: { id, businessId },
      });

      if (!existing) {
        throw new AppError('Admin access code not found', 404, ErrorCode.ERR_NOT_FOUND);
      }

      const nextCode = rotateCode ? await generateUniqueAdminCode() : undefined;

      const updated = await prisma.$transaction(async (tx) => {
        const record = await tx.adminAccessCode.update({
          where: { id },
          data: {
            label: label !== undefined ? label : undefined,
            canGenerateBills: canGenerateBills !== undefined ? canGenerateBills : undefined,
            isActive: isActive !== undefined ? isActive : undefined,
            code: nextCode,
          },
        });

        // If revoked or rotated, kill existing Admin sessions using this code immediately
        if (isActive === false || rotateCode) {
          await tx.session.deleteMany({
            where: { adminAccessCodeId: id },
          });
        }

        await logAuditEvent(
          {
            businessId,
            userId: req.user?.id,
            action: isActive === false ? 'ADMIN_ACCESS_CODE_REVOKED' : 'ADMIN_ACCESS_CODE_UPDATED',
            entityType: 'ADMIN_ACCESS_CODE',
            entityId: id,
            details: { canGenerateBills, isActive, rotated: Boolean(rotateCode) },
            ipAddress: req.ip,
          },
          tx
        );

        return record;
      });

      return sendSuccess(res, { adminCode: updated }, 'Admin Access Code updated successfully');
    } catch (err) {
      next(err);
    }
  }
);

/**
 * DELETE /api/v1/superadmin/admin-codes/:id
 * Deletes an Admin Access Code and terminates its active sessions
 */
router.delete('/admin-codes/:id', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const businessId = req.business.id;

    const existing = await prisma.adminAccessCode.findFirst({
      where: { id, businessId },
    });

    if (!existing) {
      throw new AppError('Admin access code not found', 404, ErrorCode.ERR_NOT_FOUND);
    }

    await prisma.$transaction(async (tx) => {
      await tx.session.deleteMany({ where: { adminAccessCodeId: id } });
      await tx.adminAccessCode.delete({ where: { id } });
      await logAuditEvent(
        {
          businessId,
          userId: req.user?.id,
          action: 'ADMIN_ACCESS_CODE_DELETED',
          entityType: 'ADMIN_ACCESS_CODE',
          entityId: id,
          details: { label: existing.label },
          ipAddress: req.ip,
        },
        tx
      );
    });

    return sendSuccess(res, { id, deleted: true }, 'Admin Access Code deleted');
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/v1/superadmin/stats
 * Tenant-scoped compatibility summary for stats consumers
 */
router.get('/stats', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const businessId = req.business.id;
    const [totalProducts, totalInvoices, totalPayments, revenue] = await Promise.all([
      prisma.product.count({ where: { businessId, isArchived: false } }),
      prisma.invoice.count({ where: { businessId } }),
      prisma.payment.count({ where: { invoice: { businessId }, isReversed: false } }),
      prisma.invoice.aggregate({
        where: { businessId, status: 'ISSUED' },
        _sum: { grandTotal: true },
      }),
    ]);

    return sendSuccess(res, {
      businessId,
      totalProducts,
      totalInvoices,
      totalPayments,
      totalRevenue: Number(revenue._sum.grandTotal || 0),
    });
  } catch (err) {
    next(err);
  }
});

export const superAdminRouter = router;
