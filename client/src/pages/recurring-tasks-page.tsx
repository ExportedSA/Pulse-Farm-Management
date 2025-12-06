import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import {
  Calendar,
  Clock,
  Plus,
  CheckCircle2,
  Circle,
  PlayCircle,
  PauseCircle,
  SkipForward,
  Repeat,
  CalendarDays,
  CalendarClock,
  Users,
  MapPin,
  AlertTriangle,
  Settings,
  Trash2,
  Edit,
  ChevronRight,
  ListChecks,
  Timer,
  CloudRain,
  Sun,
  MoreVertical,
  RefreshCw,
  Filter,
  Search,
} from 'lucide-react';

interface ChecklistItem {
  id: string;
  text: string;
  required: boolean;
  completed?: boolean;
  completedAt?: string;
  completedBy?: string;
}

interface RecurringTaskTemplate {
  id: string;
  title: string;
  description: string | null;
  category: string;
  priority: string;
  estimatedDuration: number | null;
  location: string | null;
  assignedTo: string[];
  assignedToNames?: string[];
  recurrenceType: 'daily' | 'weekly' | 'monthly' | 'custom';
  recurrenceInterval: number;
  recurrenceDays: number[] | null;
  recurrenceTime: string;
  recurrenceEndTime: string | null;
  startDate: string;
  endDate: string | null;
  maxOccurrences: number | null;
  checklistItems: ChecklistItem[] | null;
  weatherSensitive: boolean;
  skipIfRaining: boolean;
  minTemperature: number | null;
  maxTemperature: number | null;
  isActive: boolean;
  lastGeneratedDate: string | null;
  totalGenerated: number;
  createdAt: string;
}

interface RecurringTaskInstance {
  id: string;
  templateId: string;
  title: string;
  description: string | null;
  category: string;
  priority: string;
  location: string | null;
  assignedTo: string[];
  assignedToNames?: string[];
  scheduledDate: string;
  scheduledTime: string;
  scheduledEndTime: string | null;
  status: 'pending' | 'in_progress' | 'completed' | 'skipped' | 'cancelled';
  checklistItems: ChecklistItem[] | null;
  startedAt: string | null;
  completedAt: string | null;
  skipReason: string | null;
  estimatedDuration: number | null;
  actualDuration: number | null;
  occurrenceNumber: number;
}

interface TaskStats {
  totalTemplates: number;
  activeTemplates: number;
  todayTasks: number;
  todayCompleted: number;
  todayPending: number;
  todayInProgress: number;
  weeklyTasks: number;
  completionRate: number;
}

interface TaskCategory {
  value: string;
  label: string;
  icon: string;
}

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
}

const DAYS_OF_WEEK = [
  { value: 0, label: 'Sun' },
  { value: 1, label: 'Mon' },
  { value: 2, label: 'Tue' },
  { value: 3, label: 'Wed' },
  { value: 4, label: 'Thu' },
  { value: 5, label: 'Fri' },
  { value: 6, label: 'Sat' },
];

const PRIORITY_COLORS: Record<string, string> = {
  urgent: 'bg-red-500',
  high: 'bg-orange-500',
  medium: 'bg-yellow-500',
  low: 'bg-green-500',
};

const STATUS_ICONS: Record<string, React.ReactNode> = {
  pending: <Circle className="h-4 w-4 text-yellow-500" />,
  in_progress: <PlayCircle className="h-4 w-4 text-blue-500" />,
  completed: <CheckCircle2 className="h-4 w-4 text-green-500" />,
  skipped: <SkipForward className="h-4 w-4 text-gray-500" />,
  cancelled: <AlertTriangle className="h-4 w-4 text-red-500" />,
};

export default function RecurringTasksPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('today');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<RecurringTaskTemplate | null>(null);
  const [selectedInstance, setSelectedInstance] = useState<RecurringTaskInstance | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');

  // Form state for new template
  const [newTemplate, setNewTemplate] = useState<{
    title: string;
    description: string;
    category: string;
    priority: string;
    estimatedDuration: number;
    location: string;
    assignedTo: string[];
    recurrenceType: 'daily' | 'weekly' | 'monthly' | 'custom';
    recurrenceInterval: number;
    recurrenceDays: number[];
    recurrenceTime: string;
    recurrenceEndTime: string;
    startDate: string;
    endDate: string;
    checklistItems: { id: string; text: string; required: boolean }[];
    weatherSensitive: boolean;
    skipIfRaining: boolean;
  }>({
    title: '',
    description: '',
    category: 'general',
    priority: 'medium',
    estimatedDuration: 60,
    location: '',
    assignedTo: [] as string[],
    recurrenceType: 'daily' as const,
    recurrenceInterval: 1,
    recurrenceDays: [] as number[],
    recurrenceTime: '09:00',
    recurrenceEndTime: '',
    startDate: new Date().toISOString().split('T')[0],
    endDate: '',
    checklistItems: [] as { id: string; text: string; required: boolean }[],
    weatherSensitive: false,
    skipIfRaining: false,
  });

  const [newChecklistItem, setNewChecklistItem] = useState('');

  // Fetch stats
  const { data: stats } = useQuery<TaskStats>({
    queryKey: ['recurringTaskStats'],
    queryFn: async () => {
      const res = await fetch('/api/recurring-tasks/stats');
      if (!res.ok) throw new Error('Failed to fetch stats');
      return res.json();
    },
  });

  // Fetch templates
  const { data: templates = [], isLoading: templatesLoading } = useQuery<RecurringTaskTemplate[]>({
    queryKey: ['recurringTaskTemplates'],
    queryFn: async () => {
      const res = await fetch('/api/recurring-tasks/templates');
      if (!res.ok) throw new Error('Failed to fetch templates');
      return res.json();
    },
  });

  // Fetch today's instances
  const { data: todayInstances = [], isLoading: todayLoading } = useQuery<RecurringTaskInstance[]>({
    queryKey: ['recurringTasksToday'],
    queryFn: async () => {
      const res = await fetch('/api/recurring-tasks/instances/today');
      if (!res.ok) throw new Error('Failed to fetch today\'s tasks');
      return res.json();
    },
  });

  // Fetch upcoming instances
  const { data: upcomingInstances = [] } = useQuery<RecurringTaskInstance[]>({
    queryKey: ['recurringTasksUpcoming'],
    queryFn: async () => {
      const res = await fetch('/api/recurring-tasks/instances/upcoming');
      if (!res.ok) throw new Error('Failed to fetch upcoming tasks');
      return res.json();
    },
  });

  // Fetch categories
  const { data: categories = [] } = useQuery<TaskCategory[]>({
    queryKey: ['taskCategories'],
    queryFn: async () => {
      const res = await fetch('/api/recurring-tasks/categories');
      if (!res.ok) throw new Error('Failed to fetch categories');
      return res.json();
    },
  });

  // Fetch users
  const { data: users = [] } = useQuery<User[]>({
    queryKey: ['recurringTaskUsers'],
    queryFn: async () => {
      const res = await fetch('/api/recurring-tasks/users');
      if (!res.ok) throw new Error('Failed to fetch users');
      return res.json();
    },
  });

  // Create template mutation
  const createTemplateMutation = useMutation({
    mutationFn: async (data: typeof newTemplate) => {
      const res = await fetch('/api/recurring-tasks/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Failed to create template');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recurringTaskTemplates'] });
      queryClient.invalidateQueries({ queryKey: ['recurringTaskStats'] });
      setIsCreateDialogOpen(false);
      resetForm();
      toast.success('Recurring task created successfully');
    },
    onError: () => {
      toast.error('Failed to create recurring task');
    },
  });

  // Toggle template active status
  const toggleTemplateMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/recurring-tasks/templates/${id}/toggle`, {
        method: 'POST',
      });
      if (!res.ok) throw new Error('Failed to toggle template');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recurringTaskTemplates'] });
      queryClient.invalidateQueries({ queryKey: ['recurringTaskStats'] });
      toast.success('Template status updated');
    },
  });

  // Delete template mutation
  const deleteTemplateMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/recurring-tasks/templates/${id}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Failed to delete template');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recurringTaskTemplates'] });
      queryClient.invalidateQueries({ queryKey: ['recurringTaskStats'] });
      toast.success('Template deleted');
    },
  });

  // Start task mutation
  const startTaskMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/recurring-tasks/instances/${id}/start`, {
        method: 'POST',
      });
      if (!res.ok) throw new Error('Failed to start task');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recurringTasksToday'] });
      queryClient.invalidateQueries({ queryKey: ['recurringTaskStats'] });
      toast.success('Task started');
    },
  });

  // Complete task mutation
  const completeTaskMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const res = await fetch(`/api/recurring-tasks/instances/${id}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Failed to complete task');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recurringTasksToday'] });
      queryClient.invalidateQueries({ queryKey: ['recurringTaskStats'] });
      setSelectedInstance(null);
      toast.success('Task completed');
    },
  });

  // Skip task mutation
  const skipTaskMutation = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      const res = await fetch(`/api/recurring-tasks/instances/${id}/skip`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ skipReason: reason }),
      });
      if (!res.ok) throw new Error('Failed to skip task');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recurringTasksToday'] });
      queryClient.invalidateQueries({ queryKey: ['recurringTaskStats'] });
      toast.success('Task skipped');
    },
  });

  const resetForm = () => {
    setNewTemplate({
      title: '',
      description: '',
      category: 'general',
      priority: 'medium',
      estimatedDuration: 60,
      location: '',
      assignedTo: [],
      recurrenceType: 'daily',
      recurrenceInterval: 1,
      recurrenceDays: [],
      recurrenceTime: '09:00',
      recurrenceEndTime: '',
      startDate: new Date().toISOString().split('T')[0],
      endDate: '',
      checklistItems: [],
      weatherSensitive: false,
      skipIfRaining: false,
    });
    setNewChecklistItem('');
  };

  const addChecklistItem = () => {
    if (!newChecklistItem.trim()) return;
    setNewTemplate(prev => ({
      ...prev,
      checklistItems: [
        ...prev.checklistItems,
        { id: `item-${Date.now()}`, text: newChecklistItem.trim(), required: false },
      ],
    }));
    setNewChecklistItem('');
  };

  const removeChecklistItem = (id: string) => {
    setNewTemplate(prev => ({
      ...prev,
      checklistItems: prev.checklistItems.filter(item => item.id !== id),
    }));
  };

  const toggleChecklistRequired = (id: string) => {
    setNewTemplate(prev => ({
      ...prev,
      checklistItems: prev.checklistItems.map(item =>
        item.id === id ? { ...item, required: !item.required } : item
      ),
    }));
  };

  const getRecurrenceDescription = (template: RecurringTaskTemplate) => {
    const { recurrenceType, recurrenceInterval, recurrenceDays, recurrenceTime } = template;
    
    if (recurrenceType === 'daily') {
      return recurrenceInterval === 1 
        ? `Daily at ${recurrenceTime}` 
        : `Every ${recurrenceInterval} days at ${recurrenceTime}`;
    }
    
    if (recurrenceType === 'weekly' && recurrenceDays) {
      const dayNames = recurrenceDays.map(d => DAYS_OF_WEEK.find(day => day.value === d)?.label).join(', ');
      return `Weekly on ${dayNames} at ${recurrenceTime}`;
    }
    
    if (recurrenceType === 'monthly' && recurrenceDays) {
      const dayStr = recurrenceDays.map(d => `${d}${getOrdinalSuffix(d)}`).join(', ');
      return `Monthly on the ${dayStr} at ${recurrenceTime}`;
    }
    
    return `${recurrenceType} at ${recurrenceTime}`;
  };

  const getOrdinalSuffix = (n: number) => {
    const s = ['th', 'st', 'nd', 'rd'];
    const v = n % 100;
    return s[(v - 20) % 10] || s[v] || s[0];
  };

  const getCategoryIcon = (category: string) => {
    const cat = categories.find(c => c.value === category);
    return cat?.icon || '📋';
  };

  const filteredTemplates = templates.filter(t => {
    const matchesSearch = t.title.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = filterCategory === 'all' || t.category === filterCategory;
    return matchesSearch && matchesCategory;
  });

  const completionProgress = stats ? Math.round((stats.todayCompleted / stats.todayTasks) * 100) || 0 : 0;

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Recurring Tasks</h1>
          <p className="text-muted-foreground">Automate your daily, weekly, and monthly farm tasks</p>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-pulse-forest hover:bg-pulse-forest-dark">
              <Plus className="h-4 w-4 mr-2" />
              New Recurring Task
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create Recurring Task</DialogTitle>
              <DialogDescription>
                Set up a task that repeats automatically on your schedule
              </DialogDescription>
            </DialogHeader>
            
            <div className="grid gap-4 py-4">
              {/* Basic Info */}
              <div className="grid gap-2">
                <Label htmlFor="title">Task Title *</Label>
                <Input
                  id="title"
                  value={newTemplate.title}
                  onChange={(e) => setNewTemplate({ ...newTemplate, title: e.target.value })}
                  placeholder="e.g., Morning Feed - All Paddocks"
                />
              </div>
              
              <div className="grid gap-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={newTemplate.description}
                  onChange={(e) => setNewTemplate({ ...newTemplate, description: e.target.value })}
                  placeholder="Detailed instructions for this task..."
                  rows={2}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>Category</Label>
                  <Select
                    value={newTemplate.category}
                    onValueChange={(v) => setNewTemplate({ ...newTemplate, category: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((cat) => (
                        <SelectItem key={cat.value} value={cat.value}>
                          {cat.icon} {cat.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label>Priority</Label>
                  <Select
                    value={newTemplate.priority}
                    onValueChange={(v) => setNewTemplate({ ...newTemplate, priority: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">🟢 Low</SelectItem>
                      <SelectItem value="medium">🟡 Medium</SelectItem>
                      <SelectItem value="high">🟠 High</SelectItem>
                      <SelectItem value="urgent">🔴 Urgent</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Recurrence Settings */}
              <div className="border rounded-lg p-4 space-y-4">
                <h4 className="font-medium flex items-center gap-2">
                  <Repeat className="h-4 w-4" />
                  Recurrence Pattern
                </h4>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label>Repeat</Label>
                    <Select
                      value={newTemplate.recurrenceType}
                      onValueChange={(v: any) => setNewTemplate({ ...newTemplate, recurrenceType: v, recurrenceDays: [] })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="daily">Daily</SelectItem>
                        <SelectItem value="weekly">Weekly</SelectItem>
                        <SelectItem value="monthly">Monthly</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label>Every</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        min={1}
                        value={newTemplate.recurrenceInterval}
                        onChange={(e) => setNewTemplate({ ...newTemplate, recurrenceInterval: parseInt(e.target.value) || 1 })}
                        className="w-20"
                      />
                      <span className="text-sm text-muted-foreground">
                        {newTemplate.recurrenceType === 'daily' ? 'day(s)' : 
                         newTemplate.recurrenceType === 'weekly' ? 'week(s)' : 'month(s)'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Weekly day selection */}
                {newTemplate.recurrenceType === 'weekly' && (
                  <div className="grid gap-2">
                    <Label>On these days</Label>
                    <div className="flex gap-2">
                      {DAYS_OF_WEEK.map((day) => (
                        <Button
                          key={day.value}
                          type="button"
                          variant={newTemplate.recurrenceDays.includes(day.value) ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => {
                            const days = newTemplate.recurrenceDays.includes(day.value)
                              ? newTemplate.recurrenceDays.filter(d => d !== day.value)
                              : [...newTemplate.recurrenceDays, day.value];
                            setNewTemplate({ ...newTemplate, recurrenceDays: days });
                          }}
                        >
                          {day.label}
                        </Button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Monthly day selection */}
                {newTemplate.recurrenceType === 'monthly' && (
                  <div className="grid gap-2">
                    <Label>On day(s) of month</Label>
                    <div className="flex flex-wrap gap-1">
                      {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => (
                        <Button
                          key={day}
                          type="button"
                          variant={newTemplate.recurrenceDays.includes(day) ? 'default' : 'outline'}
                          size="sm"
                          className="w-8 h-8 p-0"
                          onClick={() => {
                            const days = newTemplate.recurrenceDays.includes(day)
                              ? newTemplate.recurrenceDays.filter(d => d !== day)
                              : [...newTemplate.recurrenceDays, day];
                            setNewTemplate({ ...newTemplate, recurrenceDays: days });
                          }}
                        >
                          {day}
                        </Button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label>Start Time</Label>
                    <Input
                      type="time"
                      value={newTemplate.recurrenceTime}
                      onChange={(e) => setNewTemplate({ ...newTemplate, recurrenceTime: e.target.value })}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label>End Time (Optional)</Label>
                    <Input
                      type="time"
                      value={newTemplate.recurrenceEndTime}
                      onChange={(e) => setNewTemplate({ ...newTemplate, recurrenceEndTime: e.target.value })}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label>Start Date</Label>
                    <Input
                      type="date"
                      value={newTemplate.startDate}
                      onChange={(e) => setNewTemplate({ ...newTemplate, startDate: e.target.value })}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label>End Date (Optional)</Label>
                    <Input
                      type="date"
                      value={newTemplate.endDate}
                      onChange={(e) => setNewTemplate({ ...newTemplate, endDate: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              {/* Assignment */}
              <div className="grid gap-2">
                <Label>Assign To</Label>
                <div className="flex flex-wrap gap-2">
                  {users.map((user) => (
                    <Button
                      key={user.id}
                      type="button"
                      variant={newTemplate.assignedTo.includes(user.id) ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => {
                        const assigned = newTemplate.assignedTo.includes(user.id)
                          ? newTemplate.assignedTo.filter(id => id !== user.id)
                          : [...newTemplate.assignedTo, user.id];
                        setNewTemplate({ ...newTemplate, assignedTo: assigned });
                      }}
                    >
                      {user.name}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Checklist */}
              <div className="border rounded-lg p-4 space-y-3">
                <h4 className="font-medium flex items-center gap-2">
                  <ListChecks className="h-4 w-4" />
                  Checklist Items
                </h4>
                
                <div className="flex gap-2">
                  <Input
                    placeholder="Add a checklist item..."
                    value={newChecklistItem}
                    onChange={(e) => setNewChecklistItem(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addChecklistItem())}
                  />
                  <Button type="button" onClick={addChecklistItem} size="sm">
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                
                {newTemplate.checklistItems.length > 0 && (
                  <div className="space-y-2">
                    {newTemplate.checklistItems.map((item) => (
                      <div key={item.id} className="flex items-center gap-2 p-2 bg-muted rounded">
                        <Checkbox
                          checked={item.required}
                          onCheckedChange={() => toggleChecklistRequired(item.id)}
                        />
                        <span className="flex-1 text-sm">{item.text}</span>
                        {item.required && <Badge variant="outline" className="text-xs">Required</Badge>}
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeChecklistItem(item.id)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Weather Settings */}
              <div className="border rounded-lg p-4 space-y-3">
                <h4 className="font-medium flex items-center gap-2">
                  <CloudRain className="h-4 w-4" />
                  Weather Conditions
                </h4>
                
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Weather Sensitive</Label>
                    <p className="text-xs text-muted-foreground">Task depends on weather conditions</p>
                  </div>
                  <Switch
                    checked={newTemplate.weatherSensitive}
                    onCheckedChange={(v) => setNewTemplate({ ...newTemplate, weatherSensitive: v })}
                  />
                </div>
                
                {newTemplate.weatherSensitive && (
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Skip if Raining</Label>
                      <p className="text-xs text-muted-foreground">Automatically skip on rainy days</p>
                    </div>
                    <Switch
                      checked={newTemplate.skipIfRaining}
                      onCheckedChange={(v) => setNewTemplate({ ...newTemplate, skipIfRaining: v })}
                    />
                  </div>
                )}
              </div>

              {/* Location & Duration */}
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>Location</Label>
                  <Input
                    value={newTemplate.location}
                    onChange={(e) => setNewTemplate({ ...newTemplate, location: e.target.value })}
                    placeholder="e.g., Paddock A, Dairy Shed"
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Estimated Duration (minutes)</Label>
                  <Input
                    type="number"
                    min={5}
                    value={newTemplate.estimatedDuration}
                    onChange={(e) => setNewTemplate({ ...newTemplate, estimatedDuration: parseInt(e.target.value) || 60 })}
                  />
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => createTemplateMutation.mutate(newTemplate)}
                disabled={!newTemplate.title || createTemplateMutation.isPending}
              >
                {createTemplateMutation.isPending ? 'Creating...' : 'Create Recurring Task'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Today's Tasks</p>
                <p className="text-2xl font-bold">{stats?.todayTasks || 0}</p>
              </div>
              <CalendarDays className="h-8 w-8 text-blue-500" />
            </div>
            <Progress value={completionProgress} className="mt-2" />
            <p className="text-xs text-muted-foreground mt-1">
              {stats?.todayCompleted || 0} of {stats?.todayTasks || 0} completed
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Active Templates</p>
                <p className="text-2xl font-bold">{stats?.activeTemplates || 0}</p>
              </div>
              <Repeat className="h-8 w-8 text-green-500" />
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              of {stats?.totalTemplates || 0} total
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">In Progress</p>
                <p className="text-2xl font-bold text-blue-600">{stats?.todayInProgress || 0}</p>
              </div>
              <PlayCircle className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Completion Rate</p>
                <p className="text-2xl font-bold text-green-600">{stats?.completionRate || 0}%</p>
              </div>
              <CheckCircle2 className="h-8 w-8 text-green-500" />
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Last 7 days
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="today" className="flex items-center gap-2">
            <CalendarDays className="h-4 w-4" />
            Today's Tasks
            {(stats?.todayPending || 0) > 0 && (
              <Badge variant="secondary" className="ml-1">{stats?.todayPending}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="upcoming" className="flex items-center gap-2">
            <CalendarClock className="h-4 w-4" />
            Upcoming
          </TabsTrigger>
          <TabsTrigger value="templates" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Templates
          </TabsTrigger>
        </TabsList>

        {/* Today's Tasks */}
        <TabsContent value="today" className="space-y-4">
          {todayLoading ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                Loading today's tasks...
              </CardContent>
            </Card>
          ) : todayInstances.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                <CalendarDays className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No tasks scheduled for today</p>
                <p className="text-sm">Create a recurring task to get started</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {todayInstances.map((instance) => (
                <Card key={instance.id} className={instance.status === 'completed' ? 'opacity-60' : ''}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        <div className={`w-2 h-2 rounded-full mt-2 ${PRIORITY_COLORS[instance.priority]}`} />
                        <div>
                          <div className="flex items-center gap-2">
                            {STATUS_ICONS[instance.status]}
                            <h4 className={`font-medium ${instance.status === 'completed' ? 'line-through' : ''}`}>
                              {instance.title}
                            </h4>
                          </div>
                          <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {instance.scheduledTime}
                              {instance.scheduledEndTime && ` - ${instance.scheduledEndTime}`}
                            </span>
                            {instance.location && (
                              <span className="flex items-center gap-1">
                                <MapPin className="h-3 w-3" />
                                {instance.location}
                              </span>
                            )}
                            <Badge variant="outline" className="text-xs">
                              {getCategoryIcon(instance.category)} {instance.category}
                            </Badge>
                          </div>
                          {instance.assignedToNames && instance.assignedToNames.length > 0 && (
                            <div className="flex items-center gap-1 mt-2">
                              <Users className="h-3 w-3 text-muted-foreground" />
                              <span className="text-xs text-muted-foreground">
                                {instance.assignedToNames.join(', ')}
                              </span>
                            </div>
                          )}
                          {instance.checklistItems && instance.checklistItems.length > 0 && (
                            <div className="mt-2">
                              <p className="text-xs text-muted-foreground">
                                Checklist: {instance.checklistItems.filter(i => i.completed).length}/{instance.checklistItems.length} items
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {instance.status === 'pending' && (
                          <>
                            <Button
                              size="sm"
                              onClick={() => startTaskMutation.mutate(instance.id)}
                              disabled={startTaskMutation.isPending}
                            >
                              <PlayCircle className="h-4 w-4 mr-1" />
                              Start
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => skipTaskMutation.mutate({ id: instance.id, reason: 'Skipped by user' })}
                            >
                              <SkipForward className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                        {instance.status === 'in_progress' && (
                          <Button
                            size="sm"
                            className="bg-green-600 hover:bg-green-700"
                            onClick={() => completeTaskMutation.mutate({
                              id: instance.id,
                              data: { completedBy: 'user-1' }
                            })}
                          >
                            <CheckCircle2 className="h-4 w-4 mr-1" />
                            Complete
                          </Button>
                        )}
                        {instance.status === 'completed' && (
                          <Badge className="bg-green-100 text-green-800">
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            Done
                          </Badge>
                        )}
                        {instance.status === 'skipped' && (
                          <Badge variant="secondary">
                            <SkipForward className="h-3 w-3 mr-1" />
                            Skipped
                          </Badge>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Upcoming Tasks */}
        <TabsContent value="upcoming" className="space-y-4">
          {upcomingInstances.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                <CalendarClock className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No upcoming tasks</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {/* Group by date */}
              {Object.entries(
                upcomingInstances.reduce((acc, instance) => {
                  const date = instance.scheduledDate;
                  if (!acc[date]) acc[date] = [];
                  acc[date].push(instance);
                  return acc;
                }, {} as Record<string, RecurringTaskInstance[]>)
              ).map(([date, instances]) => (
                <div key={date}>
                  <h3 className="font-medium text-sm text-muted-foreground mb-2">
                    {new Date(date).toLocaleDateString('en-NZ', { weekday: 'long', month: 'short', day: 'numeric' })}
                  </h3>
                  <div className="space-y-2">
                    {instances.map((instance) => (
                      <Card key={instance.id}>
                        <CardContent className="p-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className={`w-2 h-2 rounded-full ${PRIORITY_COLORS[instance.priority]}`} />
                              <div>
                                <p className="font-medium text-sm">{instance.title}</p>
                                <p className="text-xs text-muted-foreground">
                                  {instance.scheduledTime} • {instance.location || 'No location'}
                                </p>
                              </div>
                            </div>
                            <Badge variant="outline" className="text-xs">
                              {getCategoryIcon(instance.category)}
                            </Badge>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Templates */}
        <TabsContent value="templates" className="space-y-4">
          {/* Filters */}
          <div className="flex items-center gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search templates..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={filterCategory} onValueChange={setFilterCategory}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="All Categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categories.map((cat) => (
                  <SelectItem key={cat.value} value={cat.value}>
                    {cat.icon} {cat.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {templatesLoading ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                Loading templates...
              </CardContent>
            </Card>
          ) : filteredTemplates.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                <Repeat className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No recurring task templates</p>
                <p className="text-sm">Create your first recurring task to automate your farm work</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {filteredTemplates.map((template) => (
                <Card key={template.id} className={!template.isActive ? 'opacity-60' : ''}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        <div className="text-2xl">{getCategoryIcon(template.category)}</div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="font-medium">{template.title}</h4>
                            <div className={`w-2 h-2 rounded-full ${PRIORITY_COLORS[template.priority]}`} />
                            {!template.isActive && (
                              <Badge variant="secondary">Paused</Badge>
                            )}
                          </div>
                          {template.description && (
                            <p className="text-sm text-muted-foreground mt-1">{template.description}</p>
                          )}
                          <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Repeat className="h-3 w-3" />
                              {getRecurrenceDescription(template)}
                            </span>
                            {template.location && (
                              <span className="flex items-center gap-1">
                                <MapPin className="h-3 w-3" />
                                {template.location}
                              </span>
                            )}
                            {template.estimatedDuration && (
                              <span className="flex items-center gap-1">
                                <Timer className="h-3 w-3" />
                                {template.estimatedDuration} min
                              </span>
                            )}
                          </div>
                          {template.assignedToNames && template.assignedToNames.length > 0 && (
                            <div className="flex items-center gap-1 mt-2">
                              <Users className="h-3 w-3 text-muted-foreground" />
                              <span className="text-xs text-muted-foreground">
                                {template.assignedToNames.join(', ')}
                              </span>
                            </div>
                          )}
                          {template.weatherSensitive && (
                            <div className="flex items-center gap-1 mt-1">
                              <CloudRain className="h-3 w-3 text-blue-500" />
                              <span className="text-xs text-blue-600">
                                Weather sensitive {template.skipIfRaining && '• Skips if raining'}
                              </span>
                            </div>
                          )}
                          <p className="text-xs text-muted-foreground mt-2">
                            Generated {template.totalGenerated} times
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={template.isActive}
                          onCheckedChange={() => toggleTemplateMutation.mutate(template.id)}
                        />
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            if (confirm('Are you sure you want to delete this template?')) {
                              deleteTemplateMutation.mutate(template.id);
                            }
                          }}
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
