import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { sendSuccess } from '../../utils/response';
import { validateRequest } from '../../middlewares/validate';
import { MOCK_INVOICES } from '../../data/mockInvoices';

const router = Router();

const getInvoicesQuerySchema = z.object({
  status: z.enum(['ALL', 'PAID', 'PENDING', 'OVERDUE', 'DRAFT']).optional().default('ALL'),
  search: z.string().optional(),
});

const createInvoiceSchema = z.object({
  customerName: z.string().min(2, 'Customer name must be at least 2 characters'),
  customerEmail: z.string().email('Invalid email address'),
  amount: z.number().positive('Amount must be greater than zero'),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Due date must be in YYYY-MM-DD format'),
  notes: z.string().optional(),
});

/**
 * GET /api/v1/invoices
 * Lists invoices with optional status filter and search query
 */
router.get(
  '/',
  validateRequest({ query: getInvoicesQuerySchema }),
  (req: Request, res: Response) => {
    const { status, search } = req.query as { status?: string; search?: string };

    let results = [...MOCK_INVOICES];

    if (status && status !== 'ALL') {
      results = results.filter((inv) => inv.status === status);
    }

    if (search && search.trim() !== '') {
      const q = search.toLowerCase();
      results = results.filter(
        (inv) =>
          inv.invoiceNumber.toLowerCase().includes(q) ||
          inv.customerName.toLowerCase().includes(q) ||
          inv.customerEmail.toLowerCase().includes(q)
      );
    }

    return sendSuccess(
      res,
      {
        invoices: results,
        totalCount: results.length,
        isMockData: true,
        previewNotice: 'Preview records for Phase 1 UI verification',
      },
      'Invoices retrieved successfully'
    );
  }
);

/**
 * POST /api/v1/invoices
 * Validates invoice payload using Zod (prepared for Phase 2 persistence)
 */
router.post(
  '/',
  validateRequest({ body: createInvoiceSchema }),
  (req: Request, res: Response) => {
    const { customerName, customerEmail, amount, dueDate, notes } = req.body;

    const newInvoice = {
      id: `mock-inv-${Date.now()}`,
      invoiceNumber: `INV-2025-${String(MOCK_INVOICES.length + 1).padStart(3, '0')}`,
      customerName,
      customerEmail,
      issueDate: new Date().toISOString().split('T')[0],
      dueDate,
      amount,
      status: 'PENDING' as const,
      currency: 'INR',
      notes,
      isMock: true as const,
    };

    return sendSuccess(
      res,
      newInvoice,
      'Invoice created successfully (Preview Mode)',
      201
    );
  }
);

export const invoicesRouter = router;
