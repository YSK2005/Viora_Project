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

/**
 * Validates strictly whether a string is a legitimate calendar date in YYYY-MM-DD format.
 * Correctly rejects non-existent dates like February 31 or April 31.
 */
export function isValidISODateString(val: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(val)) return false;
  const parts = val.split('-').map(Number);
  const year = parts[0];
  const month = parts[1];
  const day = parts[2];
  if (month < 1 || month > 12) return false;
  if (year < 2000 || year > 2100) return false;

  // Maximum valid days in the given month (month is 1-indexed here, day 0 of month gives last day of prev month)
  const maxDays = new Date(year, month, 0).getDate();
  return day >= 1 && day <= maxDays;
}

/**
 * Safely parses a YYYY-MM-DD date string at midday to prevent any timezone off-by-one errors.
 */
export function parseISODate(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d, 12, 0, 0);
}

/**
 * Formats a Date object as YYYY-MM-DD.
 */
export function formatDateISO(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Computes the target date with proper month-end clamping.
 * e.g., Jan 31 + 1 month clamps to Feb 28 (or 29), avoiding skipping into March.
 */
export function formatTargetMonthEnd(targetYear: number, targetMonth: number, desiredDay: number): string {
  // Normalize year and month
  const base = new Date(targetYear, targetMonth, 1);
  const finalYear = base.getFullYear();
  const finalMonth = base.getMonth();

  // Find max days in the target month
  const maxDays = new Date(finalYear, finalMonth + 1, 0).getDate();
  const finalDay = Math.min(desiredDay, maxDays);

  const mm = String(finalMonth + 1).padStart(2, '0');
  const dd = String(finalDay).padStart(2, '0');
  return `${finalYear}-${mm}-${dd}`;
}

/**
 * Calculates the next recurrence date from a given base date with month-end safety.
 */
export function calculateNextDate(from: Date, frequency: RecurrenceFrequency): string {
  const year = from.getFullYear();
  const month = from.getMonth();
  const day = from.getDate();

  switch (frequency) {
    case 'WEEKLY': {
      const d = new Date(from.getTime());
      d.setDate(d.getDate() + 7);
      return formatDateISO(d);
    }
    case 'MONTHLY':
      return formatTargetMonthEnd(year, month + 1, day);
    case 'QUARTERLY':
      return formatTargetMonthEnd(year, month + 3, day);
    case 'ANNUALLY':
      return formatTargetMonthEnd(year + 1, month, day);
  }
}

/**
 * Retrieves all active/paused schedules for a business.
 * Handles deletions correctly: deleted schedule IDs are permanently excluded so older CREATE logs never resurrect them.
 */
export async function listRecurringSchedules(businessId: string): Promise<RecurringSchedule[]> {
  const logs = await prisma.auditLog.findMany({
    where: {
      businessId,
      entityType: 'RECURRING_SCHEDULE',
    },
    orderBy: { createdAt: 'desc' },
  });

  const schedulesMap = new Map<string, RecurringSchedule>();
  const deletedIds = new Set<string>();

  for (const log of logs) {
    const details = log.details as any;
    const entityId = log.entityId || details?.id;
    if (!entityId) continue;

    if (log.action === 'DELETE') {
      deletedIds.add(entityId);
      schedulesMap.delete(entityId);
      continue;
    }

    // If schedule has been deleted in a later log, do not let older CREATE/TRIGGER/UPDATE logs restore it
    if (deletedIds.has(entityId)) {
      continue;
    }

    // Since logs are ordered descending, the first encountered non-deleted log represents the latest state
    if (!schedulesMap.has(entityId) && details && details.id) {
      schedulesMap.set(entityId, details as RecurringSchedule);
    }
  }

  return Array.from(schedulesMap.values());
}

/**
 * Retrieves a single recurring schedule by ID.
 */
export async function getRecurringSchedule(
  businessId: string,
  scheduleId: string
): Promise<RecurringSchedule | null> {
  const schedules = await listRecurringSchedules(businessId);
  return schedules.find((s) => s.id === scheduleId) || null;
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

  let nextRunDate: string;
  if (startDate) {
    if (!isValidISODateString(startDate)) {
      throw new AppError(
        'Invalid start date format or non-existent calendar date (expected YYYY-MM-DD)',
        400,
        ErrorCode.ERR_INVALID_DATE_FORMAT
      );
    }
    nextRunDate = startDate;
  } else {
    nextRunDate = calculateNextDate(new Date(), frequency);
  }

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
  scheduleId: string,
  requestKey?: string
): Promise<{ invoice: any; schedule: RecurringSchedule; isIdempotentReplay?: boolean }> {
  const schedule = await getRecurringSchedule(businessId, scheduleId);

  if (!schedule) {
    throw new AppError('Recurring schedule not found', 404, ErrorCode.ERR_RECORD_NOT_FOUND);
  }

  // Guard: Paused schedules must NOT be triggered
  if (schedule.status === 'PAUSED') {
    throw new AppError(
      'Cannot trigger a paused recurring schedule. Resume the schedule before triggering.',
      400,
      ErrorCode.ERR_INVALID_INVOICE_STATUS
    );
  }

  // Idempotency check: check recent triggers for matching requestKey
  const recentTriggerLogs = await prisma.auditLog.findMany({
    where: {
      businessId,
      entityType: 'RECURRING_SCHEDULE',
      entityId: scheduleId,
      action: 'TRIGGER',
    },
    orderBy: { createdAt: 'desc' },
    take: 10,
  });

  if (requestKey) {
    const existingTrigger = recentTriggerLogs.find((l) => {
      const det = l.details as any;
      return det?.triggerRequestKey === requestKey;
    });

    if (existingTrigger) {
      const det = existingTrigger.details as any;
      const existingDraft = await prisma.invoice.findFirst({
        where: { id: det.generatedInvoiceId, businessId },
        include: { customer: true, items: true },
      });
      if (existingDraft) {
        return { invoice: existingDraft, schedule, isIdempotentReplay: true };
      }
    }
  }

  // Rapid trigger debouncing guard: prevent accidental duplicate drafts within 5 seconds without a new request key
  if (schedule.lastRunAt) {
    const timeSinceLastRun = Date.now() - new Date(schedule.lastRunAt).getTime();
    if (timeSinceLastRun >= 0 && timeSinceLastRun < 5000 && !requestKey) {
      throw new AppError(
        'A trigger request was executed within the last 5 seconds. To prevent duplicate invoices, please wait before triggering again or provide an Idempotency-Key.',
        409,
        ErrorCode.ERR_RATE_LIMIT
      );
    }
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

  const baseNextDate = isValidISODateString(schedule.nextRunDate)
    ? parseISODate(schedule.nextRunDate)
    : now;
  const nextRunDate = calculateNextDate(baseNextDate, schedule.frequency);

  const updatedSchedule: RecurringSchedule = {
    ...schedule,
    lastRunAt: now.toISOString(),
    nextRunDate,
  };

  // Atomic transaction: invoice creation AND schedule trigger update commit together
  const result = await prisma.$transaction(async (tx) => {
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

    await tx.auditLog.create({
      data: {
        businessId,
        userId: userId || null,
        action: 'TRIGGER',
        entityType: 'RECURRING_SCHEDULE',
        entityId: scheduleId,
        details: {
          ...updatedSchedule,
          generatedInvoiceId: draft.id,
          generatedInvoiceNumber: draft.invoiceNumber,
          triggerRequestKey: requestKey || null,
        } as any,
      },
    });

    return { invoice: draft, schedule: updatedSchedule };
  });

  return result;
}

export async function toggleRecurringSchedule(
  businessId: string,
  userId: string | undefined,
  scheduleId: string
): Promise<RecurringSchedule> {
  const schedule = await getRecurringSchedule(businessId, scheduleId);

  if (!schedule) {
    throw new AppError('Recurring schedule not found', 404, ErrorCode.ERR_RECORD_NOT_FOUND);
  }

  const newStatus = schedule.status === 'ACTIVE' ? 'PAUSED' : 'ACTIVE';
  const updated: RecurringSchedule = {
    ...schedule,
    status: newStatus,
  };

  await prisma.auditLog.create({
    data: {
      businessId,
      userId: userId || null,
      action: newStatus === 'ACTIVE' ? 'RESUME' : 'PAUSE',
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
  const schedule = await getRecurringSchedule(businessId, scheduleId);

  if (!schedule) {
    throw new AppError('Recurring schedule not found', 404, ErrorCode.ERR_RECORD_NOT_FOUND);
  }

  await prisma.auditLog.create({
    data: {
      businessId,
      userId: userId || null,
      action: 'DELETE',
      entityType: 'RECURRING_SCHEDULE',
      entityId: scheduleId,
      details: { id: scheduleId, deletedAt: new Date().toISOString() },
    },
  });
}
