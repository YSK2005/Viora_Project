import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../../config/prisma';
import { sendSuccess } from '../../utils/response';
import { validateRequest } from '../../middlewares/validate';
import { getOrCreateDefaultBusiness } from '../../utils/businessHelper';
import { round2, toDecimal } from '../../utils/money';

const router = Router();

const salesReportQuerySchema = z.object({
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  groupBy: z.enum(['day', 'month']).optional().default('day'),
});

/**
 * Converts a YYYY-MM-DD string into a UTC Date object
 * using canonical Indian Standard Time (IST, UTC+5:30) day boundaries.
 * B5: Resolves mismatch between date filtering and daily grouping.
 */
function istDateToUtcBoundary(dateStr: string, isEnd: boolean = false): Date {
  const parts = dateStr.trim().split('-');
  const y = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10) - 1;
  const d = parseInt(parts[2], 10);

  if (isEnd) {
    // 23:59:59.999 in IST corresponds to 18:29:59.999 UTC
    const utcMillis = Date.UTC(y, m, d, 23, 59, 59, 999) - (5 * 60 + 30) * 60 * 1000;
    return new Date(utcMillis);
  } else {
    // 00:00:00.000 in IST corresponds to 18:30:00.000 UTC of previous calendar day
    const utcMillis = Date.UTC(y, m, d, 0, 0, 0, 0) - (5 * 60 + 30) * 60 * 1000;
    return new Date(utcMillis);
  }
}

/**
 * GET /api/reports/sales
 * Generates sales and collections report with daily or monthly aggregation.
 * Canonical Timezone: Asia/Kolkata (IST).
 * B5: Date boundaries and aggregation keys strictly match.
 * B22: Distinguishes period net activity from cumulative outstanding receivables.
 */
router.get(
  '/sales',
  validateRequest({ query: salesReportQuerySchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const business = await getOrCreateDefaultBusiness();
      const { startDate, endDate, groupBy } = req.query as any;

      // 1. Invoices filter (ISSUED invoices only)
      const invoiceWhere: any = {
        businessId: business.id,
        status: 'ISSUED',
      };

      if (startDate || endDate) {
        invoiceWhere.invoiceDate = {};
        if (startDate) {
          invoiceWhere.invoiceDate.gte = istDateToUtcBoundary(startDate, false);
        }
        if (endDate) {
          invoiceWhere.invoiceDate.lte = istDateToUtcBoundary(endDate, true);
        }
      }

      const invoices = await prisma.invoice.findMany({
        where: invoiceWhere,
        orderBy: { invoiceDate: 'asc' },
        select: {
          id: true,
          invoiceNumber: true,
          invoiceDate: true,
          subtotal: true,
          discountTotal: true,
          taxTotal: true,
          grandTotal: true,
        },
      });

      // 2. Payments filter (Collections by payment date)
      const paymentWhere: any = {
        invoice: {
          businessId: business.id,
          status: 'ISSUED',
        },
      };

      if (startDate || endDate) {
        paymentWhere.paymentDate = {};
        if (startDate) {
          paymentWhere.paymentDate.gte = istDateToUtcBoundary(startDate, false);
        }
        if (endDate) {
          paymentWhere.paymentDate.lte = istDateToUtcBoundary(endDate, true);
        }
      }

      const payments = await prisma.payment.findMany({
        where: paymentWhere,
        orderBy: { paymentDate: 'asc' },
        select: {
          id: true,
          amount: true,
          paymentDate: true,
          method: true,
        },
      });

      // Helper to format date key in documented business timezone (Asia/Kolkata)
      const formatPeriodKey = (d: Date): string => {
        const dateStr = new Intl.DateTimeFormat('en-CA', {
          timeZone: 'Asia/Kolkata',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
        }).format(d);
        if (groupBy === 'month') {
          return dateStr.slice(0, 7);
        }
        return dateStr;
      };

      // Aggregate Sales by Invoice Date
      const salesAggregation: Record<
        string,
        {
          period: string;
          invoiceCount: number;
          subtotal: number;
          discountTotal: number;
          taxTotal: number;
          grandTotal: number;
        }
      > = {};

      let totalSales = toDecimal(0);
      let totalTax = toDecimal(0);
      let totalDiscount = toDecimal(0);

      for (const inv of invoices) {
        const key = formatPeriodKey(inv.invoiceDate);
        if (!salesAggregation[key]) {
          salesAggregation[key] = {
            period: key,
            invoiceCount: 0,
            subtotal: 0,
            discountTotal: 0,
            taxTotal: 0,
            grandTotal: 0,
          };
        }

        salesAggregation[key].invoiceCount += 1;
        salesAggregation[key].subtotal = Number(
          round2(toDecimal(salesAggregation[key].subtotal).plus(inv.subtotal))
        );
        salesAggregation[key].discountTotal = Number(
          round2(toDecimal(salesAggregation[key].discountTotal).plus(inv.discountTotal))
        );
        salesAggregation[key].taxTotal = Number(
          round2(toDecimal(salesAggregation[key].taxTotal).plus(inv.taxTotal))
        );
        salesAggregation[key].grandTotal = Number(
          round2(toDecimal(salesAggregation[key].grandTotal).plus(inv.grandTotal))
        );

        totalSales = totalSales.plus(inv.grandTotal);
        totalTax = totalTax.plus(inv.taxTotal);
        totalDiscount = totalDiscount.plus(inv.discountTotal);
      }

      // Aggregate Collections by Payment Date
      const collectionsAggregation: Record<
        string,
        {
          period: string;
          paymentCount: number;
          totalCollected: number;
        }
      > = {};

      let totalCollected = toDecimal(0);

      for (const p of payments) {
        const key = formatPeriodKey(p.paymentDate);
        if (!collectionsAggregation[key]) {
          collectionsAggregation[key] = {
            period: key,
            paymentCount: 0,
            totalCollected: 0,
          };
        }

        collectionsAggregation[key].paymentCount += 1;
        collectionsAggregation[key].totalCollected = Number(
          round2(toDecimal(collectionsAggregation[key].totalCollected).plus(p.amount))
        );

        totalCollected = totalCollected.plus(p.amount);
      }

      const salesTimeline = Object.values(salesAggregation).sort((a, b) =>
        a.period.localeCompare(b.period)
      );
      const collectionsTimeline = Object.values(collectionsAggregation).sort((a, b) =>
        a.period.localeCompare(b.period)
      );

      // B22: Calculate actual cumulative outstanding receivables up to report boundary
      const allIssuedUpToDate = await prisma.invoice.findMany({
        where: {
          businessId: business.id,
          status: 'ISSUED',
          invoiceDate: invoiceWhere.invoiceDate?.lte ? { lte: invoiceWhere.invoiceDate.lte } : undefined,
        },
        select: {
          grandTotal: true,
          payments: {
            select: { amount: true },
          },
        },
      });

      let totalReceivables = toDecimal(0);
      for (const inv of allIssuedUpToDate) {
        const paid = inv.payments.reduce((acc, p) => acc.plus(toDecimal(p.amount)), toDecimal(0));
        const remaining = toDecimal(inv.grandTotal).minus(paid);
        if (remaining.greaterThan(0)) {
          totalReceivables = totalReceivables.plus(remaining);
        }
      }

      const periodNet = Number(round2(totalSales.minus(totalCollected)));
      const closingReceivables = Number(round2(totalReceivables));

      return sendSuccess(
        res,
        {
          filters: {
            startDate: startDate || null,
            endDate: endDate || null,
            groupBy,
            timezone: 'Asia/Kolkata (IST)',
          },
          summary: {
            totalIssuedInvoices: invoices.length,
            totalSales: Number(round2(totalSales)),
            totalTax: Number(round2(totalTax)),
            totalDiscount: Number(round2(totalDiscount)),
            totalCollected: Number(round2(totalCollected)),
            totalPayments: payments.length,
            periodNetSalesLessCollections: periodNet,
            netOutstanding: closingReceivables, // True cumulative receivables
            totalOutstandingReceivables: closingReceivables,
          },
          salesTimeline,
          collectionsTimeline,
        },
        'Sales report generated successfully'
      );
    } catch (error) {
      next(error);
    }
  }
);

export const reportsRouter = router;
