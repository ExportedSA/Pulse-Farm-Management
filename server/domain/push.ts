import webpush from 'web-push';
import { db } from '../db';
import { pushSubscriptions } from '@shared/schema';
import { and, eq, inArray } from 'drizzle-orm';
import logger from '../config/logger';

// Phone push notifications (Web Push). Each device that turns notifications on is saved;
// every in-app notification is also sent to that person's devices.

// Read on first use, so it doesn't matter when .env is loaded
let ready: boolean | null = null;
function setUp(): boolean {
  if (ready === null) {
    const { VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT } = process.env;
    ready = Boolean(VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY);
    if (ready) webpush.setVapidDetails(VAPID_SUBJECT || 'mailto:admin@pulse.local', VAPID_PUBLIC_KEY!, VAPID_PRIVATE_KEY!);
  }
  return ready;
}

export const isPushConfigured = () => setUp();
export const pushPublicKey = () => (setUp() ? process.env.VAPID_PUBLIC_KEY! : null);

export interface DeviceSubscription { endpoint: string; keys: { p256dh: string; auth: string } }

export async function saveSubscription(userId: string, sub: DeviceSubscription, userAgent?: string) {
  // A device that was used by someone else now belongs to whoever signed in on it
  await db
    .insert(pushSubscriptions)
    .values({ userId, endpoint: sub.endpoint, p256dh: sub.keys.p256dh, auth: sub.keys.auth, userAgent: userAgent?.slice(0, 255) })
    .onConflictDoUpdate({
      target: pushSubscriptions.endpoint,
      set: { userId, p256dh: sub.keys.p256dh, auth: sub.keys.auth, userAgent: userAgent?.slice(0, 255) },
    });
}

export async function removeSubscription(userId: string, endpoint: string): Promise<boolean> {
  const rows = await db
    .delete(pushSubscriptions)
    .where(and(eq(pushSubscriptions.userId, userId), eq(pushSubscriptions.endpoint, endpoint)))
    .returning({ id: pushSubscriptions.id });
  return rows.length > 0;
}

export async function countDevices(userId: string): Promise<number> {
  const rows = await db.select({ id: pushSubscriptions.id }).from(pushSubscriptions).where(eq(pushSubscriptions.userId, userId));
  return rows.length;
}

export interface PushMessage { title: string; body: string; link?: string; tag?: string; urgent?: boolean }

/**
 * Send to every device of these people. Devices the push service says are gone are forgotten.
 * Returns how many devices accepted it.
 */
export async function sendPush(userIds: string[], message: PushMessage): Promise<number> {
  if (!setUp() || userIds.length === 0) return 0;
  const devices = await db.select().from(pushSubscriptions).where(inArray(pushSubscriptions.userId, userIds));
  const payload = JSON.stringify(message);
  let delivered = 0;
  await Promise.all(devices.map(async device => {
    try {
      await webpush.sendNotification(
        { endpoint: device.endpoint, keys: { p256dh: device.p256dh, auth: device.auth } },
        payload,
        { TTL: 24 * 60 * 60, urgency: message.urgent ? 'high' : 'normal' },
      );
      delivered++;
      await db.update(pushSubscriptions).set({ lastUsedAt: new Date() }).where(eq(pushSubscriptions.id, device.id));
    } catch (error: any) {
      if (error?.statusCode === 404 || error?.statusCode === 410) {
        await db.delete(pushSubscriptions).where(eq(pushSubscriptions.id, device.id));
      } else {
        logger.warn({ err: error, userId: device.userId }, 'Push notification failed');
      }
    }
  }));
  return delivered;
}
