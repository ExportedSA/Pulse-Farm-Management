import { Router } from 'express';
import { deliverNotification, createAndDeliverNotification, type NotificationData } from '../services/notifications';

const router = Router();

// Notification types
type NotificationType = 
  | 'task_due'
  | 'task_overdue'
  | 'task_assigned'
  | 'task_completed'
  | 'weather_alert'
  | 'weather_reschedule'
  | 'checklist_reminder'
  | 'animal_health'
  | 'compliance_due'
  | 'system'
  | 'message';

interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  icon?: string;
  link?: string;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  read: boolean;
  createdAt: string;
  expiresAt?: string;
  userId: string;
  metadata?: Record<string, any>;
}

// In-memory notification store (would be database in production)
let notifications: Notification[] = [];
let notificationIdCounter = 1;

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

// Generate demo notifications
function generateDemoNotifications(userId: string): Notification[] {
  const now = new Date();
  return [
    {
      id: `notif-${notificationIdCounter++}`,
      type: 'task_due',
      title: 'Task Due Soon',
      message: 'Morning Feed - Paddock A is due in 30 minutes',
      icon: '⏰',
      link: '/app/jobs',
      priority: 'high',
      read: false,
      createdAt: new Date(now.getTime() - 5 * 60000).toISOString(),
      userId,
      metadata: { taskId: '1', taskTitle: 'Morning Feed - Paddock A' },
    },
    {
      id: `notif-${notificationIdCounter++}`,
      type: 'weather_alert',
      title: 'Weather Warning',
      message: 'Rain expected tomorrow. Consider rescheduling outdoor tasks.',
      icon: '🌧️',
      link: '/app/weather',
      priority: 'normal',
      read: false,
      createdAt: new Date(now.getTime() - 15 * 60000).toISOString(),
      userId,
      metadata: { condition: 'rain', date: new Date(now.getTime() + 86400000).toISOString().split('T')[0] },
    },
    {
      id: `notif-${notificationIdCounter++}`,
      type: 'task_assigned',
      title: 'New Task Assigned',
      message: 'You have been assigned to "Fence Repair - North Boundary"',
      icon: '📋',
      link: '/app/jobs',
      priority: 'normal',
      read: false,
      createdAt: new Date(now.getTime() - 30 * 60000).toISOString(),
      userId,
      metadata: { taskId: '2', assignedBy: 'John Smith' },
    },
    {
      id: `notif-${notificationIdCounter++}`,
      type: 'checklist_reminder',
      title: 'Checklist Incomplete',
      message: '2 required items remaining on "Health Check - Dairy Herd"',
      icon: '✅',
      link: '/app/jobs',
      priority: 'normal',
      read: true,
      createdAt: new Date(now.getTime() - 2 * 3600000).toISOString(),
      userId,
      metadata: { taskId: '3', remaining: 2 },
    },
    {
      id: `notif-${notificationIdCounter++}`,
      type: 'compliance_due',
      title: 'Compliance Reminder',
      message: 'NAIT records update due in 3 days',
      icon: '📝',
      link: '/app/nait',
      priority: 'normal',
      read: true,
      createdAt: new Date(now.getTime() - 4 * 3600000).toISOString(),
      userId,
      metadata: { dueDate: new Date(now.getTime() + 3 * 86400000).toISOString().split('T')[0] },
    },
    {
      id: `notif-${notificationIdCounter++}`,
      type: 'animal_health',
      title: 'Health Alert',
      message: 'Cow #1234 treatment reminder - Antibiotics due today',
      icon: '🩺',
      link: '/app/livestock',
      priority: 'high',
      read: true,
      createdAt: new Date(now.getTime() - 6 * 3600000).toISOString(),
      userId,
      metadata: { animalId: '1234', treatment: 'Antibiotics' },
    },
    {
      id: `notif-${notificationIdCounter++}`,
      type: 'task_completed',
      title: 'Task Completed',
      message: 'Sarah Johnson completed "Afternoon Milking"',
      icon: '✓',
      link: '/app/jobs',
      priority: 'low',
      read: true,
      createdAt: new Date(now.getTime() - 12 * 3600000).toISOString(),
      userId,
      metadata: { taskId: '4', completedBy: 'Sarah Johnson' },
    },
  ];
}

// Initialize demo notifications
const demoUserId = 'demo-user';
notifications = generateDemoNotifications(demoUserId);

// ============================================
// ENDPOINTS
// ============================================

// Get all notifications for current user
router.get('/', (req, res) => {
  const userId = (req.user as any)?.id || 'demo-user';
  const { unreadOnly, type, limit = 50 } = req.query;
  
  let userNotifications = notifications.filter(n => n.userId === userId);
  
  // Filter by unread
  if (unreadOnly === 'true') {
    userNotifications = userNotifications.filter(n => !n.read);
  }
  
  // Filter by type
  if (type) {
    userNotifications = userNotifications.filter(n => n.type === type);
  }
  
  // Sort by date (newest first)
  userNotifications.sort((a, b) => 
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
  
  // Limit results
  userNotifications = userNotifications.slice(0, Number(limit));
  
  const unreadCount = notifications.filter(n => n.userId === userId && !n.read).length;
  
  res.json({
    notifications: userNotifications,
    unreadCount,
    total: notifications.filter(n => n.userId === userId).length,
  });
});

// Get unread count
router.get('/unread-count', (req, res) => {
  const userId = (req.user as any)?.id || 'demo-user';
  const unreadCount = notifications.filter(n => n.userId === userId && !n.read).length;
  
  res.json({ unreadCount });
});

// Mark notification as read
router.post('/:id/read', (req, res) => {
  const { id } = req.params;
  const userId = (req.user as any)?.id || 'demo-user';
  
  const notification = notifications.find(n => n.id === id && n.userId === userId);
  
  if (!notification) {
    return res.status(404).json({ error: 'Notification not found' });
  }
  
  notification.read = true;
  
  res.json({ success: true, notification });
});

// Mark all as read
router.post('/mark-all-read', (req, res) => {
  const userId = (req.user as any)?.id || 'demo-user';
  
  notifications
    .filter(n => n.userId === userId && !n.read)
    .forEach(n => { n.read = true; });
  
  res.json({ success: true });
});

// Delete notification
router.delete('/:id', (req, res) => {
  const { id } = req.params;
  const userId = (req.user as any)?.id || 'demo-user';
  
  const index = notifications.findIndex(n => n.id === id && n.userId === userId);
  
  if (index === -1) {
    return res.status(404).json({ error: 'Notification not found' });
  }
  
  notifications.splice(index, 1);
  
  res.json({ success: true });
});

// Clear all notifications
router.delete('/', (req, res) => {
  const userId = (req.user as any)?.id || 'demo-user';
  
  notifications = notifications.filter(n => n.userId !== userId);
  
  res.json({ success: true });
});

// Create notification (internal use / testing)
router.post('/', async (req, res) => {
  const userId = (req.user as any)?.id || 'demo-user';
  const { type, title, message, icon, link, priority = 'normal', metadata, deliver = true } = req.body;
  
  const notification: Notification = {
    id: `notif-${notificationIdCounter++}`,
    type,
    title,
    message,
    icon,
    link,
    priority,
    read: false,
    createdAt: new Date().toISOString(),
    userId,
    metadata,
  };
  
  notifications.unshift(notification);
  
  // Get user preferences for delivery
  const preferences = userPreferences.get(userId) || getDefaultPreferences();
  
  // Deliver via external services if requested
  let delivery = { email: false, sms: false };
  if (deliver) {
    try {
      delivery = await deliverNotification(
        {
          userId,
          title,
          message,
          type,
          priority,
          metadata,
        },
        {
          emailEnabled: preferences.emailEnabled,
          smsEnabled: preferences.emailEnabled, // For now, use same preference
          quietHours: preferences.quietHours,
        }
      );
    } catch (error) {
      console.error('[NOTIFICATIONS] Delivery failed:', error);
      // Still return success for in-app notification
    }
  }
  
  res.status(201).json({ notification, delivery });
});

// ============================================
// PREFERENCES
// ============================================

// Get notification preferences
router.get('/preferences', (req, res) => {
  const userId = (req.user as any)?.id || 'demo-user';
  
  const preferences = userPreferences.get(userId) || getDefaultPreferences();
  
  res.json(preferences);
});

// Update notification preferences
router.patch('/preferences', (req, res) => {
  const userId = (req.user as any)?.id || 'demo-user';
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
  const userId = (req.user as any)?.id || 'demo-user';
  const subscription = req.body;
  
  pushSubscriptions.set(userId, subscription);
  
  res.json({ success: true, message: 'Push subscription saved' });
});

// Unsubscribe from push notifications
router.post('/push/unsubscribe', (req, res) => {
  const userId = (req.user as any)?.id || 'demo-user';
  
  pushSubscriptions.delete(userId);
  
  res.json({ success: true, message: 'Push subscription removed' });
});

// Test push notification (no auth for testing)
router.post('/push/test-no-auth', async (req, res) => {
  const userId = 'demo-user';
  
  // Create a test notification
  const notification: Notification = {
    id: `notif-${notificationIdCounter++}`,
    type: 'system',
    title: 'Test Notification',
    message: 'Push notifications are working! 🎉',
    icon: '🔔',
    priority: 'normal',
    read: false,
    createdAt: new Date().toISOString(),
    userId,
  };
  
  notifications.unshift(notification);
  
  // Test external delivery
  try {
    const delivery = await deliverNotification(
      {
        userId,
        title: notification.title,
        message: notification.message,
        type: notification.type,
        priority: notification.priority,
      },
      {
        emailEnabled: true,
        smsEnabled: true,
      }
    );
    
    res.json({ 
      success: true, 
      notification,
      delivery,
      message: 'Test notification sent (check console for email/SMS logs)',
    });
  } catch (error) {
    console.error('[NOTIFICATIONS] Test delivery failed:', error);
    res.json({ 
      success: true, 
      notification,
      delivery: { email: false, sms: false },
      message: 'In-app notification created, external delivery failed',
    });
  }
});

// Test push notification
router.post('/push/test', async (req, res) => {
  const userId = (req.user as any)?.id || 'demo-user';
  
  // Create a test notification
  const notification: Notification = {
    id: `notif-${notificationIdCounter++}`,
    type: 'system',
    title: 'Test Notification',
    message: 'Push notifications are working! 🎉',
    icon: '🔔',
    priority: 'normal',
    read: false,
    createdAt: new Date().toISOString(),
    userId,
  };
  
  notifications.unshift(notification);
  
  // Test external delivery
  try {
    const delivery = await deliverNotification(
      {
        userId,
        title: notification.title,
        message: notification.message,
        type: notification.type,
        priority: notification.priority,
      },
      {
        emailEnabled: true,
        smsEnabled: true,
      }
    );
    
    res.json({ 
      success: true, 
      notification,
      delivery,
      message: 'Test notification sent (check console for email/SMS logs)',
    });
  } catch (error) {
    console.error('[NOTIFICATIONS] Test delivery failed:', error);
    res.json({ 
      success: true, 
      notification,
      delivery: { email: false, sms: false },
      message: 'In-app notification created, external delivery failed',
    });
  }
});

// ============================================
// NOTIFICATION TRIGGERS (for other services to call)
// ============================================

// Trigger task due notification
router.post('/trigger/task-due', async (req, res) => {
  const { userId, taskId, taskTitle, dueIn } = req.body;
  
  const notification: Notification = {
    id: `notif-${notificationIdCounter++}`,
    type: 'task_due',
    title: 'Task Due Soon',
    message: `${taskTitle} is due in ${dueIn}`,
    icon: '⏰',
    link: '/app/jobs',
    priority: 'high',
    read: false,
    createdAt: new Date().toISOString(),
    userId: userId || 'demo-user',
    metadata: { taskId, taskTitle },
  };
  
  notifications.unshift(notification);
  
  // Deliver via external services
  try {
    const preferences = userPreferences.get(userId) || getDefaultPreferences();
    const delivery = await deliverNotification(
      {
        userId: userId || 'demo-user',
        title: notification.title,
        message: notification.message,
        type: notification.type,
        priority: notification.priority,
        metadata: notification.metadata,
      },
      {
        emailEnabled: preferences.emailEnabled,
        smsEnabled: preferences.emailEnabled,
        quietHours: preferences.quietHours,
      }
    );
    
    res.json({ success: true, notification, delivery });
  } catch (error) {
    console.error('[NOTIFICATIONS] Delivery failed:', error);
    res.json({ success: true, notification, delivery: { email: false, sms: false } });
  }
});

// Trigger weather alert notification
router.post('/trigger/weather-alert', async (req, res) => {
  const { userId, condition, message: alertMessage, date } = req.body;
  
  const notification: Notification = {
    id: `notif-${notificationIdCounter++}`,
    type: 'weather_alert',
    title: 'Weather Alert',
    message: alertMessage || `${condition} expected. Check your outdoor tasks.`,
    icon: '🌧️',
    link: '/app/weather',
    priority: 'normal',
    read: false,
    createdAt: new Date().toISOString(),
    userId: userId || 'demo-user',
    metadata: { condition, date },
  };
  
  notifications.unshift(notification);
  
  // Deliver via external services
  try {
    const preferences = userPreferences.get(userId) || getDefaultPreferences();
    const delivery = await deliverNotification(
      {
        userId: userId || 'demo-user',
        title: notification.title,
        message: notification.message,
        type: notification.type,
        priority: notification.priority,
        metadata: notification.metadata,
      },
      {
        emailEnabled: preferences.emailEnabled,
        smsEnabled: preferences.emailEnabled,
        quietHours: preferences.quietHours,
      }
    );
    
    res.json({ success: true, notification, delivery });
  } catch (error) {
    console.error('[NOTIFICATIONS] Delivery failed:', error);
    res.json({ success: true, notification, delivery: { email: false, sms: false } });
  }
});

export default router;
