import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../../config/prisma';
import { AuthenticatedRequest, requireAuth, requireRole } from '../../middlewares/auth';
import { validateRequest } from '../../middlewares/validate';
import { sendSuccess } from '../../utils/response';

const router = Router();

// Guard all Super Admin routes
router.use(requireAuth);
router.use(requireRole(['SUPER_ADMIN']));

/**
 * GET /api/v1/superadmin/stats
 * Platform overview metrics
 */
router.get('/stats', async (_req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const [
      totalTenants,
      totalUsers,
      activeSubscriptionsCount,
      revenueResult,
      totalInvoices,
      totalPayments,
      recentTenants,
    ] = await Promise.all([
      prisma.business.count(),
      prisma.user.count(),
      prisma.subscription.count({ where: { status: 'ACTIVE' } }),
      prisma.subscription.aggregate({
        where: { status: 'ACTIVE' },
        _sum: { amountPaid: true },
      }),
      prisma.invoice.count(),
      prisma.payment.count({ where: { isReversed: false } }),
      prisma.business.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: {
          _count: {
            select: { invoices: true, customers: true },
          },
        },
      }),
    ]);

    const totalRevenue = Number(revenueResult._sum.amountPaid || 0);

    return sendSuccess(res, {
      totalTenants,
      totalUsers,
      activeSubscriptionsCount,
      totalRevenue,
      totalInvoices,
      totalPayments,
      recentTenants: recentTenants.map((b) => ({
        id: b.id,
        name: b.name,
        email: b.email,
        phone: b.phone,
        invoicesCount: b._count.invoices,
        customersCount: b._count.customers,
        createdAt: b.createdAt.toISOString(),
      })),
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/v1/superadmin/tenants
 * Lists all tenant businesses across the platform
 */
router.get('/tenants', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
    const search = String(req.query.search || '').trim();

    const where: any = {};
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [total, businesses] = await Promise.all([
      prisma.business.count({ where }),
      prisma.business.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          memberships: {
            include: { user: { select: { id: true, name: true, email: true, role: true } } },
          },
          _count: {
            select: { invoices: true, customers: true, products: true },
          },
        },
      }),
    ]);

    return sendSuccess(res, {
      tenants: businesses.map((b) => ({
        id: b.id,
        name: b.name,
        email: b.email,
        phone: b.phone,
        address: b.address,
        gstin: b.gstin,
        state: b.state,
        invoicesCount: b._count.invoices,
        customersCount: b._count.customers,
        productsCount: b._count.products,
        owners: b.memberships
          .filter((m) => m.role === 'OWNER')
          .map((m) => ({ name: m.user.name, email: m.user.email })),
        createdAt: b.createdAt.toISOString(),
      })),
      pagination: {
        page,
        limit,
        totalCount: total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/v1/superadmin/users
 * Lists all platform users
 */
router.get('/users', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));

    const [total, users] = await Promise.all([
      prisma.user.count(),
      prisma.user.findMany({
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          createdAt: true,
          memberships: {
            include: { business: { select: { id: true, name: true } } },
          },
          subscriptions: {
            where: { status: 'ACTIVE' },
            include: { plan: { select: { name: true } } },
            take: 1,
          },
        },
      }),
    ]);

    return sendSuccess(res, {
      users: users.map((u) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        role: u.role,
        businesses: u.memberships.map((m) => m.business.name),
        activePlan: u.subscriptions[0]?.plan.name || 'None',
        createdAt: u.createdAt.toISOString(),
      })),
      pagination: {
        page,
        limit,
        totalCount: total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/v1/superadmin/settings
 * Retrieves all system settings
 */
router.get('/settings', async (_req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const settings = await prisma.systemSetting.findMany({
      orderBy: [{ category: 'asc' }, { key: 'asc' }],
    });

    return sendSuccess(res, { settings });
  } catch (err) {
    next(err);
  }
});

const updateSettingsSchema = z.object({
  settings: z.array(
    z.object({
      key: z.string().min(1),
      value: z.string(),
      category: z.string().optional().default('GENERAL'),
      description: z.string().optional(),
    })
  ),
});

/**
 * PUT /api/v1/superadmin/settings
 * Updates system settings in batch
 */
router.put(
  '/settings',
  validateRequest({ body: updateSettingsSchema }),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { settings } = req.body;
      const adminEmail = req.user!.email;

      const results = await prisma.$transaction(
        settings.map((s: any) =>
          prisma.systemSetting.upsert({
            where: { key: s.key },
            update: {
              value: s.value,
              category: s.category || 'GENERAL',
              description: s.description,
              updatedBy: adminEmail,
            },
            create: {
              key: s.key,
              value: s.value,
              category: s.category || 'GENERAL',
              description: s.description,
              updatedBy: adminEmail,
            },
          })
        )
      );

      return sendSuccess(res, { settings: results }, 'System settings updated successfully');
    } catch (err) {
      next(err);
    }
  }
);

/**
 * GET /api/v1/superadmin/products
 * Master product catalog across system
 */
router.get('/products', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const products = await prisma.product.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        business: { select: { id: true, name: true } },
      },
      take: 100,
    });

    return sendSuccess(res, { products });
  } catch (err) {
    next(err);
  }
});

/**
 * PUT /api/v1/superadmin/plans/:id
 * Updates a subscription plan's pricing and configuration
 */
router.put('/plans/:id', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { name, monthlyPrice, yearlyPrice, description, invoiceLimit, businessLimit, isActive, features } = req.body;

    const plan = await prisma.subscriptionPlan.update({
      where: { id },
      data: {
        name: name !== undefined ? name : undefined,
        description: description !== undefined ? description : undefined,
        monthlyPrice: monthlyPrice !== undefined ? Number(monthlyPrice) : undefined,
        yearlyPrice: yearlyPrice !== undefined ? Number(yearlyPrice) : undefined,
        invoiceLimit: invoiceLimit !== undefined ? Number(invoiceLimit) : undefined,
        businessLimit: businessLimit !== undefined ? Number(businessLimit) : undefined,
        isActive: isActive !== undefined ? Boolean(isActive) : undefined,
        features: features !== undefined ? features : undefined,
      },
    });

    return sendSuccess(res, { plan }, 'Subscription plan updated successfully');
  } catch (err) {
    next(err);
  }
});

export const superAdminRouter = router;
