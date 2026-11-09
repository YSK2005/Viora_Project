import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../../config/prisma';
import { sendSuccess } from '../../utils/response';
import { validateRequest } from '../../middlewares/validate';
import { getOrCreateDefaultBusiness } from '../../utils/businessHelper';
import {
  validateAndNormalizeIndianPhone,
  validateAndNormalizeGSTIN,
} from '../../utils/validators';

const router = Router();

const updateBusinessSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'Business name must be at least 2 characters')
    .max(200, 'Business name cannot exceed 200 characters'),
  logoUrl: z.string().optional().nullable(),
  address: z
    .string()
    .trim()
    .min(5, 'Address must be at least 5 characters')
    .max(500, 'Address cannot exceed 500 characters'),
  phone: z
    .string()
    .superRefine((val, ctx) => {
      try {
        validateAndNormalizeIndianPhone(val);
      } catch (err: any) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            'Company WhatsApp / Phone must be a valid 10-digit Indian mobile number to issue invoices',
        });
      }
    })
    .transform((val) => validateAndNormalizeIndianPhone(val)),
  email: z
    .string()
    .trim()
    .max(255, 'Email cannot exceed 255 characters')
    .email('Company Gmail / Official email address is mandatory to send invoices'),
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
  invoicePrefix: z.string().trim().min(1).max(10).optional(),
});

/**
 * GET /api/business
 * Returns active business profile
 */
router.get('/', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const business = await getOrCreateDefaultBusiness();
    return sendSuccess(res, business, 'Business details retrieved successfully');
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/business
 * Updates business profile
 */
router.put(
  '/',
  validateRequest({ body: updateBusinessSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const current = await getOrCreateDefaultBusiness();
      const updated = await prisma.business.update({
        where: { id: current.id },
        data: {
          name: req.body.name,
          logoUrl: req.body.logoUrl !== undefined ? req.body.logoUrl : current.logoUrl,
          address: req.body.address,
          phone: req.body.phone,
          email: req.body.email,
          gstin: req.body.gstin !== undefined ? req.body.gstin : current.gstin,
          state: req.body.state !== undefined ? req.body.state : current.state,
          invoicePrefix: req.body.invoicePrefix || current.invoicePrefix,
        },
      });

      return sendSuccess(res, updated, 'Business profile updated successfully');
    } catch (error) {
      next(error);
    }
  }
);

export const businessRouter = router;
