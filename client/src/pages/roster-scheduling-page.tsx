import { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { 
  Users, 
  Calendar as CalendarIcon, 
  Clock, 
  Plus,
  ChevronLeft,
  ChevronRight,
  Sun,
  Moon,
  Sunrise,
  AlertTriangle,
  CheckCircle,
  Copy,
  Trash2,
  Edit,
  MoreHorizontal,
  Download,
  Upload,
  RefreshCw,
  UserCheck,
  UserX,
  Coffee,
  Briefcase,
  MapPin,
  Phone,
  Mail,
  Filter,
  Repeat,
  Bell
} from 'lucide-react';
import { format, addDays, startOfWeek, endOfWeek, eachDayOfInterval, isSameDay, addWeeks, subWeeks, isToday, parseISO, differenceInHours } from 'date-fns';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

// Types
interface StaffMember {
  id: string;
  userId: string;
  employeeId?: string;
  position?: string;
  department?: string;
  phone?: string;
  employmentType?: string;
  hourlyRate?: string;
  isActive: boolean;
  user?: {
    id: string;
    name: string;
    email: string;
    role: string;
  };
  maxHoursPerWeek?: number;
  preferredShifts?: string[];
  unavailableDates?: string[];
}

interface Shift {
  id: string;
  staffId: string;
  staffName: string;
  date: string;
  startTime: string;
  endTime: string;
  shiftType: 'morning' | 'afternoon' | 'night' | 'split' | 'custom';
  location?: string;
  tasks?: string[];
  notes?: string;
  status: 'scheduled' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled' | 'no_show';
  breakMinutes?: number;
  isRecurring?: boolean;
  recurringPattern?: string;
  createdBy?: string;
  confirmedAt?: string;
}

interface ShiftTemplate {
  id: string;
  name: string;
  shiftType: 'morning' | 'afternoon' | 'night' | 'split' | 'custom';
  startTime: string;
  endTime: string;
  breakMinutes: number;
  tasks: string[];
  color: string;
}

interface LeaveRequest {
  id: string;
  staffId: string;
  staffName: string;
  startDate: string;
  endDate: string;
  type: 'annual' | 'sick' | 'personal' | 'unpaid' | 'other';
  status: 'pending' | 'approved' | 'rejected';
  reason?: string;
  approvedBy?: string;
}

async function rosterApi<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || body.message || 'Request failed');
  return body as T;
}

const shiftTemplates: ShiftTemplate[] = [
  { id: 'morning', name: 'Morning Shift', shiftType: 'morning', startTime: '05:00', endTime: '13:00', breakMinutes: 30, tasks: ['Morning milking', 'Calf feeding'], color: 'bg-yellow-100 border-yellow-400' },
  { id: 'afternoon', name: 'Afternoon Shift', shiftType: 'afternoon', startTime: '13:00', endTime: '21:00', breakMinutes: 30, tasks: ['Afternoon milking', 'Paddock checks'], color: 'bg-orange-100 border-orange-400' },
  { id: 'night', name: 'Night Shift', shiftType: 'night', startTime: '21:00', endTime: '05:00', breakMinutes: 30, tasks: ['Night watch', 'Calving assistance'], color: 'bg-blue-100 border-blue-400' },
  { id: 'split', name: 'Split Shift', shiftType: 'split', startTime: '05:00', endTime: '09:00', breakMinutes: 0, tasks: ['Morning milking'], color: 'bg-purple-100 border-purple-400' },
];

export default function RosterSchedulingPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('weekly');
  const [currentWeekStart, setCurrentWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedShift, setSelectedShift] = useState<Shift | null>(null);
  const [isAddShiftOpen, setIsAddShiftOpen] = useState(false);
  const [isLeaveRequestOpen, setIsLeaveRequestOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'staff' | 'day'>('staff');
  const [departmentFilter, setDepartmentFilter] = useState<string>('all');
  
  // Form state for new shift
  const [newShift, setNewShift] = useState({
    staffId: '',
    date: format(new Date(), 'yyyy-MM-dd'),
    startTime: '05:00',
    endTime: '13:00',
    shiftType: 'morning' as const,
    location: '',
    tasks: '',
    notes: '',
  });

  const weekKey = format(currentWeekStart, 'yyyy-MM-dd');
  const { data: staffList = [] } = useQuery<StaffMember[]>({
    queryKey: ['/api/roster/staff'],
    queryFn: () => rosterApi('/api/roster/staff'),
  });
  const { data: shifts = [] } = useQuery<Shift[]>({
    queryKey: ['/api/roster/shifts', weekKey],
    queryFn: () => rosterApi(`/api/roster/shifts?weekStart=${weekKey}`),
  });
  const { data: leaveRequests = [] } = useQuery<LeaveRequest[]>({
    queryKey: ['/api/roster/leave'],
    queryFn: () => rosterApi('/api/roster/leave'),
  });

  const refreshShifts = () => queryClient.invalidateQueries({ queryKey: ['/api/roster/shifts'] });
  const refreshLeave = () => queryClient.invalidateQueries({ queryKey: ['/api/roster/leave'] });

  const addShiftMutation = useMutation({
    mutationFn: (shift: typeof newShift) => rosterApi<Shift>('/api/roster/shifts', {
      method: 'POST',
      body: JSON.stringify({
        staffId: shift.staffId,
        date: shift.date,
        startTime: shift.startTime,
        endTime: shift.endTime,
        location: shift.location || undefined,
        tasks: shift.tasks || undefined,
        notes: shift.notes || undefined,
      }),
    }),
    onSuccess: () => {
      refreshShifts();
      toast.success('Shift added');
      setIsAddShiftOpen(false);
      resetNewShift();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const copyWeekMutation = useMutation({
    mutationFn: () => rosterApi<{ copied: number }>('/api/roster/shifts/copy-week', {
      method: 'POST',
      body: JSON.stringify({ weekStart: weekKey }),
    }),
    onSuccess: ({ copied }) => {
      refreshShifts();
      toast.success(copied ? `Copied ${copied} shift${copied === 1 ? '' : 's'} from last week` : 'Last week had no shifts to copy');
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const deleteShiftMutation = useMutation({
    mutationFn: (id: string) => rosterApi(`/api/roster/shifts/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      refreshShifts();
      setSelectedShift(null);
      toast.success('Shift deleted');
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const reviewLeaveMutation = useMutation({
    mutationFn: ({ id, decision }: { id: string; decision: 'approve' | 'reject' }) =>
      rosterApi<LeaveRequest>(`/api/roster/leave/${id}/${decision}`, { method: 'PUT' }),
    onSuccess: (leave) => {
      refreshLeave();
      toast.success(`Leave ${leave.status}`);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const [newLeave, setNewLeave] = useState({
    startDate: format(new Date(), 'yyyy-MM-dd'),
    endDate: format(new Date(), 'yyyy-MM-dd'),
    type: 'annual' as LeaveRequest['type'],
    reason: '',
  });
  const requestLeaveMutation = useMutation({
    mutationFn: (leave: typeof newLeave) => rosterApi<LeaveRequest>('/api/roster/leave', {
      method: 'POST',
      body: JSON.stringify(leave),
    }),
    onSuccess: () => {
      refreshLeave();
      toast.success('Leave requested');
      setIsLeaveRequestOpen(false);
      setNewLeave(prev => ({ ...prev, reason: '' }));
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const weekDays = useMemo(() => eachDayOfInterval({ 
    start: currentWeekStart, 
    end: addDays(currentWeekStart, 6) 
  }), [currentWeekStart]);

  // Calculate stats
  const stats = useMemo(() => {
    const totalShifts = shifts.length;
    const confirmedShifts = shifts.filter(s => s.status === 'confirmed' || s.status === 'completed').length;
    const pendingShifts = shifts.filter(s => s.status === 'scheduled').length;
    const totalHours = shifts.reduce((sum, s) => {
      const start = parseISO(`2000-01-01T${s.startTime}`);
      const end = parseISO(`2000-01-01T${s.endTime}`);
      return sum + differenceInHours(end, start);
    }, 0);
    const staffOnLeave = leaveRequests.filter(l => l.status === 'approved').length;
    const pendingLeave = leaveRequests.filter(l => l.status === 'pending').length;
    
    return { totalShifts, confirmedShifts, pendingShifts, totalHours, staffOnLeave, pendingLeave };
  }, [shifts, leaveRequests]);

  // Get shifts for a specific staff member on a specific day
  const getShiftsForStaffDay = (staffId: string, date: Date) => {
    return shifts.filter(s => s.staffId === staffId && s.date === format(date, 'yyyy-MM-dd'));
  };

  // Get all shifts for a specific day
  const getShiftsForDay = (date: Date) => {
    return shifts.filter(s => s.date === format(date, 'yyyy-MM-dd'));
  };

  // Navigation
  const goToPreviousWeek = () => setCurrentWeekStart(prev => subWeeks(prev, 1));
  const goToNextWeek = () => setCurrentWeekStart(prev => addWeeks(prev, 1));
  const goToToday = () => setCurrentWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }));

  // Get shift type icon
  const getShiftIcon = (type: string) => {
    switch (type) {
      case 'morning': return <Sunrise className="h-3 w-3" />;
      case 'afternoon': return <Sun className="h-3 w-3" />;
      case 'night': return <Moon className="h-3 w-3" />;
      default: return <Clock className="h-3 w-3" />;
    }
  };

  // Get status badge
  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      scheduled: 'bg-gray-100 text-gray-700',
      confirmed: 'bg-blue-100 text-blue-700',
      in_progress: 'bg-green-100 text-green-700',
      completed: 'bg-green-100 text-green-700',
      cancelled: 'bg-red-100 text-red-700',
      no_show: 'bg-red-100 text-red-700',
    };
    return <Badge className={styles[status] || 'bg-gray-100'}>{status.replace('_', ' ')}</Badge>;
  };

  const resetNewShift = () => {
    setNewShift({
      staffId: '',
      date: format(new Date(), 'yyyy-MM-dd'),
      startTime: '05:00',
      endTime: '13:00',
      shiftType: 'morning',
      location: '',
      tasks: '',
      notes: '',
    });
  };

  const handleAddShift = () => {
    if (!newShift.staffId) {
      toast.error('Choose a staff member');
      return;
    }
    addShiftMutation.mutate(newShift);
  };

  // Copy previous week's roster
  const copyPreviousWeek = () => copyWeekMutation.mutate();

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
            <CalendarIcon className="h-8 w-8 text-pulse-forest" />
            Roster & Shift Scheduling
          </h1>
          <p className="text-gray-500 mt-1">Plan and manage staff shifts, rosters, and leave requests</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={copyPreviousWeek}>
            <Copy className="h-4 w-4 mr-2" />
            Copy Last Week
          </Button>
          <Button variant="outline" onClick={() => setIsLeaveRequestOpen(true)}>
            <Coffee className="h-4 w-4 mr-2" />
            Leave Requests
          </Button>
          <Button onClick={() => setIsAddShiftOpen(true)} className="bg-pulse-forest hover:bg-pulse-forest-dark">
            <Plus className="h-4 w-4 mr-2" />
            Add Shift
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500">Total Shifts</p>
                <p className="text-2xl font-bold">{stats.totalShifts}</p>
              </div>
              <CalendarIcon className="h-6 w-6 text-pulse-forest" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500">Confirmed</p>
                <p className="text-2xl font-bold text-green-600">{stats.confirmedShifts}</p>
              </div>
              <CheckCircle className="h-6 w-6 text-green-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500">Pending</p>
                <p className="text-2xl font-bold text-yellow-600">{stats.pendingShifts}</p>
              </div>
              <Clock className="h-6 w-6 text-yellow-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500">Total Hours</p>
                <p className="text-2xl font-bold">{stats.totalHours}h</p>
              </div>
              <Briefcase className="h-6 w-6 text-blue-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500">On Leave</p>
                <p className="text-2xl font-bold text-orange-600">{stats.staffOnLeave}</p>
              </div>
              <UserX className="h-6 w-6 text-orange-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500">Leave Pending</p>
                <p className="text-2xl font-bold text-purple-600">{stats.pendingLeave}</p>
              </div>
              <AlertTriangle className="h-6 w-6 text-purple-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Week Navigation */}
      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" onClick={goToPreviousWeek}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" onClick={goToToday}>Today</Button>
              <Button variant="outline" size="icon" onClick={goToNextWeek}>
                <ChevronRight className="h-4 w-4" />
              </Button>
              <span className="ml-4 text-lg font-semibold">
                {format(currentWeekStart, 'MMM d')} - {format(addDays(currentWeekStart, 6), 'MMM d, yyyy')}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Select value={viewMode} onValueChange={(v: 'staff' | 'day') => setViewMode(v)}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="staff">By Staff</SelectItem>
                  <SelectItem value="day">By Day</SelectItem>
                </SelectContent>
              </Select>
              <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="All Departments" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Departments</SelectItem>
                  <SelectItem value="Management">Management</SelectItem>
                  <SelectItem value="Operations">Operations</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Main Roster Grid */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="weekly">Weekly View</TabsTrigger>
          <TabsTrigger value="daily">Daily View</TabsTrigger>
          <TabsTrigger value="templates">Shift Templates</TabsTrigger>
          <TabsTrigger value="leave">Leave Management</TabsTrigger>
        </TabsList>

        {/* Weekly View */}
        <TabsContent value="weekly" className="mt-4">
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b bg-gray-50">
                      <th className="p-3 text-left font-medium text-gray-600 w-48 sticky left-0 bg-gray-50 z-10">
                        Staff Member
                      </th>
                      {weekDays.map(day => (
                        <th 
                          key={day.toISOString()} 
                          className={cn(
                            "p-3 text-center font-medium min-w-32",
                            isToday(day) ? "bg-pulse-forest/10 text-pulse-forest" : "text-gray-600"
                          )}
                        >
                          <div>{format(day, 'EEE')}</div>
                          <div className={cn(
                            "text-lg",
                            isToday(day) && "font-bold"
                          )}>{format(day, 'd')}</div>
                        </th>
                      ))}
                      <th className="p-3 text-center font-medium text-gray-600 w-24">
                        Hours
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {staffList
                      .filter(s => departmentFilter === 'all' || s.department === departmentFilter)
                      .map(staff => {
                        const staffShifts = shifts.filter(s => s.staffId === staff.id);
                        const totalHours = staffShifts.reduce((sum, s) => {
                          const start = parseISO(`2000-01-01T${s.startTime}`);
                          const end = parseISO(`2000-01-01T${s.endTime}`);
                          return sum + differenceInHours(end, start);
                        }, 0);
                        
                        return (
                          <tr key={staff.id} className="border-b hover:bg-accent">
                            <td className="p-3 sticky left-0 bg-white z-10">
                              <div className="flex items-center gap-3">
                                <Avatar className="h-8 w-8">
                                  <AvatarFallback className="bg-pulse-forest text-white text-xs">
                                    {staff.user?.name?.charAt(0)}
                                  </AvatarFallback>
                                </Avatar>
                                <div>
                                  <div className="font-medium text-sm">{staff.user?.name}</div>
                                  <div className="text-xs text-gray-500">{staff.position}</div>
                                </div>
                              </div>
                            </td>
                            {weekDays.map(day => {
                              const dayShifts = getShiftsForStaffDay(staff.id, day);
                              return (
                                <td 
                                  key={day.toISOString()} 
                                  className={cn(
                                    "p-2 border-l",
                                    isToday(day) && "bg-pulse-forest/5"
                                  )}
                                >
                                  {dayShifts.length > 0 ? (
                                    <div className="space-y-1">
                                      {dayShifts.map(shift => {
                                        const template = shiftTemplates.find(t => t.shiftType === shift.shiftType);
                                        return (
                                          <div
                                            key={shift.id}
                                            onClick={() => setSelectedShift(shift)}
                                            className={cn(
                                              "p-2 rounded border cursor-pointer hover:shadow-md transition-shadow text-xs",
                                              template?.color || 'bg-gray-100 border-gray-300'
                                            )}
                                          >
                                            <div className="flex items-center gap-1 font-medium">
                                              {getShiftIcon(shift.shiftType)}
                                              {shift.startTime} - {shift.endTime}
                                            </div>
                                            {shift.location && (
                                              <div className="text-gray-600 mt-1 flex items-center gap-1">
                                                <MapPin className="h-2 w-2" />
                                                {shift.location}
                                              </div>
                                            )}
                                          </div>
                                        );
                                      })}
                                    </div>
                                  ) : (
                                    <button
                                      onClick={() => {
                                        setNewShift(prev => ({
                                          ...prev,
                                          staffId: staff.id,
                                          date: format(day, 'yyyy-MM-dd'),
                                        }));
                                        setIsAddShiftOpen(true);
                                      }}
                                      className="w-full h-12 border-2 border-dashed border-gray-200 rounded hover:border-pulse-forest hover:bg-pulse-forest/5 transition-colors flex items-center justify-center"
                                    >
                                      <Plus className="h-4 w-4 text-gray-400" />
                                    </button>
                                  )}
                                </td>
                              );
                            })}
                            <td className="p-3 text-center border-l">
                              <div className={cn(
                                "font-semibold",
                                totalHours > (staff.maxHoursPerWeek || 40) ? "text-red-600" : "text-gray-900"
                              )}>
                                {totalHours}h
                              </div>
                              <div className="text-xs text-gray-500">
                                / {staff.maxHoursPerWeek || 40}h
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Daily View */}
        <TabsContent value="daily" className="mt-4">
          <div className="grid grid-cols-1 md:grid-cols-7 gap-4">
            {weekDays.map(day => {
              const dayShifts = getShiftsForDay(day);
              return (
                <Card key={day.toISOString()} className={cn(isToday(day) && "ring-2 ring-pulse-forest")}>
                  <CardHeader className="pb-2">
                    <CardTitle className={cn(
                      "text-sm",
                      isToday(day) && "text-pulse-forest"
                    )}>
                      {format(day, 'EEEE')}
                    </CardTitle>
                    <CardDescription className="text-lg font-bold">
                      {format(day, 'MMM d')}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {dayShifts.length === 0 ? (
                      <p className="text-sm text-gray-500 text-center py-4">No shifts</p>
                    ) : (
                      dayShifts.map(shift => (
                        <div
                          key={shift.id}
                          onClick={() => setSelectedShift(shift)}
                          className="p-2 bg-gray-50 rounded border cursor-pointer hover:shadow-md transition-shadow"
                        >
                          <div className="flex items-center gap-2">
                            <Avatar className="h-6 w-6">
                              <AvatarFallback className="bg-pulse-forest text-white text-xs">
                                {shift.staffName.charAt(0)}
                              </AvatarFallback>
                            </Avatar>
                            <span className="text-sm font-medium truncate">{shift.staffName}</span>
                          </div>
                          <div className="text-xs text-gray-600 mt-1 flex items-center gap-1">
                            {getShiftIcon(shift.shiftType)}
                            {shift.startTime} - {shift.endTime}
                          </div>
                        </div>
                      ))
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full"
                      onClick={() => {
                        setNewShift(prev => ({ ...prev, date: format(day, 'yyyy-MM-dd') }));
                        setIsAddShiftOpen(true);
                      }}
                    >
                      <Plus className="h-3 w-3 mr-1" />
                      Add
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        {/* Shift Templates */}
        <TabsContent value="templates" className="mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {shiftTemplates.map(template => (
              <Card key={template.id} className={cn("border-2", template.color)}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    {getShiftIcon(template.shiftType)}
                    {template.name}
                  </CardTitle>
                  <CardDescription>
                    {template.startTime} - {template.endTime}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="text-sm">
                      <span className="text-gray-500">Break:</span> {template.breakMinutes} mins
                    </div>
                    <div className="text-sm">
                      <span className="text-gray-500">Tasks:</span>
                      <ul className="list-disc list-inside mt-1">
                        {template.tasks.map((task, i) => (
                          <li key={i} className="text-gray-700">{task}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
            <Card className="border-2 border-dashed border-gray-300 flex items-center justify-center cursor-pointer hover:border-pulse-forest hover:bg-pulse-forest/5 transition-colors">
              <CardContent className="text-center py-8">
                <Plus className="h-8 w-8 mx-auto text-gray-400 mb-2" />
                <p className="text-gray-500">Create Template</p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Leave Management */}
        <TabsContent value="leave" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Leave Requests</CardTitle>
              <CardDescription>Manage staff leave and time off requests</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {leaveRequests.map(leave => (
                  <div key={leave.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-4">
                      <Avatar>
                        <AvatarFallback className="bg-pulse-forest text-white">
                          {leave.staffName.charAt(0)}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="font-medium">{leave.staffName}</div>
                        <div className="text-sm text-gray-500">
                          {format(parseISO(leave.startDate), 'MMM d')} - {format(parseISO(leave.endDate), 'MMM d, yyyy')}
                        </div>
                        <div className="text-sm text-gray-500">{leave.reason}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <Badge className={cn(
                        leave.type === 'annual' && 'bg-blue-100 text-blue-700',
                        leave.type === 'sick' && 'bg-red-100 text-red-700',
                        leave.type === 'personal' && 'bg-purple-100 text-purple-700',
                      )}>
                        {leave.type}
                      </Badge>
                      <Badge className={cn(
                        leave.status === 'approved' && 'bg-green-100 text-green-700',
                        leave.status === 'pending' && 'bg-yellow-100 text-yellow-700',
                        leave.status === 'rejected' && 'bg-red-100 text-red-700',
                      )}>
                        {leave.status}
                      </Badge>
                      {leave.status === 'pending' && (
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-green-600"
                            aria-label="Approve leave"
                            disabled={reviewLeaveMutation.isPending}
                            onClick={() => reviewLeaveMutation.mutate({ id: leave.id, decision: 'approve' })}
                          >
                            <CheckCircle className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-red-600"
                            aria-label="Reject leave"
                            disabled={reviewLeaveMutation.isPending}
                            onClick={() => reviewLeaveMutation.mutate({ id: leave.id, decision: 'reject' })}
                          >
                            <UserX className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Add Shift Dialog */}
      <Dialog open={isAddShiftOpen} onOpenChange={setIsAddShiftOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Add New Shift</DialogTitle>
            <DialogDescription>Schedule a new shift for a staff member</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Staff Member</Label>
              <Select value={newShift.staffId} onValueChange={v => setNewShift(prev => ({ ...prev, staffId: v }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Select staff member" />
                </SelectTrigger>
                <SelectContent>
                  {staffList.map(staff => (
                    <SelectItem key={staff.id} value={staff.id}>
                      {staff.user?.name} - {staff.position}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Date</Label>
                <Input 
                  type="date" 
                  value={newShift.date}
                  onChange={e => setNewShift(prev => ({ ...prev, date: e.target.value }))}
                />
              </div>
              <div>
                <Label>Shift Type</Label>
                <Select 
                  value={newShift.shiftType} 
                  onValueChange={v => {
                    const template = shiftTemplates.find(t => t.shiftType === v);
                    setNewShift(prev => ({ 
                      ...prev, 
                      shiftType: v as any,
                      startTime: template?.startTime || prev.startTime,
                      endTime: template?.endTime || prev.endTime,
                    }));
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="morning">Morning Shift</SelectItem>
                    <SelectItem value="afternoon">Afternoon Shift</SelectItem>
                    <SelectItem value="night">Night Shift</SelectItem>
                    <SelectItem value="split">Split Shift</SelectItem>
                    <SelectItem value="custom">Custom</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Start Time</Label>
                <Input 
                  type="time" 
                  value={newShift.startTime}
                  onChange={e => setNewShift(prev => ({ ...prev, startTime: e.target.value }))}
                />
              </div>
              <div>
                <Label>End Time</Label>
                <Input 
                  type="time" 
                  value={newShift.endTime}
                  onChange={e => setNewShift(prev => ({ ...prev, endTime: e.target.value }))}
                />
              </div>
            </div>
            <div>
              <Label>Location</Label>
              <Input 
                placeholder="e.g., Main Dairy, Paddock Block A"
                value={newShift.location}
                onChange={e => setNewShift(prev => ({ ...prev, location: e.target.value }))}
              />
            </div>
            <div>
              <Label>Tasks (comma separated)</Label>
              <Input 
                placeholder="e.g., Morning milking, Calf feeding"
                value={newShift.tasks}
                onChange={e => setNewShift(prev => ({ ...prev, tasks: e.target.value }))}
              />
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea 
                placeholder="Any additional notes..."
                value={newShift.notes}
                onChange={e => setNewShift(prev => ({ ...prev, notes: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddShiftOpen(false)}>Cancel</Button>
            <Button onClick={handleAddShift} className="bg-pulse-forest hover:bg-pulse-forest-dark">
              Add Shift
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Shift Detail Dialog */}
      <Dialog open={!!selectedShift} onOpenChange={() => setSelectedShift(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Shift Details</DialogTitle>
          </DialogHeader>
          {selectedShift && (
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <Avatar className="h-12 w-12">
                  <AvatarFallback className="bg-pulse-forest text-white">
                    {selectedShift.staffName.charAt(0)}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <div className="font-semibold">{selectedShift.staffName}</div>
                  <div className="text-sm text-gray-500">
                    {format(parseISO(selectedShift.date), 'EEEE, MMMM d, yyyy')}
                  </div>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-gray-500">Shift Type</Label>
                  <div className="flex items-center gap-2 mt-1">
                    {getShiftIcon(selectedShift.shiftType)}
                    <span className="capitalize">{selectedShift.shiftType}</span>
                  </div>
                </div>
                <div>
                  <Label className="text-gray-500">Status</Label>
                  <div className="mt-1">{getStatusBadge(selectedShift.status)}</div>
                </div>
                <div>
                  <Label className="text-gray-500">Time</Label>
                  <p>{selectedShift.startTime} - {selectedShift.endTime}</p>
                </div>
                <div>
                  <Label className="text-gray-500">Location</Label>
                  <p>{selectedShift.location || 'Not specified'}</p>
                </div>
              </div>
              
              {selectedShift.tasks && selectedShift.tasks.length > 0 && (
                <div>
                  <Label className="text-gray-500">Tasks</Label>
                  <ul className="list-disc list-inside mt-1">
                    {selectedShift.tasks.map((task, i) => (
                      <li key={i}>{task}</li>
                    ))}
                  </ul>
                </div>
              )}
              
              {selectedShift.notes && (
                <div>
                  <Label className="text-gray-500">Notes</Label>
                  <p className="text-sm">{selectedShift.notes}</p>
                </div>
              )}
              
              <div className="flex justify-end gap-2 pt-4">
                <Button
                  variant="outline"
                  size="sm"
                  className="text-red-600"
                  disabled={deleteShiftMutation.isPending}
                  onClick={() => deleteShiftMutation.mutate(selectedShift.id)}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Request Leave Dialog */}
      <Dialog open={isLeaveRequestOpen} onOpenChange={setIsLeaveRequestOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request Leave</DialogTitle>
            <DialogDescription>Your farm owner or manager will approve or decline it.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="leave-start">From</Label>
                <Input
                  id="leave-start"
                  type="date"
                  value={newLeave.startDate}
                  onChange={e => setNewLeave(prev => ({ ...prev, startDate: e.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="leave-end">To</Label>
                <Input
                  id="leave-end"
                  type="date"
                  value={newLeave.endDate}
                  min={newLeave.startDate}
                  onChange={e => setNewLeave(prev => ({ ...prev, endDate: e.target.value }))}
                />
              </div>
            </div>
            <div>
              <Label>Type</Label>
              <Select
                value={newLeave.type}
                onValueChange={v => setNewLeave(prev => ({ ...prev, type: v as LeaveRequest['type'] }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="annual">Annual</SelectItem>
                  <SelectItem value="sick">Sick</SelectItem>
                  <SelectItem value="personal">Personal</SelectItem>
                  <SelectItem value="unpaid">Unpaid</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="leave-reason">Reason</Label>
              <Textarea
                id="leave-reason"
                placeholder="Optional"
                value={newLeave.reason}
                onChange={e => setNewLeave(prev => ({ ...prev, reason: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsLeaveRequestOpen(false)}>Cancel</Button>
            <Button
              onClick={() => requestLeaveMutation.mutate(newLeave)}
              disabled={requestLeaveMutation.isPending}
              className="bg-pulse-forest hover:bg-pulse-forest-dark"
            >
              Submit Request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
