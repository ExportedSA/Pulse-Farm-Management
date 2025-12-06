import { Router } from 'express';

const router = Router();

// Types
interface TimeEntry {
  id: string;
  userId: string;
  userName: string;
  type: 'clock_in' | 'clock_out' | 'break_start' | 'break_end' | 'task_start' | 'task_end';
  timestamp: string;
  taskId?: string;
  taskTitle?: string;
  location?: string;
  notes?: string;
}

interface TimesheetEntry {
  id: string;
  date: string;
  userId: string;
  userName: string;
  clockIn: string;
  clockOut?: string;
  breaks: { start: string; end?: string; duration?: number }[];
  tasks: {
    taskId: string;
    taskTitle: string;
    startTime: string;
    endTime?: string;
    duration?: number;
    category?: string;
  }[];
  totalHours: number;
  breakHours: number;
  netHours: number;
  status: 'active' | 'completed' | 'pending_approval' | 'approved';
  approvedBy?: string;
  approvedAt?: string;
}

// In-memory storage (would be database in production)
let timeEntries: TimeEntry[] = [];
let timesheets: TimesheetEntry[] = [];
let entryIdCounter = 1;
let timesheetIdCounter = 1;

// Mock users
const USERS = [
  { id: 'demo-user', name: 'You' },
  { id: 'user-1', name: 'John Smith' },
  { id: 'user-2', name: 'Sarah Johnson' },
  { id: 'user-3', name: 'Mike Wilson' },
  { id: 'user-4', name: 'Emily Brown' },
];

// Generate demo data
function generateDemoData() {
  const today = new Date();
  const yesterday = new Date(today.getTime() - 86400000);
  const twoDaysAgo = new Date(today.getTime() - 2 * 86400000);
  
  // Today's active timesheet for demo user
  timesheets.push({
    id: `ts-${timesheetIdCounter++}`,
    date: today.toISOString().split('T')[0],
    userId: 'demo-user',
    userName: 'You',
    clockIn: new Date(today.setHours(6, 0, 0, 0)).toISOString(),
    breaks: [
      { start: new Date(today.setHours(10, 0, 0, 0)).toISOString(), end: new Date(today.setHours(10, 15, 0, 0)).toISOString(), duration: 15 },
    ],
    tasks: [
      { taskId: '1', taskTitle: 'Morning Feed - Paddock A', startTime: new Date(today.setHours(6, 15, 0, 0)).toISOString(), endTime: new Date(today.setHours(7, 30, 0, 0)).toISOString(), duration: 75, category: 'feeding' },
      { taskId: '2', taskTitle: 'Fence Inspection', startTime: new Date(today.setHours(8, 0, 0, 0)).toISOString(), endTime: new Date(today.setHours(9, 45, 0, 0)).toISOString(), duration: 105, category: 'maintenance' },
    ],
    totalHours: (new Date().getTime() - new Date(today.setHours(6, 0, 0, 0)).getTime()) / 3600000,
    breakHours: 0.25,
    netHours: 0,
    status: 'active',
  });
  
  // Yesterday's completed timesheet
  timesheets.push({
    id: `ts-${timesheetIdCounter++}`,
    date: yesterday.toISOString().split('T')[0],
    userId: 'demo-user',
    userName: 'You',
    clockIn: new Date(yesterday.setHours(5, 30, 0, 0)).toISOString(),
    clockOut: new Date(yesterday.setHours(16, 0, 0, 0)).toISOString(),
    breaks: [
      { start: new Date(yesterday.setHours(10, 0, 0, 0)).toISOString(), end: new Date(yesterday.setHours(10, 15, 0, 0)).toISOString(), duration: 15 },
      { start: new Date(yesterday.setHours(12, 30, 0, 0)).toISOString(), end: new Date(yesterday.setHours(13, 0, 0, 0)).toISOString(), duration: 30 },
    ],
    tasks: [
      { taskId: '3', taskTitle: 'Morning Milking', startTime: new Date(yesterday.setHours(5, 30, 0, 0)).toISOString(), endTime: new Date(yesterday.setHours(8, 0, 0, 0)).toISOString(), duration: 150, category: 'milking' },
      { taskId: '4', taskTitle: 'Calf Feeding', startTime: new Date(yesterday.setHours(8, 30, 0, 0)).toISOString(), endTime: new Date(yesterday.setHours(9, 30, 0, 0)).toISOString(), duration: 60, category: 'feeding' },
      { taskId: '5', taskTitle: 'Afternoon Milking', startTime: new Date(yesterday.setHours(14, 0, 0, 0)).toISOString(), endTime: new Date(yesterday.setHours(16, 0, 0, 0)).toISOString(), duration: 120, category: 'milking' },
    ],
    totalHours: 10.5,
    breakHours: 0.75,
    netHours: 9.75,
    status: 'approved',
    approvedBy: 'user-1',
    approvedAt: yesterday.toISOString(),
  });
  
  // Other staff timesheets
  USERS.slice(1).forEach((user, index) => {
    timesheets.push({
      id: `ts-${timesheetIdCounter++}`,
      date: today.toISOString().split('T')[0],
      userId: user.id,
      userName: user.name,
      clockIn: new Date(today.setHours(5 + index, 0, 0, 0)).toISOString(),
      clockOut: index > 1 ? new Date(today.setHours(14 + index, 0, 0, 0)).toISOString() : undefined,
      breaks: [],
      tasks: [
        { taskId: `task-${user.id}`, taskTitle: `${user.name}'s Task`, startTime: new Date(today.setHours(6 + index, 0, 0, 0)).toISOString(), duration: 120, category: 'general' },
      ],
      totalHours: index > 1 ? 8 + index : (new Date().getHours() - 5 - index),
      breakHours: 0,
      netHours: index > 1 ? 8 + index : (new Date().getHours() - 5 - index),
      status: index > 1 ? 'completed' : 'active',
    });
  });
}

generateDemoData();

// Helper functions
function getUserName(userId: string): string {
  return USERS.find(u => u.id === userId)?.name || userId;
}

function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
}

function calculateNetHours(timesheet: TimesheetEntry): number {
  if (!timesheet.clockOut) return 0;
  const totalMs = new Date(timesheet.clockOut).getTime() - new Date(timesheet.clockIn).getTime();
  const totalHours = totalMs / 3600000;
  return Math.round((totalHours - timesheet.breakHours) * 100) / 100;
}

// ============================================
// CLOCK IN/OUT ENDPOINTS
// ============================================

// Get current clock status
router.get('/status', (req, res) => {
  const userId = (req.user as any)?.id || 'demo-user';
  const today = new Date().toISOString().split('T')[0];
  
  const todayTimesheet = timesheets.find(ts => ts.userId === userId && ts.date === today);
  
  if (!todayTimesheet) {
    return res.json({
      clockedIn: false,
      onBreak: false,
      activeTask: null,
      todayHours: 0,
    });
  }
  
  const lastBreak = todayTimesheet.breaks[todayTimesheet.breaks.length - 1];
  const onBreak = lastBreak && !lastBreak.end;
  
  const activeTask = todayTimesheet.tasks.find(t => !t.endTime);
  
  // Calculate hours worked today
  const now = new Date();
  const clockInTime = new Date(todayTimesheet.clockIn);
  let todayHours = (now.getTime() - clockInTime.getTime()) / 3600000;
  todayHours = Math.round(todayHours * 100) / 100;
  
  res.json({
    clockedIn: !todayTimesheet.clockOut,
    onBreak,
    activeTask: activeTask ? {
      taskId: activeTask.taskId,
      taskTitle: activeTask.taskTitle,
      startTime: activeTask.startTime,
      duration: Math.round((now.getTime() - new Date(activeTask.startTime).getTime()) / 60000),
    } : null,
    todayHours,
    clockInTime: todayTimesheet.clockIn,
    breakHours: todayTimesheet.breakHours,
    timesheet: todayTimesheet,
  });
});

// Clock in
router.post('/clock-in', (req, res) => {
  const userId = (req.user as any)?.id || 'demo-user';
  const userName = getUserName(userId);
  const { location, notes } = req.body;
  const today = new Date().toISOString().split('T')[0];
  
  // Check if already clocked in
  const existingTimesheet = timesheets.find(ts => ts.userId === userId && ts.date === today && !ts.clockOut);
  if (existingTimesheet) {
    return res.status(400).json({ error: 'Already clocked in today' });
  }
  
  const now = new Date().toISOString();
  
  // Create time entry
  const entry: TimeEntry = {
    id: `entry-${entryIdCounter++}`,
    userId,
    userName,
    type: 'clock_in',
    timestamp: now,
    location,
    notes,
  };
  timeEntries.push(entry);
  
  // Create or update timesheet
  const timesheet: TimesheetEntry = {
    id: `ts-${timesheetIdCounter++}`,
    date: today,
    userId,
    userName,
    clockIn: now,
    breaks: [],
    tasks: [],
    totalHours: 0,
    breakHours: 0,
    netHours: 0,
    status: 'active',
  };
  timesheets.push(timesheet);
  
  res.json({ success: true, entry, timesheet });
});

// Clock out
router.post('/clock-out', (req, res) => {
  const userId = (req.user as any)?.id || 'demo-user';
  const userName = getUserName(userId);
  const { notes } = req.body;
  const today = new Date().toISOString().split('T')[0];
  
  const timesheet = timesheets.find(ts => ts.userId === userId && ts.date === today && !ts.clockOut);
  if (!timesheet) {
    return res.status(400).json({ error: 'Not clocked in' });
  }
  
  const now = new Date().toISOString();
  
  // End any active break
  const activeBreak = timesheet.breaks.find(b => !b.end);
  if (activeBreak) {
    activeBreak.end = now;
    activeBreak.duration = Math.round((new Date(now).getTime() - new Date(activeBreak.start).getTime()) / 60000);
    timesheet.breakHours = timesheet.breaks.reduce((sum, b) => sum + (b.duration || 0), 0) / 60;
  }
  
  // End any active task
  const activeTask = timesheet.tasks.find(t => !t.endTime);
  if (activeTask) {
    activeTask.endTime = now;
    activeTask.duration = Math.round((new Date(now).getTime() - new Date(activeTask.startTime).getTime()) / 60000);
  }
  
  // Update timesheet
  timesheet.clockOut = now;
  timesheet.totalHours = Math.round((new Date(now).getTime() - new Date(timesheet.clockIn).getTime()) / 3600000 * 100) / 100;
  timesheet.netHours = calculateNetHours(timesheet);
  timesheet.status = 'completed';
  
  // Create time entry
  const entry: TimeEntry = {
    id: `entry-${entryIdCounter++}`,
    userId,
    userName,
    type: 'clock_out',
    timestamp: now,
    notes,
  };
  timeEntries.push(entry);
  
  res.json({ success: true, entry, timesheet });
});

// Start break
router.post('/break/start', (req, res) => {
  const userId = (req.user as any)?.id || 'demo-user';
  const today = new Date().toISOString().split('T')[0];
  
  const timesheet = timesheets.find(ts => ts.userId === userId && ts.date === today && !ts.clockOut);
  if (!timesheet) {
    return res.status(400).json({ error: 'Not clocked in' });
  }
  
  const activeBreak = timesheet.breaks.find(b => !b.end);
  if (activeBreak) {
    return res.status(400).json({ error: 'Already on break' });
  }
  
  const now = new Date().toISOString();
  timesheet.breaks.push({ start: now });
  
  // Pause active task
  const activeTask = timesheet.tasks.find(t => !t.endTime);
  if (activeTask) {
    activeTask.endTime = now;
    activeTask.duration = Math.round((new Date(now).getTime() - new Date(activeTask.startTime).getTime()) / 60000);
  }
  
  res.json({ success: true, breakStart: now });
});

// End break
router.post('/break/end', (req, res) => {
  const userId = (req.user as any)?.id || 'demo-user';
  const today = new Date().toISOString().split('T')[0];
  
  const timesheet = timesheets.find(ts => ts.userId === userId && ts.date === today && !ts.clockOut);
  if (!timesheet) {
    return res.status(400).json({ error: 'Not clocked in' });
  }
  
  const activeBreak = timesheet.breaks.find(b => !b.end);
  if (!activeBreak) {
    return res.status(400).json({ error: 'Not on break' });
  }
  
  const now = new Date().toISOString();
  activeBreak.end = now;
  activeBreak.duration = Math.round((new Date(now).getTime() - new Date(activeBreak.start).getTime()) / 60000);
  
  // Update total break hours
  timesheet.breakHours = Math.round(timesheet.breaks.reduce((sum, b) => sum + (b.duration || 0), 0) / 60 * 100) / 100;
  
  res.json({ success: true, breakEnd: now, breakDuration: activeBreak.duration });
});

// ============================================
// TASK TIME TRACKING
// ============================================

// Start task timer
router.post('/task/start', (req, res) => {
  const userId = (req.user as any)?.id || 'demo-user';
  const { taskId, taskTitle, category } = req.body;
  const today = new Date().toISOString().split('T')[0];
  
  const timesheet = timesheets.find(ts => ts.userId === userId && ts.date === today && !ts.clockOut);
  if (!timesheet) {
    return res.status(400).json({ error: 'Not clocked in. Please clock in first.' });
  }
  
  // Check if on break
  const activeBreak = timesheet.breaks.find(b => !b.end);
  if (activeBreak) {
    return res.status(400).json({ error: 'Cannot start task while on break' });
  }
  
  // End any active task
  const activeTask = timesheet.tasks.find(t => !t.endTime);
  if (activeTask) {
    const now = new Date().toISOString();
    activeTask.endTime = now;
    activeTask.duration = Math.round((new Date(now).getTime() - new Date(activeTask.startTime).getTime()) / 60000);
  }
  
  const now = new Date().toISOString();
  const newTask = {
    taskId,
    taskTitle,
    startTime: now,
    category,
  };
  timesheet.tasks.push(newTask);
  
  res.json({ success: true, task: newTask });
});

// Stop task timer
router.post('/task/stop', (req, res) => {
  const userId = (req.user as any)?.id || 'demo-user';
  const { taskId, notes } = req.body;
  const today = new Date().toISOString().split('T')[0];
  
  const timesheet = timesheets.find(ts => ts.userId === userId && ts.date === today && !ts.clockOut);
  if (!timesheet) {
    return res.status(400).json({ error: 'Not clocked in' });
  }
  
  const task = timesheet.tasks.find(t => t.taskId === taskId && !t.endTime);
  if (!task) {
    return res.status(400).json({ error: 'Task not found or already stopped' });
  }
  
  const now = new Date().toISOString();
  task.endTime = now;
  task.duration = Math.round((new Date(now).getTime() - new Date(task.startTime).getTime()) / 60000);
  
  res.json({ success: true, task, duration: task.duration });
});

// Log manual time entry
router.post('/task/log', (req, res) => {
  const userId = (req.user as any)?.id || 'demo-user';
  const { taskId, taskTitle, date, startTime, endTime, duration, category, notes } = req.body;
  
  let timesheet = timesheets.find(ts => ts.userId === userId && ts.date === date);
  
  if (!timesheet) {
    // Create timesheet for that date
    timesheet = {
      id: `ts-${timesheetIdCounter++}`,
      date,
      userId,
      userName: getUserName(userId),
      clockIn: `${date}T${startTime}:00.000Z`,
      clockOut: `${date}T${endTime}:00.000Z`,
      breaks: [],
      tasks: [],
      totalHours: 0,
      breakHours: 0,
      netHours: 0,
      status: 'completed',
    };
    timesheets.push(timesheet);
  }
  
  const taskEntry = {
    taskId: taskId || `manual-${Date.now()}`,
    taskTitle: taskTitle || 'Manual Entry',
    startTime: `${date}T${startTime}:00.000Z`,
    endTime: `${date}T${endTime}:00.000Z`,
    duration: duration || Math.round((new Date(`${date}T${endTime}`).getTime() - new Date(`${date}T${startTime}`).getTime()) / 60000),
    category,
  };
  
  timesheet.tasks.push(taskEntry);
  
  res.json({ success: true, task: taskEntry });
});

// ============================================
// TIMESHEET ENDPOINTS
// ============================================

// Get timesheets
router.get('/timesheets', (req, res) => {
  const userId = (req.user as any)?.id || 'demo-user';
  const { startDate, endDate, allUsers } = req.query;
  
  let filtered = timesheets;
  
  // Filter by user (unless admin viewing all)
  if (allUsers !== 'true') {
    filtered = filtered.filter(ts => ts.userId === userId);
  }
  
  // Filter by date range
  if (startDate) {
    filtered = filtered.filter(ts => ts.date >= startDate);
  }
  if (endDate) {
    filtered = filtered.filter(ts => ts.date <= endDate);
  }
  
  // Sort by date descending
  filtered.sort((a, b) => b.date.localeCompare(a.date));
  
  // Calculate summary
  const summary = {
    totalHours: Math.round(filtered.reduce((sum, ts) => sum + ts.netHours, 0) * 100) / 100,
    totalDays: filtered.length,
    averageHoursPerDay: filtered.length > 0 
      ? Math.round(filtered.reduce((sum, ts) => sum + ts.netHours, 0) / filtered.length * 100) / 100 
      : 0,
    pendingApproval: filtered.filter(ts => ts.status === 'pending_approval').length,
  };
  
  res.json({ timesheets: filtered, summary });
});

// Get single timesheet
router.get('/timesheets/:id', (req, res) => {
  const { id } = req.params;
  const timesheet = timesheets.find(ts => ts.id === id);
  
  if (!timesheet) {
    return res.status(404).json({ error: 'Timesheet not found' });
  }
  
  res.json(timesheet);
});

// Submit timesheet for approval
router.post('/timesheets/:id/submit', (req, res) => {
  const { id } = req.params;
  const timesheet = timesheets.find(ts => ts.id === id);
  
  if (!timesheet) {
    return res.status(404).json({ error: 'Timesheet not found' });
  }
  
  if (timesheet.status !== 'completed') {
    return res.status(400).json({ error: 'Timesheet must be completed before submission' });
  }
  
  timesheet.status = 'pending_approval';
  
  res.json({ success: true, timesheet });
});

// Approve timesheet
router.post('/timesheets/:id/approve', (req, res) => {
  const { id } = req.params;
  const approverId = (req.user as any)?.id || 'user-1';
  const timesheet = timesheets.find(ts => ts.id === id);
  
  if (!timesheet) {
    return res.status(404).json({ error: 'Timesheet not found' });
  }
  
  timesheet.status = 'approved';
  timesheet.approvedBy = approverId;
  timesheet.approvedAt = new Date().toISOString();
  
  res.json({ success: true, timesheet });
});

// ============================================
// REPORTS
// ============================================

// Get weekly summary
router.get('/reports/weekly', (req, res) => {
  const userId = (req.user as any)?.id || 'demo-user';
  const { week } = req.query; // Format: YYYY-WW
  
  // Get current week if not specified
  const now = new Date();
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay());
  startOfWeek.setHours(0, 0, 0, 0);
  
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 6);
  
  const weekTimesheets = timesheets.filter(ts => {
    const tsDate = new Date(ts.date);
    return ts.userId === userId && tsDate >= startOfWeek && tsDate <= endOfWeek;
  });
  
  // Build daily breakdown
  const dailyBreakdown = [];
  for (let i = 0; i < 7; i++) {
    const date = new Date(startOfWeek);
    date.setDate(startOfWeek.getDate() + i);
    const dateStr = date.toISOString().split('T')[0];
    const daySheet = weekTimesheets.find(ts => ts.date === dateStr);
    
    dailyBreakdown.push({
      date: dateStr,
      dayName: date.toLocaleDateString('en-NZ', { weekday: 'short' }),
      hours: daySheet?.netHours || 0,
      status: daySheet?.status || 'none',
    });
  }
  
  // Category breakdown
  const categoryHours: Record<string, number> = {};
  weekTimesheets.forEach(ts => {
    ts.tasks.forEach(task => {
      const cat = task.category || 'general';
      categoryHours[cat] = (categoryHours[cat] || 0) + (task.duration || 0) / 60;
    });
  });
  
  res.json({
    weekStart: startOfWeek.toISOString().split('T')[0],
    weekEnd: endOfWeek.toISOString().split('T')[0],
    totalHours: Math.round(weekTimesheets.reduce((sum, ts) => sum + ts.netHours, 0) * 100) / 100,
    dailyBreakdown,
    categoryBreakdown: Object.entries(categoryHours).map(([category, hours]) => ({
      category,
      hours: Math.round(hours * 100) / 100,
    })),
    timesheets: weekTimesheets,
  });
});

// Get staff overview (for managers)
router.get('/reports/staff-overview', (req, res) => {
  const today = new Date().toISOString().split('T')[0];
  
  const staffStatus = USERS.map(user => {
    const todaySheet = timesheets.find(ts => ts.userId === user.id && ts.date === today);
    
    return {
      userId: user.id,
      userName: user.name,
      clockedIn: todaySheet && !todaySheet.clockOut,
      clockInTime: todaySheet?.clockIn,
      hoursToday: todaySheet?.netHours || todaySheet?.totalHours || 0,
      activeTask: todaySheet?.tasks.find(t => !t.endTime)?.taskTitle,
      onBreak: todaySheet?.breaks.some(b => !b.end),
    };
  });
  
  res.json({
    date: today,
    staff: staffStatus,
    totalClockedIn: staffStatus.filter(s => s.clockedIn).length,
    totalStaff: USERS.length,
  });
});

export default router;
