import { prisma, Prisma } from "../config/prisma";
import { toTimezoneBoundary } from "../utils/dateBoundary";
export interface InvoiceListQuery {
  business: { id: string };
  status: string;
  paymentStatus: string;
  customerId?: string;
  customerName?: string;
  search?: string;
  startDate?: string;
  endDate?: string;
  page: number;
  limit: number;
}
export async function findInvoicePage({
  business,
  status,
  paymentStatus,
  customerId,
  customerName,
  search,
  startDate,
  endDate,
  page,
  limit,
}: InvoiceListQuery) {
  const conditions = [Prisma.sql`i."businessId" = ${business.id}`];
  if (customerName?.trim())
    conditions.push(Prisma.sql`lower(c.name) = lower(${customerName.trim()})`);
  if (status !== "ALL") conditions.push(Prisma.sql`i.status::text = ${status}`);
  if (customerId?.trim())
    conditions.push(Prisma.sql`i."customerId" = ${customerId.trim()}`);
  if (startDate)
    conditions.push(
      Prisma.sql`i."invoiceDate" >= ${toTimezoneBoundary(startDate, false)}`,
    );
  if (endDate)
    conditions.push(
      Prisma.sql`i."invoiceDate" <= ${toTimezoneBoundary(endDate, true)}`,
    );
  if (search?.trim()) {
    const q = search.trim();
    conditions.push(Prisma.sql`(strpos(lower(i."invoiceNumber"), lower(${q})) > 0
          OR strpos(lower(i."customerNameSnapshot"), lower(${q})) > 0
          OR strpos(lower(c.name), lower(${q})) > 0)`);
  }
  // Aggregate in PostgreSQL and page IDs before loading invoice/customer records.
  // Keep count, page, and balances on the same consistent database snapshot.
  const base = Prisma.sql`SELECT i.id, i."invoiceDate", i."createdAt", i."grandTotal", i."creditedTotal",
          COALESCE(p.paid, 0) AS paid
        FROM invoices i JOIN customers c ON c.id = i."customerId"
        LEFT JOIN LATERAL (
          SELECT SUM(amount) AS paid FROM payments
          WHERE "invoiceId" = i.id AND "isReversed" = false
        ) p ON true
        WHERE ${Prisma.join(conditions, " AND ")}`;
  const paymentCondition =
    paymentStatus === "UNSETTLED"
      ? Prisma.sql`paid < "grandTotal" - "creditedTotal"`
      : paymentStatus === "PAID"
        ? Prisma.sql`("grandTotal" <> 0 OR "creditedTotal" > 0) AND paid >= "grandTotal" - "creditedTotal"`
        : paymentStatus === "PARTIALLY_PAID"
          ? Prisma.sql`paid > 0 AND paid < "grandTotal" - "creditedTotal"`
          : paymentStatus === "UNPAID"
            ? Prisma.sql`("grandTotal" = 0 AND "creditedTotal" = 0) OR (paid <= 0 AND "grandTotal" > "creditedTotal")`
            : Prisma.sql`true`;
  return prisma.$transaction(
    async (tx) => {
      const counts = await tx.$queryRaw<Array<{ count: bigint }>>(Prisma.sql`
          SELECT COUNT(*) AS count FROM (${base}) matched WHERE ${paymentCondition}`);
      const rows = await tx.$queryRaw<
        Array<{ id: string; paid: Prisma.Decimal }>
      >(Prisma.sql`
          SELECT id, paid FROM (${base}) matched WHERE ${paymentCondition}
          ORDER BY "invoiceDate" DESC, "createdAt" DESC, id DESC
          LIMIT ${limit} OFFSET ${(page - 1) * limit}`);
      const invoices = await tx.invoice.findMany({
        where: {
          businessId: business.id,
          id: { in: rows.map((row) => row.id) },
        },
        orderBy: [
          { invoiceDate: "desc" },
          { createdAt: "desc" },
          { id: "desc" },
        ],
        include: {
          customer: {
            select: {
              id: true,
              name: true,
              email: true,
              phone: true,
              state: true,
            },
          },
        },
      });
      return {
        invoices,
        totalCount: Number(counts[0].count),
        paidById: new Map(rows.map((row) => [row.id, row.paid])),
      };
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
  );
}
