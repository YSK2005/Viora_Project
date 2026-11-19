import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../../config/prisma';
import { sendSuccess } from '../../utils/response';
import { validateRequest } from '../../middlewares/validate';
import { AuthenticatedRequest, requireRole } from '../../middlewares/auth';
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
  logoUrl: z
    .string()
    .nullable()
    .optional()
    .refine(
      (val) => {
        if (!val) return true;
        // Reject local filesystem paths and file URLs
        if (
          val.startsWith('/') ||
          val.startsWith('\\') ||
          val.includes(':\\') ||
          val.startsWith('file:') ||
          val.includes('..')
        ) {
          return false;
        }
        // Must be a data URI or http/https URL
        const isDataUri = /^data:image\/(png|jpeg|jpg|webp|svg\+xml);base64,/i.test(val);
        const isWebUrl = /^https?:\/\//i.test(val);
        return isDataUri || isWebUrl;
      },
      {
        message:
          'Logo must be a valid image data URI (PNG, JPG, WebP, SVG) or web URL. Server filesystem paths are strictly rejected.',
      }
    )
    .refine(
      (val) => {
        if (!val) return true;
        // Enforce max 3MB payload
        return val.length <= 4 * 1024 * 1024;
      },
      {
        message: 'Logo file size exceeds the 3MB upload limit.',
      }
    ),
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
 * Returns active business profile for authenticated user
 */
router.get('/', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const business = await prisma.business.findUnique({
      where: { id: req.business.id },
    });
    return sendSuccess(res, business, 'Business details retrieved successfully');
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/business
 * Updates business profile (OWNER only)
 */
router.put(
  '/',
  requireRole(['OWNER']),
  validateRequest({ body: updateBusinessSchema }),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const current = req.business;
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
