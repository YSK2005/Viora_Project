import { ErrorCode } from "../utils/errorCodes";
import { prisma, Prisma } from "../config/prisma";
import { AppError } from "../middlewares/errorHandler";
import { round2, toDecimal } from "../utils/money";
export interface CreditInput {
  invoiceId: string;
  reason: string;
  requestKey: string;
  items: Array<{ invoiceItemId: string; quantity: number }>;
}
export async function issueCredit(
  businessId: string,
  userId: string,
  input: CreditInput,
) {
  return prisma.$transaction(
    async (tx) => {
      await tx.$queryRaw`SELECT id FROM invoices WHERE id=${input.invoiceId} AND "businessId"=${businessId} FOR UPDATE`;
      const invoice = await tx.invoice.findFirst({
        where: { id: input.invoiceId, businessId },
        include: { items: { include: { creditItems: true } } },
      });
      if (!invoice)
        throw new AppError(
          "Invoice not found",
          404,
          ErrorCode.ERR_INVOICE_NOT_FOUND,
        );
      if (invoice.status !== "ISSUED")
        throw new AppError(
          "Only issued invoices can be credited",
          409,
          ErrorCode.ERR_CREDIT_STATUS,
        );
      const prior = await tx.creditNote.findUnique({
        where: {
          businessId_requestKey: { businessId, requestKey: input.requestKey },
        },
      });
      if (prior)
        throw new AppError(
          "Credit request already processed. Refresh the credit list.",
          409,
          ErrorCode.ERR_DUPLICATE_CREDIT,
        );
      const seen = new Set<string>();
      const items = input.items.map((request) => {
        if (seen.has(request.invoiceItemId))
          throw new AppError(
            "Duplicate invoice line",
            400,
            ErrorCode.ERR_CREDIT_LINE,
          );
        seen.add(request.invoiceItemId);
        const line = invoice.items.find(
          (item) => item.id === request.invoiceItemId,
        );
        if (!line)
          throw new AppError(
            "Line does not belong to this invoice",
            400,
            ErrorCode.ERR_CREDIT_LINE,
          );
        const previousQty = line.creditItems.reduce(
          (sum, item) => sum.plus(item.quantity),
          toDecimal(0),
        );
        const nextQty = previousQty.plus(request.quantity);
        if (nextQty.greaterThan(line.quantity))
          throw new AppError(
            "Credit quantity exceeds remaining invoiced quantity",
            409,
            ErrorCode.ERR_CREDIT_QUANTITY,
          );
        const allocate = (
          field: "taxableAmount" | "cgstAmount" | "sgstAmount" | "igstAmount",
        ) =>
          round2(line[field].times(nextQty).div(line.quantity)).minus(
            line.creditItems.reduce(
              (sum, item) => sum.plus(item[field]),
              toDecimal(0),
            ),
          );
        const taxableAmount = allocate("taxableAmount"),
          cgstAmount = allocate("cgstAmount"),
          sgstAmount = allocate("sgstAmount"),
          igstAmount = allocate("igstAmount");
        const taxAmount = cgstAmount.plus(sgstAmount).plus(igstAmount);
        return {
          invoiceItemId: line.id,
          description: line.descriptionSnapshot,
          quantity: toDecimal(request.quantity),
          taxableAmount,
          cgstAmount,
          sgstAmount,
          igstAmount,
          taxAmount,
          total: taxableAmount.plus(taxAmount),
        };
      });
      const total = items.reduce(
        (sum, item) => sum.plus(item.total),
        toDecimal(0),
      );
      if (
        total.lessThanOrEqualTo(0) ||
        invoice.creditedTotal.plus(total).greaterThan(invoice.grandTotal)
      )
        throw new AppError(
          "Invalid credit amount",
          400,
          ErrorCode.ERR_CREDIT_AMOUNT,
        );
      const business = await tx.business.update({
        where: { id: businessId },
        data: { nextCreditNumber: { increment: 1 } },
      });
      const note = await tx.creditNote.create({
        data: {
          businessId,
          invoiceId: invoice.id,
          number:
            "CN-" + String(business.nextCreditNumber - 1).padStart(6, "0"),
          reason: input.reason,
          requestKey: input.requestKey,
          createdByUserId: userId,
          total,
          taxableAmount: items.reduce(
            (s, i) => s.plus(i.taxableAmount),
            toDecimal(0),
          ),
          taxAmount: items.reduce((s, i) => s.plus(i.taxAmount), toDecimal(0)),
          items: { create: items },
        },
        include: { items: true },
      });
      await tx.invoice.update({
        where: { id: invoice.id },
        data: { creditedTotal: { increment: total } },
      });
      await tx.auditLog.create({
        data: {
          businessId,
          userId,
          action: "CREDIT_NOTE_ISSUE",
          entityType: "CREDIT_NOTE",
          entityId: note.id,
          details: {
            invoiceId: invoice.id,
            number: note.number,
            total: total.toString(),
            reason: note.reason,
          },
        },
      });
      return note;
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted },
  );
}
