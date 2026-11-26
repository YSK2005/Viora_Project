import {ErrorCode} from '../../utils/errorCodes';
import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../../config/prisma';
import { sendSuccess } from '../../utils/response';
import { validateRequest } from '../../middlewares/validate';
import { AppError } from '../../middlewares/errorHandler';
import { AuthenticatedRequest, requireRole } from '../../middlewares/auth';
import { round2, toDecimal } from '../../utils/money';
import { logAuditEvent } from '../../utils/audit';

const router = Router();

function ensureProductManagerPortal(req: AuthenticatedRequest) {
  if (req.portal === 'ADMIN') {
    throw new AppError(
      'Product catalog management is strictly restricted to Super Admin Panel (Port 5175). Admins can select active catalog products to generate bills.',
      403,
      ErrorCode.ERR_FORBIDDEN_ROLE
    );
  }
  if (req.portal === 'CUSTOMER') {
    throw new AppError(
      'Customer Portal is strictly for purchasing software licenses. Sign into Super Admin Control (Port 5175) with your 12-digit code to manage products.',
      403,
      ErrorCode.ERR_FORBIDDEN_ROLE
    );
  }
}

const createProductSchema = z.object({
  name: z.string().trim().min(2, 'Product name must be at least 2 characters').max(200),
  description: z.string().optional().nullable(),
  unit: z.string().trim().min(1, 'Unit is required').max(30).default('PCS'),
  unitPrice: z.coerce.number().min(0, 'Unit price cannot be negative'),
  taxRate: z.coerce.number().min(0).max(100, 'Tax rate must be between 0% and 100%').default(0),
  isActive: z.boolean().optional().default(true),
});

const updateProductSchema = createProductSchema.partial();

const productQuerySchema = z.object({
  search: z.string().optional(),
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(100).optional().default(20),
  isActive: z.enum(['true', 'false', 'all']).optional().default('all'),
  includeArchived: z.enum(['true', 'false']).optional().default('false'),
});

/**
 * GET /api/products
 * Returns paginated product list with search and filter for active business
 */
router.get(
  '/',
  validateRequest({ query: productQuerySchema }),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const businessId = req.business.id;
      const { search, page, limit, isActive, includeArchived } = req.query as any;

      const where: any = {
        businessId,
      };

      if (includeArchived !== 'true') {
        where.isArchived = false;
      }

      if (isActive === 'true') {
        where.isActive = true;
      } else if (isActive === 'false') {
        where.isActive = false;
      }

      if (search && search.trim() !== '') {
        const q = search.trim();
        where.OR = [
          { name: { contains: q, mode: 'insensitive' } },
          { description: { contains: q, mode: 'insensitive' } },
          { unit: { contains: q, mode: 'insensitive' } },
        ];
      }

      const totalCount = await prisma.product.count({ where });
      const products = await prisma.product.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      });

      return sendSuccess(
        res,
        {
          products,
          pagination: {
            totalCount,
            page,
            limit,
            totalPages: Math.ceil(totalCount / limit) || 1,
          },
        },
        'Products retrieved successfully'
      );
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/products/:id
 * Returns single product details (isolated to active business)
 */
router.get('/:id', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const product = await prisma.product.findFirst({
      where: { id, businessId: req.business.id },
    });

    if (!product) {
      throw new AppError('Product not found', 404, ErrorCode.ERR_PRODUCT_NOT_FOUND);
    }

    return sendSuccess(res, product, 'Product retrieved successfully');
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/products
 * Creates a new product catalog item (OWNER or ACCOUNTANT)
 */
router.post(
  '/',
  requireRole(['OWNER', 'ACCOUNTANT', 'SUPER_ADMIN']),
  validateRequest({ body: createProductSchema }),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      ensureProductManagerPortal(req);
      const businessId = req.business.id;
      const product = await prisma.product.create({
        data: {
          businessId,
          name: req.body.name.trim(),
          description: req.body.description ? req.body.description.trim() : null,
          unit: req.body.unit ? req.body.unit.trim().toUpperCase() : 'PCS',
          unitPrice: round2(toDecimal(req.body.unitPrice)),
          taxRate: toDecimal(req.body.taxRate),
          isActive: req.body.isActive ?? true,
        },
      });

      await logAuditEvent({
        businessId,
        userId: req.user?.id,
        action: 'PRODUCT_CREATE',
        entityType: 'PRODUCT',
        entityId: product.id,
        details: { name: product.name, unitPrice: Number(product.unitPrice), taxRate: Number(product.taxRate) },
        ipAddress: req.ip,
      });

      return sendSuccess(res, product, 'Product created successfully', 201);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * PUT /api/products/:id
 * Updates product details (SUPER_ADMIN portal or API_LEGACY OWNER/ACCOUNTANT)
 */
router.put(
  '/:id',
  requireRole(['OWNER', 'ACCOUNTANT', 'SUPER_ADMIN']),
  validateRequest({ body: updateProductSchema }),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      ensureProductManagerPortal(req);
      const { id } = req.params;
      const existing = await prisma.product.findFirst({
        where: { id, businessId: req.business.id },
      });
      if (!existing) {
        throw new AppError('Product not found', 404, ErrorCode.ERR_PRODUCT_NOT_FOUND);
      }

      const updated = await prisma.product.update({
        where: { id },
        data: {
          name: req.body.name !== undefined ? req.body.name.trim() : undefined,
          description: req.body.description !== undefined ? (req.body.description ? req.body.description.trim() : null) : undefined,
          unit: req.body.unit !== undefined ? req.body.unit.trim().toUpperCase() : undefined,
          unitPrice: req.body.unitPrice !== undefined ? round2(toDecimal(req.body.unitPrice)) : undefined,
          taxRate: req.body.taxRate !== undefined ? toDecimal(req.body.taxRate) : undefined,
          isActive: req.body.isActive !== undefined ? req.body.isActive : undefined,
        },
      });

      await logAuditEvent({
        businessId: req.business.id,
        userId: req.user?.id,
        action: 'PRODUCT_UPDATE',
        entityType: 'PRODUCT',
        entityId: id,
        details: { name: updated.name, isActive: updated.isActive, unitPrice: Number(updated.unitPrice) },
        ipAddress: req.ip,
      });

      return sendSuccess(res, updated, 'Product updated successfully');
    } catch (error) {
      next(error);
    }
  }
);

/**
 * DELETE /api/products/:id
 * Soft deletes/archives product if referenced in past invoices (SUPER_ADMIN portal or API_LEGACY OWNER/ACCOUNTANT)
 */
router.delete('/:id', requireRole(['OWNER', 'ACCOUNTANT', 'SUPER_ADMIN']), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    ensureProductManagerPortal(req);
    const { id } = req.params;
    const existing = await prisma.product.findFirst({
      where: { id, businessId: req.business.id },
      include: { _count: { select: { items: true } } },
    });

    if (!existing) {
      throw new AppError('Product not found', 404, ErrorCode.ERR_PRODUCT_NOT_FOUND);
    }

    if (existing._count.items > 0) {
      // Historical references exist - archive product
      const archived = await prisma.product.update({
        where: { id },
        data: { isArchived: true, isActive: false },
      });
      return sendSuccess(
        res,
        archived,
        'Product has historical invoice items and was archived successfully'
      );
    } else {
      // Safe to delete permanently
      await prisma.product.delete({ where: { id } });
      return sendSuccess(res, { id, deleted: true }, 'Product removed successfully');
    }
  } catch (error) {
    next(error);
  }
});

export const productsRouter = router;
