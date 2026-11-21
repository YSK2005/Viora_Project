import {ErrorCode} from '../../utils/errorCodes';
import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../../config/prisma';
import { sendSuccess } from '../../utils/response';
import { validateRequest } from '../../middlewares/validate';
import { AppError } from '../../middlewares/errorHandler';
import { AuthenticatedRequest, requireRole } from '../../middlewares/auth';
import { derivePaymentStatus, round2, toDecimal } from '../../utils/money';
import { toTimezoneBoundary } from '../../utils/dateBoundary';
import { logAuditEvent } from '../../utils/audit';

const router = Router();

export const createPaymentSchema = z.object({
  amount: z
    .coerce
    .number()
    .positive('Payment amount must be greater than zero')
    .refine(
      (val) => {
        // Enforce max 2 currency decimals (reject sub-paisa like 0.005)
        const parts = val.toString().split('.');
        return !parts[1] || parts[1].length <= 2;
      },
      {
        message:
          'Payment amount cannot have more than 2 decimal places (sub-paisa is not permitted)',
      }
    )
    .refine((val) => val <= 1000000000, {
      message: 'Payment amount exceeds maximum allowable limit',
    }),
  paymentDate: z
    .string()
    .refine((val) => !isNaN(Date.parse(val)), {
      message: 'Invalid payment date format',
    })
    .optional(),
  method: z
    .enum(['CASH', 'BANK_TRANSFER', 'UPI', 'CHEQUE', 'CARD', 'OTHER'])
    .default('BANK_TRANSFER'),
  reference: z.string().max(100).optional().nullable(),
  requestKey: z
    .string()
    .min(4, 'Idempotency requestKey is required to prevent duplicate payments')
    .max(100),
});

const getPaymentsQuerySchema = z.object({
  invoiceId: z.string().optional(),
  customerId: z.string().optional(),
  search: z.string().optional(),
  method: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  isReversed: z.enum(['true', 'false', 'all']).optional().default('all'),
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(100).optional().default(20),
});

export const reversePaymentSchema = z.object({
  reason: z
    .string()
    .trim()
    .min(3, 'Reversal reason must be at least 3 characters')
    .max(500, 'Reversal reason cannot exceed 500 characters'),
});

/**
 * GET /api/payments
 * Lists all recorded payments with invoice metadata, customer filter, search, and date filters
 */
router.get(
  '/',
  validateRequest({ query: getPaymentsQuerySchema }),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const businessId = req.business.id;
      const { invoiceId, customerId, search, method, startDate, endDate, isReversed, page, limit } = req.query as any;

      const where: any = {
        invoice: {
          businessId,
        },
      };

      if (invoiceId) {
        where.invoiceId = invoiceId;
      }

      if (customerId) {
        where.invoice.customerId = customerId;
      }

      if (method && method !== 'ALL') {
        where.method = method;
      }

      if (isReversed === 'true') {
        where.isReversed = true;
      } else if (isReversed === 'false') {
        where.isReversed = false;
      }

      if (startDate || endDate) {
        where.paymentDate = {};
        if (startDate) where.paymentDate.gte = toTimezoneBoundary(startDate, false);
        if (endDate) where.paymentDate.lte = toTimezoneBoundary(endDate, true);
      }

      if (search && search.trim()) {
        const term = search.trim();
        where.OR = [
          { invoice: { invoiceNumber: { contains: term, mode: 'insensitive' } } },
          { invoice: { customerNameSnapshot: { contains: term, mode: 'insensitive' } } },
          { invoice: { customer: { name: { contains: term, mode: 'insensitive' } } } },
          { reference: { contains: term, mode: 'insensitive' } },
        ];
      }

      const totalCount = await prisma.payment.count({ where });
      const payments = await prisma.payment.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { paymentDate: 'desc' },
        include: {
          invoice: {
            select: {
              id: true,
              invoiceNumber: true,
              grandTotal: true,
              customerNameSnapshot: true,
              customer: { select: { id: true, name: true } },
            },
          },
        },
      });

      return sendSuccess(
        res,
        {
          payments: payments.map((p) => ({
            id: p.id,
            invoiceId: p.invoiceId,
            invoiceNumber: p.invoice.invoiceNumber,
            customerId: p.invoice.customer?.id,
            customerName: p.invoice.customerNameSnapshot || p.invoice.customer.name,
            amount: Number(p.amount),
            paymentDate: p.paymentDate.toISOString().split('T')[0],
            method: p.method,
            reference: p.reference,
            requestKey: p.requestKey,
            isReversed: p.isReversed,
            reversedAt: p.reversedAt,
            reversedReason: p.reversedReason,
            reversedByUserId: p.reversedByUserId,
            createdByUserId: p.createdByUserId,
            createdAt: p.createdAt,
          })),
          pagination: {
            totalCount,
            page,
            limit,
            totalPages: Math.ceil(totalCount / limit) || 1,
          },
        },
        'Payments retrieved successfully'
      );
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/payments/:id/reverse
 * Reverses a recorded payment with full audit history and balance reconciliation.
 * Preserves the original payment row for complete financial audit integrity.
 * Requires OWNER or ACCOUNTANT role.
 */
router.post(
  '/:id/reverse',
  requireRole(['OWNER', 'ACCOUNTANT']),
  validateRequest({ body: reversePaymentSchema }),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const paymentId = req.params.id;
      const { reason } = req.body;
      const businessId = req.business.id;

      const result = await prisma.$transaction(async (tx) => {
        // 1. Locate payment and ensure multi-tenant boundary
        const payment = await tx.payment.findUnique({
          where: { id: paymentId },
          include: {
            invoice: {
              select: {
                id: true,
                businessId: true,
                invoiceNumber: true,
                grandTotal: true,
                status: true,
              },
            },
          },
        });

        if (!payment || payment.invoice.businessId !== businessId) {
          throw new AppError('Payment not found', 404, ErrorCode.ERR_PAYMENT_NOT_FOUND);
        }

        if (payment.isReversed) {
          throw new AppError('This payment has already been reversed', 400, ErrorCode.ERR_PAYMENT_ALREADY_REVERSED);
        }

        // 2. Lock invoice row for update
        const [lockedInvoice] = await tx.$queryRaw<Array<{ id: string; grandTotal: any; creditedTotal: any; status: string }>>`
          SELECT id, "grandTotal", "creditedTotal", status
          FROM "invoices"
          WHERE id = ${payment.invoiceId} AND "businessId" = ${businessId}
          FOR UPDATE
        `;

        if (!lockedInvoice) {
          throw new AppError('Invoice not found', 404, ErrorCode.ERR_INVOICE_NOT_FOUND);
        }

        // 3. Mark payment as reversed (Preserves original payment record!)
        const reversedAt = new Date();
        const updatedPayment = await tx.payment.update({
          where: { id: payment.id },
          data: {
            isReversed: true,
            reversedAt,
            reversedReason: reason.trim(),
            reversedByUserId: req.user!.id,
          },
        });

        // 4. Reconcile remaining invoice balance excluding reversed payments
        const allPayments = await tx.payment.findMany({
          where: { invoiceId: payment.invoiceId },
        });

        const derived = derivePaymentStatus(lockedInvoice.grandTotal, allPayments, lockedInvoice.creditedTotal);

        // 5. Create immutable audit log entry
        await logAuditEvent(
          {
            businessId,
            userId: req.user!.id,
            action: 'PAYMENT_REVERSE',
            entityType: 'PAYMENT',
            entityId: payment.id,
            details: {
              invoiceId: payment.invoiceId,
              invoiceNumber: payment.invoice.invoiceNumber,
              reversedAmount: Number(payment.amount),
              reason: reason.trim(),
              reversedAt: reversedAt.toISOString(),
              reversedByUserId: req.user!.id,
              newPaymentStatus: derived.paymentStatus,
              newTotalPaid: Number(derived.totalPaid),
              newBalanceRemaining: Number(derived.balanceRemaining),
            },
            ipAddress: req.ip,
          },
          tx
        );

        return {
          payment: {
            ...updatedPayment,
            amount: Number(updatedPayment.amount),
          },
          invoiceSummary: {
            invoiceId: lockedInvoice.id,
            invoiceNumber: payment.invoice.invoiceNumber,
            grandTotal: Number(lockedInvoice.grandTotal),
            paymentStatus: derived.paymentStatus,
            totalPaid: Number(derived.totalPaid),
            balanceRemaining: Number(derived.balanceRemaining),
          },
        };
      });

      return sendSuccess(res, result, 'Payment reversed successfully and invoice balance reconciled');
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Helper to record payment on an invoice (used by POST /api/invoices/:id/payments)
 * Protects against concurrent requests via PostgreSQL row-level locks (FOR UPDATE)
 * and strict transactional balance recalculation and idempotency checking.
 */
export async function handleRecordPayment(
  invoiceId: string,
  rawBody: z.infer<typeof createPaymentSchema>,
  businessId?: string,
  userId?: string
) {
  const body = createPaymentSchema.parse(rawBody);
  const paymentAmount = round2(toDecimal(body.amount));

  try {
    return await prisma.$transaction(async (tx) => {
      // 1. Check duplicate requestKey inside transaction
      const existingPayment = await tx.payment.findUnique({
        where: { requestKey: body.requestKey.trim() },
      });
      if (existingPayment) {
        throw new AppError(
          `Duplicate payment submission detected for requestKey: ${body.requestKey}`,
          409,
          ErrorCode.ERR_DUPLICATE_PAYMENT_REQUEST
        );
      }

      // 2. Lock invoice row FOR UPDATE to safely serialize concurrent payment attempts
      const lockedInvoices = businessId
        ? await tx.$queryRaw<
            Array<{
              id: string;
              invoiceNumber: string;
              grandTotal: any; creditedTotal: any;
              status: string;
            }>
          >`
            SELECT id, "invoiceNumber", "grandTotal", "creditedTotal", status
            FROM "invoices"
            WHERE id = ${invoiceId} AND "businessId" = ${businessId}
            FOR UPDATE
          `
        : await tx.$queryRaw<
            Array<{
              id: string;
              invoiceNumber: string;
              grandTotal: any; creditedTotal: any;
              status: string;
            }>
          >`
            SELECT id, "invoiceNumber", "grandTotal", "creditedTotal", status
            FROM "invoices"
            WHERE id = ${invoiceId}
            FOR UPDATE
          `;

      if (!lockedInvoices || lockedInvoices.length === 0) {
        throw new AppError('Invoice not found', 404, ErrorCode.ERR_INVOICE_NOT_FOUND);
      }

      const invoice = lockedInvoices[0];

      if (invoice.status !== 'ISSUED') {
        throw new AppError(
          `Cannot record payment for an invoice in ${invoice.status} status. Only ISSUED invoices can receive payments.`,
          400,
          ErrorCode.ERR_INVALID_INVOICE_STATUS
        );
      }

      // 3. Recalculate balance inside transaction (excluding reversed payments)
      const existingPayments = await tx.payment.findMany({
        where: { invoiceId },
        select: {
          id: true,
          amount: true,
          paymentDate: true,
          method: true,
          reference: true,
          requestKey: true,
          isReversed: true,
          createdAt: true,
        },
      });

      const currentStatus = derivePaymentStatus(invoice.grandTotal, existingPayments, invoice.creditedTotal);
      if (currentStatus.paymentStatus === 'PAID' || currentStatus.balanceRemaining.lessThanOrEqualTo(0)) {
        throw new AppError('This invoice has already been fully paid', 400, ErrorCode.ERR_INVOICE_ALREADY_PAID);
      }

      // 4. Validate that payment amount does not exceed remaining balance
      if (paymentAmount.greaterThan(currentStatus.balanceRemaining)) {
        throw new AppError(
          `Payment amount (₹${paymentAmount.toString()}) exceeds outstanding balance (₹${currentStatus.balanceRemaining.toString()})`,
          400,
          ErrorCode.ERR_OVERPAYMENT_REJECTED
        );
      }

      // 5. Insert payment
      const paymentDateObj = body.paymentDate ? new Date(body.paymentDate) : new Date();

      const newPayment = await tx.payment.create({
        data: {
          invoiceId,
          amount: paymentAmount,
          paymentDate: paymentDateObj,
          method: body.method,
          reference: body.reference ? body.reference.trim() : null,
          requestKey: body.requestKey.trim(),
          createdByUserId: userId || null,
        },
      });

      // 6. Recalculate updated status
      const updatedPayments = [...existingPayments, newPayment];
      const updatedStatus = derivePaymentStatus(invoice.grandTotal, updatedPayments, invoice.creditedTotal);

      // 7. Audit log
      if (businessId) {
        await logAuditEvent(
          {
            businessId,
            userId: userId || null,
            action: 'PAYMENT_RECORD',
            entityType: 'PAYMENT',
            entityId: newPayment.id,
            details: {
              invoiceId: invoice.id,
              invoiceNumber: invoice.invoiceNumber,
              amount: Number(newPayment.amount),
              method: newPayment.method,
              requestKey: newPayment.requestKey,
              paymentStatus: updatedStatus.paymentStatus,
              totalPaid: Number(updatedStatus.totalPaid),
              balanceRemaining: Number(updatedStatus.balanceRemaining),
            },
          },
          tx
        );
      }

      return {
        payment: {
          ...newPayment,
          amount: Number(newPayment.amount),
        },
        invoiceSummary: {
          invoiceId: invoice.id,
          invoiceNumber: invoice.invoiceNumber,
          grandTotal: Number(invoice.grandTotal),
          paymentStatus: updatedStatus.paymentStatus,
          totalPaid: Number(updatedStatus.totalPaid),
          balanceRemaining: Number(updatedStatus.balanceRemaining),
        },
      };
    });
  } catch (error: any) {
    if (error?.code === 'P2002' && error?.meta?.target?.includes('requestKey')) {
      throw new AppError(
        `Duplicate payment submission detected for requestKey: ${body.requestKey}`,
        409,
        ErrorCode.ERR_DUPLICATE_PAYMENT_REQUEST
      );
    }
    throw error;
  }
}

export const paymentsRouter = router;
