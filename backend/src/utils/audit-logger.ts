import prisma from '../lib/prisma-client.js';

interface AuditEntry {
  actorUserId?: string;
  action: string;
  targetType?: string;
  targetId?: string;
  metadata?: Record<string, unknown>;
  ip?: string;
}

export async function logAudit(entry: AuditEntry): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        action: entry.action,
        targetType: entry.targetType,
        targetId: entry.targetId,
        metadata: entry.metadata ? JSON.parse(JSON.stringify(entry.metadata)) : undefined,
        ip: entry.ip,
        ...(entry.actorUserId ? { actor: { connect: { id: entry.actorUserId } } } : {}),
      },
    });
  } catch (err) {
    console.error('Audit log write failed:', err);
  }
}
