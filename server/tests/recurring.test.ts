// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  isValidISODateString,
  calculateNextDate,
  formatTargetMonthEnd,
  parseISODate,
  listRecurringSchedules,
  triggerRecurringSchedule,
} from '../src/repositories/recurring.repository';
import { prisma } from '../src/config/prisma';
import { AppError } from '../src/middlewares/errorHandler';
import { ErrorCode } from '../src/utils/errorCodes';

describe('Recurring Invoices: Date Validation & Month-End Calculations', () => {
  it('strictly validates ISO date format and rejects nonexistent calendar days', () => {
    // Valid dates
    expect(isValidISODateString('2026-01-31')).toBe(true);
    expect(isValidISODateString('2026-04-30')).toBe(true);
    expect(isValidISODateString('2024-02-29')).toBe(true); // Leap year 2024

    // Nonexistent / Invalid calendar days
    expect(isValidISODateString('2026-02-31')).toBe(false); // Feb never has 31 days
    expect(isValidISODateString('2026-02-29')).toBe(false); // 2026 is not a leap year
    expect(isValidISODateString('2026-04-31')).toBe(false); // April has 30 days
    expect(isValidISODateString('2026-06-31')).toBe(false); // June has 30 days
    expect(isValidISODateString('2026-09-31')).toBe(false); // Sept has 30 days
    expect(isValidISODateString('2026-11-31')).toBe(false); // Nov has 30 days
    expect(isValidISODateString('2026-13-01')).toBe(false); // Month 13 does not exist
    expect(isValidISODateString('2026-00-15')).toBe(false); // Month 0 does not exist
    expect(isValidISODateString('2026-05-00')).toBe(false); // Day 0 does not exist
    expect(isValidISODateString('not-a-date')).toBe(false);
  });

  it('preserves the original anchor billing day across consecutive months (Jan 31 -> Feb 28 -> Mar 31 -> Apr 30 -> May 31)', () => {
    const anchorBillingDay = 31;

    // Step 1: Jan 31 -> Feb 28 (clamped to 28 days in Feb 2026)
    const jan31 = parseISODate('2026-01-31');
    const febNext = calculateNextDate(jan31, 'MONTHLY', anchorBillingDay);
    expect(febNext).toBe('2026-02-28');

    // Step 2: From Feb 28 -> Mar 31 (MUST restore the 31st billing day, NOT stay at March 28)
    const feb28 = parseISODate(febNext);
    const marNext = calculateNextDate(feb28, 'MONTHLY', anchorBillingDay);
    expect(marNext).toBe('2026-03-31');

    // Step 3: From Mar 31 -> Apr 30 (clamped to 30 days in April)
    const mar31 = parseISODate(marNext);
    const aprNext = calculateNextDate(mar31, 'MONTHLY', anchorBillingDay);
    expect(aprNext).toBe('2026-04-30');

    // Step 4: From Apr 30 -> May 31 (MUST restore the 31st billing day, NOT stay at May 30)
    const apr30 = parseISODate(aprNext);
    const mayNext = calculateNextDate(apr30, 'MONTHLY', anchorBillingDay);
    expect(mayNext).toBe('2026-05-31');
  });

  it('clamps leap year anchor dates correctly across annual cycles', () => {
    const feb29Leap = parseISODate('2024-02-29');
    const anchorBillingDay = 29;

    // 2024 (leap) -> 2025: Feb 28
    const next2025 = calculateNextDate(feb29Leap, 'ANNUALLY', anchorBillingDay);
    expect(next2025).toBe('2025-02-28');

    // 2025 -> 2026: Feb 28
    const next2026 = calculateNextDate(parseISODate(next2025), 'ANNUALLY', anchorBillingDay);
    expect(next2026).toBe('2026-02-28');

    // 2027 -> 2028: restores Feb 29 in leap year 2028
    const date2027 = parseISODate('2027-02-28');
    const next2028 = calculateNextDate(date2027, 'ANNUALLY', anchorBillingDay);
    expect(next2028).toBe('2028-02-29');
  });

  it('advances weekly schedules by exactly 7 days', () => {
    const jan15 = parseISODate('2026-01-15');
    expect(calculateNextDate(jan15, 'WEEKLY')).toBe('2026-01-22');
  });
});

describe('Recurring Invoices: Deletion Safety & Reappearance Prevention', () => {
  it('does not resurrect deleted schedules even if older CREATE records exist', async () => {
    const businessId = 'bus_test_123';
    const scheduleId = 'rec_deleted_item_1';

    const mockLogs = [
      {
        id: 'log_3',
        businessId,
        action: 'DELETE',
        entityType: 'RECURRING_SCHEDULE',
        entityId: scheduleId,
        details: { id: scheduleId, deletedAt: '2026-11-21T10:00:00Z' },
        createdAt: new Date('2026-11-21T10:00:00Z'),
      },
      {
        id: 'log_2',
        businessId,
        action: 'TRIGGER',
        entityType: 'RECURRING_SCHEDULE',
        entityId: scheduleId,
        details: { id: scheduleId, invoiceNumber: 'INV-001', status: 'ACTIVE' },
        createdAt: new Date('2026-11-20T10:00:00Z'),
      },
      {
        id: 'log_1',
        businessId,
        action: 'CREATE',
        entityType: 'RECURRING_SCHEDULE',
        entityId: scheduleId,
        details: { id: scheduleId, invoiceNumber: 'INV-001', status: 'ACTIVE' },
        createdAt: new Date('2026-11-19T10:00:00Z'),
      },
      {
        id: 'log_0',
        businessId,
        action: 'CREATE',
        entityType: 'RECURRING_SCHEDULE',
        entityId: 'rec_active_item_2',
        details: { id: 'rec_active_item_2', invoiceNumber: 'INV-002', status: 'ACTIVE' },
        createdAt: new Date('2026-11-19T10:00:00Z'),
      },
    ];

    vi.spyOn(prisma.auditLog, 'findMany').mockResolvedValue(mockLogs as any);

    const schedules = await listRecurringSchedules(businessId);

    expect(schedules.find((s) => s.id === scheduleId)).toBeUndefined();
    expect(schedules.find((s) => s.id === 'rec_active_item_2')).toBeDefined();
    expect(schedules.length).toBe(1);
  });
});

describe('Recurring Invoices: Transaction Atomicity & Idempotency', () => {
  it('rejects trigger attempts on PAUSED schedules with ERR_INVALID_INVOICE_STATUS', async () => {
    const businessId = 'bus_test_123';
    const scheduleId = 'rec_paused_item_1';

    const mockLogs = [
      {
        id: 'log_1',
        businessId,
        action: 'PAUSE',
        entityType: 'RECURRING_SCHEDULE',
        entityId: scheduleId,
        details: {
          id: scheduleId,
          businessId,
          invoiceId: 'inv_1',
          customerName: 'ACME Corp',
          invoiceNumber: 'INV-001',
          frequency: 'MONTHLY',
          billingDay: 1,
          nextRunDate: '2026-12-01',
          status: 'PAUSED',
        },
        createdAt: new Date(),
      },
    ];

    vi.spyOn(prisma.auditLog, 'findMany').mockResolvedValue(mockLogs as any);

    await expect(
      triggerRecurringSchedule(businessId, 'user_1', scheduleId)
    ).rejects.toThrow(
      'Cannot trigger a paused recurring schedule. Resume the schedule before triggering.'
    );
  });

  it('re-returns existing invoice for previously used requestKey across all history without duplicate draft creation', async () => {
    const businessId = 'bus_test_123';
    const scheduleId = 'rec_active_item_1';
    const requestKey = 'idemp_key_historic_999';

    const mockScheduleLog = {
      id: 'log_sched',
      businessId,
      action: 'CREATE',
      entityType: 'RECURRING_SCHEDULE',
      entityId: scheduleId,
      details: {
        id: scheduleId,
        businessId,
        invoiceId: 'inv_template_1',
        customerName: 'ACME Corp',
        invoiceNumber: 'INV-001',
        frequency: 'MONTHLY',
        billingDay: 15,
        nextRunDate: '2026-12-15',
        status: 'ACTIVE',
      },
      createdAt: new Date('2026-10-01T00:00:00Z'),
    };

    vi.spyOn(prisma.auditLog, 'findMany').mockResolvedValue([mockScheduleLog] as any);

    // Mock template invoice
    vi.spyOn(prisma.invoice, 'findFirst').mockResolvedValue({
      id: 'inv_template_1',
      businessId,
      invoiceDate: new Date('2026-10-15'),
      dueDate: new Date('2026-10-30'),
      items: [
        {
          productId: 'prod_1',
          descriptionSnapshot: 'Widget',
          unit: 'PCS',
          quantity: 1,
          unitPrice: 100,
          discountAmount: 0,
          taxRate: 18,
        },
      ],
      customer: { name: 'ACME Corp' },
    } as any);

    const mockExistingDraft = {
      id: 'inv_draft_already_created',
      invoiceNumber: 'DRAFT-999999',
      status: 'DRAFT',
    };

    // Mock $transaction to run callback with mock tx
    vi.spyOn(prisma, '$transaction').mockImplementation(async (cb: any) => {
      const mockTx = {
        $executeRaw: vi.fn().mockResolvedValue(1),
        auditLog: {
          findFirst: vi.fn().mockImplementation(async (query: any) => {
            // Check for idempotency record
            if (query.where?.entityType === 'RECURRING_TRIGGER_IDEMPOTENCY') {
              return {
                id: 'log_idemp_record',
                businessId,
                entityType: 'RECURRING_TRIGGER_IDEMPOTENCY',
                entityId: `${scheduleId}:${requestKey}`,
                details: {
                  generatedInvoiceId: 'inv_draft_already_created',
                  requestKey,
                },
              };
            }
            return null;
          }),
          create: vi.fn(),
        },
        invoice: {
          findFirst: vi.fn().mockResolvedValue(mockExistingDraft),
          create: vi.fn(),
        },
      };
      return cb(mockTx);
    });

    const result = await triggerRecurringSchedule(businessId, 'user_1', scheduleId, requestKey);

    expect(result.isIdempotentReplay).toBe(true);
    expect(result.invoice.id).toBe('inv_draft_already_created');
  });
});
