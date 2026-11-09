import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../../config/prisma';
import { sendSuccess } from '../../utils/response';
import { validateRequest } from '../../middlewares/validate';
import { AppError } from '../../middlewares/errorHandler';
import { getOrCreateDefaultBusiness } from '../../utils/businessHelper';
import {
  validateAndNormalizeIndianPhone,
  validateAndNormalizeGSTIN,
} from '../../utils/validators';

const router = Router();

const createCustomerSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, 'Customer name must be at least 2 characters')
      .max(200, 'Customer name cannot exceed 200 characters'),
    phone: z
      .string()
      .optional()
      .nullable()
      .superRefine((val, ctx) => {
        if (!val || val.trim() === '') return;
        try {
          validateAndNormalizeIndianPhone(val);
        } catch (err: any) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: err.message,
          });
        }
      })
      .transform((val) => {
        if (!val || val.trim() === '') return '';
        return validateAndNormalizeIndianPhone(val);
      }),
    email: z
      .string()
      .trim()
      .max(255, 'Email cannot exceed 255 characters')
      .email('Invalid email address')
      .optional()
      .nullable()
      .or(z.literal('')),
    billingAddress: z
      .string()
      .trim()
      .min(3, 'Billing address must be at least 3 characters')
      .max(500, 'Billing address cannot exceed 500 characters'),
    gstin: z
      .string()
      .optional()
      .nullable()
      .superRefine((val, ctx) => {
        if (!val || val.trim() === '') return;
        try {
          validateAndNormalizeGSTIN(val);
        } catch (err: any) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: err.message,
          });
        }
      })
      .transform((val) => validateAndNormalizeGSTIN(val)),
    state: z.string().max(100).optional().nullable(),
  })
  .refine(
    (data) => {
      const hasPhone = Boolean(data.phone && /^\d{10}$/.test(data.phone));
      const hasEmail = Boolean(data.email && data.email.trim().length > 0);
      return hasPhone || hasEmail;
    },
    {
      message:
        'At least one contact method (10-digit Phone Number or valid Email) is mandatory',
      path: ['phone'],
    }
  );

const updateCustomerSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, 'Customer name must be at least 2 characters')
      .max(200, 'Customer name cannot exceed 200 characters')
      .optional(),
    phone: z
      .string()
      .optional()
      .nullable()
      .superRefine((val, ctx) => {
        if (!val || val.trim() === '') return;
        try {
          validateAndNormalizeIndianPhone(val);
        } catch (err: any) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: err.message,
          });
        }
      })
      .transform((val) => {
        if (val === undefined) return undefined;
        if (!val || val.trim() === '') return '';
        return validateAndNormalizeIndianPhone(val);
      }),
    email: z
      .string()
      .trim()
      .max(255, 'Email cannot exceed 255 characters')
      .email('Invalid email address')
      .optional()
      .nullable()
      .or(z.literal('')),
    billingAddress: z
      .string()
      .trim()
      .min(3, 'Billing address must be at least 3 characters')
      .max(500, 'Billing address cannot exceed 500 characters')
      .optional(),
    gstin: z
      .string()
      .optional()
      .nullable()
      .superRefine((val, ctx) => {
        if (!val || val.trim() === '') return;
        try {
          validateAndNormalizeGSTIN(val);
        } catch (err: any) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: err.message,
          });
        }
      })
      .transform((val) => (val !== undefined ? validateAndNormalizeGSTIN(val) : undefined)),
    state: z.string().max(100).optional().nullable(),
  });

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
 * Retrieves single customer by ID
 */
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const customer = await prisma.customer.findUnique({
      where: { id },
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
 * Creates a new customer for default business
 */
router.post(
  '/',
  validateRequest({ body: createCustomerSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const business = await getOrCreateDefaultBusiness();
      const { name, phone, email, billingAddress, gstin, state } = req.body;

      // Duplicate customer detection (B17)
      const duplicateConditions: any[] = [];
      if (phone && phone.trim()) {
        duplicateConditions.push({ phone: phone.trim() });
      }
      if (email && email.trim()) {
        duplicateConditions.push({ email: { equals: email.trim(), mode: 'insensitive' } });
      }
      if (gstin && gstin.trim()) {
        duplicateConditions.push({ gstin: gstin.trim() });
      }

      if (duplicateConditions.length > 0) {
        const existingDuplicate = await prisma.customer.findFirst({
          where: {
            businessId: business.id,
            isArchived: false,
            OR: duplicateConditions,
          },
        });

        if (existingDuplicate) {
          throw new AppError(
            `A customer with matching contact details already exists: ${existingDuplicate.name}`,
            409,
            'ERR_DUPLICATE_CUSTOMER'
          );
        }
      }

      const customer = await prisma.customer.create({
        data: {
          businessId: business.id,
          name,
          phone: phone || '',
          email: email && email.trim() !== '' ? email.trim() : null,
          billingAddress,
          gstin: gstin || null,
          state: state || 'Karnataka',
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

      const current = await prisma.customer.findUnique({
        where: { id },
      });

      if (!current) {
        throw new AppError('Customer not found', 404, 'ERR_CUSTOMER_NOT_FOUND');
      }

      const candidatePhone = req.body.phone !== undefined ? req.body.phone : current.phone;
      const candidateEmail = req.body.email !== undefined ? req.body.email : current.email;

      const hasCandidatePhone = Boolean(candidatePhone && /^\d{10}$/.test(candidatePhone));
      const hasCandidateEmail = Boolean(candidateEmail && candidateEmail.trim().length > 0);

      if (!hasCandidatePhone && !hasCandidateEmail) {
        throw new AppError(
          'Customer must have at least one contact method (10-digit Phone Number or valid Email)',
          400,
          'ERR_CONTACT_METHOD_REQUIRED'
        );
      }

      const updated = await prisma.customer.update({
        where: { id },
        data: {
          name: req.body.name,
          phone: req.body.phone !== undefined ? req.body.phone : undefined,
          email:
            req.body.email !== undefined
              ? req.body.email && req.body.email.trim() !== ''
                ? req.body.email.trim()
                : null
              : undefined,
          billingAddress: req.body.billingAddress,
          gstin: req.body.gstin !== undefined ? req.body.gstin : undefined,
          state: req.body.state,
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
 * Soft deletes if referenced in invoices, permanently removes if unreferenced
 */
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const customer = await prisma.customer.findUnique({
      where: { id },
      include: {
        _count: {
          select: { invoices: true },
        },
      },
    });

    if (!customer) {
      throw new AppError('Customer not found', 404, 'ERR_CUSTOMER_NOT_FOUND');
    }

    if (customer._count.invoices > 0) {
      const archived = await prisma.customer.update({
        where: { id },
        data: { isArchived: true },
      });
      return sendSuccess(
        res,
        archived,
        'Customer has associated invoices; successfully archived'
      );
    }

    await prisma.customer.delete({
      where: { id },
    });

    return sendSuccess(res, { id }, 'Customer permanently deleted');
  } catch (error) {
    next(error);
  }
});

export const customersRouter = router;
