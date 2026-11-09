import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { randomBytes } from 'crypto';
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
import { createPaymentSchema, handleRecordPayment } from './payments.route';

const router = Router();

const invoiceItemSchema = z.object({
  productId: z.string().optional().nullable(),
  descriptionSnapshot: z.string().trim().min(1, 'Item description is required').max(300),
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
  notes: z.string().max(1000).optional().nullable(),
  items: z.array(invoiceItemSchema).min(1, 'At least one line item is required').max(100),
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
  limit: z.coerce.number().int().positive().max(500).optional().default(20),
});

/**
 * GET /api/invoices
 * Lists invoices with search, status filters, paymentStatus filtering before paging, and pagination
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

      if (customerId && customerId.trim() !== '') {
        where.customerId = customerId.trim();
      }

      if (startDate || endDate) {
        where.invoiceDate = {};
        if (startDate) {
          where.invoiceDate.gte = new Date(`${startDate}T00:00:00.000Z`);
        }
        if (endDate) {
          where.invoiceDate.lte = new Date(`${endDate}T23:59:59.999Z`);
        }
      }

      if (search && search.trim() !== '') {
        const q = search.trim();
        where.OR = [
          { invoiceNumber: { contains: q, mode: 'insensitive' } },
          { customerNameSnapshot: { contains: q, mode: 'insensitive' } },
          { customer: { name: { contains: q, mode: 'insensitive' } } },
        ];
      }

      // Fetch matching invoices to apply derived payment status filtering BEFORE pagination
      const allMatching = await prisma.invoice.findMany({
        where,
        orderBy: [{ invoiceDate: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }],
        include: {
          customer: {
            select: { id: true, name: true, email: true, phone: true, state: true },
          },
          payments: {
            select: { amount: true },
          },
        },
      });

      // Augment invoices with derived payment status and freeze issue-time snapshots if issued
      const augmented = allMatching.map((inv) => {
        const paymentInfo = derivePaymentStatus(inv.grandTotal, inv.payments);
        const isIssued = inv.status === 'ISSUED' || inv.status === 'CANCELLED';

        return {
          id: inv.id,
          invoiceNumber: inv.invoiceNumber,
          customerId: inv.customerId,
          customerName: isIssued && inv.customerNameSnapshot ? inv.customerNameSnapshot : inv.customer.name,
          customerEmail: isIssued && inv.customerEmailSnapshot ? inv.customerEmailSnapshot : inv.customer.email,
          customerPhone: isIssued && inv.customerPhoneSnapshot ? inv.customerPhoneSnapshot : inv.customer.phone,
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

      // Filter by paymentStatus BEFORE paging (B4)
      const filtered =
        paymentStatus === 'ALL'
          ? augmented
          : augmented.filter((i) => i.paymentStatus === paymentStatus);

      const totalCount = filtered.length;
      const totalPages = Math.ceil(totalCount / limit) || 1;
      const pagedInvoices = filtered.slice((page - 1) * limit, page * limit);

      return sendSuccess(
        res,
        {
          invoices: pagedInvoices,
          pagination: {
            totalCount,
            page,
            limit,
            totalPages,
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
 * When ISSUED, returns frozen snapshot details for customer and business (B8)
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
    const isIssued = inv.status === 'ISSUED' || inv.status === 'CANCELLED';

    // B8: Freeze customer and business details for issued invoices
    const customerData = isIssued
      ? {
          id: inv.customerId,
          name: inv.customerNameSnapshot || inv.customer.name,
          phone: inv.customerPhoneSnapshot || inv.customer.phone,
          email: inv.customerEmailSnapshot || inv.customer.email,
          billingAddress: inv.customerAddressSnapshot || inv.customer.billingAddress,
          gstin: inv.customerGstinSnapshot || inv.customer.gstin,
          state: inv.customerStateSnapshot || inv.customer.state,
        }
      : inv.customer;

    const businessData = isIssued
      ? {
          id: inv.businessId,
          name: inv.businessNameSnapshot || inv.business.name,
          address: inv.businessAddressSnapshot || inv.business.address,
          phone: inv.businessPhoneSnapshot || inv.business.phone,
          email: inv.businessEmailSnapshot || inv.business.email,
          gstin: inv.businessGstinSnapshot || inv.business.gstin,
          state: inv.businessStateSnapshot || inv.business.state,
          logoUrl: inv.business.logoUrl,
        }
      : inv.business;

    return sendSuccess(
      res,
      {
        ...inv,
        customer: customerData,
        business: businessData,
        customerName: isIssued && inv.customerNameSnapshot ? inv.customerNameSnapshot : inv.customer.name,
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

    const pdfData: InvoicePdfData = {
      invoiceNumber: inv.invoiceNumber,
      invoiceDate: inv.invoiceDate.toISOString().split('T')[0],
      dueDate: inv.dueDate.toISOString().split('T')[0],
      status: inv.status,
      placeOfSupply: inv.placeOfSupply,
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
        logoUrl: inv.business.logoUrl || null,
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
 * Creates a DRAFT invoice with collision-free draft identifier (B2)
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
      if (customer.isArchived) {
        throw new AppError('Cannot create an invoice for an archived customer', 400, 'ERR_CUSTOMER_ARCHIVED');
      }

      // Validate dates
      const invDateObj = new Date(invoiceDate);
      const dueDateObj = new Date(dueDate);
      if (isNaN(invDateObj.getTime()) || isNaN(dueDateObj.getTime())) {
        throw new AppError('Invalid date provided', 400, 'ERR_INVALID_DATE_FORMAT');
      }
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

      // B2: Collision-safe unique draft identifier
      const draftNumber = `DRAFT-${Date.now().toString().slice(-4)}-${randomBytes(4).toString('hex').toUpperCase()}`;

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
 * Updates an existing DRAFT invoice. Issued invoices are immutable.
 */
router.put(
  '/:id',
  validateRequest({ body: updateInvoiceSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const business = await getOrCreateDefaultBusiness();
      const { customerId, invoiceDate, dueDate, placeOfSupply, isInterState: explicitInterState, notes, items } = req.body;

      const existing = await prisma.invoice.findUnique({
        where: { id },
        include: { items: true },
      });

      if (!existing) {
        throw new AppError('Invoice not found', 404, 'ERR_INVOICE_NOT_FOUND');
      }

      if (existing.status !== 'DRAFT') {
        throw new AppError(
          'Issued or cancelled invoices cannot be edited. Create a new invoice or credit note.',
          400,
          'ERR_IMMUTABLE_INVOICE'
        );
      }

      const customer = await prisma.customer.findFirst({
        where: { id: customerId, businessId: business.id },
      });
      if (!customer) {
        throw new AppError('Customer not found', 404, 'ERR_CUSTOMER_NOT_FOUND');
      }

      const invDateObj = new Date(invoiceDate);
      const dueDateObj = new Date(dueDate);
      if (dueDateObj < invDateObj) {
        throw new AppError('Due date cannot precede invoice date', 400, 'ERR_INVALID_DATES');
      }

      const resolvedSupplyPlace = placeOfSupply ? placeOfSupply.trim() : (customer.state || business.state || 'Karnataka');
      const isInterState = typeof explicitInterState === 'boolean'
        ? explicitInterState
        : resolvedSupplyPlace.toLowerCase() !== (business.state || 'karnataka').toLowerCase();

      const calculated = calculateInvoiceTotals(items, isInterState);

      const updated = await prisma.$transaction(async (tx) => {
        await tx.invoiceItem.deleteMany({
          where: { invoiceId: id },
        });

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
      });

      return sendSuccess(res, updated, 'Draft invoice updated successfully');
    } catch (error) {
      next(error);
    }
  }
);

/**
 * DELETE /api/invoices/:id
 * Deletes a DRAFT invoice. Issued invoices cannot be deleted (B11)
 */
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const inv = await prisma.invoice.findUnique({
      where: { id },
      include: { payments: true },
    });

    if (!inv) {
      throw new AppError('Invoice not found', 404, 'ERR_INVOICE_NOT_FOUND');
    }

    if (inv.status !== 'DRAFT') {
      throw new AppError(
        'Only draft invoices can be deleted. Issued invoices cannot be deleted.',
        409,
        'ERR_CANNOT_DELETE_NON_DRAFT'
      );
    }

    await prisma.invoice.delete({
      where: { id },
    });

    return sendSuccess(res, { id }, 'Draft invoice deleted successfully');
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/invoices/:id/cancel
 * Cancels an ISSUED invoice. Cancelled invoices preserve their number for audit trail (B11)
 */
router.post('/:id/cancel', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const inv = await prisma.invoice.findUnique({
      where: { id },
      include: { payments: true },
    });

    if (!inv) {
      throw new AppError('Invoice not found', 404, 'ERR_INVOICE_NOT_FOUND');
    }

    if (inv.status === 'CANCELLED') {
      throw new AppError('Invoice is already cancelled', 400, 'ERR_ALREADY_CANCELLED');
    }

    if (inv.status === 'DRAFT') {
      throw new AppError('Draft invoices should be deleted, not cancelled', 400, 'ERR_CANNOT_CANCEL_DRAFT');
    }

    if (inv.payments && inv.payments.length > 0) {
      throw new AppError(
        'Invoices with recorded payments cannot be cancelled directly. Please refund or remove payments first.',
        400,
        'ERR_INVOICE_HAS_PAYMENTS'
      );
    }

    const updated = await prisma.invoice.update({
      where: { id },
      data: { status: 'CANCELLED' },
    });

    return sendSuccess(res, updated, `Invoice ${updated.invoiceNumber} has been cancelled`);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/invoices/:id/issue
 * Issues a draft invoice: locks invoice row in database, assigns sequential official number atomically (B1, B20)
 */
router.post('/:id/issue', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    // Atomic transaction with row locking on invoice table (B1)
    const issuedInvoice = await prisma.$transaction(async (tx) => {
      // 1. Lock invoice row and check status atomically
      const lockedInvoices: any = await tx.$queryRaw`
        SELECT id, status, "businessId", "grandTotal", "placeOfSupply", "customerId"
        FROM "invoices"
        WHERE id = ${id}
        FOR UPDATE
      `;

      const lockedInvoice = lockedInvoices && lockedInvoices[0];
      if (!lockedInvoice) {
        throw new AppError('Invoice not found', 404, 'ERR_INVOICE_NOT_FOUND');
      }

      if (lockedInvoice.status === 'ISSUED') {
        throw new AppError('Invoice has already been issued', 409, 'ERR_ALREADY_ISSUED');
      }

      if (lockedInvoice.status === 'CANCELLED') {
        throw new AppError('Cancelled invoices cannot be issued', 400, 'ERR_CANNOT_ISSUE_CANCELLED');
      }

      if (lockedInvoice.status !== 'DRAFT') {
        throw new AppError('Only draft invoices can be issued', 400, 'ERR_INVALID_INVOICE_STATE');
      }

      // B20: Zero-total invoice cannot be issued
      if (Number(lockedInvoice.grandTotal) <= 0) {
        throw new AppError(
          'Cannot issue an invoice with a total amount of zero or less',
          400,
          'ERR_ZERO_TOTAL_INVOICE'
        );
      }

      const itemCount = await tx.invoiceItem.count({ where: { invoiceId: id } });
      if (itemCount === 0) {
        throw new AppError('Cannot issue an invoice with zero items', 400, 'ERR_EMPTY_INVOICE');
      }

      // 2. Verify business profile and contact credentials
      const business = await tx.business.findUnique({
        where: { id: lockedInvoice.businessId },
      });

      if (!business) {
        throw new AppError('Business profile not found', 404, 'ERR_BUSINESS_NOT_FOUND');
      }

      const cleanBizPhone = (business.phone || '').replace(/\D/g, '');
      const hasBizWhatsApp = cleanBizPhone.length >= 10;
      const hasBizGmail = Boolean(business.email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(business.email.trim()));

      if (!hasBizWhatsApp || !hasBizGmail) {
        throw new AppError(
          'Company WhatsApp number (min 10 digits) and Gmail/Email are mandatory to issue and send invoices. Please configure them in Settings.',
          400,
          'ERR_COMPANY_CONTACT_MANDATORY'
        );
      }

      // 3. Verify customer contact
      const customer = await tx.customer.findUnique({
        where: { id: lockedInvoice.customerId },
      });

      if (!customer) {
        throw new AppError('Customer not found', 404, 'ERR_CUSTOMER_NOT_FOUND');
      }

      const cleanCustPhone = (customer.phone || '').replace(/\D/g, '');
      const hasCustPhone = cleanCustPhone.length >= 10;
      const hasCustEmail = Boolean(customer.email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customer.email.trim()));

      if (!hasCustPhone && !hasCustEmail) {
        throw new AppError(
          'Customer must have at least one contact method (10-digit phone number or email) to receive the invoice.',
          400,
          'ERR_CUSTOMER_CONTACT_MANDATORY'
        );
      }

      // 4. Atomically allocate next sequence number
      const updatedBusiness = await tx.business.update({
        where: { id: business.id },
        data: {
          nextInvoiceNumber: { increment: 1 },
        },
      });

      const assignedSequence = updatedBusiness.nextInvoiceNumber - 1;
      const currentYear = new Date().getFullYear();
      const officialNumber = `${updatedBusiness.invoicePrefix}-${currentYear}-${String(
        assignedSequence
      ).padStart(6, '0')}`;

      // 5. Update status to ISSUED and lock snapshots
      const updated = await tx.invoice.update({
        where: { id },
        data: {
          invoiceNumber: officialNumber,
          status: 'ISSUED',
          customerNameSnapshot: customer.name,
          customerPhoneSnapshot: customer.phone,
          customerEmailSnapshot: customer.email,
          customerAddressSnapshot: customer.billingAddress,
          customerGstinSnapshot: customer.gstin,
          customerStateSnapshot: customer.state || lockedInvoice.placeOfSupply,
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
  validateRequest({ body: createPaymentSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const result = await handleRecordPayment(id, req.body);
      return sendSuccess(res, result, 'Payment recorded successfully', 201);
    } catch (error) {
      next(error);
    }
  }
);

export const invoicesRouter = router;
