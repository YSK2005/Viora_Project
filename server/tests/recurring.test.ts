// @vitest-environment node
import { describe, it, expect, vi } from 'vitest';
import {
  isValidISODateString,
  calculateNextDate,
  formatTargetMonthEnd,
  parseISODate,
  listRecurringSchedules,
  triggerRecurringSchedule,
} from '../src/repositories/recurring.repository';
import { prisma } from '../src/config/prisma';
import { AppError } from '../middlewares/errorHandler';
import { ErrorCode } from '../utils/errorCodes';

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

  it('clamps month-end dates correctly instead of skipping into subsequent months', () => {
    // Jan 31 + 1 month should clamp to Feb 28 in 2026 (NOT March 3)
    const jan31 = parseISODate('2026-01-31');
    expect(calculateNextDate(jan31, 'MONTHLY')).toBe('2026-02-28');

    // In a leap year, Jan 31 + 1 month should clamp to Feb 29
    const jan31Leap = parseISODate('2024-01-31');
    expect(calculateNextDate(jan31Leap, 'MONTHLY')).toBe('2024-02-29');

    // Aug 31 + 1 month should clamp to Sep 30
    const aug31 = parseISODate('2026-08-31');
    expect(calculateNextDate(aug31, 'MONTHLY')).toBe('2026-09-30');

    // Jan 31 + 3 months (QUARTERLY) should clamp to April 30 (NOT May 1)
    expect(calculateNextDate(jan31, 'QUARTERLY')).toBe('2026-04-30');

    // Feb 29 2024 + 1 year (ANNUALLY) should clamp to Feb 28 2025
    const feb29Leap = parseISODate('2024-02-29');
    expect(calculateNextDate(feb29Leap, 'ANNUALLY')).toBe('2025-02-28');

    // Weekly advances by exactly 7 days
    const jan15 = parseISODate('2026-01-15');
    expect(calculateNextDate(jan15, 'WEEKLY')).toBe('2026-01-22');
  });
});

describe('Recurring Invoices: Deletion Safety & Reappearance Prevention', () => {
  it('does not resurrect deleted schedules even if older CREATE records exist', async () => {
    const businessId = 'bus_test_123';
    const scheduleId = 'rec_deleted_item_1';

    // Mock audit logs ordered DESC (latest first)
    // 1. Latest log: DELETE
    // 2. Older log: CREATE
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
      // Another schedule that was NOT deleted
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

    // Only the active item should be returned; the deleted one must NOT be resurrected
    expect(schedules.find((s) => s.id === scheduleId)).toBeUndefined();
    expect(schedules.find((s) => s.id === 'rec_active_item_2')).toBeDefined();
    expect(schedules.length).toBe(1);
  });
});

describe('Recurring Invoices: Paused State & Guard Protection', () => {
  it('rejects trigger attempts on PAUSED schedules with ERR_INVALID_STATUS', async () => {
    const businessId = 'bus_test_123';
    const scheduleId = 'rec_paused_item_1';

    // Mock logs returning a PAUSED schedule
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
});
