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

// Mock data
const mockStaff: StaffMember[] = [
  {
    id: 'staff-1',
    userId: 'user-1',
    employeeId: 'EMP001',
    position: 'Farm Manager',
    department: 'Management',
    phone: '021 123 4567',
    employmentType: 'full_time',
    hourlyRate: '35.00',
    isActive: true,
    maxHoursPerWeek: 45,
    preferredShifts: ['morning'],
    user: { id: 'user-1', name: 'John Smith', email: 'john@pulse.farm', role: 'manager' },
  },
  {
    id: 'staff-2',
    userId: 'user-2',
    employeeId: 'EMP002',
    position: 'Stock Handler',
    department: 'Operations',
    phone: '021 234 5678',
    employmentType: 'full_time',
    hourlyRate: '28.00',
    isActive: true,
    maxHoursPerWeek: 40,
    preferredShifts: ['morning', 'afternoon'],
    user: { id: 'user-2', name: 'Sarah Johnson', email: 'sarah@pulse.farm', role: 'staff' },
  },
  {
    id: 'staff-3',
    userId: 'user-3',
    employeeId: 'EMP003',
    position: 'Seasonal Worker',
    department: 'Operations',
    phone: '021 345 6789',
    employmentType: 'seasonal',
    hourlyRate: '24.00',
    isActive: true,
    maxHoursPerWeek: 50,
    preferredShifts: ['morning', 'afternoon', 'night'],
    user: { id: 'user-3', name: 'Mike Wilson', email: 'mike@pulse.farm', role: 'worker' },
  },
  {
    id: 'staff-4',
    userId: 'user-4',
    employeeId: 'EMP004',
    position: 'Relief Milker',
    department: 'Operations',
    phone: '021 456 7890',
    employmentType: 'casual',
    hourlyRate: '26.00',
    isActive: true,
    maxHoursPerWeek: 30,
    preferredShifts: ['morning'],
    user: { id: 'user-4', name: 'Emily Brown', email: 'emily@pulse.farm', role: 'casual' },
  },
];

const shiftTemplates: ShiftTemplate[] = [
  { id: 'morning', name: 'Morning Shift', shiftType: 'morning', startTime: '05:00', endTime: '13:00', breakMinutes: 30, tasks: ['Morning milking', 'Calf feeding'], color: 'bg-yellow-100 border-yellow-400' },
  { id: 'afternoon', name: 'Afternoon Shift', shiftType: 'afternoon', startTime: '13:00', endTime: '21:00', breakMinutes: 30, tasks: ['Afternoon milking', 'Paddock checks'], color: 'bg-orange-100 border-orange-400' },
  { id: 'night', name: 'Night Shift', shiftType: 'night', startTime: '21:00', endTime: '05:00', breakMinutes: 30, tasks: ['Night watch', 'Calving assistance'], color: 'bg-blue-100 border-blue-400' },
  { id: 'split', name: 'Split Shift', shiftType: 'split', startTime: '05:00', endTime: '09:00', breakMinutes: 0, tasks: ['Morning milking'], color: 'bg-purple-100 border-purple-400' },
];

// Generate mock shifts for current week
const generateMockShifts = (weekStart: Date): Shift[] => {
  const shifts: Shift[] = [];
  const days = eachDayOfInterval({ start: weekStart, end: addDays(weekStart, 6) });
  
  days.forEach((day, dayIndex) => {
    // Morning shift - John
    if (dayIndex < 5) {
      shifts.push({
        id: `shift-${format(day, 'yyyy-MM-dd')}-1`,
        staffId: 'staff-1',
        staffName: 'John Smith',
        date: format(day, 'yyyy-MM-dd'),
        startTime: '05:00',
        endTime: '13:00',
        shiftType: 'morning',
        location: 'Main Dairy',
        tasks: ['Morning milking', 'Calf feeding', 'Paddock rotation'],
        status: isToday(day) ? 'in_progress' : dayIndex < new Date().getDay() ? 'completed' : 'confirmed',
        breakMinutes: 30,
      });
    }
    
    // Afternoon shift - Sarah
    if (dayIndex < 6) {
      shifts.push({
        id: `shift-${format(day, 'yyyy-MM-dd')}-2`,
        staffId: 'staff-2',
        staffName: 'Sarah Johnson',
        date: format(day, 'yyyy-MM-dd'),
        startTime: '13:00',
        endTime: '21:00',
        shiftType: 'afternoon',
        location: 'Main Dairy',
        tasks: ['Afternoon milking', 'Stock checks'],
        status: dayIndex < new Date().getDay() ? 'completed' : 'scheduled',
        breakMinutes: 30,
      });
    }
    
    // Mike - varies
    if (dayIndex % 2 === 0) {
      shifts.push({
        id: `shift-${format(day, 'yyyy-MM-dd')}-3`,
        staffId: 'staff-3',
        staffName: 'Mike Wilson',
        date: format(day, 'yyyy-MM-dd'),
        startTime: '06:00',
        endTime: '14:00',
        shiftType: 'morning',
        location: 'Paddock Block B',
        tasks: ['Fencing repairs', 'Water system checks'],
        status: dayIndex < new Date().getDay() ? 'completed' : 'scheduled',
        breakMinutes: 30,
      });
    }
  });
  
  return shifts;
};

const mockLeaveRequests: LeaveRequest[] = [
  {
    id: 'leave-1',
    staffId: 'staff-2',
    staffName: 'Sarah Johnson',
    startDate: format(addDays(new Date(), 14), 'yyyy-MM-dd'),
    endDate: format(addDays(new Date(), 18), 'yyyy-MM-dd'),
    type: 'annual',
    status: 'approved',
    reason: 'Family holiday',
    approvedBy: 'John Smith',
  },
  {
    id: 'leave-2',
    staffId: 'staff-3',
    staffName: 'Mike Wilson',
    startDate: format(addDays(new Date(), 7), 'yyyy-MM-dd'),
    endDate: format(addDays(new Date(), 7), 'yyyy-MM-dd'),
    type: 'personal',
    status: 'pending',
    reason: 'Medical appointment',
  },
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
    isRecurring: false,
    recurringPattern: 'weekly',
  });

  // Get shifts for current week
  const shifts = useMemo(() => generateMockShifts(currentWeekStart), [currentWeekStart]);
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
    const staffOnLeave = mockLeaveRequests.filter(l => l.status === 'approved').length;
    const pendingLeave = mockLeaveRequests.filter(l => l.status === 'pending').length;
    
    return { totalShifts, confirmedShifts, pendingShifts, totalHours, staffOnLeave, pendingLeave };
  }, [shifts]);

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

  // Handle add shift
  const handleAddShift = () => {
    toast.success('Shift added successfully');
    setIsAddShiftOpen(false);
    setNewShift({
      staffId: '',
      date: format(new Date(), 'yyyy-MM-dd'),
      startTime: '05:00',
      endTime: '13:00',
      shiftType: 'morning',
      location: '',
      tasks: '',
      notes: '',
      isRecurring: false,
      recurringPattern: 'weekly',
    });
  };

  // Copy previous week's roster
  const copyPreviousWeek = () => {
    toast.success('Previous week\'s roster copied to current week');
  };

  // Publish roster
  const publishRoster = () => {
    toast.success('Roster published and notifications sent to staff');
  };

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
              <Button variant="outline" onClick={publishRoster}>
                <Bell className="h-4 w-4 mr-2" />
                Publish Roster
              </Button>
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
                    {mockStaff
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
                {mockLeaveRequests.map(leave => (
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
                          <Button size="sm" variant="outline" className="text-green-600">
                            <CheckCircle className="h-4 w-4" />
                          </Button>
                          <Button size="sm" variant="outline" className="text-red-600">
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
                  {mockStaff.map(staff => (
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
            <div className="flex items-center gap-2">
              <Switch 
                checked={newShift.isRecurring}
                onCheckedChange={v => setNewShift(prev => ({ ...prev, isRecurring: v }))}
              />
              <Label>Recurring shift</Label>
              {newShift.isRecurring && (
                <Select 
                  value={newShift.recurringPattern}
                  onValueChange={v => setNewShift(prev => ({ ...prev, recurringPattern: v }))}
                >
                  <SelectTrigger className="w-32 ml-4">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">Daily</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="fortnightly">Fortnightly</SelectItem>
                  </SelectContent>
                </Select>
              )}
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
                <Button variant="outline" size="sm">
                  <Edit className="h-4 w-4 mr-2" />
                  Edit
                </Button>
                <Button variant="outline" size="sm" className="text-red-600">
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
