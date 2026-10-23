import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../../config/prisma';
import { sendSuccess } from '../../utils/response';
import { validateRequest } from '../../middlewares/validate';
import { AppError } from '../../middlewares/errorHandler';
import { getOrCreateDefaultBusiness } from '../../utils/businessHelper';
import {
  calculateInvoiceTotals,
  derivePaymentStatus,
  round2,
  toDecimal,
} from '../../utils/money';

const router = Router();

const invoiceItemSchema = z.object({
  productId: z.string().optional().nullable(),
  descriptionSnapshot: z.string().min(1, 'Item description is required'),
  quantity: z.coerce.number().positive('Quantity must be greater than zero'),
  unitPrice: z.coerce.number().min(0, 'Unit price cannot be negative'),
  discountAmount: z.coerce.number().min(0, 'Discount cannot be negative').optional().default(0),
  taxRate: z.coerce.number().min(0).max(100, 'Tax rate must be between 0% and 100%').optional().default(0),
});

const createInvoiceSchema = z.object({
  customerId: z.string().min(1, 'Customer is required'),
  invoiceDate: z.string().regex(/^\d{4}-\d{2}-\d{2}/, 'Invalid invoice date format (YYYY-MM-DD)'),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}/, 'Invalid due date format (YYYY-MM-DD)'),
  notes: z.string().optional().nullable(),
  items: z.array(invoiceItemSchema).min(1, 'At least one line item is required'),
});

const updateInvoiceSchema = createInvoiceSchema;

const getInvoicesQuerySchema = z.object({
  status: z.enum(['ALL', 'DRAFT', 'ISSUED', 'CANCELLED']).optional().default('ALL'),
  paymentStatus: z.enum(['ALL', 'UNPAID', 'PARTIALLY_PAID', 'PAID']).optional().default('ALL'),
  customerId: z.string().optional(),
  search: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(100).optional().default(20),
});

/**
 * GET /api/invoices
 * Lists invoices with search, status filters, pagination, and derived payment statuses
 */
router.get(
  '/',
  validateRequest({ query: getInvoicesQuerySchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const business = await getOrCreateDefaultBusiness();
      const {
        status,
        paymentStatus,
        customerId,
        search,
        startDate,
        endDate,
        page,
        limit,
      } = req.query as any;

      const where: any = {
        businessId: business.id,
      };

      if (status !== 'ALL') {
        where.status = status;
      }

      if (customerId) {
        where.customerId = customerId;
      }

      if (startDate || endDate) {
        where.invoiceDate = {};
        if (startDate) where.invoiceDate.gte = new Date(startDate);
        if (endDate) where.invoiceDate.lte = new Date(`${endDate}T23:59:59.999Z`);
      }

      if (search && search.trim() !== '') {
        const q = search.trim();
        where.OR = [
          { invoiceNumber: { contains: q, mode: 'insensitive' } },
          { customerNameSnapshot: { contains: q, mode: 'insensitive' } },
          { customer: { name: { contains: q, mode: 'insensitive' } } },
        ];
      }

      const totalCount = await prisma.invoice.count({ where });
      const rawInvoices = await prisma.invoice.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { invoiceDate: 'desc' },
        include: {
          customer: {
            select: { id: true, name: true, email: true, phone: true },
          },
          payments: {
            select: { amount: true },
          },
        },
      });

      // Augment invoices with derived payment status
      const invoices = rawInvoices.map((inv) => {
        const paymentInfo = derivePaymentStatus(inv.grandTotal, inv.payments);
        return {
          id: inv.id,
          invoiceNumber: inv.invoiceNumber,
          customerId: inv.customerId,
          customerName: inv.customerNameSnapshot || inv.customer.name,
          customerEmail: inv.customerEmailSnapshot || inv.customer.email,
          invoiceDate: inv.invoiceDate.toISOString().split('T')[0],
          dueDate: inv.dueDate.toISOString().split('T')[0],
          status: inv.status,
          subtotal: Number(inv.subtotal),
          discountTotal: Number(inv.discountTotal),
          taxTotal: Number(inv.taxTotal),
          grandTotal: Number(inv.grandTotal),
          paymentStatus: paymentInfo.paymentStatus,
          totalPaid: Number(paymentInfo.totalPaid),
          balanceRemaining: Number(paymentInfo.balanceRemaining),
          createdAt: inv.createdAt,
        };
      });

      // Filter by paymentStatus if requested
      const filtered =
        paymentStatus === 'ALL'
          ? invoices
          : invoices.filter((i) => i.paymentStatus === paymentStatus);

      return sendSuccess(
        res,
        {
          invoices: filtered,
          pagination: {
            totalCount,
            page,
            limit,
            totalPages: Math.ceil(totalCount / limit) || 1,
          },
        },
        'Invoices retrieved successfully'
      );
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/invoices/:id
 * Returns single invoice with line items, payments, snapshots and derived balance
 */
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const inv = await prisma.invoice.findUnique({
      where: { id },
      include: {
        customer: true,
        business: true,
        items: {
          include: {
            product: { select: { id: true, name: true, unit: true } },
          },
        },
        payments: {
          orderBy: { paymentDate: 'desc' },
        },
      },
    });

    if (!inv) {
      throw new AppError('Invoice not found', 404, 'ERR_INVOICE_NOT_FOUND');
    }

    const paymentInfo = derivePaymentStatus(inv.grandTotal, inv.payments);

    return sendSuccess(
      res,
      {
        ...inv,
        invoiceDate: inv.invoiceDate.toISOString().split('T')[0],
        dueDate: inv.dueDate.toISOString().split('T')[0],
        subtotal: Number(inv.subtotal),
        discountTotal: Number(inv.discountTotal),
        taxTotal: Number(inv.taxTotal),
        grandTotal: Number(inv.grandTotal),
        paymentStatus: paymentInfo.paymentStatus,
        totalPaid: Number(paymentInfo.totalPaid),
        balanceRemaining: Number(paymentInfo.balanceRemaining),
        items: inv.items.map((it) => ({
          ...it,
          quantity: Number(it.quantity),
          unitPrice: Number(it.unitPrice),
          discountAmount: Number(it.discountAmount),
          taxRate: Number(it.taxRate),
          taxableAmount: Number(it.taxableAmount),
          taxAmount: Number(it.taxAmount),
          lineTotal: Number(it.lineTotal),
        })),
        payments: inv.payments.map((p) => ({
          ...p,
          amount: Number(p.amount),
        })),
      },
      'Invoice details retrieved successfully'
    );
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/invoices
 * Creates a DRAFT invoice with full server-side financial calculations
 */
router.post(
  '/',
  validateRequest({ body: createInvoiceSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const business = await getOrCreateDefaultBusiness();
      const { customerId, invoiceDate, dueDate, notes, items } = req.body;

      // Validate customer existence
      const customer = await prisma.customer.findFirst({
        where: { id: customerId, businessId: business.id },
      });
      if (!customer) {
        throw new AppError('Customer not found', 404, 'ERR_CUSTOMER_NOT_FOUND');
      }

      // Validate dates
      const invDateObj = new Date(invoiceDate);
      const dueDateObj = new Date(dueDate);
      if (dueDateObj < invDateObj) {
        throw new AppError('Due date cannot precede invoice date', 400, 'ERR_INVALID_DATES');
      }

      // Calculate totals strictly on the server
      const calculated = calculateInvoiceTotals(items);

      // Temporary draft identifier
      const draftNumber = `DRAFT-${Date.now().toString().slice(-6)}`;

      const invoice = await prisma.$transaction(async (tx) => {
        const created = await tx.invoice.create({
          data: {
            businessId: business.id,
            customerId: customer.id,
            invoiceNumber: draftNumber,
            invoiceDate: invDateObj,
            dueDate: dueDateObj,
            status: 'DRAFT',
            subtotal: calculated.subtotal,
            discountTotal: calculated.discountTotal,
            taxTotal: calculated.taxTotal,
            grandTotal: calculated.grandTotal,
            notes: notes ? notes.trim() : null,
            // Pre-seed customer snapshots
            customerNameSnapshot: customer.name,
            customerPhoneSnapshot: customer.phone,
            customerEmailSnapshot: customer.email,
            customerAddressSnapshot: customer.billingAddress,
            customerGstinSnapshot: customer.gstin,
            businessNameSnapshot: business.name,
            businessAddressSnapshot: business.address,
            businessPhoneSnapshot: business.phone,
            businessEmailSnapshot: business.email,
            businessGstinSnapshot: business.gstin,
            items: {
              create: calculated.items.map((item) => ({
                productId: item.productId,
                descriptionSnapshot: item.descriptionSnapshot,
                quantity: item.quantity,
                unitPrice: item.unitPrice,
                discountAmount: item.discountAmount,
                taxRate: item.taxRate,
                taxableAmount: item.taxableAmount,
                taxAmount: item.taxAmount,
                lineTotal: item.lineTotal,
              })),
            },
          },
          include: {
            items: true,
            customer: true,
          },
        });

        return created;
      });

      return sendSuccess(
        res,
        {
          ...invoice,
          subtotal: Number(invoice.subtotal),
          discountTotal: Number(invoice.discountTotal),
          taxTotal: Number(invoice.taxTotal),
          grandTotal: Number(invoice.grandTotal),
        },
        'Draft invoice created successfully',
        201
      );
    } catch (error) {
      next(error);
    }
  }
);

/**
 * PUT /api/invoices/:id
 * Updates an invoice ONLY if it is currently in DRAFT status
 */
router.put(
  '/:id',
  validateRequest({ body: updateInvoiceSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const { customerId, invoiceDate, dueDate, notes, items } = req.body;

      const existing = await prisma.invoice.findUnique({
        where: { id },
      });

      if (!existing) {
        throw new AppError('Invoice not found', 404, 'ERR_INVOICE_NOT_FOUND');
      }

      // BUSINESS RULE: Only DRAFT invoices can be edited
      if (existing.status !== 'DRAFT') {
        throw new AppError(
          `Only draft invoices can be edited. This invoice is already ${existing.status}.`,
          400,
          'ERR_INVOICE_NOT_DRAFT'
        );
      }

      const invDateObj = new Date(invoiceDate);
      const dueDateObj = new Date(dueDate);
      if (dueDateObj < invDateObj) {
        throw new AppError('Due date cannot precede invoice date', 400, 'ERR_INVALID_DATES');
      }

      const customer = await prisma.customer.findUnique({ where: { id: customerId } });
      if (!customer) {
        throw new AppError('Customer not found', 404, 'ERR_CUSTOMER_NOT_FOUND');
      }

      const calculated = calculateInvoiceTotals(items);

      const updated = await prisma.$transaction(async (tx) => {
        // Remove existing items
        await tx.invoiceItem.deleteMany({ where: { invoiceId: id } });

        // Update invoice and re-create items
        return tx.invoice.update({
          where: { id },
          data: {
            customerId: customer.id,
            invoiceDate: invDateObj,
            dueDate: dueDateObj,
            subtotal: calculated.subtotal,
            discountTotal: calculated.discountTotal,
            taxTotal: calculated.taxTotal,
            grandTotal: calculated.grandTotal,
            notes: notes ? notes.trim() : null,
            customerNameSnapshot: customer.name,
            customerPhoneSnapshot: customer.phone,
            customerEmailSnapshot: customer.email,
            customerAddressSnapshot: customer.billingAddress,
            customerGstinSnapshot: customer.gstin,
            items: {
              create: calculated.items.map((item) => ({
                productId: item.productId,
                descriptionSnapshot: item.descriptionSnapshot,
                quantity: item.quantity,
                unitPrice: item.unitPrice,
                discountAmount: item.discountAmount,
                taxRate: item.taxRate,
                taxableAmount: item.taxableAmount,
                taxAmount: item.taxAmount,
                lineTotal: item.lineTotal,
              })),
            },
          },
          include: {
            items: true,
            customer: true,
          },
        });
      });

      return sendSuccess(res, updated, 'Draft invoice updated successfully');
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/invoices/:id/issue
 * Issues a draft invoice: locks snapshots, assigns sequential official invoice number in transaction
 */
router.post('/:id/issue', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const existing = await prisma.invoice.findUnique({
      where: { id },
      include: {
        customer: true,
        items: true,
      },
    });

    if (!existing) {
      throw new AppError('Invoice not found', 404, 'ERR_INVOICE_NOT_FOUND');
    }

    if (existing.status === 'ISSUED') {
      throw new AppError('Invoice has already been issued', 400, 'ERR_ALREADY_ISSUED');
    }

    if (existing.status === 'CANCELLED') {
      throw new AppError('Cancelled invoices cannot be issued', 400, 'ERR_CANNOT_ISSUE_CANCELLED');
    }

    if (existing.items.length === 0) {
      throw new AppError('Cannot issue an invoice with zero items', 400, 'ERR_EMPTY_INVOICE');
    }

    // Atomic transaction for number assignment and status transition
    const issuedInvoice = await prisma.$transaction(async (tx) => {
      const business = await tx.business.findUnique({
        where: { id: existing.businessId },
      });

      if (!business) {
        throw new AppError('Business not found', 404, 'ERR_BUSINESS_NOT_FOUND');
      }

      // Generate next sequential invoice number
      const officialNumber = `${business.invoicePrefix}-${String(
        business.nextInvoiceNumber
      ).padStart(4, '0')}`;

      // Increment business sequence counter
      await tx.business.update({
        where: { id: business.id },
        data: {
          nextInvoiceNumber: { increment: 1 },
        },
      });

      // Lock snapshots permanently
      const updated = await tx.invoice.update({
        where: { id },
        data: {
          invoiceNumber: officialNumber,
          status: 'ISSUED',
          customerNameSnapshot: existing.customer.name,
          customerPhoneSnapshot: existing.customer.phone,
          customerEmailSnapshot: existing.customer.email,
          customerAddressSnapshot: existing.customer.billingAddress,
          customerGstinSnapshot: existing.customer.gstin,
          businessNameSnapshot: business.name,
          businessAddressSnapshot: business.address,
          businessPhoneSnapshot: business.phone,
          businessEmailSnapshot: business.email,
          businessGstinSnapshot: business.gstin,
        },
        include: {
          customer: true,
          items: true,
        },
      });

      return updated;
    });

    return sendSuccess(
      res,
      issuedInvoice,
      `Invoice ${issuedInvoice.invoiceNumber} has been officially issued`
    );
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/invoices/:id/payments
 * Records payment for an issued invoice
 */
router.post(
  '/:id/payments',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const { handleRecordPayment } = await import('./payments.route');
      const result = await handleRecordPayment(id, req.body);
      return sendSuccess(res, result, 'Payment recorded successfully', 201);
    } catch (error) {
      next(error);
    }
  }
);

export const invoicesRouter = router;
