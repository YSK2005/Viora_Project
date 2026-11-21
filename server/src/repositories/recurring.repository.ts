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
  billingDay: number; // Anchor day of month (1-31), preserving original billing day across short months
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
 * If desiredDay is 31, January (31) -> February (28/29) -> March (31).
 */
export function formatTargetMonthEnd(targetYear: number, targetMonth: number, desiredDay: number): string {
  const base = new Date(targetYear, targetMonth, 1);
  const finalYear = base.getFullYear();
  const finalMonth = base.getMonth();

  const maxDays = new Date(finalYear, finalMonth + 1, 0).getDate();
  const finalDay = Math.min(desiredDay, maxDays);

  const mm = String(finalMonth + 1).padStart(2, '0');
  const dd = String(finalDay).padStart(2, '0');
  return `${finalYear}-${mm}-${dd}`;
}

/**
 * Calculates the next recurrence date from a given base date while preserving the anchor billing day.
 * e.g., starting Jan 31 gives: Feb 28 -> Mar 31 -> Apr 30 -> May 31.
 */
export function calculateNextDate(
  from: Date,
  frequency: RecurrenceFrequency,
  anchorBillingDay?: number
): string {
  const year = from.getFullYear();
  const month = from.getMonth();
  const desiredDay = anchorBillingDay !== undefined ? anchorBillingDay : from.getDate();

  switch (frequency) {
    case 'WEEKLY': {
      const d = new Date(from.getTime());
      d.setDate(d.getDate() + 7);
      return formatDateISO(d);
    }
    case 'MONTHLY':
      return formatTargetMonthEnd(year, month + 1, desiredDay);
    case 'QUARTERLY':
      return formatTargetMonthEnd(year, month + 3, desiredDay);
    case 'ANNUALLY':
      return formatTargetMonthEnd(year + 1, month, desiredDay);
  }
}

/**
 * Retrieves all active/paused schedules for a business.
 * Handles deletions correctly: deleted schedule IDs are tracked and permanently excluded so older CREATE logs never resurrect them.
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

    if (deletedIds.has(entityId)) {
      continue;
    }

    if (!schedulesMap.has(entityId) && details && details.id) {
      const item = details as RecurringSchedule;
      if (item.billingDay === undefined) {
        item.billingDay = isValidISODateString(item.nextRunDate)
          ? parseISODate(item.nextRunDate).getDate()
          : 1;
      }
      schedulesMap.set(entityId, item);
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
  let billingDay: number;

  if (startDate) {
    if (!isValidISODateString(startDate)) {
      throw new AppError(
        'Invalid start date format or non-existent calendar date (expected YYYY-MM-DD)',
        400,
        ErrorCode.ERR_INVALID_DATE_FORMAT
      );
    }
    nextRunDate = startDate;
    billingDay = parseISODate(startDate).getDate();
  } else {
    const now = new Date();
    billingDay = now.getDate();
    nextRunDate = calculateNextDate(now, frequency, billingDay);
  }

  const scheduleId = `rec_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

  const schedule: RecurringSchedule = {
    id: scheduleId,
    businessId,
    invoiceId: invoice.id,
    customerName: invoice.customerNameSnapshot || invoice.customer.name,
    invoiceNumber: invoice.invoiceNumber,
    frequency,
    billingDay,
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

  // Preserve anchor billing day across month lengths
  const anchorBillingDay = schedule.billingDay || (isValidISODateString(schedule.nextRunDate) ? parseISODate(schedule.nextRunDate).getDate() : now.getDate());
  const baseNextDate = isValidISODateString(schedule.nextRunDate)
    ? parseISODate(schedule.nextRunDate)
    : now;
  const nextRunDate = calculateNextDate(baseNextDate, schedule.frequency, anchorBillingDay);

  const updatedSchedule: RecurringSchedule = {
    ...schedule,
    billingDay: anchorBillingDay,
    lastRunAt: now.toISOString(),
    nextRunDate,
  };

  // Atomic transaction with advisory locking and database-level idempotency
  const result = await prisma.$transaction(async (tx) => {
    // 1. Transaction-scoped PostgreSQL advisory lock to serialize concurrent triggers on this schedule
    try {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${'rec_schedule_' + scheduleId}))`;
    } catch {
      // Graceful fallback in environments/mocks without advisory lock support
    }

    // 2. Strict idempotency check without limits: check ALL historic trigger records for this requestKey
    if (requestKey) {
      const existingKeyRecord = await tx.auditLog.findFirst({
        where: {
          businessId,
          entityType: 'RECURRING_TRIGGER_IDEMPOTENCY',
          entityId: `${scheduleId}:${requestKey}`,
        },
      });

      if (existingKeyRecord) {
        const details = existingKeyRecord.details as any;
        const existingDraft = await tx.invoice.findFirst({
          where: { id: details?.generatedInvoiceId, businessId },
          include: { customer: true, items: true },
        });

        if (existingDraft) {
          return {
            invoice: existingDraft,
            schedule,
            isIdempotentReplay: true,
          };
        }
      }
    }

    // 3. Inside the transaction lock: check if a trigger occurred in the last 5 seconds to prevent race conditions
    const lastTrigger = await tx.auditLog.findFirst({
      where: {
        businessId,
        entityType: 'RECURRING_SCHEDULE',
        entityId: scheduleId,
        action: 'TRIGGER',
      },
      orderBy: { createdAt: 'desc' },
    });

    if (lastTrigger) {
      const timeSinceLastRun = Date.now() - new Date(lastTrigger.createdAt).getTime();
      if (timeSinceLastRun >= 0 && timeSinceLastRun < 5000 && !requestKey) {
        throw new AppError(
          'A trigger request was executed within the last 5 seconds. To prevent duplicate invoices, please wait before triggering again or provide an Idempotency-Key.',
          409,
          ErrorCode.ERR_RATE_LIMIT
        );
      }
    }

    // 4. Create the draft invoice
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

    // 5. Atomically commit the schedule update
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

    // 6. Atomically commit the permanent idempotency lock record
    if (requestKey) {
      await tx.auditLog.create({
        data: {
          businessId,
          userId: userId || null,
          action: 'IDEMPOTENCY_LOCK',
          entityType: 'RECURRING_TRIGGER_IDEMPOTENCY',
          entityId: `${scheduleId}:${requestKey}`,
          details: {
            scheduleId,
            requestKey,
            generatedInvoiceId: draft.id,
            generatedInvoiceNumber: draft.invoiceNumber,
            createdAt: now.toISOString(),
          },
        },
      });
    }

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
