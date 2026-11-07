import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../../config/prisma';
import { sendSuccess } from '../../utils/response';
import { validateRequest } from '../../middlewares/validate';
import { AppError } from '../../middlewares/errorHandler';
import { getOrCreateDefaultBusiness } from '../../utils/businessHelper';

const router = Router();

const clean10DigitPhone = (val: unknown): string => {
  if (typeof val !== 'string') return '';
  const digits = val.replace(/\D/g, '');
  if (digits.length === 10) return digits;
  if (digits.length === 11 && digits.startsWith('0')) return digits.slice(1);
  if (digits.length > 10 && digits.startsWith('91')) return digits.slice(-10);
  return digits.length > 10 ? digits.slice(-10) : digits;
};

const createCustomerSchema = z
  .object({
    name: z.string().min(2, 'Customer name must be at least 2 characters'),
    phone: z
      .string()
      .optional()
      .nullable()
      .transform((val) => (val ? clean10DigitPhone(val) : '')),
    email: z
      .string()
      .email('Invalid email address')
      .optional()
      .nullable()
      .or(z.literal('')),
    billingAddress: z.string().min(3, 'Billing address must be at least 3 characters'),
    gstin: z.string().optional().nullable(),
    state: z.string().optional().nullable(),
  })
  .refine(
    (data) => {
      const hasPhone = Boolean(data.phone && /^\d{10}$/.test(data.phone));
      const hasEmail = Boolean(data.email && data.email.trim().length > 0);
      return hasPhone || hasEmail;
    },
    {
      message: 'At least one contact method (10-digit Phone Number or valid Email) is mandatory',
      path: ['phone'],
    }
  )
  .refine(
    (data) => {
      if (data.phone && data.phone.length > 0) {
        return /^\d{10}$/.test(data.phone);
      }
      return true;
    },
    {
      message: 'Phone number must be exactly 10 digits',
      path: ['phone'],
    }
  );

const updateCustomerSchema = z
  .object({
    name: z.string().min(2).optional(),
    phone: z
      .string()
      .optional()
      .nullable()
      .transform((val) => (val !== undefined && val !== null ? clean10DigitPhone(val) : undefined)),
    email: z
      .string()
      .email('Invalid email address')
      .optional()
      .nullable()
      .or(z.literal('')),
    billingAddress: z.string().min(3).optional(),
    gstin: z.string().optional().nullable(),
    state: z.string().optional().nullable(),
  })
  .refine(
    (data) => {
      if (data.phone !== undefined && data.phone !== null && data.phone.length > 0) {
        return /^\d{10}$/.test(data.phone);
      }
      return true;
    },
    {
      message: 'Phone number must be exactly 10 digits',
      path: ['phone'],
    }
  );

const customerQuerySchema = z.object({
  search: z.string().optional(),
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(100).optional().default(20),
  includeArchived: z.enum(['true', 'false']).optional().default('false'),
});

/**
 * GET /api/customers
 * Returns paginated customer list with search filter
 */
router.get(
  '/',
  validateRequest({ query: customerQuerySchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const business = await getOrCreateDefaultBusiness();
      const { search, page, limit, includeArchived } = req.query as any;

      const where: any = {
        businessId: business.id,
      };

      if (includeArchived !== 'true') {
        where.isArchived = false;
      }

      if (search && search.trim() !== '') {
        const q = search.trim();
        where.OR = [
          { name: { contains: q, mode: 'insensitive' } },
          { phone: { contains: q, mode: 'insensitive' } },
          { email: { contains: q, mode: 'insensitive' } },
          { gstin: { contains: q, mode: 'insensitive' } },
        ];
      }

      const totalCount = await prisma.customer.count({ where });
      const customers = await prisma.customer.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          _count: {
            select: { invoices: true },
          },
        },
      });

      return sendSuccess(
        res,
        {
          customers,
          pagination: {
            totalCount,
            page,
            limit,
            totalPages: Math.ceil(totalCount / limit) || 1,
          },
        },
        'Customers retrieved successfully'
      );
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/customers/:id
 * Returns single customer with recent invoices
 */
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const customer = await prisma.customer.findUnique({
      where: { id },
      include: {
        invoices: {
          take: 10,
          orderBy: { invoiceDate: 'desc' },
          select: {
            id: true,
            invoiceNumber: true,
            invoiceDate: true,
            dueDate: true,
            status: true,
            grandTotal: true,
          },
        },
      },
    });

    if (!customer) {
      throw new AppError('Customer not found', 404, 'ERR_CUSTOMER_NOT_FOUND');
    }

    return sendSuccess(res, customer, 'Customer retrieved successfully');
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/customers
 * Creates a new customer
 */
router.post(
  '/',
  validateRequest({ body: createCustomerSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const business = await getOrCreateDefaultBusiness();
      const customer = await prisma.customer.create({
        data: {
          businessId: business.id,
          name: req.body.name.trim(),
          phone: req.body.phone.trim(),
          email: req.body.email ? req.body.email.trim() : null,
          billingAddress: req.body.billingAddress.trim(),
          gstin: req.body.gstin ? req.body.gstin.trim() : null,
          state: req.body.state ? req.body.state.trim() : 'Karnataka',
        },
      });

      return sendSuccess(res, customer, 'Customer created successfully', 201);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * PUT /api/customers/:id
 * Updates customer details
 */
router.put(
  '/:id',
  validateRequest({ body: updateCustomerSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const existing = await prisma.customer.findUnique({ where: { id } });
      if (!existing) {
        throw new AppError('Customer not found', 404, 'ERR_CUSTOMER_NOT_FOUND');
      }

      const candidatePhone = req.body.phone !== undefined ? req.body.phone.trim() : existing.phone;
      const candidateEmail = req.body.email !== undefined ? (req.body.email ? req.body.email.trim() : null) : existing.email;

      if (!candidatePhone && !candidateEmail) {
        throw new AppError(
          'At least one contact method (10-digit Phone Number or valid Email) is mandatory',
          400,
          'ERR_CONTACT_MANDATORY'
        );
      }

      const updated = await prisma.customer.update({
        where: { id },
        data: {
          name: req.body.name !== undefined ? req.body.name.trim() : undefined,
          phone: req.body.phone !== undefined ? req.body.phone.trim() : undefined,
          email: req.body.email !== undefined ? (req.body.email ? req.body.email.trim() : null) : undefined,
          billingAddress: req.body.billingAddress !== undefined ? req.body.billingAddress.trim() : undefined,
          gstin: req.body.gstin !== undefined ? (req.body.gstin ? req.body.gstin.trim() : null) : undefined,
          state: req.body.state !== undefined ? (req.body.state ? req.body.state.trim() : null) : undefined,
        },
      });

      return sendSuccess(res, updated, 'Customer updated successfully');
    } catch (error) {
      next(error);
    }
  }
);

/**
 * DELETE /api/customers/:id
 * Soft deletes/archives customer to preserve historical invoice records
 */
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const existing = await prisma.customer.findUnique({
      where: { id },
      include: { _count: { select: { invoices: true } } },
    });

    if (!existing) {
      throw new AppError('Customer not found', 404, 'ERR_CUSTOMER_NOT_FOUND');
    }

    if (existing._count.invoices > 0) {
      // Historical references exist - soft delete/archive
      const archived = await prisma.customer.update({
        where: { id },
        data: { isArchived: true },
      });
      return sendSuccess(
        res,
        archived,
        'Customer has historical invoices and was archived successfully'
      );
    } else {
      // No historical invoices - permanent removal is safe
      await prisma.customer.delete({ where: { id } });
      return sendSuccess(res, { id, deleted: true }, 'Customer removed successfully');
    }
  } catch (error) {
    next(error);
  }
});

export const customersRouter = router;
