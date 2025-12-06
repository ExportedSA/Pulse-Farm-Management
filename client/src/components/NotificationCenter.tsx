import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
  Bell,
  BellOff,
  Check,
  CheckCheck,
  Trash2,
  Settings,
  Clock,
  CloudRain,
  ClipboardList,
  Heart,
  FileText,
  MessageSquare,
  AlertTriangle,
  X,
  ExternalLink,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { useLocation } from 'wouter';

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  icon?: string;
  link?: string;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  read: boolean;
  createdAt: string;
  metadata?: Record<string, any>;
}

interface NotificationPreferences {
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
}

const PRIORITY_COLORS: Record<string, string> = {
  urgent: 'border-l-red-500 bg-red-50',
  high: 'border-l-orange-500 bg-orange-50',
  normal: 'border-l-blue-500',
  low: 'border-l-gray-300',
};

const TYPE_ICONS: Record<string, React.ReactNode> = {
  task_due: <Clock className="h-4 w-4 text-orange-500" />,
  task_overdue: <AlertTriangle className="h-4 w-4 text-red-500" />,
  task_assigned: <ClipboardList className="h-4 w-4 text-blue-500" />,
  task_completed: <Check className="h-4 w-4 text-green-500" />,
  weather_alert: <CloudRain className="h-4 w-4 text-blue-500" />,
  weather_reschedule: <CloudRain className="h-4 w-4 text-orange-500" />,
  checklist_reminder: <ClipboardList className="h-4 w-4 text-purple-500" />,
  animal_health: <Heart className="h-4 w-4 text-red-500" />,
  compliance_due: <FileText className="h-4 w-4 text-yellow-600" />,
  message: <MessageSquare className="h-4 w-4 text-blue-500" />,
  system: <Bell className="h-4 w-4 text-gray-500" />,
};

export function NotificationCenter() {
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('all');

  // Request browser notification permission on mount
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      // Don't auto-request, wait for user action
    }
  }, []);

  // Fetch notifications
  const { data: notificationData, refetch } = useQuery({
    queryKey: ['notifications'],
    queryFn: async () => {
      const res = await fetch('/api/notifications');
      if (!res.ok) throw new Error('Failed to fetch notifications');
      return res.json();
    },
    refetchInterval: 30000, // Poll every 30 seconds
  });

  // Fetch preferences
  const { data: preferences } = useQuery<NotificationPreferences>({
    queryKey: ['notificationPreferences'],
    queryFn: async () => {
      const res = await fetch('/api/notifications/preferences');
      if (!res.ok) throw new Error('Failed to fetch preferences');
      return res.json();
    },
  });

  const notifications: Notification[] = notificationData?.notifications || [];
  const unreadCount = notificationData?.unreadCount || 0;

  // Mark as read mutation
  const markReadMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/notifications/${id}/read`, { method: 'POST' });
      if (!res.ok) throw new Error('Failed to mark as read');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  // Mark all as read mutation
  const markAllReadMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/notifications/mark-all-read', { method: 'POST' });
      if (!res.ok) throw new Error('Failed to mark all as read');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      toast.success('All notifications marked as read');
    },
  });

  // Delete notification mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/notifications/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete notification');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  // Clear all mutation
  const clearAllMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/notifications', { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to clear notifications');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      toast.success('All notifications cleared');
    },
  });

  // Update preferences mutation
  const updatePreferencesMutation = useMutation({
    mutationFn: async (updates: Partial<NotificationPreferences>) => {
      const res = await fetch('/api/notifications/preferences', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      if (!res.ok) throw new Error('Failed to update preferences');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notificationPreferences'] });
      toast.success('Preferences updated');
    },
  });

  // Test push notification
  const testPushMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/notifications/push/test', { method: 'POST' });
      if (!res.ok) throw new Error('Failed to send test notification');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      toast.success('Test notification sent!');
      
      // Show browser notification if permitted
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification('Pulse Farm', {
          body: 'Push notifications are working! 🎉',
          icon: '/favicon.ico',
        });
      }
    },
  });

  // Request push permission
  const requestPushPermission = async () => {
    if (!('Notification' in window)) {
      toast.error('This browser does not support notifications');
      return;
    }

    const permission = await Notification.requestPermission();
    
    if (permission === 'granted') {
      toast.success('Push notifications enabled!');
      updatePreferencesMutation.mutate({ pushEnabled: true });
    } else if (permission === 'denied') {
      toast.error('Notification permission denied');
      updatePreferencesMutation.mutate({ pushEnabled: false });
    }
  };

  // Handle notification click
  const handleNotificationClick = (notification: Notification) => {
    if (!notification.read) {
      markReadMutation.mutate(notification.id);
    }
    
    if (notification.link) {
      setIsOpen(false);
      navigate(notification.link);
    }
  };

  // Format time ago
  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString('en-NZ', { month: 'short', day: 'numeric' });
  };

  // Filter notifications by tab
  const filteredNotifications = notifications.filter(n => {
    if (activeTab === 'all') return true;
    if (activeTab === 'unread') return !n.read;
    if (activeTab === 'tasks') return n.type.startsWith('task') || n.type === 'checklist_reminder';
    if (activeTab === 'alerts') return n.type.includes('alert') || n.type.includes('weather') || n.priority === 'urgent';
    return true;
  });

  return (
    <>
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="sm" className="relative">
            <Bell className="h-5 w-5" />
            {unreadCount > 0 && (
              <Badge 
                className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center bg-red-500 text-white text-xs"
              >
                {unreadCount > 9 ? '9+' : unreadCount}
              </Badge>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-96 p-0" align="end">
          {/* Header */}
          <div className="flex items-center justify-between p-3 border-b">
            <h3 className="font-semibold">Notifications</h3>
            <div className="flex items-center gap-1">
              {unreadCount > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => markAllReadMutation.mutate()}
                  className="text-xs"
                >
                  <CheckCheck className="h-4 w-4 mr-1" />
                  Mark all read
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsSettingsOpen(true)}
              >
                <Settings className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="w-full justify-start rounded-none border-b h-auto p-0">
              <TabsTrigger value="all" className="rounded-none data-[state=active]:border-b-2 data-[state=active]:border-primary">
                All
              </TabsTrigger>
              <TabsTrigger value="unread" className="rounded-none data-[state=active]:border-b-2 data-[state=active]:border-primary">
                Unread
                {unreadCount > 0 && (
                  <Badge variant="secondary" className="ml-1 h-5 px-1.5">
                    {unreadCount}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="tasks" className="rounded-none data-[state=active]:border-b-2 data-[state=active]:border-primary">
                Tasks
              </TabsTrigger>
              <TabsTrigger value="alerts" className="rounded-none data-[state=active]:border-b-2 data-[state=active]:border-primary">
                Alerts
              </TabsTrigger>
            </TabsList>
          </Tabs>

          {/* Notification List */}
          <ScrollArea className="h-[400px]">
            {filteredNotifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <Bell className="h-12 w-12 mb-2 opacity-20" />
                <p className="text-sm">No notifications</p>
              </div>
            ) : (
              <div className="divide-y">
                {filteredNotifications.map((notification) => (
                  <div
                    key={notification.id}
                    className={cn(
                      "p-3 hover:bg-muted/50 cursor-pointer transition-colors border-l-4",
                      PRIORITY_COLORS[notification.priority],
                      !notification.read && "bg-blue-50/50"
                    )}
                    onClick={() => handleNotificationClick(notification)}
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 mt-0.5">
                        {notification.icon ? (
                          <span className="text-lg">{notification.icon}</span>
                        ) : (
                          TYPE_ICONS[notification.type] || <Bell className="h-4 w-4" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <p className={cn(
                            "text-sm",
                            !notification.read && "font-medium"
                          )}>
                            {notification.title}
                          </p>
                          <div className="flex items-center gap-1 flex-shrink-0">
                            {!notification.read && (
                              <div className="w-2 h-2 rounded-full bg-blue-500" />
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100"
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteMutation.mutate(notification.id);
                              }}
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                          {notification.message}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs text-muted-foreground">
                            {formatTimeAgo(notification.createdAt)}
                          </span>
                          {notification.link && (
                            <ExternalLink className="h-3 w-3 text-muted-foreground" />
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>

          {/* Footer */}
          {notifications.length > 0 && (
            <div className="p-2 border-t">
              <Button
                variant="ghost"
                size="sm"
                className="w-full text-xs text-muted-foreground"
                onClick={() => clearAllMutation.mutate()}
              >
                <Trash2 className="h-3 w-3 mr-1" />
                Clear all notifications
              </Button>
            </div>
          )}
        </PopoverContent>
      </Popover>

      {/* Settings Dialog */}
      <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Notification Settings</DialogTitle>
            <DialogDescription>
              Configure how you receive notifications
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Push Notifications */}
            <div className="space-y-4">
              <h4 className="font-medium text-sm">Push Notifications</h4>
              
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {preferences?.pushEnabled ? (
                    <Volume2 className="h-4 w-4 text-green-500" />
                  ) : (
                    <VolumeX className="h-4 w-4 text-gray-400" />
                  )}
                  <span className="text-sm">Browser Notifications</span>
                </div>
                <div className="flex items-center gap-2">
                  {'Notification' in window && Notification.permission !== 'granted' ? (
                    <Button size="sm" onClick={requestPushPermission}>
                      Enable
                    </Button>
                  ) : (
                    <Switch
                      checked={preferences?.pushEnabled}
                      onCheckedChange={(checked) => 
                        updatePreferencesMutation.mutate({ pushEnabled: checked })
                      }
                    />
                  )}
                </div>
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={() => testPushMutation.mutate()}
                disabled={testPushMutation.isPending}
              >
                <Bell className="h-4 w-4 mr-2" />
                Send Test Notification
              </Button>
            </div>

            {/* Categories */}
            <div className="space-y-4">
              <h4 className="font-medium text-sm">Notification Categories</h4>
              
              {[
                { key: 'tasks', label: 'Tasks & Jobs', icon: ClipboardList },
                { key: 'weather', label: 'Weather Alerts', icon: CloudRain },
                { key: 'health', label: 'Animal Health', icon: Heart },
                { key: 'compliance', label: 'Compliance Reminders', icon: FileText },
                { key: 'messages', label: 'Messages', icon: MessageSquare },
              ].map(({ key, label, icon: Icon }) => (
                <div key={key} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Icon className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">{label}</span>
                  </div>
                  <Switch
                    checked={preferences?.categories?.[key as keyof typeof preferences.categories]}
                    onCheckedChange={(checked) =>
                      updatePreferencesMutation.mutate({
                        categories: { ...preferences?.categories, [key]: checked } as any,
                      })
                    }
                  />
                </div>
              ))}
            </div>

            {/* Quiet Hours */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="font-medium text-sm">Quiet Hours</h4>
                <Switch
                  checked={preferences?.quietHours?.enabled}
                  onCheckedChange={(checked) =>
                    updatePreferencesMutation.mutate({
                      quietHours: { ...preferences?.quietHours, enabled: checked } as any,
                    })
                  }
                />
              </div>
              
              {preferences?.quietHours?.enabled && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Clock className="h-4 w-4" />
                  <span>
                    No notifications from {preferences.quietHours.start} to {preferences.quietHours.end}
                  </span>
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

// Notification bell for use in headers
export function NotificationBell() {
  const { data } = useQuery({
    queryKey: ['notificationCount'],
    queryFn: async () => {
      const res = await fetch('/api/notifications/unread-count');
      if (!res.ok) return { unreadCount: 0 };
      return res.json();
    },
    refetchInterval: 30000,
  });

  return (
    <NotificationCenter />
  );
}

export default NotificationCenter;
