import { prisma } from '../config/prisma';
import { calculateInvoiceTotals } from '../utils/money';
import { AppError } from '../middlewares/errorHandler';
import { ErrorCode } from '../utils/errorCodes';

export type RecurrenceFrequency = 'WEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'ANNUALLY';

export interface RecurringSchedule {
  id: string;
  businessId: string;
  invoiceId: string;
  customerName: string;
  invoiceNumber: string;
  frequency: RecurrenceFrequency;
  nextRunDate: string;
  lastRunAt?: string;
  status: 'ACTIVE' | 'PAUSED';
  grandTotal: number;
  itemsCount: number;
  createdAt: string;
}

function calculateNextDate(from: Date, frequency: RecurrenceFrequency): string {
  const d = new Date(from);
  switch (frequency) {
    case 'WEEKLY':
      d.setDate(d.getDate() + 7);
      break;
    case 'MONTHLY':
      d.setMonth(d.getMonth() + 1);
      break;
    case 'QUARTERLY':
      d.setMonth(d.getMonth() + 3);
      break;
    case 'ANNUALLY':
      d.setFullYear(d.getFullYear() + 1);
      break;
  }
  return d.toISOString().split('T')[0];
}

export async function listRecurringSchedules(businessId: string): Promise<RecurringSchedule[]> {
  const logs = await prisma.auditLog.findMany({
    where: {
      businessId,
      entityType: 'RECURRING_SCHEDULE',
    },
    orderBy: { createdAt: 'desc' },
  });

  const schedulesMap = new Map<string, RecurringSchedule>();

  for (const log of logs) {
    const details = log.details as any;
    if (!details || !details.id) continue;

    if (log.action === 'DELETE') {
      schedulesMap.delete(details.id);
    } else if (!schedulesMap.has(details.id)) {
      schedulesMap.set(details.id, details as RecurringSchedule);
    }
  }

  return Array.from(schedulesMap.values());
}

export async function createRecurringSchedule(
  businessId: string,
  userId: string | undefined,
  invoiceId: string,
  frequency: RecurrenceFrequency,
  startDate?: string
): Promise<RecurringSchedule> {
  const invoice = await prisma.invoice.findFirst({
    where: { id: invoiceId, businessId },
    include: {
      customer: true,
      items: true,
    },
  });

  if (!invoice) {
    throw new AppError('Template invoice not found', 404, ErrorCode.ERR_INVOICE_NOT_FOUND);
  }

  const baseDate = startDate ? new Date(startDate) : new Date();
  const nextRunDate = calculateNextDate(baseDate, frequency);
  const scheduleId = `rec_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

  const schedule: RecurringSchedule = {
    id: scheduleId,
    businessId,
    invoiceId: invoice.id,
    customerName: invoice.customerNameSnapshot || invoice.customer.name,
    invoiceNumber: invoice.invoiceNumber,
    frequency,
    nextRunDate,
    status: 'ACTIVE',
    grandTotal: Number(invoice.grandTotal),
    itemsCount: invoice.items.length,
    createdAt: new Date().toISOString(),
  };

  await prisma.auditLog.create({
    data: {
      businessId,
      userId: userId || null,
      action: 'CREATE',
      entityType: 'RECURRING_SCHEDULE',
      entityId: scheduleId,
      details: schedule as any,
    },
  });

  return schedule;
}

export async function triggerRecurringSchedule(
  businessId: string,
  userId: string | undefined,
  scheduleId: string
): Promise<{ invoice: any; schedule: RecurringSchedule }> {
  const schedules = await listRecurringSchedules(businessId);
  const schedule = schedules.find((s) => s.id === scheduleId);

  if (!schedule) {
    throw new AppError('Recurring schedule not found', 404, ErrorCode.ERR_RECORD_NOT_FOUND);
  }

  const templateInvoice = await prisma.invoice.findFirst({
    where: { id: schedule.invoiceId, businessId },
    include: { items: true },
  });

  if (!templateInvoice) {
    throw new AppError('Template invoice no longer exists', 404, ErrorCode.ERR_INVOICE_NOT_FOUND);
  }

  // Calculate payment term days
  const origInvoiceDate = templateInvoice.invoiceDate.getTime();
  const origDueDate = templateInvoice.dueDate.getTime();
  const termDays = Math.max(1, Math.round((origDueDate - origInvoiceDate) / (1000 * 60 * 60 * 24)));

  const now = new Date();
  const newInvoiceDate = now;
  const newDueDate = new Date(now.getTime() + termDays * 24 * 60 * 60 * 1000);

  const totals = calculateInvoiceTotals(
    templateInvoice.items.map((item) => ({
      productId: item.productId,
      descriptionSnapshot: item.descriptionSnapshot,
      unit: item.unit,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      discountAmount: item.discountAmount,
      taxRate: item.taxRate,
    })),
    templateInvoice.isInterState
  );

  const newDraft = await prisma.$transaction(async (tx) => {
    const draft = await tx.invoice.create({
      data: {
        businessId,
        customerId: templateInvoice.customerId,
        invoiceNumber: `DRAFT-${Date.now().toString().slice(-6)}`,
        invoiceDate: newInvoiceDate,
        dueDate: newDueDate,
        status: 'DRAFT',
        placeOfSupply: templateInvoice.placeOfSupply,
        isInterState: templateInvoice.isInterState,
        notes: `Automatically generated recurring invoice from ${schedule.invoiceNumber}`,
        subtotal: totals.subtotal,
        discountTotal: totals.discountTotal,
        taxableAmount: totals.taxableAmount,
        cgstTotal: totals.cgstTotal,
        sgstTotal: totals.sgstTotal,
        igstTotal: totals.igstTotal,
        taxTotal: totals.taxTotal,
        grandTotal: totals.grandTotal,
        items: {
          create: totals.items.map((item) => ({
            productId: item.productId,
            descriptionSnapshot: item.descriptionSnapshot,
            unit: item.unit,
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
        customer: true,
        items: true,
      },
    });

    return draft;
  });

  const updatedSchedule: RecurringSchedule = {
    ...schedule,
    lastRunAt: new Date().toISOString(),
    nextRunDate: calculateNextDate(new Date(schedule.nextRunDate), schedule.frequency),
  };

  await prisma.auditLog.create({
    data: {
      businessId,
      userId: userId || null,
      action: 'TRIGGER',
      entityType: 'RECURRING_SCHEDULE',
      entityId: scheduleId,
      details: updatedSchedule as any,
    },
  });

  return { invoice: newDraft, schedule: updatedSchedule };
}

export async function toggleRecurringSchedule(
  businessId: string,
  userId: string | undefined,
  scheduleId: string
): Promise<RecurringSchedule> {
  const schedules = await listRecurringSchedules(businessId);
  const schedule = schedules.find((s) => s.id === scheduleId);

  if (!schedule) {
    throw new AppError('Recurring schedule not found', 404, ErrorCode.ERR_RECORD_NOT_FOUND);
  }

  const updated: RecurringSchedule = {
    ...schedule,
    status: schedule.status === 'ACTIVE' ? 'PAUSED' : 'ACTIVE',
  };

  await prisma.auditLog.create({
    data: {
      businessId,
      userId: userId || null,
      action: updated.status === 'ACTIVE' ? 'RESUME' : 'PAUSE',
      entityType: 'RECURRING_SCHEDULE',
      entityId: scheduleId,
      details: updated as any,
    },
  });

  return updated;
}

export async function deleteRecurringSchedule(
  businessId: string,
  userId: string | undefined,
  scheduleId: string
): Promise<void> {
  await prisma.auditLog.create({
    data: {
      businessId,
      userId: userId || null,
      action: 'DELETE',
      entityType: 'RECURRING_SCHEDULE',
      entityId: scheduleId,
      details: { id: scheduleId },
    },
  });
}
