import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
  Clock,
  Play,
  Pause,
  Square,
  Coffee,
  LogIn,
  LogOut,
  Calendar,
  Timer,
  Users,
  FileText,
  CheckCircle2,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Plus,
  BarChart3,
  Download,
  Send,
} from 'lucide-react';

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

interface ClockStatus {
  clockedIn: boolean;
  onBreak: boolean;
  activeTask: {
    taskId: string;
    taskTitle: string;
    startTime: string;
    duration: number;
  } | null;
  todayHours: number;
  clockInTime?: string;
  breakHours: number;
  timesheet?: TimesheetEntry;
}

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-green-100 text-green-800',
  completed: 'bg-blue-100 text-blue-800',
  pending_approval: 'bg-yellow-100 text-yellow-800',
  approved: 'bg-purple-100 text-purple-800',
};

const CATEGORY_COLORS: Record<string, string> = {
  feeding: 'bg-green-500',
  milking: 'bg-blue-500',
  health: 'bg-red-500',
  maintenance: 'bg-orange-500',
  fencing: 'bg-yellow-500',
  general: 'bg-gray-500',
};

export default function TimesheetsPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('today');
  const [selectedWeek, setSelectedWeek] = useState(new Date());
  const [isManualEntryOpen, setIsManualEntryOpen] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);
  
  // Manual entry form
  const [manualEntry, setManualEntry] = useState({
    date: new Date().toISOString().split('T')[0],
    taskTitle: '',
    startTime: '09:00',
    endTime: '10:00',
    category: 'general',
  });

  // Fetch clock status
  const { data: clockStatus, refetch: refetchStatus } = useQuery<ClockStatus>({
    queryKey: ['clockStatus'],
    queryFn: async () => {
      const res = await fetch('/api/time-tracking/status');
      if (!res.ok) throw new Error('Failed to fetch status');
      return res.json();
    },
    refetchInterval: 30000,
  });

  // Fetch weekly report
  const { data: weeklyReport } = useQuery({
    queryKey: ['weeklyReport', selectedWeek.toISOString()],
    queryFn: async () => {
      const res = await fetch('/api/time-tracking/reports/weekly');
      if (!res.ok) throw new Error('Failed to fetch weekly report');
      return res.json();
    },
  });

  // Fetch timesheets
  const { data: timesheetsData } = useQuery({
    queryKey: ['timesheets'],
    queryFn: async () => {
      const res = await fetch('/api/time-tracking/timesheets');
      if (!res.ok) throw new Error('Failed to fetch timesheets');
      return res.json();
    },
  });

  // Fetch staff overview
  const { data: staffOverview } = useQuery({
    queryKey: ['staffOverview'],
    queryFn: async () => {
      const res = await fetch('/api/time-tracking/reports/staff-overview');
      if (!res.ok) throw new Error('Failed to fetch staff overview');
      return res.json();
    },
    refetchInterval: 60000,
  });

  // Update elapsed time for active task
  useEffect(() => {
    if (clockStatus?.activeTask) {
      const interval = setInterval(() => {
        const start = new Date(clockStatus.activeTask!.startTime);
        const now = new Date();
        setElapsedTime(Math.floor((now.getTime() - start.getTime()) / 1000));
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [clockStatus?.activeTask]);

  // Clock in mutation
  const clockInMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/time-tracking/clock-in', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      if (!res.ok) throw new Error('Failed to clock in');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clockStatus'] });
      queryClient.invalidateQueries({ queryKey: ['timesheets'] });
      toast.success('Clocked in successfully!');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to clock in');
    },
  });

  // Clock out mutation
  const clockOutMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/time-tracking/clock-out', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      if (!res.ok) throw new Error('Failed to clock out');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clockStatus'] });
      queryClient.invalidateQueries({ queryKey: ['timesheets'] });
      toast.success('Clocked out successfully!');
    },
  });

  // Break mutations
  const startBreakMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/time-tracking/break/start', { method: 'POST' });
      if (!res.ok) throw new Error('Failed to start break');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clockStatus'] });
      toast.success('Break started');
    },
  });

  const endBreakMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/time-tracking/break/end', { method: 'POST' });
      if (!res.ok) throw new Error('Failed to end break');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clockStatus'] });
      toast.success('Break ended');
    },
  });

  // Manual entry mutation
  const logManualEntryMutation = useMutation({
    mutationFn: async (data: typeof manualEntry) => {
      const res = await fetch('/api/time-tracking/task/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Failed to log time');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['timesheets'] });
      queryClient.invalidateQueries({ queryKey: ['weeklyReport'] });
      setIsManualEntryOpen(false);
      toast.success('Time entry logged');
    },
  });

  // Format time
  const formatTime = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const formatHours = (hours: number) => {
    const h = Math.floor(hours);
    const m = Math.round((hours - h) * 60);
    return `${h}h ${m}m`;
  };

  const formatTimeOfDay = (isoString: string) => {
    return new Date(isoString).toLocaleTimeString('en-NZ', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Clock className="h-8 w-8 text-pulse-forest" />
            Time Tracking & Timesheets
          </h1>
          <p className="text-muted-foreground mt-1">
            Track your work hours and manage timesheets
          </p>
        </div>
        <Button onClick={() => setIsManualEntryOpen(true)} variant="outline">
          <Plus className="h-4 w-4 mr-2" />
          Log Manual Entry
        </Button>
      </div>

      {/* Clock In/Out Card */}
      <Card className="bg-gradient-to-r from-pulse-forest/10 to-pulse-forest/5 border-pulse-forest/20">
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            {/* Status */}
            <div className="flex items-center gap-4">
              <div className={cn(
                "w-16 h-16 rounded-full flex items-center justify-center",
                clockStatus?.clockedIn ? "bg-green-100" : "bg-gray-100"
              )}>
                {clockStatus?.clockedIn ? (
                  clockStatus.onBreak ? (
                    <Coffee className="h-8 w-8 text-yellow-600" />
                  ) : (
                    <Timer className="h-8 w-8 text-green-600" />
                  )
                ) : (
                  <Clock className="h-8 w-8 text-gray-400" />
                )}
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Status</p>
                <p className="text-xl font-bold">
                  {clockStatus?.clockedIn 
                    ? clockStatus.onBreak 
                      ? 'On Break' 
                      : 'Working'
                    : 'Not Clocked In'
                  }
                </p>
                {clockStatus?.clockInTime && (
                  <p className="text-sm text-muted-foreground">
                    Since {formatTimeOfDay(clockStatus.clockInTime)}
                  </p>
                )}
              </div>
            </div>

            {/* Today's Hours */}
            <div className="text-center">
              <p className="text-sm text-muted-foreground">Today's Hours</p>
              <p className="text-3xl font-bold text-pulse-forest">
                {formatHours(clockStatus?.todayHours || 0)}
              </p>
              {(clockStatus?.breakHours ?? 0) > 0 && (
                <p className="text-xs text-muted-foreground">
                  ({formatHours(clockStatus?.breakHours ?? 0)} break)
                </p>
              )}
            </div>

            {/* Active Task */}
            {clockStatus?.activeTask && (
              <div className="flex-1 max-w-xs">
                <p className="text-sm text-muted-foreground">Active Task</p>
                <p className="font-medium truncate">{clockStatus.activeTask.taskTitle}</p>
                <p className="text-2xl font-mono text-pulse-forest">
                  {formatTime(elapsedTime)}
                </p>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2">
              {!clockStatus?.clockedIn ? (
                <Button
                  size="lg"
                  onClick={() => clockInMutation.mutate()}
                  disabled={clockInMutation.isPending}
                  className="bg-green-600 hover:bg-green-700"
                >
                  <LogIn className="h-5 w-5 mr-2" />
                  Clock In
                </Button>
              ) : (
                <>
                  {clockStatus.onBreak ? (
                    <Button
                      size="lg"
                      onClick={() => endBreakMutation.mutate()}
                      disabled={endBreakMutation.isPending}
                      className="bg-yellow-600 hover:bg-yellow-700"
                    >
                      <Play className="h-5 w-5 mr-2" />
                      End Break
                    </Button>
                  ) : (
                    <Button
                      size="lg"
                      variant="outline"
                      onClick={() => startBreakMutation.mutate()}
                      disabled={startBreakMutation.isPending}
                    >
                      <Coffee className="h-5 w-5 mr-2" />
                      Take Break
                    </Button>
                  )}
                  <Button
                    size="lg"
                    onClick={() => clockOutMutation.mutate()}
                    disabled={clockOutMutation.isPending}
                    className="bg-red-600 hover:bg-red-700"
                  >
                    <LogOut className="h-5 w-5 mr-2" />
                    Clock Out
                  </Button>
                </>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="today">Today</TabsTrigger>
          <TabsTrigger value="week">This Week</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
          <TabsTrigger value="team">Team</TabsTrigger>
        </TabsList>

        {/* Today's Timesheet */}
        <TabsContent value="today" className="space-y-4">
          {clockStatus?.timesheet ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Today's Timesheet</CardTitle>
                <CardDescription>
                  {new Date().toLocaleDateString('en-NZ', { weekday: 'long', month: 'long', day: 'numeric' })}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Tasks */}
                <div>
                  <h4 className="font-medium mb-2">Tasks Worked On</h4>
                  {clockStatus.timesheet.tasks.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No tasks logged yet</p>
                  ) : (
                    <div className="space-y-2">
                      {clockStatus.timesheet.tasks.map((task, index) => (
                        <div
                          key={index}
                          className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                        >
                          <div className="flex items-center gap-3">
                            <div className={cn(
                              "w-2 h-8 rounded",
                              CATEGORY_COLORS[task.category || 'general']
                            )} />
                            <div>
                              <p className="font-medium">{task.taskTitle}</p>
                              <p className="text-xs text-muted-foreground">
                                {formatTimeOfDay(task.startTime)}
                                {task.endTime && ` - ${formatTimeOfDay(task.endTime)}`}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            {task.duration ? (
                              <Badge variant="secondary">
                                {Math.floor(task.duration / 60)}h {task.duration % 60}m
                              </Badge>
                            ) : (
                              <Badge className="bg-green-100 text-green-800">
                                <Timer className="h-3 w-3 mr-1" />
                                Active
                              </Badge>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Breaks */}
                {clockStatus.timesheet.breaks.length > 0 && (
                  <div>
                    <h4 className="font-medium mb-2">Breaks</h4>
                    <div className="space-y-2">
                      {clockStatus.timesheet.breaks.map((brk, index) => (
                        <div
                          key={index}
                          className="flex items-center justify-between p-2 bg-yellow-50 rounded"
                        >
                          <div className="flex items-center gap-2">
                            <Coffee className="h-4 w-4 text-yellow-600" />
                            <span className="text-sm">
                              {formatTimeOfDay(brk.start)}
                              {brk.end && ` - ${formatTimeOfDay(brk.end)}`}
                            </span>
                          </div>
                          {brk.duration && (
                            <span className="text-sm text-muted-foreground">
                              {brk.duration} min
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="py-12 text-center">
                <Clock className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                <p className="text-muted-foreground">Clock in to start tracking your time</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Weekly View */}
        <TabsContent value="week" className="space-y-4">
          {weeklyReport && (
            <>
              {/* Weekly Summary */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card>
                  <CardContent className="p-4 text-center">
                    <p className="text-sm text-muted-foreground">Total Hours</p>
                    <p className="text-3xl font-bold text-pulse-forest">
                      {formatHours(weeklyReport.totalHours)}
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 text-center">
                    <p className="text-sm text-muted-foreground">Days Worked</p>
                    <p className="text-3xl font-bold">
                      {weeklyReport.dailyBreakdown.filter((d: any) => d.hours > 0).length}
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 text-center">
                    <p className="text-sm text-muted-foreground">Avg Hours/Day</p>
                    <p className="text-3xl font-bold">
                      {formatHours(weeklyReport.totalHours / Math.max(1, weeklyReport.dailyBreakdown.filter((d: any) => d.hours > 0).length))}
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 text-center">
                    <p className="text-sm text-muted-foreground">Target (40h)</p>
                    <Progress value={(weeklyReport.totalHours / 40) * 100} className="mt-2" />
                    <p className="text-sm mt-1">{Math.round((weeklyReport.totalHours / 40) * 100)}%</p>
                  </CardContent>
                </Card>
              </div>

              {/* Daily Breakdown */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Daily Breakdown</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-7 gap-2">
                    {weeklyReport.dailyBreakdown.map((day: any) => (
                      <div
                        key={day.date}
                        className={cn(
                          "p-3 rounded-lg text-center border",
                          day.hours > 0 ? "bg-green-50 border-green-200" : "bg-muted/50"
                        )}
                      >
                        <p className="text-xs font-medium">{day.dayName}</p>
                        <p className="text-lg font-bold mt-1">
                          {day.hours > 0 ? formatHours(day.hours) : '-'}
                        </p>
                        {day.status !== 'none' && (
                          <Badge variant="outline" className="text-xs mt-1">
                            {day.status}
                          </Badge>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Category Breakdown */}
              {weeklyReport.categoryBreakdown.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Time by Category</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {weeklyReport.categoryBreakdown.map((cat: any) => (
                        <div key={cat.category} className="flex items-center gap-3">
                          <div className={cn(
                            "w-3 h-3 rounded",
                            CATEGORY_COLORS[cat.category] || CATEGORY_COLORS.general
                          )} />
                          <span className="flex-1 capitalize">{cat.category}</span>
                          <span className="font-medium">{formatHours(cat.hours)}</span>
                          <Progress
                            value={(cat.hours / weeklyReport.totalHours) * 100}
                            className="w-24"
                          />
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </TabsContent>

        {/* History */}
        <TabsContent value="history" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Timesheet History</CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px]">
                <div className="space-y-2">
                  {timesheetsData?.timesheets.map((ts: TimesheetEntry) => (
                    <div
                      key={ts.id}
                      className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50"
                    >
                      <div className="flex items-center gap-3">
                        <Calendar className="h-5 w-5 text-muted-foreground" />
                        <div>
                          <p className="font-medium">
                            {new Date(ts.date).toLocaleDateString('en-NZ', { weekday: 'short', month: 'short', day: 'numeric' })}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {formatTimeOfDay(ts.clockIn)}
                            {ts.clockOut && ` - ${formatTimeOfDay(ts.clockOut)}`}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <p className="font-medium">{formatHours(ts.netHours)}</p>
                          <p className="text-xs text-muted-foreground">
                            {ts.tasks.length} tasks
                          </p>
                        </div>
                        <Badge className={STATUS_COLORS[ts.status]}>
                          {ts.status.replace('_', ' ')}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Team Overview */}
        <TabsContent value="team" className="space-y-4">
          {staffOverview && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <Card>
                  <CardContent className="p-4 text-center">
                    <p className="text-sm text-muted-foreground">Currently Working</p>
                    <p className="text-3xl font-bold text-green-600">
                      {staffOverview.totalClockedIn}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      of {staffOverview.totalStaff} staff
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 text-center">
                    <p className="text-sm text-muted-foreground">Date</p>
                    <p className="text-xl font-bold">
                      {new Date(staffOverview.date).toLocaleDateString('en-NZ', { weekday: 'short', month: 'short', day: 'numeric' })}
                    </p>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    Staff Status
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {staffOverview.staff.map((member: any) => (
                      <div
                        key={member.userId}
                        className="flex items-center justify-between p-3 border rounded-lg"
                      >
                        <div className="flex items-center gap-3">
                          <Avatar>
                            <AvatarFallback className={cn(
                              member.clockedIn ? "bg-green-100 text-green-700" : "bg-gray-100"
                            )}>
                              {member.userName.charAt(0)}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium">{member.userName}</p>
                            {member.clockedIn && (
                              <p className="text-xs text-muted-foreground">
                                {member.onBreak ? (
                                  <span className="text-yellow-600">On break</span>
                                ) : member.activeTask ? (
                                  <span className="text-green-600">{member.activeTask}</span>
                                ) : (
                                  <span>Working</span>
                                )}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          {member.clockedIn ? (
                            <>
                              <div className="text-right">
                                <p className="font-medium">{formatHours(member.hoursToday)}</p>
                                <p className="text-xs text-muted-foreground">
                                  Since {formatTimeOfDay(member.clockInTime)}
                                </p>
                              </div>
                              <Badge className="bg-green-100 text-green-800">
                                <CheckCircle2 className="h-3 w-3 mr-1" />
                                Active
                              </Badge>
                            </>
                          ) : (
                            <Badge variant="outline" className="text-gray-500">
                              Not clocked in
                            </Badge>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>
      </Tabs>

      {/* Manual Entry Dialog */}
      <Dialog open={isManualEntryOpen} onOpenChange={setIsManualEntryOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Log Manual Time Entry</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid gap-2">
              <Label>Date</Label>
              <Input
                type="date"
                value={manualEntry.date}
                onChange={(e) => setManualEntry({ ...manualEntry, date: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label>Task Description</Label>
              <Input
                value={manualEntry.taskTitle}
                onChange={(e) => setManualEntry({ ...manualEntry, taskTitle: e.target.value })}
                placeholder="What did you work on?"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Start Time</Label>
                <Input
                  type="time"
                  value={manualEntry.startTime}
                  onChange={(e) => setManualEntry({ ...manualEntry, startTime: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label>End Time</Label>
                <Input
                  type="time"
                  value={manualEntry.endTime}
                  onChange={(e) => setManualEntry({ ...manualEntry, endTime: e.target.value })}
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Category</Label>
              <Select
                value={manualEntry.category}
                onValueChange={(v) => setManualEntry({ ...manualEntry, category: v })}
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
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsManualEntryOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => logManualEntryMutation.mutate(manualEntry)}
              disabled={!manualEntry.taskTitle || logManualEntryMutation.isPending}
            >
              Log Time
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
