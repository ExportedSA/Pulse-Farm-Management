import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Plus,
  Clock,
  MapPin,
  Users,
  CheckCircle2,
  Circle,
  PlayCircle,
  AlertCircle,
  Repeat,
  Filter,
  LayoutGrid,
  List,
  Sun,
  Cloud,
  Briefcase,
  ListChecks,
} from 'lucide-react';

interface CalendarTask {
  id: string;
  title: string;
  description?: string;
  date: string;
  time: string;
  endTime?: string;
  location?: string;
  category: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'pending' | 'in_progress' | 'completed' | 'skipped';
  assignedTo?: string[];
  assignedToNames?: string[];
  isRecurring?: boolean;
  checklistProgress?: { completed: number; total: number };
  type: 'job' | 'recurring';
}

interface User {
  id: string;
  name: string;
}

const PRIORITY_COLORS: Record<string, string> = {
  urgent: 'bg-red-500',
  high: 'bg-orange-500',
  medium: 'bg-yellow-500',
  low: 'bg-green-500',
};

const STATUS_STYLES: Record<string, { bg: string; text: string; icon: React.ReactNode }> = {
  pending: { bg: 'bg-gray-100', text: 'text-gray-700', icon: <Circle className="h-3 w-3" /> },
  in_progress: { bg: 'bg-blue-100', text: 'text-blue-700', icon: <PlayCircle className="h-3 w-3" /> },
  completed: { bg: 'bg-green-100', text: 'text-green-700', icon: <CheckCircle2 className="h-3 w-3" /> },
  skipped: { bg: 'bg-gray-100', text: 'text-gray-500', icon: <AlertCircle className="h-3 w-3" /> },
};

const CATEGORY_COLORS: Record<string, string> = {
  feeding: 'border-l-green-500',
  milking: 'border-l-blue-500',
  health: 'border-l-red-500',
  maintenance: 'border-l-orange-500',
  fencing: 'border-l-yellow-500',
  water: 'border-l-cyan-500',
  pasture: 'border-l-lime-500',
  equipment: 'border-l-amber-500',
  compliance: 'border-l-purple-500',
  general: 'border-l-gray-500',
};

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

// Mock users
const USERS: User[] = [
  { id: 'user-1', name: 'John Smith' },
  { id: 'user-2', name: 'Sarah Johnson' },
  { id: 'user-3', name: 'Mike Wilson' },
  { id: 'user-4', name: 'Emily Brown' },
];

export default function TaskCalendarPage() {
  const queryClient = useQueryClient();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<'month' | 'week'>('month');
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTask, setSelectedTask] = useState<CalendarTask | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterAssignee, setFilterAssignee] = useState('all');

  // New task form
  const [newTask, setNewTask] = useState({
    title: '',
    description: '',
    date: '',
    time: '09:00',
    endTime: '',
    location: '',
    category: 'general',
    priority: 'medium' as const,
    assignedTo: [] as string[],
  });

  // Fetch jobs
  const { data: jobs = [] } = useQuery<any[]>({
    queryKey: ['calendarJobs'],
    queryFn: async () => {
      const res = await fetch('/api/jobs');
      if (!res.ok) throw new Error('Failed to fetch jobs');
      return res.json();
    },
  });

  // Fetch recurring task instances
  const { data: recurringTasks = [] } = useQuery<any[]>({
    queryKey: ['calendarRecurringTasks'],
    queryFn: async () => {
      const res = await fetch('/api/recurring-tasks/instances/upcoming');
      if (!res.ok) throw new Error('Failed to fetch recurring tasks');
      return res.json();
    },
  });

  // Combine and transform tasks for calendar
  const calendarTasks: CalendarTask[] = useMemo(() => {
    const tasks: CalendarTask[] = [];
    
    // Add jobs
    jobs.forEach((job: any) => {
      tasks.push({
        id: job.id,
        title: job.title,
        description: job.description,
        date: job.startDate,
        time: job.startTime,
        endTime: job.endTime,
        location: job.location,
        category: job.category || 'general',
        priority: job.priority,
        status: job.status === 'in-progress' ? 'in_progress' : job.status,
        assignedTo: job.assignedTo,
        assignedToNames: job.assignedToNames,
        isRecurring: false,
        checklistProgress: job.checklistItems ? {
          completed: job.checklistItems.filter((i: any) => i.completed).length,
          total: job.checklistItems.length,
        } : undefined,
        type: 'job',
      });
    });
    
    // Add recurring tasks
    recurringTasks.forEach((task: any) => {
      tasks.push({
        id: task.id,
        title: task.title,
        description: task.description,
        date: task.scheduledDate,
        time: task.scheduledTime,
        endTime: task.scheduledEndTime,
        location: task.location,
        category: task.category || 'general',
        priority: task.priority,
        status: task.status,
        assignedTo: task.assignedTo,
        assignedToNames: task.assignedToNames,
        isRecurring: true,
        checklistProgress: task.checklistItems ? {
          completed: task.checklistItems.filter((i: any) => i.completed).length,
          total: task.checklistItems.length,
        } : undefined,
        type: 'recurring',
      });
    });
    
    return tasks;
  }, [jobs, recurringTasks]);

  // Filter tasks
  const filteredTasks = useMemo(() => {
    return calendarTasks.filter(task => {
      if (filterCategory !== 'all' && task.category !== filterCategory) return false;
      if (filterStatus !== 'all' && task.status !== filterStatus) return false;
      if (filterAssignee !== 'all' && !task.assignedTo?.includes(filterAssignee)) return false;
      return true;
    });
  }, [calendarTasks, filterCategory, filterStatus, filterAssignee]);

  // Get tasks for a specific date
  const getTasksForDate = (date: Date) => {
    const dateStr = date.toISOString().split('T')[0];
    return filteredTasks.filter(task => task.date === dateStr);
  };

  // Calendar navigation
  const goToPreviousMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const goToNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const goToPreviousWeek = () => {
    setCurrentDate(new Date(currentDate.getTime() - 7 * 24 * 60 * 60 * 1000));
  };

  const goToNextWeek = () => {
    setCurrentDate(new Date(currentDate.getTime() + 7 * 24 * 60 * 60 * 1000));
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  // Generate calendar days for month view
  const getMonthDays = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startPadding = firstDay.getDay();
    const days: Date[] = [];
    
    // Previous month padding
    for (let i = startPadding - 1; i >= 0; i--) {
      days.push(new Date(year, month, -i));
    }
    
    // Current month
    for (let i = 1; i <= lastDay.getDate(); i++) {
      days.push(new Date(year, month, i));
    }
    
    // Next month padding
    const remaining = 42 - days.length;
    for (let i = 1; i <= remaining; i++) {
      days.push(new Date(year, month + 1, i));
    }
    
    return days;
  };

  // Generate week days
  const getWeekDays = () => {
    const days: Date[] = [];
    const startOfWeek = new Date(currentDate);
    startOfWeek.setDate(currentDate.getDate() - currentDate.getDay());
    
    for (let i = 0; i < 7; i++) {
      days.push(new Date(startOfWeek.getTime() + i * 24 * 60 * 60 * 1000));
    }
    
    return days;
  };

  // Check if date is today
  const isToday = (date: Date) => {
    const today = new Date();
    return date.toDateString() === today.toDateString();
  };

  // Check if date is in current month
  const isCurrentMonth = (date: Date) => {
    return date.getMonth() === currentDate.getMonth();
  };

  // Handle date click
  const handleDateClick = (date: Date) => {
    setSelectedDate(date);
    setNewTask(prev => ({
      ...prev,
      date: date.toISOString().split('T')[0],
    }));
  };

  // Handle task click
  const handleTaskClick = (task: CalendarTask, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedTask(task);
  };

  // Create task mutation
  const createTaskMutation = useMutation({
    mutationFn: async (data: typeof newTask) => {
      const res = await fetch('/api/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...data,
          startDate: data.date,
          startTime: data.time,
          status: 'pending',
          assignedTo: JSON.stringify(data.assignedTo),
        }),
      });
      if (!res.ok) throw new Error('Failed to create task');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendarJobs'] });
      setIsCreateDialogOpen(false);
      setSelectedDate(null);
      resetForm();
      toast.success('Task created successfully');
    },
    onError: () => {
      toast.error('Failed to create task');
    },
  });

  const resetForm = () => {
    setNewTask({
      title: '',
      description: '',
      date: '',
      time: '09:00',
      endTime: '',
      location: '',
      category: 'general',
      priority: 'medium',
      assignedTo: [],
    });
  };

  // Stats for header
  const todayTasks = getTasksForDate(new Date());
  const pendingToday = todayTasks.filter(t => t.status === 'pending').length;
  const completedToday = todayTasks.filter(t => t.status === 'completed').length;

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <CalendarIcon className="h-8 w-8 text-pulse-forest" />
            Task Calendar
          </h1>
          <p className="text-muted-foreground mt-1">
            Plan and manage your farm tasks
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          {/* Today's Stats */}
          <div className="hidden md:flex items-center gap-4 mr-4">
            <div className="text-center">
              <p className="text-2xl font-bold">{todayTasks.length}</p>
              <p className="text-xs text-muted-foreground">Today</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-yellow-600">{pendingToday}</p>
              <p className="text-xs text-muted-foreground">Pending</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-green-600">{completedToday}</p>
              <p className="text-xs text-muted-foreground">Done</p>
            </div>
          </div>
          
          <Button
            onClick={() => {
              setSelectedDate(new Date());
              setNewTask(prev => ({ ...prev, date: new Date().toISOString().split('T')[0] }));
              setIsCreateDialogOpen(true);
            }}
            className="bg-pulse-forest hover:bg-pulse-forest-dark"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Task
          </Button>
        </div>
      </div>

      {/* Controls */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            {/* Navigation */}
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={goToToday}>
                Today
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={viewMode === 'month' ? goToPreviousMonth : goToPreviousWeek}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={viewMode === 'month' ? goToNextMonth : goToNextWeek}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
              <h2 className="text-lg font-semibold min-w-[200px]">
                {viewMode === 'month' 
                  ? `${MONTHS[currentDate.getMonth()]} ${currentDate.getFullYear()}`
                  : `Week of ${currentDate.toLocaleDateString('en-NZ', { month: 'short', day: 'numeric' })}`
                }
              </h2>
            </div>

            {/* View Toggle */}
            <div className="flex items-center gap-4">
              <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as 'month' | 'week')}>
                <TabsList>
                  <TabsTrigger value="month" className="flex items-center gap-1">
                    <LayoutGrid className="h-4 w-4" />
                    Month
                  </TabsTrigger>
                  <TabsTrigger value="week" className="flex items-center gap-1">
                    <List className="h-4 w-4" />
                    Week
                  </TabsTrigger>
                </TabsList>
              </Tabs>

              {/* Filters */}
              <div className="hidden md:flex items-center gap-2">
                <Select value={filterCategory} onValueChange={setFilterCategory}>
                  <SelectTrigger className="w-[130px]">
                    <Filter className="h-4 w-4 mr-1" />
                    <SelectValue placeholder="Category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    <SelectItem value="feeding">Feeding</SelectItem>
                    <SelectItem value="milking">Milking</SelectItem>
                    <SelectItem value="health">Health</SelectItem>
                    <SelectItem value="maintenance">Maintenance</SelectItem>
                    <SelectItem value="fencing">Fencing</SelectItem>
                    <SelectItem value="equipment">Equipment</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger className="w-[120px]">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="in_progress">In Progress</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Calendar Grid */}
      <Card>
        <CardContent className="p-0">
          {viewMode === 'month' ? (
            // Month View
            <div>
              {/* Day Headers */}
              <div className="grid grid-cols-7 border-b">
                {DAYS.map(day => (
                  <div key={day} className="p-3 text-center text-sm font-medium text-muted-foreground border-r last:border-r-0">
                    {day}
                  </div>
                ))}
              </div>
              
              {/* Calendar Days */}
              <div className="grid grid-cols-7">
                {getMonthDays().map((date, index) => {
                  const dayTasks = getTasksForDate(date);
                  const isCurrentMonthDay = isCurrentMonth(date);
                  
                  return (
                    <div
                      key={index}
                      onClick={() => handleDateClick(date)}
                      className={cn(
                        "min-h-[120px] p-2 border-r border-b last:border-r-0 cursor-pointer transition-colors",
                        !isCurrentMonthDay && "bg-muted/30",
                        isToday(date) && "bg-blue-50",
                        selectedDate?.toDateString() === date.toDateString() && "ring-2 ring-pulse-forest ring-inset"
                      )}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className={cn(
                          "text-sm font-medium",
                          !isCurrentMonthDay && "text-muted-foreground",
                          isToday(date) && "bg-pulse-forest text-white rounded-full w-6 h-6 flex items-center justify-center"
                        )}>
                          {date.getDate()}
                        </span>
                        {dayTasks.length > 0 && (
                          <Badge variant="secondary" className="text-xs h-5">
                            {dayTasks.length}
                          </Badge>
                        )}
                      </div>
                      
                      <div className="space-y-1">
                        {dayTasks.slice(0, 3).map(task => (
                          <div
                            key={task.id}
                            onClick={(e) => handleTaskClick(task, e)}
                            className={cn(
                              "text-xs p-1 rounded truncate cursor-pointer hover:opacity-80 border-l-2",
                              CATEGORY_COLORS[task.category] || CATEGORY_COLORS.general,
                              STATUS_STYLES[task.status]?.bg,
                              STATUS_STYLES[task.status]?.text
                            )}
                          >
                            <div className="flex items-center gap-1">
                              {task.isRecurring && <Repeat className="h-2 w-2 flex-shrink-0" />}
                              <span className="truncate">{task.title}</span>
                            </div>
                          </div>
                        ))}
                        {dayTasks.length > 3 && (
                          <p className="text-xs text-muted-foreground">
                            +{dayTasks.length - 3} more
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            // Week View
            <div>
              {/* Day Headers */}
              <div className="grid grid-cols-7 border-b">
                {getWeekDays().map((date, index) => (
                  <div
                    key={index}
                    className={cn(
                      "p-3 text-center border-r last:border-r-0",
                      isToday(date) && "bg-blue-50"
                    )}
                  >
                    <p className="text-sm text-muted-foreground">{DAYS[date.getDay()]}</p>
                    <p className={cn(
                      "text-lg font-semibold",
                      isToday(date) && "text-pulse-forest"
                    )}>
                      {date.getDate()}
                    </p>
                  </div>
                ))}
              </div>
              
              {/* Week Tasks */}
              <div className="grid grid-cols-7 min-h-[500px]">
                {getWeekDays().map((date, index) => {
                  const dayTasks = getTasksForDate(date);
                  
                  return (
                    <div
                      key={index}
                      onClick={() => handleDateClick(date)}
                      className={cn(
                        "p-2 border-r last:border-r-0 cursor-pointer",
                        isToday(date) && "bg-blue-50/50",
                        selectedDate?.toDateString() === date.toDateString() && "ring-2 ring-pulse-forest ring-inset"
                      )}
                    >
                      <ScrollArea className="h-[480px]">
                        <div className="space-y-2 pr-2">
                          {dayTasks
                            .sort((a, b) => a.time.localeCompare(b.time))
                            .map(task => (
                              <div
                                key={task.id}
                                onClick={(e) => handleTaskClick(task, e)}
                                className={cn(
                                  "p-2 rounded-lg border-l-4 cursor-pointer hover:shadow-md transition-shadow",
                                  CATEGORY_COLORS[task.category] || CATEGORY_COLORS.general,
                                  STATUS_STYLES[task.status]?.bg
                                )}
                              >
                                <div className="flex items-start justify-between gap-1">
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-1">
                                      {task.isRecurring && <Repeat className="h-3 w-3 flex-shrink-0 text-blue-500" />}
                                      <p className={cn(
                                        "text-sm font-medium truncate",
                                        task.status === 'completed' && "line-through"
                                      )}>
                                        {task.title}
                                      </p>
                                    </div>
                                    <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                                      <Clock className="h-3 w-3" />
                                      {task.time}
                                      {task.endTime && ` - ${task.endTime}`}
                                    </div>
                                    {task.location && (
                                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                        <MapPin className="h-3 w-3" />
                                        {task.location}
                                      </div>
                                    )}
                                    {task.checklistProgress && (
                                      <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                                        <ListChecks className="h-3 w-3" />
                                        {task.checklistProgress.completed}/{task.checklistProgress.total}
                                      </div>
                                    )}
                                  </div>
                                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${PRIORITY_COLORS[task.priority]}`} />
                                </div>
                              </div>
                            ))}
                          
                          {dayTasks.length === 0 && (
                            <div className="text-center py-8 text-muted-foreground">
                              <p className="text-xs">No tasks</p>
                            </div>
                          )}
                        </div>
                      </ScrollArea>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-4 text-sm">
        <span className="text-muted-foreground">Categories:</span>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded border-l-2 border-green-500 bg-green-100" />
          <span>Feeding</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded border-l-2 border-blue-500 bg-blue-100" />
          <span>Milking</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded border-l-2 border-red-500 bg-red-100" />
          <span>Health</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded border-l-2 border-orange-500 bg-orange-100" />
          <span>Maintenance</span>
        </div>
        <span className="text-muted-foreground ml-4">Priority:</span>
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full bg-red-500" />
          <span>Urgent</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full bg-orange-500" />
          <span>High</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full bg-yellow-500" />
          <span>Medium</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full bg-green-500" />
          <span>Low</span>
        </div>
      </div>

      {/* Create Task Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Create New Task</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="grid gap-2">
              <Label>Title *</Label>
              <Input
                value={newTask.title}
                onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
                placeholder="Task title..."
              />
            </div>
            
            <div className="grid gap-2">
              <Label>Description</Label>
              <Textarea
                value={newTask.description}
                onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
                placeholder="Task details..."
                rows={2}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Date *</Label>
                <Input
                  type="date"
                  value={newTask.date}
                  onChange={(e) => setNewTask({ ...newTask, date: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label>Time *</Label>
                <Input
                  type="time"
                  value={newTask.time}
                  onChange={(e) => setNewTask({ ...newTask, time: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Category</Label>
                <Select
                  value={newTask.category}
                  onValueChange={(v) => setNewTask({ ...newTask, category: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="general">General</SelectItem>
                    <SelectItem value="feeding">Feeding</SelectItem>
                    <SelectItem value="milking">Milking</SelectItem>
                    <SelectItem value="health">Health</SelectItem>
                    <SelectItem value="maintenance">Maintenance</SelectItem>
                    <SelectItem value="fencing">Fencing</SelectItem>
                    <SelectItem value="equipment">Equipment</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Priority</Label>
                <Select
                  value={newTask.priority}
                  onValueChange={(v: any) => setNewTask({ ...newTask, priority: v })}
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

            <div className="grid gap-2">
              <Label>Location</Label>
              <Input
                value={newTask.location}
                onChange={(e) => setNewTask({ ...newTask, location: e.target.value })}
                placeholder="e.g., Paddock A, Dairy Shed"
              />
            </div>

            <div className="grid gap-2">
              <Label>Assign To</Label>
              <div className="flex flex-wrap gap-2">
                {USERS.map((user) => (
                  <Button
                    key={user.id}
                    type="button"
                    variant={newTask.assignedTo.includes(user.id) ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => {
                      const assigned = newTask.assignedTo.includes(user.id)
                        ? newTask.assignedTo.filter(id => id !== user.id)
                        : [...newTask.assignedTo, user.id];
                      setNewTask({ ...newTask, assignedTo: assigned });
                    }}
                  >
                    {user.name}
                  </Button>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => createTaskMutation.mutate(newTask)}
              disabled={!newTask.title || !newTask.date || !newTask.time || createTaskMutation.isPending}
              className="bg-pulse-forest hover:bg-pulse-forest-dark"
            >
              {createTaskMutation.isPending ? 'Creating...' : 'Create Task'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Task Detail Dialog */}
      <Dialog open={!!selectedTask} onOpenChange={() => setSelectedTask(null)}>
        <DialogContent>
          {selectedTask && (
            <>
              <DialogHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    {selectedTask.isRecurring && (
                      <Badge variant="outline" className="text-blue-600">
                        <Repeat className="h-3 w-3 mr-1" />
                        Recurring
                      </Badge>
                    )}
                    <Badge className={`${PRIORITY_COLORS[selectedTask.priority]} text-white`}>
                      {selectedTask.priority}
                    </Badge>
                  </div>
                </div>
                <DialogTitle className="text-xl mt-2">{selectedTask.title}</DialogTitle>
              </DialogHeader>

              <div className="space-y-4 py-4">
                {selectedTask.description && (
                  <p className="text-muted-foreground">{selectedTask.description}</p>
                )}

                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="flex items-center gap-2">
                    <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                    <span>{new Date(selectedTask.date).toLocaleDateString('en-NZ', { weekday: 'long', month: 'short', day: 'numeric' })}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span>{selectedTask.time} {selectedTask.endTime && `- ${selectedTask.endTime}`}</span>
                  </div>
                  {selectedTask.location && (
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-muted-foreground" />
                      <span>{selectedTask.location}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <Briefcase className="h-4 w-4 text-muted-foreground" />
                    <span className="capitalize">{selectedTask.category}</span>
                  </div>
                </div>

                {selectedTask.assignedToNames && selectedTask.assignedToNames.length > 0 && (
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    <div className="flex -space-x-2">
                      {selectedTask.assignedToNames.map((name, idx) => (
                        <Avatar key={idx} className="h-8 w-8 border-2 border-white">
                          <AvatarFallback className="bg-pulse-forest text-white text-xs">
                            {name.charAt(0)}
                          </AvatarFallback>
                        </Avatar>
                      ))}
                    </div>
                    <span className="text-sm text-muted-foreground">
                      {selectedTask.assignedToNames.join(', ')}
                    </span>
                  </div>
                )}

                {selectedTask.checklistProgress && (
                  <div className="flex items-center gap-2">
                    <ListChecks className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">
                      Checklist: {selectedTask.checklistProgress.completed}/{selectedTask.checklistProgress.total} completed
                    </span>
                  </div>
                )}

                <div className="flex items-center gap-2 pt-2">
                  <span className="text-sm text-muted-foreground">Status:</span>
                  <Badge className={cn(STATUS_STYLES[selectedTask.status]?.bg, STATUS_STYLES[selectedTask.status]?.text)}>
                    {STATUS_STYLES[selectedTask.status]?.icon}
                    <span className="ml-1 capitalize">{selectedTask.status.replace('_', ' ')}</span>
                  </Badge>
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setSelectedTask(null)}>
                  Close
                </Button>
                <Button
                  onClick={() => {
                    // Navigate to job or recurring task page
                    window.location.href = selectedTask.type === 'job' 
                      ? '/app/jobs' 
                      : '/app/recurring-tasks';
                  }}
                >
                  View Full Details
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
