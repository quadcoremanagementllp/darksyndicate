import { prisma } from './prisma';

export type AuditActionType =
  | 'CREATE'
  | 'UPDATE'
  | 'DELETE'
  | 'LOGIN'
  | 'LOGOUT'
  | 'STATUS_CHANGE'
  | 'PAYMENT'
  | 'REFUND';

export interface LogAuditParams {
  userId?: string | null;
  action: AuditActionType;
  entityType: string;
  entityId: string;
  oldValue?: Record<string, any> | null;
  newValue?: Record<string, any> | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}

/**
 * Persists an entry to the system audit trail.
 * Wraps in a safe try-catch so audit recording failure does not abort parent business logic.
 */
export async function logAudit(params: LogAuditParams): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        userId: params.userId || null,
        action: params.action,
        entityType: params.entityType,
        entityId: params.entityId,
        oldValue: params.oldValue ?? undefined,
        newValue: params.newValue ?? undefined,
        ipAddress: params.ipAddress || null,
        userAgent: params.userAgent || null,
      },
    });
  } catch (err) {
    // Non-blocking log in demo/development or when DB is unreachable
    console.warn('[AuditLog] Failed to persist audit record:', err);
  }
}
