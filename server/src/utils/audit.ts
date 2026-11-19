import { prisma } from '../config/prisma';

export interface AuditLogOptions {
  businessId: string;
  userId?: string | null;
  action: string;
  entityType: 'INVOICE' | 'PAYMENT' | 'CUSTOMER' | 'PRODUCT' | 'BUSINESS' | 'AUTH';
  entityId: string;
  details?: any;
  ipAddress?: string | null;
}

/**
 * Creates an immutable audit trail record for critical financial and entity actions.
 */
export async function logAuditEvent(
  options: AuditLogOptions,
  tx?: any
): Promise<void> {
  const client = tx || prisma;
  try {
    await client.auditLog.create({
      data: {
        businessId: options.businessId,
        userId: options.userId || null,
        action: options.action,
        entityType: options.entityType,
        entityId: options.entityId,
        details: options.details ?? undefined,
        ipAddress: options.ipAddress || null,
      },
    });
  } catch (err) {
    console.error('Failed to write audit log entry:', err);
  }
}
