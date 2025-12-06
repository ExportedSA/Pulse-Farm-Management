import { Router } from 'express';

const router = Router();

// Types
type DependencyType = 
  | 'finish_to_start'   // Task B can't start until Task A finishes (most common)
  | 'start_to_start'    // Task B can't start until Task A starts
  | 'finish_to_finish'  // Task B can't finish until Task A finishes
  | 'start_to_finish';  // Task B can't finish until Task A starts (rare)

interface TaskDependency {
  id: string;
  predecessorId: string;
  predecessorTitle: string;
  successorId: string;
  successorTitle: string;
  type: DependencyType;
  lagTime?: number; // Minutes delay after dependency is met
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
}

// In-memory storage
let dependencies: TaskDependency[] = [];
let idCounter = 1;

// Mock tasks for demo (would come from jobs API in production)
const mockTasks = [
  { id: '1', title: 'Morning Feed - Paddock A', status: 'in-progress', priority: 'high', category: 'feeding', startDate: new Date().toISOString().split('T')[0] },
  { id: '2', title: 'Fence Repair - North Boundary', status: 'pending', priority: 'urgent', category: 'maintenance', startDate: new Date().toISOString().split('T')[0] },
  { id: '3', title: 'Health Check - Dairy Herd', status: 'completed', priority: 'medium', category: 'health', startDate: new Date(Date.now() - 86400000).toISOString().split('T')[0] },
  { id: '4', title: 'Water Trough Inspection', status: 'pending', priority: 'medium', category: 'maintenance', startDate: new Date().toISOString().split('T')[0] },
  { id: '5', title: 'Afternoon Milking', status: 'pending', priority: 'high', category: 'milking', startDate: new Date().toISOString().split('T')[0] },
  { id: '6', title: 'Move Herd to Paddock B', status: 'pending', priority: 'medium', category: 'general', startDate: new Date().toISOString().split('T')[0] },
  { id: '7', title: 'Check Calving Paddock', status: 'pending', priority: 'high', category: 'health', startDate: new Date().toISOString().split('T')[0] },
  { id: '8', title: 'Evening Feed', status: 'pending', priority: 'high', category: 'feeding', startDate: new Date().toISOString().split('T')[0] },
];

// Generate demo dependencies
function generateDemoDependencies() {
  dependencies = [
    {
      id: 'dep-1',
      predecessorId: '1',
      predecessorTitle: 'Morning Feed - Paddock A',
      successorId: '6',
      successorTitle: 'Move Herd to Paddock B',
      type: 'finish_to_start',
      lagTime: 30, // 30 min after feeding
      createdAt: new Date().toISOString(),
      createdBy: 'John Smith',
    },
    {
      id: 'dep-2',
      predecessorId: '6',
      predecessorTitle: 'Move Herd to Paddock B',
      successorId: '5',
      successorTitle: 'Afternoon Milking',
      type: 'finish_to_start',
      createdAt: new Date().toISOString(),
      createdBy: 'John Smith',
    },
    {
      id: 'dep-3',
      predecessorId: '3',
      predecessorTitle: 'Health Check - Dairy Herd',
      successorId: '7',
      successorTitle: 'Check Calving Paddock',
      type: 'finish_to_start',
      createdAt: new Date().toISOString(),
      createdBy: 'Sarah Johnson',
    },
    {
      id: 'dep-4',
      predecessorId: '5',
      predecessorTitle: 'Afternoon Milking',
      successorId: '8',
      successorTitle: 'Evening Feed',
      type: 'finish_to_start',
      lagTime: 60,
      createdAt: new Date().toISOString(),
      createdBy: 'John Smith',
    },
    {
      id: 'dep-5',
      predecessorId: '2',
      predecessorTitle: 'Fence Repair - North Boundary',
      successorId: '6',
      successorTitle: 'Move Herd to Paddock B',
      type: 'finish_to_start',
      createdAt: new Date().toISOString(),
      createdBy: 'Mike Wilson',
    },
  ];
}

generateDemoDependencies();

// Helper: Check if a task can start based on dependencies
function canTaskStart(taskId: string, taskStatus: string): { canStart: boolean; blockingTasks: string[] } {
  if (taskStatus === 'completed' || taskStatus === 'in-progress') {
    return { canStart: true, blockingTasks: [] };
  }

  const predecessorDeps = dependencies.filter(d => d.successorId === taskId);
  const blockingTasks: string[] = [];

  for (const dep of predecessorDeps) {
    const predecessor = mockTasks.find(t => t.id === dep.predecessorId);
    if (!predecessor) continue;

    switch (dep.type) {
      case 'finish_to_start':
        if (predecessor.status !== 'completed') {
          blockingTasks.push(dep.predecessorTitle);
        }
        break;
      case 'start_to_start':
        if (predecessor.status === 'pending') {
          blockingTasks.push(dep.predecessorTitle);
        }
        break;
      case 'finish_to_finish':
      case 'start_to_finish':
        // These don't block starting
        break;
    }
  }

  return {
    canStart: blockingTasks.length === 0,
    blockingTasks,
  };
}

// Helper: Get task with dependency info
function getTaskWithDependencies(taskId: string): TaskWithDependencies | null {
  const task = mockTasks.find(t => t.id === taskId);
  if (!task) return null;

  const predecessors = dependencies.filter(d => d.successorId === taskId);
  const successors = dependencies.filter(d => d.predecessorId === taskId);
  const { canStart, blockingTasks } = canTaskStart(taskId, task.status);

  return {
    ...task,
    dependencies: {
      predecessors,
      successors,
    },
    isBlocked: !canStart,
    blockingTasks,
    canStart,
  };
}

// ============================================
// DEPENDENCY ENDPOINTS
// ============================================

// Get all dependencies
router.get('/', (req, res) => {
  const { taskId } = req.query;

  if (taskId) {
    const taskDeps = dependencies.filter(
      d => d.predecessorId === taskId || d.successorId === taskId
    );
    return res.json(taskDeps);
  }

  res.json(dependencies);
});

// Get dependency types
router.get('/types', (req, res) => {
  const types = [
    {
      id: 'finish_to_start',
      label: 'Finish to Start',
      description: 'Task B cannot start until Task A finishes',
      shortLabel: 'FS',
      isDefault: true,
    },
    {
      id: 'start_to_start',
      label: 'Start to Start',
      description: 'Task B cannot start until Task A starts',
      shortLabel: 'SS',
    },
    {
      id: 'finish_to_finish',
      label: 'Finish to Finish',
      description: 'Task B cannot finish until Task A finishes',
      shortLabel: 'FF',
    },
    {
      id: 'start_to_finish',
      label: 'Start to Finish',
      description: 'Task B cannot finish until Task A starts',
      shortLabel: 'SF',
    },
  ];
  res.json(types);
});

// Get tasks with dependency info
router.get('/tasks', (req, res) => {
  const tasksWithDeps = mockTasks.map(task => {
    const predecessors = dependencies.filter(d => d.successorId === task.id);
    const successors = dependencies.filter(d => d.predecessorId === task.id);
    const { canStart, blockingTasks } = canTaskStart(task.id, task.status);

    return {
      ...task,
      dependencies: {
        predecessors,
        successors,
      },
      isBlocked: !canStart,
      blockingTasks,
      canStart,
      predecessorCount: predecessors.length,
      successorCount: successors.length,
    };
  });

  // Stats
  const stats = {
    totalTasks: mockTasks.length,
    blockedTasks: tasksWithDeps.filter(t => t.isBlocked).length,
    tasksWithDependencies: tasksWithDeps.filter(t => t.predecessorCount > 0 || t.successorCount > 0).length,
    totalDependencies: dependencies.length,
  };

  res.json({ tasks: tasksWithDeps, stats });
});

// Get single task with dependencies
router.get('/tasks/:taskId', (req, res) => {
  const { taskId } = req.params;
  const taskWithDeps = getTaskWithDependencies(taskId);

  if (!taskWithDeps) {
    return res.status(404).json({ error: 'Task not found' });
  }

  res.json(taskWithDeps);
});

// Check if task can start
router.get('/tasks/:taskId/can-start', (req, res) => {
  const { taskId } = req.params;
  const task = mockTasks.find(t => t.id === taskId);

  if (!task) {
    return res.status(404).json({ error: 'Task not found' });
  }

  const result = canTaskStart(taskId, task.status);
  res.json(result);
});

// Create dependency
router.post('/', (req, res) => {
  const { predecessorId, successorId, type = 'finish_to_start', lagTime } = req.body;
  const userName = (req.user as any)?.name || 'Demo User';

  if (!predecessorId || !successorId) {
    return res.status(400).json({ error: 'Predecessor and successor task IDs are required' });
  }

  if (predecessorId === successorId) {
    return res.status(400).json({ error: 'A task cannot depend on itself' });
  }

  // Check for existing dependency
  const existing = dependencies.find(
    d => d.predecessorId === predecessorId && d.successorId === successorId
  );
  if (existing) {
    return res.status(400).json({ error: 'This dependency already exists' });
  }

  // Check for circular dependency
  const wouldCreateCircle = checkCircularDependency(predecessorId, successorId);
  if (wouldCreateCircle) {
    return res.status(400).json({ error: 'This would create a circular dependency' });
  }

  const predecessor = mockTasks.find(t => t.id === predecessorId);
  const successor = mockTasks.find(t => t.id === successorId);

  if (!predecessor || !successor) {
    return res.status(404).json({ error: 'Task not found' });
  }

  const dependency: TaskDependency = {
    id: `dep-${idCounter++}`,
    predecessorId,
    predecessorTitle: predecessor.title,
    successorId,
    successorTitle: successor.title,
    type,
    lagTime,
    createdAt: new Date().toISOString(),
    createdBy: userName,
  };

  dependencies.push(dependency);

  res.status(201).json(dependency);
});

// Update dependency
router.patch('/:id', (req, res) => {
  const { id } = req.params;
  const { type, lagTime } = req.body;

  const dependency = dependencies.find(d => d.id === id);
  if (!dependency) {
    return res.status(404).json({ error: 'Dependency not found' });
  }

  if (type) dependency.type = type;
  if (lagTime !== undefined) dependency.lagTime = lagTime;

  res.json(dependency);
});

// Delete dependency
router.delete('/:id', (req, res) => {
  const { id } = req.params;
  const index = dependencies.findIndex(d => d.id === id);

  if (index === -1) {
    return res.status(404).json({ error: 'Dependency not found' });
  }

  dependencies.splice(index, 1);
  res.json({ success: true });
});

// ============================================
// DEPENDENCY CHAIN VISUALIZATION
// ============================================

// Get dependency chain for a task
router.get('/chain/:taskId', (req, res) => {
  const { taskId } = req.params;
  const { direction = 'both' } = req.query;

  const chain = buildDependencyChain(taskId, direction as string);
  res.json(chain);
});

// Get critical path (longest dependency chain)
router.get('/critical-path', (req, res) => {
  // Find tasks with no predecessors (start points)
  const startTasks = mockTasks.filter(task => {
    const hasPredecessors = dependencies.some(d => d.successorId === task.id);
    return !hasPredecessors;
  });

  // Find longest path from each start
  let longestPath: any[] = [];

  for (const startTask of startTasks) {
    const path = findLongestPath(startTask.id, []);
    if (path.length > longestPath.length) {
      longestPath = path;
    }
  }

  res.json({
    criticalPath: longestPath,
    length: longestPath.length,
    tasks: longestPath.map(id => mockTasks.find(t => t.id === id)),
  });
});

// ============================================
// HELPER FUNCTIONS
// ============================================

function checkCircularDependency(predecessorId: string, successorId: string): boolean {
  // Check if adding this dependency would create a circle
  const visited = new Set<string>();
  const stack = [predecessorId];

  while (stack.length > 0) {
    const current = stack.pop()!;
    if (current === successorId) {
      return true; // Found a path back to successor, would create circle
    }

    if (visited.has(current)) continue;
    visited.add(current);

    // Get all predecessors of current
    const predecessors = dependencies
      .filter(d => d.successorId === current)
      .map(d => d.predecessorId);

    stack.push(...predecessors);
  }

  return false;
}

function buildDependencyChain(taskId: string, direction: string): any {
  const task = mockTasks.find(t => t.id === taskId);
  if (!task) return null;

  const result: any = {
    task: {
      id: task.id,
      title: task.title,
      status: task.status,
    },
    predecessors: [],
    successors: [],
  };

  if (direction === 'both' || direction === 'predecessors') {
    result.predecessors = getPredecessorChain(taskId, new Set());
  }

  if (direction === 'both' || direction === 'successors') {
    result.successors = getSuccessorChain(taskId, new Set());
  }

  return result;
}

function getPredecessorChain(taskId: string, visited: Set<string>): any[] {
  if (visited.has(taskId)) return [];
  visited.add(taskId);

  const predecessorDeps = dependencies.filter(d => d.successorId === taskId);
  
  return predecessorDeps.map(dep => {
    const task = mockTasks.find(t => t.id === dep.predecessorId);
    return {
      dependency: dep,
      task: task ? {
        id: task.id,
        title: task.title,
        status: task.status,
      } : null,
      predecessors: getPredecessorChain(dep.predecessorId, visited),
    };
  });
}

function getSuccessorChain(taskId: string, visited: Set<string>): any[] {
  if (visited.has(taskId)) return [];
  visited.add(taskId);

  const successorDeps = dependencies.filter(d => d.predecessorId === taskId);
  
  return successorDeps.map(dep => {
    const task = mockTasks.find(t => t.id === dep.successorId);
    return {
      dependency: dep,
      task: task ? {
        id: task.id,
        title: task.title,
        status: task.status,
      } : null,
      successors: getSuccessorChain(dep.successorId, visited),
    };
  });
}

function findLongestPath(taskId: string, currentPath: string[]): string[] {
  const newPath = [...currentPath, taskId];
  
  const successorDeps = dependencies.filter(d => d.predecessorId === taskId);
  
  if (successorDeps.length === 0) {
    return newPath;
  }

  let longestPath = newPath;
  
  for (const dep of successorDeps) {
    const path = findLongestPath(dep.successorId, newPath);
    if (path.length > longestPath.length) {
      longestPath = path;
    }
  }

  return longestPath;
}

export default router;
