import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../../config/prisma';
import { sendSuccess } from '../../utils/response';
import { validateRequest } from '../../middlewares/validate';
import { getOrCreateDefaultBusiness } from '../../utils/businessHelper';
import { round2, toDecimal } from '../../utils/money';

const router = Router();

const dashboardQuerySchema = z.object({
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

/**
 * GET /api/dashboard/summary
 * Calculates real financial and operational metrics from PostgreSQL database records.
 * Supports date range filtering while strictly distinguishing:
 * - Total Sales (by invoice date, excluding drafts)
 * - Total Invoices (issued invoices count in reporting period)
 * - Total Payments Collected (by payment date)
 * - Outstanding Payments (remaining balance on issued invoices)
 */
router.get(
  '/summary',
  validateRequest({ query: dashboardQuerySchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const business = await getOrCreateDefaultBusiness();
      const { startDate, endDate } = req.query as any;

      // 1. Issued invoices filter (by invoiceDate, drafts and cancelled excluded)
      const invoiceWhere: any = {
        businessId: business.id,
        status: 'ISSUED',
      };

      if (startDate || endDate) {
        invoiceWhere.invoiceDate = {};
        if (startDate) invoiceWhere.invoiceDate.gte = new Date(`${startDate}T00:00:00.000Z`);
        if (endDate) invoiceWhere.invoiceDate.lte = new Date(`${endDate}T23:59:59.999Z`);
      }

      const issuedInvoices = await prisma.invoice.findMany({
        where: invoiceWhere,
        select: {
          id: true,
          grandTotal: true,
          invoiceDate: true,
          payments: {
            select: {
              amount: true,
              paymentDate: true,
            },
          },
        },
      });

      // 2. Draft invoices count in period (or overall)
      const draftWhere: any = {
        businessId: business.id,
        status: 'DRAFT',
      };
      if (startDate || endDate) {
        draftWhere.invoiceDate = {};
        if (startDate) draftWhere.invoiceDate.gte = new Date(`${startDate}T00:00:00.000Z`);
        if (endDate) draftWhere.invoiceDate.lte = new Date(`${endDate}T23:59:59.999Z`);
      }
      const draftCount = await prisma.invoice.count({ where: draftWhere });

      // 3. Payments collected in period (by paymentDate)
      const paymentWhere: any = {
        invoice: {
          businessId: business.id,
          status: 'ISSUED',
        },
      };
      if (startDate || endDate) {
        paymentWhere.paymentDate = {};
        if (startDate) paymentWhere.paymentDate.gte = new Date(`${startDate}T00:00:00.000Z`);
        if (endDate) paymentWhere.paymentDate.lte = new Date(`${endDate}T23:59:59.999Z`);
      }
      const periodPayments = await prisma.payment.findMany({
        where: paymentWhere,
        select: {
          amount: true,
        },
      });

      let totalCollected = toDecimal(0);
      for (const p of periodPayments) {
        totalCollected = totalCollected.plus(toDecimal(p.amount));
      }
      totalCollected = round2(totalCollected);

      // 4. Calculate Total Sales and Outstanding Balances for issued invoices
      let totalIssuedSales = toDecimal(0);
      let paidCount = 0;
      let partialCount = 0;
      let unpaidCount = 0;
      let outstandingBalance = toDecimal(0);

      for (const inv of issuedInvoices) {
        const gTotal = toDecimal(inv.grandTotal);
        totalIssuedSales = totalIssuedSales.plus(gTotal);

        let invoicePaid = toDecimal(0);
        for (const p of inv.payments) {
          invoicePaid = invoicePaid.plus(toDecimal(p.amount));
        }
        invoicePaid = round2(invoicePaid);

        const rem = gTotal.minus(invoicePaid).isNegative() ? toDecimal(0) : gTotal.minus(invoicePaid);
        outstandingBalance = outstandingBalance.plus(rem);

        if (gTotal.isZero() || invoicePaid.greaterThanOrEqualTo(gTotal)) {
          paidCount++;
        } else if (invoicePaid.greaterThan(0)) {
          partialCount++;
        } else {
          unpaidCount++;
        }
      }

      totalIssuedSales = round2(totalIssuedSales);
      outstandingBalance = round2(outstandingBalance);

      // 5. Customer and product counts
      const [customerCount, productCount] = await Promise.all([
        prisma.customer.count({
          where: { businessId: business.id, isArchived: false },
        }),
        prisma.product.count({
          where: { businessId: business.id, isArchived: false, isActive: true },
        }),
      ]);

      const collectionRate = totalIssuedSales.greaterThan(0)
        ? Number(
            totalCollected
              .dividedBy(totalIssuedSales)
              .times(100)
              .toDecimalPlaces(1)
          )
        : 0;

      const summary = {
        isMock: false,
        business: {
          id: business.id,
          name: business.name,
        },
        filters: {
          startDate: startDate || null,
          endDate: endDate || null,
        },
        metrics: {
          totalSales: {
            amount: Number(totalIssuedSales),
            currency: 'INR',
            label: 'Total Issued Sales',
          },
          totalInvoices: {
            count: issuedInvoices.length,
            draftCount,
            paidCount,
            partialCount,
            unpaidCount,
            label: 'Total Invoices',
          },
          amountCollected: {
            amount: Number(totalCollected),
            collectionRate,
            currency: 'INR',
            label: 'Total Payments Collected',
          },
          outstandingBalance: {
            amount: Number(outstandingBalance),
            currency: 'INR',
            label: 'Outstanding Payments',
          },
        },
        counts: {
          customers: customerCount,
          products: productCount,
        },
      };

      return sendSuccess(res, summary, 'Dashboard summary calculated successfully from database');
    } catch (error) {
      next(error);
    }
  }
);

export const dashboardRouter = router;
