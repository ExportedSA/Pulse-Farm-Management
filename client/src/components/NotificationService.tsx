import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { 
  Bell, 
  AlertTriangle, 
  CheckCircle, 
  Clock, 
  Phone, 
  Mail, 
  MessageSquare, 
  Settings,
  Users,
  Shield,
  Activity,
  Eye,
  Send
} from 'lucide-react';

interface Notification {
  id: string;
  type: 'lone_worker_overdue' | 'biosecurity_breach' | 'document_expiry' | 'incident_reported' | 'hazard_identified';
  title: string;
  message: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  recipient: string;
  recipientEmail?: string;
  recipientPhone?: string;
  status: 'pending' | 'sent' | 'delivered' | 'failed';
  sentAt?: string;
  createdAt: string;
  channels: ('email' | 'sms' | 'push')[];
  escalationLevel: number;
}

interface NotificationRule {
  id: string;
  eventType: string;
  triggerCondition: string;
  recipients: string[];
  channels: ('email' | 'sms' | 'push')[];
  enabled: boolean;
  escalationDelay: number; // minutes
}

interface NotificationTemplate {
  id: string;
  eventType: string;
  subject: string;
  emailTemplate: string;
  smsTemplate: string;
  variables: string[];
}

export default function NotificationService() {
  const [notifications, setNotifications] = useState<Notification[]>([
    {
      id: '1',
      type: 'lone_worker_overdue',
      title: 'Lone Worker Overdue - Sarah Wilson',
      message: 'Sarah Wilson (Veterinarian) is 15 minutes overdue for check-in at Dairy Shed. Last check-in was 2 hours ago.',
      priority: 'high',
      recipient: 'Tom Brown',
      recipientEmail: 'tom@pulsefarm.nz',
      recipientPhone: '+64 21 345 6789',
      status: 'sent',
      sentAt: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
      createdAt: new Date(Date.now() - 20 * 60 * 1000).toISOString(),
      channels: ['email', 'sms'],
      escalationLevel: 1
    },
    {
      id: '2',
      type: 'biosecurity_breach',
      title: 'Biosecurity Red Flag - International Visitor',
      message: 'International visitor detected requiring 7-day stand down. Automatic biosecurity checks failed for recent travel.',
      priority: 'critical',
      recipient: 'Safety Manager',
      recipientEmail: 'safety@pulsefarm.nz',
      status: 'pending',
      createdAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
      channels: ['email', 'sms'],
      escalationLevel: 0
    },
    {
      id: '3',
      type: 'document_expiry',
      title: 'Contractor Insurance Expiring Soon',
      message: 'AgriTech Solutions insurance expires in 15 days. Policy #POL-345678 requires renewal.',
      priority: 'medium',
      recipient: 'Farm Manager',
      recipientEmail: 'manager@pulsefarm.nz',
      status: 'delivered',
      sentAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      channels: ['email'],
      escalationLevel: 0
    }
  ]);

  const [rules, setRules] = useState<NotificationRule[]>([
    {
      id: '1',
      eventType: 'lone_worker_overdue',
      triggerCondition: 'Worker overdue by 15 minutes',
      recipients: ['Safety Manager', 'Farm Manager'],
      channels: ['email', 'sms'],
      enabled: true,
      escalationDelay: 30
    },
    {
      id: '2',
      eventType: 'biosecurity_breach',
      triggerCondition: 'Biosecurity red flag detected',
      recipients: ['Safety Manager', 'Biosecurity Officer'],
      channels: ['email', 'sms'],
      enabled: true,
      escalationDelay: 15
    },
    {
      id: '3',
      eventType: 'document_expiry',
      triggerCondition: 'Document expires within 30 days',
      recipients: ['Farm Manager'],
      channels: ['email'],
      enabled: true,
      escalationDelay: 60
    }
  ]);

  const [templates] = useState<NotificationTemplate[]>([
    {
      id: '1',
      eventType: 'lone_worker_overdue',
      subject: 'URGENT: Lone Worker Overdue Check-in',
      emailTemplate: 'URGENT: {{workerName}} is {{overdueMinutes}} minutes overdue for check-in at {{location}}. Last contact: {{lastContact}}. Please contact immediately at {{workerPhone}}.',
      smsTemplate: 'URGENT: {{workerName}} overdue {{overdueMinutes}}min at {{location}}. Contact: {{workerPhone}}',
      variables: ['workerName', 'overdueMinutes', 'location', 'lastContact', 'workerPhone']
    },
    {
      id: '2',
      eventType: 'biosecurity_breach',
      subject: 'CRITICAL: Biosecurity Breach Detected',
      emailTemplate: 'CRITICAL: Biosecurity breach detected. {{visitorName}} from {{origin}} requires {{standDownDays}}-day stand down. Red flags: {{redFlags}}. Immediate action required.',
      smsTemplate: 'CRITICAL: Biosecurity breach - {{visitorName}} requires {{standDownDays}}-day stand down',
      variables: ['visitorName', 'origin', 'standDownDays', 'redFlags']
    }
  ]);

  const [activeTab, setActiveTab] = useState<'notifications' | 'rules' | 'templates'>('notifications');
  const [isTestMode, setIsTestMode] = useState(false);

  const sendNotification = (notificationId: string) => {
    const notification = notifications.find(n => n.id === notificationId);
    if (!notification) return;

    // Simulate sending notification
    console.log('Sending notification:', notification);
    
    setNotifications(prev => prev.map(n => 
      n.id === notificationId 
        ? { 
            ...n, 
            status: 'sent', 
            sentAt: new Date().toISOString() 
          }
        : n
    ));

    // Simulate delivery after 2 seconds
    setTimeout(() => {
      setNotifications(prev => prev.map(n => 
        n.id === notificationId 
          ? { ...n, status: 'delivered' }
          : n
      ));
    }, 2000);
  };

  const escalateNotification = (notificationId: string) => {
    const notification = notifications.find(n => n.id === notificationId);
    if (!notification) return;

    // Create escalated notification
    const escalatedNotification: Notification = {
      id: Date.now().toString(),
      type: notification.type,
      title: `ESCALATED: ${notification.title}`,
      message: `${notification.message} - ESCALATION LEVEL ${notification.escalationLevel + 1}`,
      priority: notification.priority === 'critical' ? 'critical' : 'high',
      recipient: 'Emergency Services',
      recipientEmail: 'emergency@pulsefarm.nz',
      recipientPhone: '111',
      status: 'pending',
      createdAt: new Date().toISOString(),
      channels: ['email', 'sms'],
      escalationLevel: notification.escalationLevel + 1
    };

    setNotifications(prev => [escalatedNotification, ...prev]);
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical': return 'bg-red-100 text-red-800 border-red-200';
      case 'high': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'low': return 'bg-green-100 text-green-800 border-green-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'delivered': return 'bg-green-100 text-green-800 border-green-200';
      case 'sent': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'pending': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'failed': return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getChannelIcon = (channel: string) => {
    switch (channel) {
      case 'email': return <Mail className="h-3 w-3" />;
      case 'sms': return <MessageSquare className="h-3 w-3" />;
      case 'push': return <Bell className="h-3 w-3" />;
      default: return null;
    }
  };

  const pendingCount = notifications.filter(n => n.status === 'pending').length;
  const sentCount = notifications.filter(n => n.status === 'sent').length;
  const deliveredCount = notifications.filter(n => n.status === 'delivered').length;
  const failedCount = notifications.filter(n => n.status === 'failed').length;

  return (
    <div className="space-y-6">
      {/* Statistics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-orange-600">{pendingCount}</div>
            <div className="text-sm text-gray-600">Pending</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-blue-600">{sentCount}</div>
            <div className="text-sm text-gray-600">Sent</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-green-600">{deliveredCount}</div>
            <div className="text-sm text-gray-600">Delivered</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-red-600">{failedCount}</div>
            <div className="text-sm text-gray-600">Failed</div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as any)} className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="notifications">
            <Bell className="h-4 w-4 mr-2" />
            Notifications ({notifications.length})
          </TabsTrigger>
          <TabsTrigger value="rules">
            <Settings className="h-4 w-4 mr-2" />
            Rules ({rules.length})
          </TabsTrigger>
          <TabsTrigger value="templates">
            <Mail className="h-4 w-4 mr-2" />
            Templates ({templates.length})
          </TabsTrigger>
        </TabsList>

        {/* Notifications Tab */}
        <TabsContent value="notifications" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Bell className="h-5 w-5 text-pulse-forest" />
                  Automated Notifications
                </CardTitle>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsTestMode(!isTestMode)}
                  >
                    {isTestMode ? 'Live Mode' : 'Test Mode'}
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {notifications.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <Bell className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                    <p>No notifications sent yet</p>
                  </div>
                ) : (
                  notifications.map(notification => (
                    <Card key={notification.id} className={`border-l-4 ${
                      notification.priority === 'critical' ? 'border-l-red-500' : 
                      notification.priority === 'high' ? 'border-l-orange-500' : 'border-l-blue-500'
                    }`}>
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <h3 className="font-semibold">{notification.title}</h3>
                              <Badge className={getPriorityColor(notification.priority)}>
                                {notification.priority}
                              </Badge>
                              <Badge className={getStatusColor(notification.status)}>
                                {notification.status}
                              </Badge>
                              {notification.escalationLevel > 0 && (
                                <Badge variant="outline" className="text-red-600">
                                  Level {notification.escalationLevel}
                                </Badge>
                              )}
                            </div>
                            <p className="text-sm text-gray-600 mb-3">{notification.message}</p>
                            <div className="flex items-center gap-4 text-sm text-gray-500 mb-2">
                              <span className="flex items-center gap-2">
                                <Users className="h-4 w-4" />
                                {notification.recipient}
                              </span>
                              {notification.recipientEmail && (
                                <span className="flex items-center gap-2">
                                  <Mail className="h-4 w-4" />
                                  {notification.recipientEmail}
                                </span>
                              )}
                              {notification.recipientPhone && (
                                <span className="flex items-center gap-2">
                                  <Phone className="h-4 w-4" />
                                  {notification.recipientPhone}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-4 text-xs text-gray-500">
                              <span className="flex items-center gap-1">
                                Created: {new Date(notification.createdAt).toLocaleString()}
                              </span>
                              {notification.sentAt && (
                                <span className="flex items-center gap-1">
                                  Sent: {new Date(notification.sentAt).toLocaleString()}
                                </span>
                              )}
                              <span className="flex items-center gap-2">
                                Channels: {notification.channels.map(channel => (
                                  <span key={channel} className="flex items-center gap-1">
                                    {getChannelIcon(channel)}
                                    {channel}
                                  </span>
                                ))}
                              </span>
                            </div>
                          </div>
                          <div className="flex flex-col gap-2">
                            {notification.status === 'pending' && (
                              <Button
                                size="sm"
                                onClick={() => sendNotification(notification.id)}
                                className="bg-pulse-forest hover:bg-pulse-forest-dark text-white"
                              >
                                <Send className="h-4 w-4 mr-2" />
                                Send Now
                              </Button>
                            )}
                            {notification.status === 'sent' && notification.escalationLevel < 3 && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => escalateNotification(notification.id)}
                                className="text-orange-600 border-orange-200 hover:bg-orange-50"
                              >
                                <AlertTriangle className="h-4 w-4 mr-2" />
                                Escalate
                              </Button>
                            )}
                            <Button size="sm" variant="outline">
                              <Eye className="h-4 w-4 mr-2" />
                              View
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Rules Tab */}
        <TabsContent value="rules" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5 text-pulse-forest" />
                Notification Rules & Automation
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {rules.map(rule => (
                  <Card key={rule.id} className="border-l-4 border-l-purple-500">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <h3 className="font-semibold">{rule.eventType.replace(/_/g, ' ').toUpperCase()}</h3>
                            <Badge variant={rule.enabled ? 'default' : 'outline'}>
                              {rule.enabled ? 'Active' : 'Disabled'}
                            </Badge>
                          </div>
                          <p className="text-sm text-gray-600 mb-2">{rule.triggerCondition}</p>
                          <div className="flex items-center gap-4 text-sm text-gray-500">
                            <span>Recipients: {rule.recipients.join(', ')}</span>
                            <span>Escalation: {rule.escalationDelay} minutes</span>
                            <span>Channels: {rule.channels.join(', ')}</span>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline">
                            Edit
                          </Button>
                          <Button size="sm" variant="outline">
                            Test
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Templates Tab */}
        <TabsContent value="templates" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mail className="h-5 w-5 text-pulse-forest" />
                Email & SMS Templates
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {templates.map(template => (
                  <Card key={template.id} className="border-l-4 border-l-green-500">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h3 className="font-semibold mb-2">{template.subject}</h3>
                          <p className="text-sm text-gray-600 mb-2">
                            Event: {template.eventType.replace(/_/g, ' ').toUpperCase()}
                          </p>
                          <div className="space-y-2">
                            <div>
                              <span className="text-sm font-medium">Email Template:</span>
                              <p className="text-sm text-gray-600 mt-1">{template.emailTemplate}</p>
                            </div>
                            <div>
                              <span className="text-sm font-medium">SMS Template:</span>
                              <p className="text-sm text-gray-600 mt-1">{template.smsTemplate}</p>
                            </div>
                            <div>
                              <span className="text-sm font-medium">Variables:</span>
                              <div className="flex gap-2 mt-1">
                                {template.variables.map(variable => (
                                  <Badge key={variable} variant="outline" className="text-xs">
                                    {variable}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline">
                            Edit
                          </Button>
                          <Button size="sm" variant="outline">
                            Preview
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
