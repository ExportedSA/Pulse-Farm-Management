import { Router } from 'express';
import { z } from 'zod';
import { deliverNotification } from '../services/notifications';
import { getUserId, getFarmId } from '../middleware/auth';
import { isFarmMember } from '../domain/farms';
import {
  notifyUsers,
  listNotifications,
  countNotifications,
  markRead,
  deleteNotifications,
  toApiNotification,
  type NewNotification,
} from '../domain/notifications';

const router = Router();

// User notification preferences (would be in database)
const userPreferences: Map<string, {
  pushEnabled: boolean;
  emailEnabled: boolean;
  categories: {
    tasks: boolean;
    weather: boolean;
    health: boolean;
    compliance: boolean;
    messages: boolean;
  };
  quietHours: {
    enabled: boolean;
    start: string;
    end: string;
  };
}> = new Map();

// Default preferences
const getDefaultPreferences = () => ({
  pushEnabled: true,
  emailEnabled: true,
  categories: {
    tasks: true,
    weather: true,
    health: true,
    compliance: true,
    messages: true,
  },
  quietHours: {
    enabled: false,
    start: '22:00',
    end: '07:00',
  },
});

// ============================================
// ENDPOINTS
// ============================================

// Get notifications for the signed-in user
router.get('/', async (req, res) => {
  try {
    const userId = getUserId(req)!;
    const { unreadOnly, type, limit } = req.query;
    const rows = await listNotifications(userId, {
      unreadOnly: unreadOnly === 'true',
      type: typeof type === 'string' ? type : undefined,
      limit: Number(limit) || 50,
    });
    res.json({
      notifications: rows.map(toApiNotification),
      unreadCount: await countNotifications(userId, true),
      total: await countNotifications(userId, false),
    });
  } catch (error) {
    console.error('Failed to fetch notifications:', error);
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

// Get unread count
router.get('/unread-count', async (req, res) => {
  try {
    res.json({ unreadCount: await countNotifications(getUserId(req)!, true) });
  } catch (error) {
    console.error('Failed to count notifications:', error);
    res.status(500).json({ error: 'Failed to count notifications' });
  }
});

const idSchema = z.string().uuid();

// Mark notification as read
router.post('/:id/read', async (req, res) => {
  try {
    const userId = getUserId(req)!;
    if (!idSchema.safeParse(req.params.id).success) {
      return res.status(404).json({ error: 'Notification not found' });
    }
    const updated = await markRead(userId, req.params.id);
    if (updated === 0) {
      // Either already read or not this user's notification
      const [existing] = await listNotifications(userId, { limit: 200 }).then(rows => rows.filter(n => n.id === req.params.id));
      if (!existing) return res.status(404).json({ error: 'Notification not found' });
    }
    res.json({ success: true });
  } catch (error) {
    console.error('Failed to mark notification read:', error);
    res.status(500).json({ error: 'Failed to mark notification read' });
  }
});

// Mark all as read
router.post('/mark-all-read', async (req, res) => {
  try {
    const updated = await markRead(getUserId(req)!);
    res.json({ success: true, updated });
  } catch (error) {
    console.error('Failed to mark notifications read:', error);
    res.status(500).json({ error: 'Failed to mark notifications read' });
  }
});

// Delete notification
router.delete('/:id', async (req, res) => {
  try {
    if (!idSchema.safeParse(req.params.id).success) {
      return res.status(404).json({ error: 'Notification not found' });
    }
    const deleted = await deleteNotifications(getUserId(req)!, req.params.id);
    if (deleted === 0) return res.status(404).json({ error: 'Notification not found' });
    res.json({ success: true });
  } catch (error) {
    console.error('Failed to delete notification:', error);
    res.status(500).json({ error: 'Failed to delete notification' });
  }
});

// Clear all notifications
router.delete('/', async (req, res) => {
  try {
    await deleteNotifications(getUserId(req)!);
    res.json({ success: true });
  } catch (error) {
    console.error('Failed to clear notifications:', error);
    res.status(500).json({ error: 'Failed to clear notifications' });
  }
});

const PRIORITIES = ['low', 'normal', 'high', 'urgent'] as const;

/**
 * Store an in-app notification for one user, then email/SMS it according to their preferences
 */
async function createAndDeliver(userId: string, notification: NewNotification, deliver: boolean) {
  const [row] = await notifyUsers([userId], notification);
  let delivery = { email: false, sms: false };
  if (deliver) {
    try {
      const preferences = userPreferences.get(userId) || getDefaultPreferences();
      delivery = await deliverNotification(
        {
          userId,
          title: notification.title,
          message: notification.message,
          type: notification.type as any,
          priority: notification.priority ?? 'normal',
          metadata: notification.metadata,
        },
        {
          emailEnabled: preferences.emailEnabled,
          smsEnabled: preferences.emailEnabled, // For now, use same preference
          quietHours: preferences.quietHours,
        }
      );
    } catch (error) {
      console.error('[NOTIFICATIONS] Delivery failed:', error);
      // The in-app notification is still stored
    }
  }
  return { notification: toApiNotification(row), delivery };
}

/**
 * Who a notification is for: the signed-in user, or another member of their farm
 */
async function resolveRecipient(req: any, requested?: string): Promise<string | null> {
  const me = getUserId(req)!;
  if (!requested || requested === me) return me;
  const farmId = getFarmId(req);
  if (!farmId || !z.string().uuid().safeParse(requested).success) return null;
  return (await isFarmMember(requested, farmId)) ? requested : null;
}

// Create notification (internal use / testing)
router.post('/', async (req, res) => {
  try {
    const data = z.object({
      type: z.string().min(1).max(50),
      title: z.string().min(1).max(255),
      message: z.string().min(1),
      link: z.string().max(500).optional(),
      priority: z.enum(PRIORITIES).default('normal'),
      metadata: z.record(z.any()).optional(),
      deliver: z.boolean().default(true),
    }).parse(req.body);
    const { deliver, ...notification } = data;
    const result = await createAndDeliver(getUserId(req)!, { ...notification, farmId: getFarmId(req) }, deliver);
    res.status(201).json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.errors });
    }
    console.error('Failed to create notification:', error);
    res.status(500).json({ error: 'Failed to create notification' });
  }
});

// ============================================
// PREFERENCES
// ============================================

// Get notification preferences
router.get('/preferences', (req, res) => {
  const userId = getUserId(req)!;
  
  const preferences = userPreferences.get(userId) || getDefaultPreferences();
  
  res.json(preferences);
});

// Update notification preferences
router.patch('/preferences', (req, res) => {
  const userId = getUserId(req)!;
  const updates = req.body;
  
  const current = userPreferences.get(userId) || getDefaultPreferences();
  const updated = { ...current, ...updates };
  
  // Deep merge categories if provided
  if (updates.categories) {
    updated.categories = { ...current.categories, ...updates.categories };
  }
  
  // Deep merge quietHours if provided
  if (updates.quietHours) {
    updated.quietHours = { ...current.quietHours, ...updates.quietHours };
  }
  
  userPreferences.set(userId, updated);
  
  res.json(updated);
});

// ============================================
// PUSH SUBSCRIPTION
// ============================================

// Store for push subscriptions (would be database in production)
const pushSubscriptions: Map<string, any> = new Map();

// Subscribe to push notifications
router.post('/push/subscribe', (req, res) => {
  const userId = getUserId(req)!;
  const subscription = req.body;
  
  pushSubscriptions.set(userId, subscription);
  
  res.json({ success: true, message: 'Push subscription saved' });
});

// Unsubscribe from push notifications
router.post('/push/unsubscribe', (req, res) => {
  const userId = getUserId(req)!;
  
  pushSubscriptions.delete(userId);
  
  res.json({ success: true, message: 'Push subscription removed' });
});

// Test notification: stores one for the signed-in user and tries email/SMS delivery
router.post('/push/test', async (req, res) => {
  try {
    const result = await createAndDeliver(getUserId(req)!, {
      type: 'system',
      title: 'Test Notification',
      message: 'Notifications are working! 🎉',
      farmId: getFarmId(req),
    }, true);
    res.json({ success: true, ...result, message: 'Test notification sent' });
  } catch (error) {
    console.error('[NOTIFICATIONS] Test notification failed:', error);
    res.status(500).json({ error: 'Failed to send test notification' });
  }
});

// ============================================
// NOTIFICATION TRIGGERS (for other services to call)
// ============================================

// Trigger task due notification
router.post('/trigger/task-due', async (req, res) => {
  try {
    const { userId, taskId, taskTitle, dueIn } = req.body;
    const recipient = await resolveRecipient(req, userId);
    if (!recipient) return res.status(404).json({ error: 'User not found on this farm' });
    const result = await createAndDeliver(recipient, {
      type: 'task_due',
      title: 'Task Due Soon',
      message: `${taskTitle} is due in ${dueIn}`,
      link: '/app/jobs',
      priority: 'high',
      farmId: getFarmId(req),
      metadata: { taskId, taskTitle },
    }, true);
    res.json({ success: true, ...result });
  } catch (error) {
    console.error('Failed to send task notification:', error);
    res.status(500).json({ error: 'Failed to send task notification' });
  }
});

// Trigger weather alert notification
router.post('/trigger/weather-alert', async (req, res) => {
  try {
    const { userId, condition, message: alertMessage, date } = req.body;
    const recipient = await resolveRecipient(req, userId);
    if (!recipient) return res.status(404).json({ error: 'User not found on this farm' });
    const result = await createAndDeliver(recipient, {
      type: 'weather_alert',
      title: 'Weather Alert',
      message: alertMessage || `${condition} expected. Check your outdoor tasks.`,
      link: '/app/weather',
      priority: 'normal',
      farmId: getFarmId(req),
      metadata: { condition, date },
    }, true);
    res.json({ success: true, ...result });
  } catch (error) {
    console.error('Failed to send weather notification:', error);
    res.status(500).json({ error: 'Failed to send weather notification' });
  }
});

export default router;
