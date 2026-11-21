import { ErrorCode } from "../utils/errorCodes";
import { prisma, Prisma } from "../config/prisma";
import { AppError } from "../middlewares/errorHandler";
import { derivePaymentStatus } from "../utils/money";
export async function customerStatement(
  businessId: string,
  customerId: string,
  page: number,
  limit: number,
) {
  return prisma.$transaction(
    async (tx) => {
      const customer = await tx.customer.findFirst({
        where: { id: customerId, businessId },
      });
      if (!customer)
        throw new AppError(
          "Customer not found",
          404,
          ErrorCode.ERR_CUSTOMER_NOT_FOUND,
        );
      const where = { businessId, customerId, status: "ISSUED" as const };
      const totalCount = await tx.invoice.count({ where });
      const invoices = await tx.invoice.findMany({
        where,
        take: limit,
        skip: (page - 1) * limit,
        orderBy: [{ invoiceDate: "desc" }, { id: "desc" }],
        include: {
          payments: { where: { isReversed: false }, select: { amount: true } },
        },
      });
      const [totals] = await tx.$queryRaw<
        Array<{
          billed: Prisma.Decimal;
          credited: Prisma.Decimal;
          paid: Prisma.Decimal;
          balanceDue: Prisma.Decimal;
          customerCredit: Prisma.Decimal;
        }>
      >`
   SELECT COALESCE(SUM(i."grandTotal"),0) AS billed,COALESCE(SUM(i."creditedTotal"),0) AS credited,
    COALESCE(SUM(p.paid),0) AS paid,COALESCE(SUM(GREATEST(0,i."grandTotal"-i."creditedTotal"-COALESCE(p.paid,0))),0) AS "balanceDue",
    COALESCE(SUM(GREATEST(0,COALESCE(p.paid,0)+i."creditedTotal"-i."grandTotal")),0) AS "customerCredit"
   FROM invoices i LEFT JOIN LATERAL (SELECT SUM(amount) AS paid FROM payments WHERE "invoiceId"=i.id AND "isReversed"=false) p ON true
   WHERE i."businessId"=${businessId} AND i."customerId"=${customerId} AND i.status='ISSUED'`;
      return {
        customer,
        generatedAt: new Date(),
        totals,
        invoices: invoices.map((inv) => ({
          ...inv,
          ...derivePaymentStatus(
            inv.grandTotal,
            inv.payments,
            inv.creditedTotal,
          ),
        })),
        pagination: {
          page,
          limit,
          totalCount,
          totalPages: Math.max(1, Math.ceil(totalCount / limit)),
        },
      };
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
  );
}
