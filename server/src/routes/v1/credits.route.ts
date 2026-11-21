import { ErrorCode } from "../../utils/errorCodes";
import { Router, Response, NextFunction } from "express";
import { z } from "zod";
import { prisma } from "../../config/prisma";
import { AuthenticatedRequest, requireRole } from "../../middlewares/auth";
import { validateRequest } from "../../middlewares/validate";
import { sendSuccess } from "../../utils/response";
import { issueCredit } from "../../repositories/creditNotes.repository";
import { AppError } from "../../middlewares/errorHandler";
const router = Router();
const paging = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
const body = z.object({
  invoiceId: z.string().uuid(),
  reason: z.string().trim().min(3).max(500),
  requestKey: z.string().min(8).max(100),
  items: z
    .array(
      z.object({
        invoiceItemId: z.string().uuid(),
        quantity: z
          .number()
          .positive()
          .refine(
            (q) => Math.abs(q * 1000 - Math.round(q * 1000)) < 0.000001,
            "Use up to 3 decimal places",
          ),
      }),
    )
    .min(1)
    .max(100),
});
router.get(
  "/",
  validateRequest({ query: paging }),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { page, limit } = req.query as unknown as z.infer<typeof paging>,
        where = { businessId: req.business.id };
      const [totalCount, notes] = await prisma.$transaction([
        prisma.creditNote.count({ where }),
        prisma.creditNote.findMany({
          where,
          skip: (page - 1) * limit,
          take: limit,
          orderBy: [{ issuedAt: "desc" }, { id: "desc" }],
          include: {
            invoice: { select: { invoiceNumber: true } },
            items: true,
          },
        }),
      ]);
      return sendSuccess(res, {
        notes,
        pagination: {
          page,
          limit,
          totalCount,
          totalPages: Math.max(1, Math.ceil(totalCount / limit)),
        },
      });
    } catch (error) {
      next(error);
    }
  },
);
router.get(
  "/eligible/:id",
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const invoice = await prisma.invoice.findFirst({
        where: { id: req.params.id, businessId: req.business.id },
        include: {
          items: { include: { creditItems: { select: { quantity: true } } } },
        },
      });
      if (!invoice)
        throw new AppError(
          "Invoice not found",
          404,
          ErrorCode.ERR_INVOICE_NOT_FOUND,
        );
      return sendSuccess(res, {
        ...invoice,
        items: invoice.items.map((line) => ({
          ...line,
          remainingQuantity:
            Number(line.quantity) -
            line.creditItems.reduce((s, i) => s + Number(i.quantity), 0),
        })),
      });
    } catch (error) {
      next(error);
    }
  },
);
router.post(
  "/",
  requireRole(["OWNER", "ACCOUNTANT"]),
  validateRequest({ body }),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      return sendSuccess(
        res,
        await issueCredit(req.business.id, req.user!.id, req.body),
        "Credit note issued",
        201,
      );
    } catch (error) {
      next(error);
    }
  },
);
export const creditsRouter = router;
