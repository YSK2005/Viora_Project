import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../../config/prisma';
import { sendSuccess } from '../../utils/response';
import { validateRequest } from '../../middlewares/validate';
import { AuthenticatedRequest } from '../../middlewares/auth';

const router = Router();

const searchQuerySchema = z.object({
  q: z.string().trim().min(1, 'Search query must be at least 1 character').max(100),
});

/**
 * GET /api/search
 * Global omni-search across Invoices, Customers, and Products for active business.
 */
router.get(
  '/',
  validateRequest({ query: searchQuerySchema }),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const businessId = req.business.id;
      const q = (req.query.q as string).trim();

      const [invoices, customers, products] = await Promise.all([
        // Search Invoices
        prisma.invoice.findMany({
          where: {
            businessId,
            OR: [
              { invoiceNumber: { contains: q, mode: 'insensitive' } },
              { customerNameSnapshot: { contains: q, mode: 'insensitive' } },
              { customer: { name: { contains: q, mode: 'insensitive' } } },
              { notes: { contains: q, mode: 'insensitive' } },
            ],
          },
          take: 8,
          orderBy: { invoiceDate: 'desc' },
          select: {
            id: true,
            invoiceNumber: true,
            customerNameSnapshot: true,
            invoiceDate: true,
            grandTotal: true,
            status: true,
            customer: {
              select: { name: true },
            },
          },
        }),

        // Search Customers
        prisma.customer.findMany({
          where: {
            businessId,
            isArchived: false,
            OR: [
              { name: { contains: q, mode: 'insensitive' } },
              { phone: { contains: q, mode: 'insensitive' } },
              { email: { contains: q, mode: 'insensitive' } },
              { gstin: { contains: q, mode: 'insensitive' } },
            ],
          },
          take: 8,
          orderBy: { name: 'asc' },
          select: {
            id: true,
            name: true,
            phone: true,
            email: true,
            gstin: true,
            state: true,
          },
        }),

        // Search Products
        prisma.product.findMany({
          where: {
            businessId,
            isArchived: false,
            OR: [
              { name: { contains: q, mode: 'insensitive' } },
              { description: { contains: q, mode: 'insensitive' } },
            ],
          },
          take: 8,
          orderBy: { name: 'asc' },
          select: {
            id: true,
            name: true,
            unit: true,
            unitPrice: true,
            taxRate: true,
            isActive: true,
          },
        }),
      ]);

      return sendSuccess(
        res,
        {
          query: q,
          totalMatches: invoices.length + customers.length + products.length,
          invoices: invoices.map((i) => ({
            id: i.id,
            invoiceNumber: i.invoiceNumber,
            customerName: i.customerNameSnapshot || i.customer?.name || 'Customer',
            invoiceDate: i.invoiceDate.toISOString().split('T')[0],
            grandTotal: Number(i.grandTotal),
            status: i.status,
          })),
          customers: customers.map((c) => ({
            id: c.id,
            name: c.name,
            phone: c.phone,
            email: c.email,
            gstin: c.gstin,
            state: c.state,
          })),
          products: products.map((p) => ({
            id: p.id,
            name: p.name,
            unit: p.unit,
            unitPrice: Number(p.unitPrice),
            taxRate: Number(p.taxRate),
            isActive: p.isActive,
          })),
        },
        'Global search results retrieved successfully'
      );
    } catch (error) {
      next(error);
    }
  }
);

export const searchRouter = router;
