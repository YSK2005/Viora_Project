import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../../config/prisma';
import { sendSuccess } from '../../utils/response';
import { validateRequest } from '../../middlewares/validate';
import { getOrCreateDefaultBusiness } from '../../utils/businessHelper';

const router = Router();

const updateBusinessSchema = z.object({
  name: z.string().min(2, 'Business name must be at least 2 characters'),
  logoUrl: z.string().optional().nullable(),
  address: z.string().min(5, 'Address must be at least 5 characters'),
  phone: z.string().min(5, 'Phone number must be at least 5 characters'),
  email: z.string().email('Invalid email address'),
  gstin: z.string().optional().nullable(),
  invoicePrefix: z.string().min(1).max(10).optional(),
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
          logoUrl: req.body.logoUrl ?? current.logoUrl,
          address: req.body.address,
          phone: req.body.phone,
          email: req.body.email,
          gstin: req.body.gstin ?? null,
          invoicePrefix: req.body.invoicePrefix ?? current.invoicePrefix,
        },
      });

      return sendSuccess(res, updated, 'Business profile updated successfully');
    } catch (error) {
      next(error);
    }
  }
);

export const businessRouter = router;
