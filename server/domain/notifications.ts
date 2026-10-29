import { db } from '../db';
import { notifications, type InAppNotification } from '@shared/schema';
import { and, desc, eq, isNull } from 'drizzle-orm';
import { chatWebSocket } from '../websocket';
import logger from '../config/logger';
import { sendPush } from './push';

export type NotificationPriority = 'low' | 'normal' | 'high' | 'urgent';

export interface NewNotification {
  type: string;
  title: string;
  message: string;
  farmId?: string;
  link?: string;
  priority?: NotificationPriority;
  metadata?: Record<string, any>;
}

/**
 * Shape a stored notification for the notification bell
 */
export function toApiNotification(n: InAppNotification) {
  return {
    id: n.id,
    type: n.type,
    title: n.title,
    message: n.message,
    link: n.link ?? undefined,
    priority: n.priority,
    read: n.readAt !== null,
    createdAt: n.createdAt.toISOString(),
    userId: n.userId,
    metadata: n.metadata ?? undefined,
  };
}

/**
 * Store an in-app notification for each user and push it to anyone online
 */
export async function notifyUsers(userIds: string[], notification: NewNotification) {
  const recipients = Array.from(new Set(userIds));
  if (recipients.length === 0) return [];

  const rows = await db
    .insert(notifications)
    .values(recipients.map(userId => ({
      userId,
      farmId: notification.farmId,
      type: notification.type,
      title: notification.title,
      message: notification.message,
      link: notification.link,
      priority: notification.priority ?? 'normal',
      metadata: notification.metadata,
    })))
    .returning();

  for (const row of rows) {
    try {
      chatWebSocket.broadcastNotification(row.userId, toApiNotification(row));
    } catch (error) {
      // Stored notifications still show up the next time the bell loads
      logger.warn({ err: error, userId: row.userId }, 'Failed to push notification over WebSocket');
    }
  }
  // Phones get it too, even with Pulse closed (not awaited: saving the notification shouldn't wait on it)
  sendPush(recipients, {
    title: notification.title,
    body: notification.message,
    link: notification.link,
    tag: notification.metadata?.jobId ? `job-${notification.metadata.jobId}` : undefined,
    urgent: notification.priority === 'high' || notification.priority === 'urgent',
  }).catch(error => logger.warn({ err: error }, 'Phone push failed'));
  return rows;
}

export async function listNotifications(
  userId: string,
  options: { unreadOnly?: boolean; type?: string; limit?: number } = {},
) {
  const conditions = [eq(notifications.userId, userId)];
  if (options.unreadOnly) conditions.push(isNull(notifications.readAt));
  if (options.type) conditions.push(eq(notifications.type, options.type));

  return db
    .select()
    .from(notifications)
    .where(and(...conditions))
    .orderBy(desc(notifications.createdAt))
    .limit(Math.min(options.limit ?? 50, 200));
}

export async function countNotifications(userId: string, unreadOnly: boolean): Promise<number> {
  const conditions = [eq(notifications.userId, userId)];
  if (unreadOnly) conditions.push(isNull(notifications.readAt));
  return db.$count(notifications, and(...conditions));
}

export async function markRead(userId: string, id?: string): Promise<number> {
  const conditions = [eq(notifications.userId, userId), isNull(notifications.readAt)];
  if (id) conditions.push(eq(notifications.id, id));
  const rows = await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(and(...conditions))
    .returning({ id: notifications.id });
  return rows.length;
}

export async function deleteNotifications(userId: string, id?: string): Promise<number> {
  const conditions = [eq(notifications.userId, userId)];
  if (id) conditions.push(eq(notifications.id, id));
  const rows = await db.delete(notifications).where(and(...conditions)).returning({ id: notifications.id });
  return rows.length;
}
