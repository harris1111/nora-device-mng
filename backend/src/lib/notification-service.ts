/**
 * Persists a notification row, then broadcasts it via SSE to the recipient.
 * If userId is null, the notification is created once per ADMIN/SADMIN user
 * (each receives their own row + push) so the read-state is per-user.
 */
import prisma from './prisma-client.js';
import { publishToUser } from './notification-hub.js';

export interface CreateNotificationInput {
  userId: string | null;          // null => fan out to all admins
  type: string;
  title: string;
  message: string;
  link?: string | null;
  sourceType?: string | null;
  sourceId?: string | null;
}

function mapNotification(n: {
  id: string; type: string; title: string; message: string;
  link: string | null; sourceType: string | null; sourceId: string | null;
  isRead: boolean; readAt: Date | null; createdAt: Date;
}) {
  return {
    id: n.id,
    type: n.type,
    title: n.title,
    message: n.message,
    link: n.link,
    source_type: n.sourceType,
    source_id: n.sourceId,
    is_read: n.isRead,
    read_at: n.readAt?.toISOString() || null,
    created_at: n.createdAt.toISOString(),
  };
}

export async function createNotification(input: CreateNotificationInput): Promise<void> {
  const { userId, type, title, message, link, sourceType, sourceId } = input;

  const targetUsers = userId
    ? [{ id: userId }]
    : await prisma.user.findMany({
        where: { role: { in: ['SADMIN', 'ADMIN'] }, status: 'ACTIVE' },
        select: { id: true },
      });

  for (const u of targetUsers) {
    const notif = await prisma.notification.create({
      data: {
        userId: u.id,
        type,
        title,
        message,
        link: link ?? null,
        sourceType: sourceType ?? null,
        sourceId: sourceId ?? null,
      },
    });
    publishToUser(u.id, 'notification', mapNotification(notif));
  }
}

export { mapNotification };
