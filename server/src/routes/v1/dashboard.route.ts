import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../../config/prisma';
import { sendSuccess } from '../../utils/response';
import { getOrCreateDefaultBusiness } from '../../utils/businessHelper';
import { round2, toDecimal } from '../../utils/money';

const router = Router();

/**
 * GET /api/dashboard/summary
 * Calculates real financial and operational metrics from PostgreSQL database records
 */
router.get('/summary', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const business = await getOrCreateDefaultBusiness();

    // 1. Issued invoices only (exclude DRAFT and CANCELLED)
    const issuedInvoices = await prisma.invoice.findMany({
      where: {
        businessId: business.id,
        status: 'ISSUED',
      },
      select: {
        id: true,
        grandTotal: true,
        payments: {
          select: {
            amount: true,
          },
        },
      },
    });

    // 2. Draft invoices count
    const draftCount = await prisma.invoice.count({
      where: {
        businessId: business.id,
        status: 'DRAFT',
      },
    });

    let totalIssuedSales = toDecimal(0);
    let totalCollected = toDecimal(0);
    let paidCount = 0;
    let partialCount = 0;
    let unpaidCount = 0;

    for (const inv of issuedInvoices) {
      const gTotal = toDecimal(inv.grandTotal);
      totalIssuedSales = totalIssuedSales.plus(gTotal);

      let invoicePaid = toDecimal(0);
      for (const p of inv.payments) {
        const amt = toDecimal(p.amount);
        invoicePaid = invoicePaid.plus(amt);
        totalCollected = totalCollected.plus(amt);
      }

      if (invoicePaid.greaterThanOrEqualTo(gTotal) && gTotal.greaterThan(0)) {
        paidCount++;
      } else if (invoicePaid.greaterThan(0)) {
        partialCount++;
      } else {
        unpaidCount++;
      }
    }

    totalIssuedSales = round2(totalIssuedSales);
    totalCollected = round2(totalCollected);

    const outstandingBalance = round2(
      totalIssuedSales.minus(totalCollected).isNegative()
        ? toDecimal(0)
        : totalIssuedSales.minus(totalCollected)
    );

    // Customer and product metrics
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
          label: 'Total Collections',
        },
        outstandingBalance: {
          amount: Number(outstandingBalance),
          currency: 'INR',
          label: 'Outstanding Receivables',
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
});

export const dashboardRouter = router;
