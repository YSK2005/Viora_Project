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
import { generateInvoicePdfStream, InvoicePdfData } from '../../services/pdf.service';

const router = Router();

const invoiceItemSchema = z.object({
  productId: z.string().optional().nullable(),
  descriptionSnapshot: z.string().min(1, 'Item description is required'),
  unit: z.string().optional().default('PCS'),
  quantity: z.coerce.number().positive('Quantity must be greater than zero'),
  unitPrice: z.coerce.number().min(0, 'Unit price cannot be negative'),
  discountAmount: z.coerce.number().min(0, 'Discount cannot be negative').optional().default(0),
  taxRate: z.coerce.number().min(0).max(100, 'Tax rate must be between 0% and 100%').optional().default(0),
});

const createInvoiceSchema = z.object({
  customerId: z.string().min(1, 'Customer is required'),
  invoiceDate: z.string().regex(/^\d{4}-\d{2}-\d{2}/, 'Invalid invoice date format (YYYY-MM-DD)'),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}/, 'Invalid due date format (YYYY-MM-DD)'),
  placeOfSupply: z.string().optional().nullable(),
  isInterState: z.boolean().optional(),
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
            select: { id: true, name: true, email: true, phone: true, state: true },
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
          placeOfSupply: inv.placeOfSupply,
          isInterState: inv.isInterState,
          subtotal: Number(inv.subtotal),
          discountTotal: Number(inv.discountTotal),
          taxableAmount: Number(inv.taxableAmount),
          cgstTotal: Number(inv.cgstTotal),
          sgstTotal: Number(inv.sgstTotal),
          igstTotal: Number(inv.igstTotal),
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
        taxableAmount: Number(inv.taxableAmount),
        cgstTotal: Number(inv.cgstTotal),
        sgstTotal: Number(inv.sgstTotal),
        igstTotal: Number(inv.igstTotal),
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
          cgstRate: Number(it.cgstRate),
          cgstAmount: Number(it.cgstAmount),
          sgstRate: Number(it.sgstRate),
          sgstAmount: Number(it.sgstAmount),
          igstRate: Number(it.igstRate),
          igstAmount: Number(it.igstAmount),
          taxAmount: Number(it.taxAmount),
          lineTotal: Number(it.lineTotal),
        })),
        payments: inv.payments.map((p) => ({
          ...p,
          amount: Number(p.amount),
          paymentDate: p.paymentDate.toISOString().split('T')[0],
        })),
      },
      'Invoice details retrieved successfully'
    );
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/invoices/:id/pdf
 * Returns professional A4 PDF for invoice with snapshots and tax breakdowns
 */
router.get('/:id/pdf', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const inv = await prisma.invoice.findUnique({
      where: { id },
      include: {
        business: true,
        customer: true,
        items: true,
        payments: { orderBy: { paymentDate: 'desc' } },
      },
    });

    if (!inv) {
      throw new AppError('Invoice not found', 404, 'ERR_INVOICE_NOT_FOUND');
    }

    const paymentInfo = derivePaymentStatus(inv.grandTotal, inv.payments);

    const pdfData: InvoicePdfData = {
      invoiceNumber: inv.invoiceNumber,
      invoiceDate: inv.invoiceDate.toISOString().split('T')[0],
      dueDate: inv.dueDate.toISOString().split('T')[0],
      status: inv.status,
      placeOfSupply: inv.placeOfSupply || 'Karnataka',
      isInterState: inv.isInterState,
      notes: inv.notes,
      subtotal: Number(inv.subtotal),
      discountTotal: Number(inv.discountTotal),
      taxableAmount: Number(inv.taxableAmount),
      cgstTotal: Number(inv.cgstTotal),
      sgstTotal: Number(inv.sgstTotal),
      igstTotal: Number(inv.igstTotal),
      taxTotal: Number(inv.taxTotal),
      grandTotal: Number(inv.grandTotal),
      totalPaid: Number(paymentInfo.totalPaid),
      balanceRemaining: Number(paymentInfo.balanceRemaining),
      paymentStatus: paymentInfo.paymentStatus,
      business: {
        name: inv.businessNameSnapshot || inv.business.name,
        address: inv.businessAddressSnapshot || inv.business.address,
        phone: inv.businessPhoneSnapshot || inv.business.phone,
        email: inv.businessEmailSnapshot || inv.business.email,
        gstin: inv.businessGstinSnapshot || inv.business.gstin,
        state: inv.businessStateSnapshot || inv.business.state,
      },
      customer: {
        name: inv.customerNameSnapshot || inv.customer.name,
        phone: inv.customerPhoneSnapshot || inv.customer.phone,
        email: inv.customerEmailSnapshot || inv.customer.email,
        address: inv.customerAddressSnapshot || inv.customer.billingAddress,
        gstin: inv.customerGstinSnapshot || inv.customer.gstin,
        state: inv.customerStateSnapshot || inv.customer.state,
      },
      items: inv.items.map((it) => ({
        description: it.descriptionSnapshot,
        unit: it.unitSnapshot || it.unit,
        quantity: Number(it.quantity),
        unitPrice: Number(it.unitPrice),
        discountAmount: Number(it.discountAmount),
        taxableAmount: Number(it.taxableAmount),
        taxRate: Number(it.taxRate),
        cgstAmount: Number(it.cgstAmount),
        sgstAmount: Number(it.sgstAmount),
        igstAmount: Number(it.igstAmount),
        taxAmount: Number(it.taxAmount),
        lineTotal: Number(it.lineTotal),
      })),
      payments: inv.payments.map((p) => ({
        amount: Number(p.amount),
        paymentDate: p.paymentDate.toISOString().split('T')[0],
        method: p.method,
        reference: p.reference,
      })),
    };

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `inline; filename="invoice-${inv.invoiceNumber}.pdf"`
    );

    const pdfStream = generateInvoicePdfStream(pdfData);
    pdfStream.pipe(res);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/invoices
 * Creates a DRAFT invoice with full server-side GST financial calculations
 */
router.post(
  '/',
  validateRequest({ body: createInvoiceSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const business = await getOrCreateDefaultBusiness();
      const { customerId, invoiceDate, dueDate, placeOfSupply, isInterState: explicitInterState, notes, items } = req.body;

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

      // Determine Inter-state supply (IGST) vs Intra-state supply (CGST+SGST)
      const resolvedSupplyPlace = placeOfSupply ? placeOfSupply.trim() : (customer.state || business.state || 'Karnataka');
      const isInterState = typeof explicitInterState === 'boolean'
        ? explicitInterState
        : resolvedSupplyPlace.toLowerCase() !== (business.state || 'karnataka').toLowerCase();

      // Calculate totals strictly on the server
      let calculated;
      try {
        calculated = calculateInvoiceTotals(items, isInterState);
      } catch (calcErr: any) {
        throw new AppError(calcErr.message || 'Invoice calculation error', 400, 'ERR_INVALID_INVOICE_CALCULATION');
      }

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
            placeOfSupply: resolvedSupplyPlace,
            isInterState,
            subtotal: calculated.subtotal,
            discountTotal: calculated.discountTotal,
            taxableAmount: calculated.taxableAmount,
            cgstTotal: calculated.cgstTotal,
            sgstTotal: calculated.sgstTotal,
            igstTotal: calculated.igstTotal,
            taxTotal: calculated.taxTotal,
            grandTotal: calculated.grandTotal,
            notes: notes ? notes.trim() : null,
            // Pre-seed customer snapshots
            customerNameSnapshot: customer.name,
            customerPhoneSnapshot: customer.phone,
            customerEmailSnapshot: customer.email,
            customerAddressSnapshot: customer.billingAddress,
            customerGstinSnapshot: customer.gstin,
            customerStateSnapshot: customer.state || resolvedSupplyPlace,
            businessNameSnapshot: business.name,
            businessAddressSnapshot: business.address,
            businessPhoneSnapshot: business.phone,
            businessEmailSnapshot: business.email,
            businessGstinSnapshot: business.gstin,
            businessStateSnapshot: business.state,
            items: {
              create: calculated.items.map((item) => ({
                productId: item.productId,
                descriptionSnapshot: item.descriptionSnapshot,
                unit: item.unit,
                unitSnapshot: item.unit,
                quantity: item.quantity,
                unitPrice: item.unitPrice,
                discountAmount: item.discountAmount,
                taxRate: item.taxRate,
                taxableAmount: item.taxableAmount,
                cgstRate: item.cgstRate,
                cgstAmount: item.cgstAmount,
                sgstRate: item.sgstRate,
                sgstAmount: item.sgstAmount,
                igstRate: item.igstRate,
                igstAmount: item.igstAmount,
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

      return sendSuccess(res, invoice, 'Draft invoice created successfully', 201);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * PUT /api/invoices/:id
 * Strictly draft invoices can be edited. Issued invoices are IMMUTABLE.
 */
router.put(
  '/:id',
  validateRequest({ body: updateInvoiceSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const { customerId, invoiceDate, dueDate, placeOfSupply, isInterState: explicitInterState, notes, items } = req.body;

      const existing = await prisma.invoice.findUnique({
        where: { id },
        include: { business: true },
      });

      if (!existing) {
        throw new AppError('Invoice not found', 404, 'ERR_INVOICE_NOT_FOUND');
      }

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

      const business = existing.business;
      const resolvedSupplyPlace = placeOfSupply ? placeOfSupply.trim() : (customer.state || business.state || 'Karnataka');
      const isInterState = typeof explicitInterState === 'boolean'
        ? explicitInterState
        : resolvedSupplyPlace.toLowerCase() !== (business.state || 'karnataka').toLowerCase();

      let calculated;
      try {
        calculated = calculateInvoiceTotals(items, isInterState);
      } catch (calcErr: any) {
        throw new AppError(calcErr.message || 'Invoice calculation error', 400, 'ERR_INVALID_INVOICE_CALCULATION');
      }

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
            placeOfSupply: resolvedSupplyPlace,
            isInterState,
            subtotal: calculated.subtotal,
            discountTotal: calculated.discountTotal,
            taxableAmount: calculated.taxableAmount,
            cgstTotal: calculated.cgstTotal,
            sgstTotal: calculated.sgstTotal,
            igstTotal: calculated.igstTotal,
            taxTotal: calculated.taxTotal,
            grandTotal: calculated.grandTotal,
            notes: notes ? notes.trim() : null,
            customerNameSnapshot: customer.name,
            customerPhoneSnapshot: customer.phone,
            customerEmailSnapshot: customer.email,
            customerAddressSnapshot: customer.billingAddress,
            customerGstinSnapshot: customer.gstin,
            customerStateSnapshot: customer.state || resolvedSupplyPlace,
            items: {
              create: calculated.items.map((item) => ({
                productId: item.productId,
                descriptionSnapshot: item.descriptionSnapshot,
                unit: item.unit,
                unitSnapshot: item.unit,
                quantity: item.quantity,
                unitPrice: item.unitPrice,
                discountAmount: item.discountAmount,
                taxRate: item.taxRate,
                taxableAmount: item.taxableAmount,
                cgstRate: item.cgstRate,
                cgstAmount: item.cgstAmount,
                sgstRate: item.sgstRate,
                sgstAmount: item.sgstAmount,
                igstRate: item.igstRate,
                igstAmount: item.igstAmount,
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
      // Atomic row update & sequence allocation: PostgreSQL serializes concurrent updates
      const updatedBusiness = await tx.business.update({
        where: { id: existing.businessId },
        data: {
          nextInvoiceNumber: { increment: 1 },
        },
      });

      // The sequence allocated to this invoice is the value before increment
      const assignedSequence = updatedBusiness.nextInvoiceNumber - 1;
      const currentYear = new Date().getFullYear();
      const officialNumber = `${updatedBusiness.invoicePrefix}-${currentYear}-${String(
        assignedSequence
      ).padStart(6, '0')}`;

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
          customerStateSnapshot: existing.customer.state || existing.placeOfSupply,
          businessNameSnapshot: updatedBusiness.name,
          businessAddressSnapshot: updatedBusiness.address,
          businessPhoneSnapshot: updatedBusiness.phone,
          businessEmailSnapshot: updatedBusiness.email,
          businessGstinSnapshot: updatedBusiness.gstin,
          businessStateSnapshot: updatedBusiness.state,
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
