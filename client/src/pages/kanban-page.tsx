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
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
  LayoutGrid,
  Plus,
  MoreVertical,
  Clock,
  MapPin,
  Users,
  Calendar,
  CheckCircle2,
  Circle,
  PlayCircle,
  AlertCircle,
  GripVertical,
  Filter,
  Search,
  ListChecks,
  ChevronDown,
  ChevronRight,
  Trash2,
  Edit,
  Eye,
} from 'lucide-react';

interface KanbanTask {
  id: string;
  title: string;
  description?: string;
  status: 'pending' | 'in-progress' | 'completed' | 'blocked';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  category: string;
  assignedTo?: string[];
  assignedToNames?: string[];
  dueDate?: string;
  dueTime?: string;
  location?: string;
  checklistItems?: { id: string; text: string; completed: boolean }[];
  tags?: string[];
  createdAt: string;
}

interface Column {
  id: string;
  title: string;
  status: string;
  color: string;
  icon: React.ReactNode;
}

const COLUMNS: Column[] = [
  { id: 'pending', title: 'To Do', status: 'pending', color: 'bg-gray-100 border-gray-300', icon: <Circle className="h-4 w-4 text-gray-500" /> },
  { id: 'in-progress', title: 'In Progress', status: 'in-progress', color: 'bg-blue-50 border-blue-300', icon: <PlayCircle className="h-4 w-4 text-blue-500" /> },
  { id: 'blocked', title: 'Blocked', status: 'blocked', color: 'bg-red-50 border-red-300', icon: <AlertCircle className="h-4 w-4 text-red-500" /> },
  { id: 'completed', title: 'Done', status: 'completed', color: 'bg-green-50 border-green-300', icon: <CheckCircle2 className="h-4 w-4 text-green-500" /> },
];

const PRIORITY_COLORS: Record<string, string> = {
  urgent: 'border-l-red-500 bg-red-50',
  high: 'border-l-orange-500 bg-orange-50',
  medium: 'border-l-yellow-500',
  low: 'border-l-green-500',
};

const PRIORITY_BADGES: Record<string, string> = {
  urgent: 'bg-red-100 text-red-800',
  high: 'bg-orange-100 text-orange-800',
  medium: 'bg-yellow-100 text-yellow-800',
  low: 'bg-green-100 text-green-800',
};

const CATEGORY_COLORS: Record<string, string> = {
  feeding: 'bg-green-500',
  milking: 'bg-blue-500',
  health: 'bg-red-500',
  maintenance: 'bg-orange-500',
  fencing: 'bg-yellow-500',
  equipment: 'bg-purple-500',
  general: 'bg-gray-500',
};

const USERS = [
  { id: 'user-1', name: 'John Smith' },
  { id: 'user-2', name: 'Sarah Johnson' },
  { id: 'user-3', name: 'Mike Wilson' },
  { id: 'user-4', name: 'Emily Brown' },
];

export default function KanbanPage() {
  const queryClient = useQueryClient();
  const [draggedTask, setDraggedTask] = useState<KanbanTask | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterPriority, setFilterPriority] = useState('all');
  const [filterAssignee, setFilterAssignee] = useState('all');
  const [collapsedSwimlanes, setCollapsedSwimlanes] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<'board' | 'swimlane'>('board');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<KanbanTask | null>(null);
  const [createInColumn, setCreateInColumn] = useState<string>('pending');

  // New task form
  const [newTask, setNewTask] = useState({
    title: '',
    description: '',
    priority: 'medium' as const,
    category: 'general',
    assignedTo: [] as string[],
    dueDate: '',
    dueTime: '',
    location: '',
  });

  // Fetch jobs as tasks
  const { data: jobs = [], isLoading } = useQuery<any[]>({
    queryKey: ['kanbanJobs'],
    queryFn: async () => {
      const res = await fetch('/api/jobs');
      if (!res.ok) throw new Error('Failed to fetch jobs');
      return res.json();
    },
  });

  // Transform jobs to kanban tasks
  const tasks: KanbanTask[] = useMemo(() => {
    return jobs.map(job => ({
      id: job.id,
      title: job.title,
      description: job.description,
      status: job.status === 'in-progress' ? 'in-progress' : job.status,
      priority: job.priority,
      category: job.category || 'general',
      assignedTo: job.assignedTo,
      assignedToNames: job.assignedToNames,
      dueDate: job.startDate,
      dueTime: job.startTime,
      location: job.location,
      checklistItems: job.checklistItems,
      createdAt: job.createdAt,
    }));
  }, [jobs]);

  // Filter tasks
  const filteredTasks = useMemo(() => {
    return tasks.filter(task => {
      if (searchQuery && !task.title.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      if (filterCategory !== 'all' && task.category !== filterCategory) return false;
      if (filterPriority !== 'all' && task.priority !== filterPriority) return false;
      if (filterAssignee !== 'all' && !task.assignedTo?.includes(filterAssignee)) return false;
      return true;
    });
  }, [tasks, searchQuery, filterCategory, filterPriority, filterAssignee]);

  // Group tasks by column
  const tasksByColumn = useMemo(() => {
    const grouped: Record<string, KanbanTask[]> = {};
    COLUMNS.forEach(col => {
      grouped[col.status] = filteredTasks.filter(t => t.status === col.status);
    });
    return grouped;
  }, [filteredTasks]);

  // Group tasks by category for swimlane view
  const tasksByCategory = useMemo(() => {
    const categories = Array.from(new Set(filteredTasks.map(t => t.category)));
    return categories.map(category => ({
      category,
      tasks: filteredTasks.filter(t => t.category === category),
    }));
  }, [filteredTasks]);

  // Update task status mutation
  const updateStatusMutation = useMutation({
    mutationFn: async ({ taskId, newStatus }: { taskId: string; newStatus: string }) => {
      const res = await fetch(`/api/jobs/${taskId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) throw new Error('Failed to update status');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kanbanJobs'] });
    },
  });

  // Create task mutation
  const createTaskMutation = useMutation({
    mutationFn: async (data: typeof newTask & { status: string }) => {
      const res = await fetch('/api/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...data,
          startDate: data.dueDate || new Date().toISOString().split('T')[0],
          startTime: data.dueTime || '09:00',
          assignedTo: JSON.stringify(data.assignedTo.length > 0 ? data.assignedTo : ['user-1']),
        }),
      });
      if (!res.ok) throw new Error('Failed to create task');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kanbanJobs'] });
      setIsCreateDialogOpen(false);
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
      priority: 'medium',
      category: 'general',
      assignedTo: [],
      dueDate: '',
      dueTime: '',
      location: '',
    });
  };

  // Drag and drop handlers
  const handleDragStart = (e: React.DragEvent, task: KanbanTask) => {
    setDraggedTask(task);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', task.id);
  };

  const handleDragOver = (e: React.DragEvent, columnId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverColumn(columnId);
  };

  const handleDragLeave = () => {
    setDragOverColumn(null);
  };

  const handleDrop = (e: React.DragEvent, columnId: string) => {
    e.preventDefault();
    setDragOverColumn(null);
    
    if (draggedTask && draggedTask.status !== columnId) {
      updateStatusMutation.mutate({
        taskId: draggedTask.id,
        newStatus: columnId,
      });
      toast.success(`Moved "${draggedTask.title}" to ${COLUMNS.find(c => c.id === columnId)?.title}`);
    }
    
    setDraggedTask(null);
  };

  const handleDragEnd = () => {
    setDraggedTask(null);
    setDragOverColumn(null);
  };

  // Toggle swimlane collapse
  const toggleSwimlane = (category: string) => {
    setCollapsedSwimlanes(prev => {
      const newCollapsed = new Set(Array.from(prev));
      if (newCollapsed.has(category)) {
        newCollapsed.delete(category);
      } else {
        newCollapsed.add(category);
      }
      return newCollapsed;
    });
  };

  // Get checklist progress
  const getChecklistProgress = (items?: { completed: boolean }[]) => {
    if (!items || items.length === 0) return null;
    const completed = items.filter(i => i.completed).length;
    return { completed, total: items.length, percent: Math.round((completed / items.length) * 100) };
  };

  // Format date
  const formatDate = (dateStr?: string) => {
    if (!dateStr) return null;
    const date = new Date(dateStr);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    if (date.toDateString() === today.toDateString()) return 'Today';
    if (date.toDateString() === tomorrow.toDateString()) return 'Tomorrow';
    return date.toLocaleDateString('en-NZ', { month: 'short', day: 'numeric' });
  };

  // Task card component
  const TaskCard = ({ task }: { task: KanbanTask }) => {
    const checklistProgress = getChecklistProgress(task.checklistItems);
    const isOverdue = task.dueDate && new Date(task.dueDate) < new Date() && task.status !== 'completed';
    
    return (
      <div
        draggable
        onDragStart={(e) => handleDragStart(e, task)}
        onDragEnd={handleDragEnd}
        onClick={() => setSelectedTask(task)}
        className={cn(
          "bg-white rounded-lg border-l-4 shadow-sm p-3 cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow",
          PRIORITY_COLORS[task.priority],
          draggedTask?.id === task.id && "opacity-50"
        )}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-2 mb-2">
          <h4 className="font-medium text-sm line-clamp-2">{task.title}</h4>
          <Badge className={cn("text-xs flex-shrink-0", PRIORITY_BADGES[task.priority])}>
            {task.priority}
          </Badge>
        </div>

        {/* Description */}
        {task.description && (
          <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
            {task.description}
          </p>
        )}

        {/* Meta info */}
        <div className="space-y-1.5">
          {/* Category */}
          <div className="flex items-center gap-2">
            <div className={cn("w-2 h-2 rounded-full", CATEGORY_COLORS[task.category])} />
            <span className="text-xs text-muted-foreground capitalize">{task.category}</span>
          </div>

          {/* Due date */}
          {task.dueDate && (
            <div className={cn(
              "flex items-center gap-1 text-xs",
              isOverdue ? "text-red-600" : "text-muted-foreground"
            )}>
              <Calendar className="h-3 w-3" />
              <span>{formatDate(task.dueDate)}</span>
              {task.dueTime && <span>at {task.dueTime}</span>}
            </div>
          )}

          {/* Location */}
          {task.location && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <MapPin className="h-3 w-3" />
              <span className="truncate">{task.location}</span>
            </div>
          )}

          {/* Checklist progress */}
          {checklistProgress && (
            <div className="flex items-center gap-2">
              <ListChecks className="h-3 w-3 text-muted-foreground" />
              <Progress value={checklistProgress.percent} className="h-1.5 flex-1" />
              <span className="text-xs text-muted-foreground">
                {checklistProgress.completed}/{checklistProgress.total}
              </span>
            </div>
          )}
        </div>

        {/* Footer - Assignees */}
        {task.assignedToNames && task.assignedToNames.length > 0 && (
          <div className="flex items-center justify-between mt-3 pt-2 border-t">
            <div className="flex -space-x-2">
              {task.assignedToNames.slice(0, 3).map((name, idx) => (
                <Avatar key={idx} className="h-6 w-6 border-2 border-white">
                  <AvatarFallback className="bg-pulse-forest text-white text-xs">
                    {name.charAt(0)}
                  </AvatarFallback>
                </Avatar>
              ))}
              {task.assignedToNames.length > 3 && (
                <div className="h-6 w-6 rounded-full bg-gray-200 border-2 border-white flex items-center justify-center text-xs">
                  +{task.assignedToNames.length - 3}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  // Column component
  const KanbanColumn = ({ column }: { column: Column }) => {
    const columnTasks = tasksByColumn[column.status] || [];
    const isOver = dragOverColumn === column.id;
    
    return (
      <div
        className={cn(
          "flex-1 min-w-[280px] max-w-[350px] rounded-lg border-2 transition-colors",
          column.color,
          isOver && "border-pulse-forest border-dashed bg-pulse-forest/5"
        )}
        onDragOver={(e) => handleDragOver(e, column.id)}
        onDragLeave={handleDragLeave}
        onDrop={(e) => handleDrop(e, column.id)}
      >
        {/* Column Header */}
        <div className="p-3 border-b flex items-center justify-between">
          <div className="flex items-center gap-2">
            {column.icon}
            <h3 className="font-semibold">{column.title}</h3>
            <Badge variant="secondary" className="h-5 px-1.5">
              {columnTasks.length}
            </Badge>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0"
            onClick={() => {
              setCreateInColumn(column.id);
              setIsCreateDialogOpen(true);
            }}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>

        {/* Tasks */}
        <ScrollArea className="h-[calc(100vh-320px)]">
          <div className="p-2 space-y-2">
            {columnTasks.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <p className="text-sm">No tasks</p>
                <p className="text-xs">Drag tasks here or click + to add</p>
              </div>
            ) : (
              columnTasks.map(task => (
                <TaskCard key={task.id} task={task} />
              ))
            )}
          </div>
        </ScrollArea>
      </div>
    );
  };

  return (
    <div className="container mx-auto p-6 space-y-4">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <LayoutGrid className="h-8 w-8 text-pulse-forest" />
            Kanban Board
          </h1>
          <p className="text-muted-foreground mt-1">
            Visual task management with drag-and-drop
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={viewMode === 'board' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('board')}
          >
            Board
          </Button>
          <Button
            variant={viewMode === 'swimlane' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('swimlane')}
          >
            Swimlanes
          </Button>
          <Button
            onClick={() => {
              setCreateInColumn('pending');
              setIsCreateDialogOpen(true);
            }}
            className="bg-pulse-forest hover:bg-pulse-forest-dark"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Task
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex-1 min-w-[200px] max-w-sm">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search tasks..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            
            <Select value={filterCategory} onValueChange={setFilterCategory}>
              <SelectTrigger className="w-[140px]">
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
                <SelectItem value="general">General</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filterPriority} onValueChange={setFilterPriority}>
              <SelectTrigger className="w-[130px]">
                <SelectValue placeholder="Priority" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Priorities</SelectItem>
                <SelectItem value="urgent">🔴 Urgent</SelectItem>
                <SelectItem value="high">🟠 High</SelectItem>
                <SelectItem value="medium">🟡 Medium</SelectItem>
                <SelectItem value="low">🟢 Low</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filterAssignee} onValueChange={setFilterAssignee}>
              <SelectTrigger className="w-[150px]">
                <Users className="h-4 w-4 mr-1" />
                <SelectValue placeholder="Assignee" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Assignees</SelectItem>
                {USERS.map(user => (
                  <SelectItem key={user.id} value={user.id}>{user.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Stats */}
            <div className="flex items-center gap-4 ml-auto text-sm">
              <div className="flex items-center gap-1">
                <Circle className="h-3 w-3 text-gray-500" />
                <span>{tasksByColumn['pending']?.length || 0}</span>
              </div>
              <div className="flex items-center gap-1">
                <PlayCircle className="h-3 w-3 text-blue-500" />
                <span>{tasksByColumn['in-progress']?.length || 0}</span>
              </div>
              <div className="flex items-center gap-1">
                <AlertCircle className="h-3 w-3 text-red-500" />
                <span>{tasksByColumn['blocked']?.length || 0}</span>
              </div>
              <div className="flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3 text-green-500" />
                <span>{tasksByColumn['completed']?.length || 0}</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Board View */}
      {viewMode === 'board' && (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {COLUMNS.map(column => (
            <KanbanColumn key={column.id} column={column} />
          ))}
        </div>
      )}

      {/* Swimlane View */}
      {viewMode === 'swimlane' && (
        <div className="space-y-4">
          {tasksByCategory.map(({ category, tasks: categoryTasks }) => (
            <Card key={category}>
              <CardHeader
                className="py-3 cursor-pointer hover:bg-muted/50"
                onClick={() => toggleSwimlane(category)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {collapsedSwimlanes.has(category) ? (
                      <ChevronRight className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                    <div className={cn("w-3 h-3 rounded-full", CATEGORY_COLORS[category])} />
                    <CardTitle className="text-base capitalize">{category}</CardTitle>
                    <Badge variant="secondary">{categoryTasks.length}</Badge>
                  </div>
                </div>
              </CardHeader>
              {!collapsedSwimlanes.has(category) && (
                <CardContent className="pt-0">
                  <div className="flex gap-4 overflow-x-auto pb-2">
                    {COLUMNS.map(column => {
                      const columnTasks = categoryTasks.filter(t => t.status === column.status);
                      return (
                        <div
                          key={column.id}
                          className={cn(
                            "flex-1 min-w-[250px] max-w-[300px] rounded-lg border p-2",
                            column.color,
                            dragOverColumn === `${category}-${column.id}` && "border-pulse-forest border-dashed"
                          )}
                          onDragOver={(e) => handleDragOver(e, column.id)}
                          onDragLeave={handleDragLeave}
                          onDrop={(e) => handleDrop(e, column.id)}
                        >
                          <div className="flex items-center gap-2 mb-2 px-1">
                            {column.icon}
                            <span className="text-sm font-medium">{column.title}</span>
                            <Badge variant="outline" className="h-5 px-1 text-xs">
                              {columnTasks.length}
                            </Badge>
                          </div>
                          <div className="space-y-2">
                            {columnTasks.map(task => (
                              <TaskCard key={task.id} task={task} />
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              )}
            </Card>
          ))}
        </div>
      )}

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

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Due Date</Label>
                <Input
                  type="date"
                  value={newTask.dueDate}
                  onChange={(e) => setNewTask({ ...newTask, dueDate: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label>Time</Label>
                <Input
                  type="time"
                  value={newTask.dueTime}
                  onChange={(e) => setNewTask({ ...newTask, dueTime: e.target.value })}
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label>Location</Label>
              <Input
                value={newTask.location}
                onChange={(e) => setNewTask({ ...newTask, location: e.target.value })}
                placeholder="e.g., Paddock A"
              />
            </div>

            <div className="grid gap-2">
              <Label>Assign To</Label>
              <div className="flex flex-wrap gap-2">
                {USERS.map(user => (
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
              onClick={() => createTaskMutation.mutate({ ...newTask, status: createInColumn })}
              disabled={!newTask.title || createTaskMutation.isPending}
              className="bg-pulse-forest hover:bg-pulse-forest-dark"
            >
              Create Task
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Task Detail Dialog */}
      <Dialog open={!!selectedTask} onOpenChange={() => setSelectedTask(null)}>
        <DialogContent className="max-w-lg">
          {selectedTask && (
            <>
              <DialogHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <div className={cn("w-3 h-3 rounded-full", CATEGORY_COLORS[selectedTask.category])} />
                    <Badge className={PRIORITY_BADGES[selectedTask.priority]}>
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
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span>{formatDate(selectedTask.dueDate) || 'No due date'}</span>
                  </div>
                  {selectedTask.dueTime && (
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <span>{selectedTask.dueTime}</span>
                    </div>
                  )}
                  {selectedTask.location && (
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-muted-foreground" />
                      <span>{selectedTask.location}</span>
                    </div>
                  )}
                </div>

                {selectedTask.assignedToNames && selectedTask.assignedToNames.length > 0 && (
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">{selectedTask.assignedToNames.join(', ')}</span>
                  </div>
                )}

                {selectedTask.checklistItems && selectedTask.checklistItems.length > 0 && (
                  <div className="border rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <ListChecks className="h-4 w-4" />
                      <span className="font-medium text-sm">Checklist</span>
                      <Badge variant="secondary" className="text-xs">
                        {selectedTask.checklistItems.filter(i => i.completed).length}/{selectedTask.checklistItems.length}
                      </Badge>
                    </div>
                    <div className="space-y-2">
                      {selectedTask.checklistItems.map(item => (
                        <div key={item.id} className="flex items-center gap-2">
                          <Checkbox checked={item.completed} disabled />
                          <span className={cn("text-sm", item.completed && "line-through text-muted-foreground")}>
                            {item.text}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Quick Actions */}
                <div className="flex gap-2 pt-2">
                  {COLUMNS.filter(c => c.id !== selectedTask.status).map(column => (
                    <Button
                      key={column.id}
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        updateStatusMutation.mutate({
                          taskId: selectedTask.id,
                          newStatus: column.id,
                        });
                        setSelectedTask(null);
                        toast.success(`Moved to ${column.title}`);
                      }}
                    >
                      {column.icon}
                      <span className="ml-1">{column.title}</span>
                    </Button>
                  ))}
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setSelectedTask(null)}>
                  Close
                </Button>
                <Button onClick={() => window.location.href = '/app/jobs'}>
                  <Eye className="h-4 w-4 mr-1" />
                  View in Jobs
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
