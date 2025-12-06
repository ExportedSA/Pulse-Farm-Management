import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
  GitBranch,
  Plus,
  ArrowRight,
  ArrowDown,
  Link2,
  Unlink,
  Lock,
  Unlock,
  CheckCircle2,
  Circle,
  PlayCircle,
  AlertTriangle,
  Clock,
  Trash2,
  Eye,
  ChevronRight,
  ChevronDown,
  Network,
  ListTree,
  Filter,
  Search,
} from 'lucide-react';

interface TaskDependency {
  id: string;
  predecessorId: string;
  predecessorTitle: string;
  successorId: string;
  successorTitle: string;
  type: string;
  lagTime?: number;
  createdAt: string;
  createdBy: string;
}

interface TaskWithDependencies {
  id: string;
  title: string;
  status: string;
  priority: string;
  category: string;
  startDate?: string;
  dependencies: {
    predecessors: TaskDependency[];
    successors: TaskDependency[];
  };
  isBlocked: boolean;
  blockingTasks: string[];
  canStart: boolean;
  predecessorCount: number;
  successorCount: number;
}

interface DependencyType {
  id: string;
  label: string;
  description: string;
  shortLabel: string;
  isDefault?: boolean;
}

const STATUS_ICONS: Record<string, React.ReactNode> = {
  pending: <Circle className="h-4 w-4 text-gray-500" />,
  'in-progress': <PlayCircle className="h-4 w-4 text-blue-500" />,
  completed: <CheckCircle2 className="h-4 w-4 text-green-500" />,
  blocked: <Lock className="h-4 w-4 text-red-500" />,
};

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-gray-100 text-gray-800',
  'in-progress': 'bg-blue-100 text-blue-800',
  completed: 'bg-green-100 text-green-800',
  blocked: 'bg-red-100 text-red-800',
};

const PRIORITY_COLORS: Record<string, string> = {
  urgent: 'border-l-red-500',
  high: 'border-l-orange-500',
  medium: 'border-l-yellow-500',
  low: 'border-l-green-500',
};

export default function TaskDependenciesPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('list');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterBlocked, setFilterBlocked] = useState(false);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<TaskWithDependencies | null>(null);
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set());

  // Form state
  const [newDependency, setNewDependency] = useState({
    predecessorId: '',
    successorId: '',
    type: 'finish_to_start',
    lagTime: '',
  });

  // Fetch tasks with dependencies
  const { data: tasksData, isLoading } = useQuery<{ tasks: TaskWithDependencies[]; stats: any }>({
    queryKey: ['taskDependencies'],
    queryFn: async () => {
      const res = await fetch('/api/task-dependencies/tasks');
      if (!res.ok) throw new Error('Failed to fetch tasks');
      return res.json();
    },
  });

  // Fetch dependency types
  const { data: dependencyTypes = [] } = useQuery<DependencyType[]>({
    queryKey: ['dependencyTypes'],
    queryFn: async () => {
      const res = await fetch('/api/task-dependencies/types');
      if (!res.ok) throw new Error('Failed to fetch types');
      return res.json();
    },
  });

  // Fetch critical path
  const { data: criticalPath } = useQuery({
    queryKey: ['criticalPath'],
    queryFn: async () => {
      const res = await fetch('/api/task-dependencies/critical-path');
      if (!res.ok) throw new Error('Failed to fetch critical path');
      return res.json();
    },
  });

  const tasks = tasksData?.tasks || [];
  const stats = tasksData?.stats;

  // Filter tasks
  const filteredTasks = tasks.filter(task => {
    if (searchQuery && !task.title.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    if (filterBlocked && !task.isBlocked) return false;
    return true;
  });

  // Create dependency mutation
  const createMutation = useMutation({
    mutationFn: async (data: typeof newDependency) => {
      const res = await fetch('/api/task-dependencies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...data,
          lagTime: data.lagTime ? parseInt(data.lagTime) : undefined,
        }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to create dependency');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['taskDependencies'] });
      queryClient.invalidateQueries({ queryKey: ['criticalPath'] });
      setIsCreateDialogOpen(false);
      setNewDependency({ predecessorId: '', successorId: '', type: 'finish_to_start', lagTime: '' });
      toast.success('Dependency created');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  // Delete dependency mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/task-dependencies/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete dependency');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['taskDependencies'] });
      queryClient.invalidateQueries({ queryKey: ['criticalPath'] });
      toast.success('Dependency removed');
    },
  });

  // Toggle task expansion
  const toggleExpand = (taskId: string) => {
    setExpandedTasks(prev => {
      const newSet = new Set(Array.from(prev));
      if (newSet.has(taskId)) {
        newSet.delete(taskId);
      } else {
        newSet.add(taskId);
      }
      return newSet;
    });
  };

  // Get dependency type label
  const getTypeLabel = (type: string) => {
    const depType = dependencyTypes.find(t => t.id === type);
    return depType?.shortLabel || type;
  };

  // Render dependency chain node
  const renderChainNode = (task: TaskWithDependencies, level: number = 0) => {
    const isExpanded = expandedTasks.has(task.id);
    const hasSuccessors = task.dependencies.successors.length > 0;

    return (
      <div key={task.id} className="relative">
        {/* Connection line */}
        {level > 0 && (
          <div className="absolute left-4 -top-4 w-0.5 h-4 bg-gray-300" />
        )}
        
        <div
          className={cn(
            "flex items-center gap-2 p-3 rounded-lg border-l-4 bg-white shadow-sm mb-2",
            PRIORITY_COLORS[task.priority],
            task.isBlocked && "bg-red-50 border-red-200"
          )}
          style={{ marginLeft: level * 24 }}
        >
          {hasSuccessors && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0"
              onClick={() => toggleExpand(task.id)}
            >
              {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </Button>
          )}
          {!hasSuccessors && <div className="w-6" />}
          
          {STATUS_ICONS[task.isBlocked ? 'blocked' : task.status]}
          
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm truncate">{task.title}</p>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="capitalize">{task.category}</span>
              {task.isBlocked && (
                <span className="text-red-600 flex items-center gap-1">
                  <Lock className="h-3 w-3" />
                  Blocked by {task.blockingTasks.length} task(s)
                </span>
              )}
            </div>
          </div>

          <Badge className={STATUS_COLORS[task.status]} variant="secondary">
            {task.status}
          </Badge>

          {task.predecessorCount > 0 && (
            <Badge variant="outline" className="text-xs">
              {task.predecessorCount} dep
            </Badge>
          )}
        </div>

        {/* Successors */}
        {isExpanded && task.dependencies.successors.map(dep => {
          const successorTask = tasks.find(t => t.id === dep.successorId);
          if (!successorTask) return null;
          return (
            <div key={dep.id} className="relative">
              <div 
                className="absolute left-8 top-0 flex items-center text-xs text-muted-foreground"
                style={{ marginLeft: level * 24 }}
              >
                <ArrowDown className="h-3 w-3 mr-1" />
                <span className="bg-gray-100 px-1 rounded">{getTypeLabel(dep.type)}</span>
                {dep.lagTime && <span className="ml-1">+{dep.lagTime}m</span>}
              </div>
              {renderChainNode(successorTask, level + 1)}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <GitBranch className="h-8 w-8 text-pulse-forest" />
            Task Dependencies
          </h1>
          <p className="text-muted-foreground mt-1">
            Manage task relationships and blocking dependencies
          </p>
        </div>
        <Button onClick={() => setIsCreateDialogOpen(true)} className="bg-pulse-forest hover:bg-pulse-forest-dark">
          <Plus className="h-4 w-4 mr-2" />
          Add Dependency
        </Button>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold">{stats.totalTasks}</p>
              <p className="text-sm text-muted-foreground">Total Tasks</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold">{stats.totalDependencies}</p>
              <p className="text-sm text-muted-foreground">Dependencies</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-blue-600">{stats.tasksWithDependencies}</p>
              <p className="text-sm text-muted-foreground">Linked Tasks</p>
            </CardContent>
          </Card>
          <Card className={stats.blockedTasks > 0 ? "border-red-200 bg-red-50" : ""}>
            <CardContent className="p-4 text-center">
              <p className={cn("text-2xl font-bold", stats.blockedTasks > 0 && "text-red-600")}>
                {stats.blockedTasks}
              </p>
              <p className="text-sm text-muted-foreground">Blocked Tasks</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Critical Path Alert */}
      {criticalPath && criticalPath.length > 2 && (
        <Card className="border-purple-200 bg-purple-50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Network className="h-5 w-5 text-purple-600" />
              <div className="flex-1">
                <p className="font-medium text-purple-800">Critical Path: {criticalPath.length} tasks</p>
                <p className="text-sm text-purple-700">
                  {criticalPath.tasks?.map((t: any) => t?.title).join(' → ')}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

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
            <Button
              variant={filterBlocked ? "default" : "outline"}
              size="sm"
              onClick={() => setFilterBlocked(!filterBlocked)}
            >
              <Lock className="h-4 w-4 mr-1" />
              Blocked Only
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Main Content */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="list" className="flex items-center gap-1">
            <ListTree className="h-4 w-4" />
            List View
          </TabsTrigger>
          <TabsTrigger value="chain" className="flex items-center gap-1">
            <Network className="h-4 w-4" />
            Chain View
          </TabsTrigger>
          <TabsTrigger value="matrix" className="flex items-center gap-1">
            <GitBranch className="h-4 w-4" />
            Dependencies
          </TabsTrigger>
        </TabsList>

        {/* List View */}
        <TabsContent value="list" className="space-y-4">
          {isLoading ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                Loading tasks...
              </CardContent>
            </Card>
          ) : filteredTasks.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                <GitBranch className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>No tasks found</p>
              </CardContent>
            </Card>
          ) : (
            filteredTasks.map(task => (
              <Card
                key={task.id}
                className={cn(
                  "hover:shadow-md transition-shadow",
                  task.isBlocked && "border-red-200 bg-red-50"
                )}
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-4">
                    {/* Status Icon */}
                    <div className={cn(
                      "w-10 h-10 rounded-lg flex items-center justify-center",
                      task.isBlocked ? "bg-red-100" : 
                      task.status === 'completed' ? "bg-green-100" :
                      task.status === 'in-progress' ? "bg-blue-100" : "bg-gray-100"
                    )}>
                      {task.isBlocked ? (
                        <Lock className="h-5 w-5 text-red-600" />
                      ) : (
                        STATUS_ICONS[task.status]
                      )}
                    </div>

                    {/* Task Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h3 className="font-semibold">{task.title}</h3>
                          <p className="text-sm text-muted-foreground capitalize">
                            {task.category} • {task.priority} priority
                          </p>
                        </div>
                        <Badge className={STATUS_COLORS[task.status]}>
                          {task.status}
                        </Badge>
                      </div>

                      {/* Blocking Info */}
                      {task.isBlocked && task.blockingTasks.length > 0 && (
                        <div className="mt-2 p-2 bg-red-100 rounded-lg">
                          <p className="text-sm text-red-800 flex items-center gap-1">
                            <AlertTriangle className="h-4 w-4" />
                            Blocked by: {task.blockingTasks.join(', ')}
                          </p>
                        </div>
                      )}

                      {/* Dependencies */}
                      <div className="flex flex-wrap gap-2 mt-3">
                        {task.dependencies.predecessors.map(dep => (
                          <div
                            key={dep.id}
                            className="flex items-center gap-1 text-xs bg-gray-100 rounded-full px-2 py-1"
                          >
                            <ArrowRight className="h-3 w-3 text-gray-500" />
                            <span className="truncate max-w-[150px]">{dep.predecessorTitle}</span>
                            <span className="text-gray-400">({getTypeLabel(dep.type)})</span>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-4 w-4 p-0 ml-1"
                              onClick={() => deleteMutation.mutate(dep.id)}
                            >
                              <Trash2 className="h-3 w-3 text-gray-400 hover:text-red-500" />
                            </Button>
                          </div>
                        ))}
                        {task.dependencies.successors.map(dep => (
                          <div
                            key={dep.id}
                            className="flex items-center gap-1 text-xs bg-blue-50 rounded-full px-2 py-1"
                          >
                            <span className="truncate max-w-[150px]">{dep.successorTitle}</span>
                            <ArrowRight className="h-3 w-3 text-blue-500" />
                            <span className="text-blue-400">({getTypeLabel(dep.type)})</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setNewDependency({ ...newDependency, successorId: task.id });
                          setIsCreateDialogOpen(true);
                        }}
                      >
                        <Link2 className="h-4 w-4 mr-1" />
                        Add Dependency
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        {/* Chain View */}
        <TabsContent value="chain" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Dependency Chains</CardTitle>
              <CardDescription>Visual representation of task dependencies</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[500px]">
                {/* Find root tasks (no predecessors) */}
                {tasks
                  .filter(t => t.predecessorCount === 0)
                  .map(task => renderChainNode(task, 0))}
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Dependencies Matrix */}
        <TabsContent value="matrix" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">All Dependencies</CardTitle>
              <CardDescription>Complete list of task dependencies</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px]">
                <div className="space-y-2">
                  {tasks
                    .flatMap(t => t.dependencies.predecessors)
                    .filter((dep, index, self) => 
                      index === self.findIndex(d => d.id === dep.id)
                    )
                    .map(dep => (
                      <div
                        key={dep.id}
                        className="flex items-center gap-3 p-3 border rounded-lg hover:bg-muted/50"
                      >
                        <div className="flex-1 flex items-center gap-2">
                          <div className="flex-1 text-right">
                            <p className="font-medium text-sm">{dep.predecessorTitle}</p>
                          </div>
                          <div className="flex items-center gap-1 px-3">
                            <ArrowRight className="h-4 w-4 text-gray-400" />
                            <Badge variant="outline" className="text-xs">
                              {getTypeLabel(dep.type)}
                            </Badge>
                            {dep.lagTime && (
                              <span className="text-xs text-muted-foreground">+{dep.lagTime}m</span>
                            )}
                            <ArrowRight className="h-4 w-4 text-gray-400" />
                          </div>
                          <div className="flex-1">
                            <p className="font-medium text-sm">{dep.successorTitle}</p>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteMutation.mutate(dep.id)}
                        >
                          <Trash2 className="h-4 w-4 text-gray-400 hover:text-red-500" />
                        </Button>
                      </div>
                    ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Create Dependency Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Task Dependency</DialogTitle>
            <DialogDescription>
              Define a relationship between two tasks
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid gap-2">
              <Label>Predecessor Task (must complete first)</Label>
              <Select
                value={newDependency.predecessorId}
                onValueChange={(v) => setNewDependency({ ...newDependency, predecessorId: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select predecessor task..." />
                </SelectTrigger>
                <SelectContent>
                  {tasks
                    .filter(t => t.id !== newDependency.successorId)
                    .map(task => (
                      <SelectItem key={task.id} value={task.id}>
                        {task.title}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex justify-center">
              <div className="flex items-center gap-2 text-muted-foreground">
                <ArrowDown className="h-5 w-5" />
                <span className="text-sm">depends on</span>
              </div>
            </div>

            <div className="grid gap-2">
              <Label>Successor Task (blocked until predecessor completes)</Label>
              <Select
                value={newDependency.successorId}
                onValueChange={(v) => setNewDependency({ ...newDependency, successorId: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select successor task..." />
                </SelectTrigger>
                <SelectContent>
                  {tasks
                    .filter(t => t.id !== newDependency.predecessorId)
                    .map(task => (
                      <SelectItem key={task.id} value={task.id}>
                        {task.title}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Dependency Type</Label>
                <Select
                  value={newDependency.type}
                  onValueChange={(v) => setNewDependency({ ...newDependency, type: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {dependencyTypes.map(type => (
                      <SelectItem key={type.id} value={type.id}>
                        <div>
                          <p className="font-medium">{type.label}</p>
                          <p className="text-xs text-muted-foreground">{type.description}</p>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Lag Time (minutes)</Label>
                <Input
                  type="number"
                  value={newDependency.lagTime}
                  onChange={(e) => setNewDependency({ ...newDependency, lagTime: e.target.value })}
                  placeholder="0"
                />
                <p className="text-xs text-muted-foreground">
                  Wait time after dependency is met
                </p>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => createMutation.mutate(newDependency)}
              disabled={!newDependency.predecessorId || !newDependency.successorId || createMutation.isPending}
            >
              <Link2 className="h-4 w-4 mr-1" />
              Create Dependency
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
