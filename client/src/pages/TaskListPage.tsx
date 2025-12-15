import { useState, useEffect, useCallback } from 'react';
import { pulseGet, pulsePatch } from '@/lib/pulseApi';
import { useAuth } from '@/lib/auth-context';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Plus,
  Search,
  Filter,
  Calendar,
  User,
  Clock,
  CheckCircle2,
  Circle,
  Loader2,
  AlertTriangle,
  Edit,
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import TaskForm from '@/components/TaskForm';

// Types
interface Task {
  id: string;
  farmId: string;
  jobId: string | null;
  title: string;
  description: string | null;
  status: 'pending' | 'in_progress' | 'done' | 'cancelled';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  assignedToId: string | null;
  createdById: string;
  dueDate: string | null;
  startDate: string | null;
  completedAt: string | null;
  completedById: string | null;
  estimatedMinutes: number | null;
  actualMinutes: number | null;
  location: string | null;
  checklistItems: { id: string; text: string; completed: boolean }[] | null;
  tags: string[] | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
}

// Manager roles that can create/assign tasks
const MANAGER_ROLES = ['owner', 'manager', 'admin'];

export default function TaskListPage() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('active');
  const [assigneeFilter, setAssigneeFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  
  // Form dialog
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);

  const isManager = user?.role && MANAGER_ROLES.includes(user.role.toLowerCase());

  // Load tasks
  const loadTasks = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const showCompleted = statusFilter === 'all' || statusFilter === 'done';
      const params = new URLSearchParams();
      if (showCompleted) params.set('showCompleted', 'true');
      if (statusFilter !== 'all' && statusFilter !== 'active') {
        params.set('status', statusFilter);
      }
      
      const queryString = params.toString();
      const url = queryString ? `/tasks?${queryString}` : '/tasks';
      const data = await pulseGet<Task[]>(url);
      setTasks(data);
    } catch (err) {
      console.error('Failed to load tasks:', err);
      setError('Failed to load tasks');
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  // Load users for assignee display
  const loadUsers = useCallback(async () => {
    try {
      const data = await pulseGet<User[]>('/users');
      setUsers(data);
    } catch (err) {
      console.error('Failed to load users:', err);
    }
  }, []);

  useEffect(() => {
    loadTasks();
    loadUsers();
  }, [loadTasks, loadUsers]);

  // Toggle task completion
  async function toggleTaskStatus(task: Task) {
    const newStatus = task.status === 'done' ? 'pending' : 'done';
    try {
      const updated = await pulsePatch<Task>(`/tasks/${task.id}`, { status: newStatus });
      setTasks(prev => prev.map(t => t.id === task.id ? updated : t));
      toast.success(newStatus === 'done' ? 'Task completed!' : 'Task reopened');
    } catch (err) {
      console.error('Failed to update task:', err);
      toast.error('Failed to update task');
    }
  }

  // Handle task saved (create or update)
  function handleTaskSaved(savedTask: Task) {
    if (editingTask) {
      setTasks(prev => prev.map(t => t.id === savedTask.id ? savedTask : t));
    } else {
      setTasks(prev => [savedTask, ...prev]);
    }
    setShowTaskForm(false);
    setEditingTask(null);
  }

  // Get user name by ID
  function getUserName(userId: string | null): string {
    if (!userId) return 'Unassigned';
    const found = users.find(u => u.id === userId);
    return found?.name || 'Unknown';
  }

  // Filter tasks
  const filteredTasks = tasks.filter(task => {
    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      if (!task.title.toLowerCase().includes(query) &&
          !task.description?.toLowerCase().includes(query)) {
        return false;
      }
    }
    
    // Assignee filter
    if (assigneeFilter === 'mine' && task.assignedToId !== user?.id) {
      return false;
    }
    if (assigneeFilter !== 'all' && assigneeFilter !== 'mine' && task.assignedToId !== assigneeFilter) {
      return false;
    }
    
    // Priority filter
    if (priorityFilter !== 'all' && task.priority !== priorityFilter) {
      return false;
    }
    
    return true;
  });

  // Get status badge
  function getStatusBadge(status: string) {
    switch (status) {
      case 'pending':
        return <Badge variant="outline" className="bg-gray-100">Pending</Badge>;
      case 'in_progress':
        return <Badge className="bg-blue-100 text-blue-800">In Progress</Badge>;
      case 'done':
        return <Badge className="bg-green-100 text-green-800">Done</Badge>;
      case 'cancelled':
        return <Badge className="bg-red-100 text-red-800">Cancelled</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  }

  // Get priority badge
  function getPriorityBadge(priority: string) {
    switch (priority) {
      case 'urgent':
        return <Badge className="bg-red-500 text-white">Urgent</Badge>;
      case 'high':
        return <Badge className="bg-orange-100 text-orange-800">High</Badge>;
      case 'medium':
        return <Badge className="bg-yellow-100 text-yellow-800">Medium</Badge>;
      case 'low':
        return <Badge className="bg-gray-100 text-gray-800">Low</Badge>;
      default:
        return null;
    }
  }

  // Format due date
  function formatDueDate(dateStr: string | null): string {
    if (!dateStr) return 'No due date';
    try {
      return format(new Date(dateStr), 'MMM d, yyyy');
    } catch {
      return dateStr;
    }
  }

  // Check if task is overdue
  function isOverdue(task: Task): boolean {
    if (!task.dueDate || task.status === 'done' || task.status === 'cancelled') return false;
    return new Date(task.dueDate) < new Date();
  }

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-pulse-green-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 max-w-4xl mx-auto">
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3 text-red-800">
              <AlertTriangle className="h-5 w-5" />
              <p>{error}</p>
            </div>
            <Button variant="outline" className="mt-4" onClick={loadTasks}>
              Try Again
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-pulse-green-800">Tasks</h1>
          <p className="text-gray-500">
            {isManager ? 'Manage farm tasks and assignments' : 'Your assigned tasks'}
          </p>
        </div>
        {isManager && (
          <Button onClick={() => { setEditingTask(null); setShowTaskForm(true); }}>
            <Plus className="h-4 w-4 mr-2" />
            New Task
          </Button>
        )}
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <CardContent className="pt-4">
          <div className="flex flex-wrap gap-4">
            {/* Search */}
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search tasks..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            {/* Status filter */}
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="done">Completed</SelectItem>
                <SelectItem value="all">All</SelectItem>
              </SelectContent>
            </Select>

            {/* Assignee filter */}
            <Select value={assigneeFilter} onValueChange={setAssigneeFilter}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Assignee" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Assignees</SelectItem>
                <SelectItem value="mine">My Tasks</SelectItem>
                {isManager && users.map(u => (
                  <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Priority filter */}
            <Select value={priorityFilter} onValueChange={setPriorityFilter}>
              <SelectTrigger className="w-[130px]">
                <SelectValue placeholder="Priority" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Priority</SelectItem>
                <SelectItem value="urgent">Urgent</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="low">Low</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Task List */}
      {filteredTasks.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-gray-500">
            <CheckCircle2 className="h-12 w-12 mx-auto mb-4 text-gray-300" />
            <p>No tasks found</p>
            {isManager && (
              <Button
                variant="outline"
                className="mt-4"
                onClick={() => { setEditingTask(null); setShowTaskForm(true); }}
              >
                Create your first task
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredTasks.map(task => (
            <Card
              key={task.id}
              className={`transition-all ${task.status === 'done' ? 'opacity-60' : ''} ${isOverdue(task) ? 'border-red-300' : ''}`}
            >
              <CardContent className="py-4">
                <div className="flex items-start gap-4">
                  {/* Checkbox */}
                  <div className="pt-1">
                    <Checkbox
                      checked={task.status === 'done'}
                      onCheckedChange={() => toggleTaskStatus(task)}
                      className="h-5 w-5"
                    />
                  </div>

                  {/* Task content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h3 className={`font-medium ${task.status === 'done' ? 'line-through text-gray-500' : ''}`}>
                          {task.title}
                        </h3>
                        {task.description && (
                          <p className="text-sm text-gray-500 mt-1 line-clamp-2">
                            {task.description}
                          </p>
                        )}
                      </div>
                      
                      {/* Edit button for managers */}
                      {isManager && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => { setEditingTask(task); setShowTaskForm(true); }}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                      )}
                    </div>

                    {/* Meta info */}
                    <div className="flex flex-wrap items-center gap-3 mt-3 text-sm">
                      {/* Status */}
                      {getStatusBadge(task.status)}
                      
                      {/* Priority */}
                      {getPriorityBadge(task.priority)}

                      {/* Assignee */}
                      <span className="flex items-center gap-1 text-gray-500">
                        <User className="h-3.5 w-3.5" />
                        {getUserName(task.assignedToId)}
                      </span>

                      {/* Due date */}
                      <span className={`flex items-center gap-1 ${isOverdue(task) ? 'text-red-600 font-medium' : 'text-gray-500'}`}>
                        <Calendar className="h-3.5 w-3.5" />
                        {formatDueDate(task.dueDate)}
                        {isOverdue(task) && ' (Overdue)'}
                      </span>

                      {/* Estimated time */}
                      {task.estimatedMinutes && (
                        <span className="flex items-center gap-1 text-gray-500">
                          <Clock className="h-3.5 w-3.5" />
                          {task.estimatedMinutes} min
                        </span>
                      )}
                    </div>

                    {/* Checklist progress */}
                    {task.checklistItems && task.checklistItems.length > 0 && (
                      <div className="mt-2">
                        <div className="flex items-center gap-2 text-sm text-gray-500">
                          <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-pulse-green-500 rounded-full"
                              style={{
                                width: `${(task.checklistItems.filter(i => i.completed).length / task.checklistItems.length) * 100}%`
                              }}
                            />
                          </div>
                          <span>
                            {task.checklistItems.filter(i => i.completed).length}/{task.checklistItems.length}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Task Form Dialog */}
      <Dialog open={showTaskForm} onOpenChange={setShowTaskForm}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingTask ? 'Edit Task' : 'Create New Task'}</DialogTitle>
          </DialogHeader>
          <TaskForm
            existingTask={editingTask}
            users={users}
            onSuccess={handleTaskSaved}
            onCancel={() => { setShowTaskForm(false); setEditingTask(null); }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
