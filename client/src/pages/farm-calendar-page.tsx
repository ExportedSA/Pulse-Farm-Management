import { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { format, addDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isSameMonth, isToday, parseISO, differenceInDays } from 'date-fns';
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
  Briefcase,
  Heart,
  Cake,
  Tractor,
  Stethoscope,
  Baby,
  Settings,
  UserPlus,
  CalendarDays,
  CalendarClock,
  Eye,
  EyeOff,
  Palette,
  MoreVertical,
  Trash2,
  Edit,
  Save,
  X,
} from 'lucide-react';

// Types
interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  date: string;
  endDate?: string;
  time?: string;
  endTime?: string;
  type: 'job' | 'roster' | 'health' | 'farm' | 'birthday' | 'calving' | 'treatment';
  category?: string;
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  status?: string;
  assignedTo?: string[];
  assignedToNames?: string[];
  color?: string;
  allDay?: boolean;
  animalId?: string;
  animalName?: string;
}

interface StaffMember {
  id: string;
  name: string;
  email: string;
  role: string;
  color: string;
  rosterPattern?: string;
  rosterStartDate?: string;
}

interface RosterPattern {
  id: string;
  name: string;
  daysOn: number;
  daysOff: number;
  description: string;
}

// Roster patterns
const ROSTER_PATTERNS: RosterPattern[] = [
  { id: '6-2', name: '6/2', daysOn: 6, daysOff: 2, description: '6 days on, 2 days off' },
  { id: '8-2', name: '8/2', daysOn: 8, daysOff: 2, description: '8 days on, 2 days off' },
  { id: '11-3', name: '11/3', daysOn: 11, daysOff: 3, description: '11 days on, 3 days off' },
  { id: '5-2', name: '5/2', daysOn: 5, daysOff: 2, description: '5 days on, 2 days off (Mon-Fri)' },
  { id: 'custom', name: 'Custom', daysOn: 0, daysOff: 0, description: 'Custom pattern' },
];

// Staff colors
const STAFF_COLORS = [
  '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', 
  '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#6366f1'
];

// Event type colors and icons
const EVENT_TYPES = {
  job: { color: 'bg-blue-500', icon: Briefcase, label: 'Job' },
  roster: { color: 'bg-purple-500', icon: Users, label: 'Roster' },
  health: { color: 'bg-red-500', icon: Stethoscope, label: 'Health' },
  farm: { color: 'bg-green-500', icon: Tractor, label: 'Farm Event' },
  birthday: { color: 'bg-pink-500', icon: Cake, label: 'Birthday' },
  calving: { color: 'bg-amber-500', icon: Baby, label: 'Calving' },
  treatment: { color: 'bg-orange-500', icon: Heart, label: 'Treatment' },
};

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export default function FarmCalendarPage() {
  const queryClient = useQueryClient();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<'month' | 'week'>('month');
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  
  // Dialogs
  const [isEventDialogOpen, setIsEventDialogOpen] = useState(false);
  const [isRosterDialogOpen, setIsRosterDialogOpen] = useState(false);
  const [isStaffDialogOpen, setIsStaffDialogOpen] = useState(false);
  
  // Filters
  const [showJobs, setShowJobs] = useState(true);
  const [showRoster, setShowRoster] = useState(true);
  const [showHealth, setShowHealth] = useState(true);
  const [showFarmEvents, setShowFarmEvents] = useState(true);
  const [showBirthdays, setShowBirthdays] = useState(true);
  const [filterStaff, setFilterStaff] = useState<string>('all');
  
  // Staff roster state
  const [staff, setStaff] = useState<StaffMember[]>([
    { id: '1', name: 'John Smith', email: 'john@farm.com', role: 'Manager', color: STAFF_COLORS[0], rosterPattern: '6-2', rosterStartDate: '2025-01-01' },
    { id: '2', name: 'Sarah Johnson', email: 'sarah@farm.com', role: 'Farm Hand', color: STAFF_COLORS[1], rosterPattern: '6-2', rosterStartDate: '2025-01-03' },
    { id: '3', name: 'Mike Wilson', email: 'mike@farm.com', role: 'Relief Milker', color: STAFF_COLORS[2], rosterPattern: '5-2', rosterStartDate: '2025-01-01' },
  ]);
  
  const [editingStaff, setEditingStaff] = useState<StaffMember | null>(null);
  
  // New event form
  const [newEvent, setNewEvent] = useState<Partial<CalendarEvent>>({
    title: '',
    description: '',
    date: '',
    time: '09:00',
    type: 'farm',
    allDay: false,
  });

  // Fetch jobs
  const { data: jobs = [] } = useQuery<any[]>({
    queryKey: ['/api/jobs'],
    queryFn: async () => {
      const res = await fetch('/api/jobs');
      if (!res.ok) return [];
      return res.json();
    },
  });

  // Fetch animal treatments
  const { data: treatments = [] } = useQuery<any[]>({
    queryKey: ['/api/animal-treatments'],
    queryFn: async () => {
      const res = await fetch('/api/animal-treatments');
      if (!res.ok) return [];
      return res.json();
    },
  });

  // Fetch animals for calving/birthdays
  const { data: animals = [] } = useQuery<any[]>({
    queryKey: ['/api/animals'],
    queryFn: async () => {
      const res = await fetch('/api/animals');
      if (!res.ok) return [];
      return res.json();
    },
  });

  // Fetch farm events (custom events stored locally for now)
  const [farmEvents, setFarmEvents] = useState<CalendarEvent[]>(() => {
    const saved = localStorage.getItem('pulse_farm_events');
    return saved ? JSON.parse(saved) : [];
  });

  // Save farm events to localStorage
  useEffect(() => {
    localStorage.setItem('pulse_farm_events', JSON.stringify(farmEvents));
  }, [farmEvents]);

  // Generate roster events for staff
  const generateRosterEvents = useMemo(() => {
    const events: CalendarEvent[] = [];
    const viewStart = viewMode === 'month' 
      ? startOfMonth(currentDate)
      : startOfWeek(currentDate);
    const viewEnd = viewMode === 'month'
      ? endOfMonth(currentDate)
      : endOfWeek(currentDate);
    
    // Extend range for month view padding
    const rangeStart = addDays(viewStart, -7);
    const rangeEnd = addDays(viewEnd, 7);
    
    staff.forEach(member => {
      if (!member.rosterPattern || !member.rosterStartDate) return;
      
      const pattern = ROSTER_PATTERNS.find(p => p.id === member.rosterPattern);
      if (!pattern || pattern.id === 'custom') return;
      
      const cycleLength = pattern.daysOn + pattern.daysOff;
      const startDate = parseISO(member.rosterStartDate);
      
      // Generate events for the visible range
      let currentDay = rangeStart;
      while (currentDay <= rangeEnd) {
        const daysSinceStart = differenceInDays(currentDay, startDate);
        const positionInCycle = ((daysSinceStart % cycleLength) + cycleLength) % cycleLength;
        const isWorking = positionInCycle < pattern.daysOn;
        
        if (isWorking) {
          events.push({
            id: `roster-${member.id}-${format(currentDay, 'yyyy-MM-dd')}`,
            title: member.name,
            date: format(currentDay, 'yyyy-MM-dd'),
            type: 'roster',
            color: member.color,
            allDay: true,
            assignedTo: [member.id],
            assignedToNames: [member.name],
          });
        }
        
        currentDay = addDays(currentDay, 1);
      }
    });
    
    return events;
  }, [staff, currentDate, viewMode]);

  // Combine all events
  const allEvents = useMemo(() => {
    const events: CalendarEvent[] = [];
    
    // Add jobs
    if (showJobs) {
      jobs.forEach((job: any) => {
        events.push({
          id: `job-${job.id}`,
          title: job.title,
          description: job.description,
          date: job.startDate,
          time: job.startTime,
          endTime: job.endTime,
          type: 'job',
          category: job.category,
          priority: job.priority,
          status: job.status,
          assignedTo: job.assignedTo,
          assignedToNames: job.assignedToNames,
        });
      });
    }
    
    // Add roster
    if (showRoster) {
      events.push(...generateRosterEvents);
    }
    
    // Add treatments
    if (showHealth) {
      treatments.forEach((treatment: any) => {
        events.push({
          id: `treatment-${treatment.id}`,
          title: `Treatment: ${treatment.treatmentType || 'Health Check'}`,
          description: treatment.notes,
          date: treatment.startDate,
          type: 'treatment',
          animalId: treatment.animalId,
        });
      });
    }
    
    // Add calving events (animals with expected calving dates)
    if (showHealth) {
      animals.forEach((animal: any) => {
        if (animal.reproductionStatus === 'confirmed_pregnant' && animal.expectedCalvingDate) {
          events.push({
            id: `calving-${animal.id}`,
            title: `Expected Calving: ${animal.visualId || animal.tagNumber || animal.name}`,
            date: animal.expectedCalvingDate,
            type: 'calving',
            animalId: animal.id,
            animalName: animal.name || animal.visualId,
          });
        }
      });
    }
    
    // Add birthdays (animals with date of birth - show anniversary)
    if (showBirthdays) {
      const today = new Date();
      animals.forEach((animal: any) => {
        if (animal.dateOfBirth) {
          const dob = parseISO(animal.dateOfBirth);
          const thisYearBirthday = new Date(today.getFullYear(), dob.getMonth(), dob.getDate());
          const age = today.getFullYear() - dob.getFullYear();
          
          events.push({
            id: `birthday-${animal.id}`,
            title: `🎂 ${animal.visualId || animal.name || animal.tagNumber} turns ${age}`,
            date: format(thisYearBirthday, 'yyyy-MM-dd'),
            type: 'birthday',
            animalId: animal.id,
            animalName: animal.name || animal.visualId,
            allDay: true,
          });
        }
      });
    }
    
    // Add custom farm events
    if (showFarmEvents) {
      events.push(...farmEvents);
    }
    
    // Filter by staff if needed
    if (filterStaff !== 'all') {
      return events.filter(e => 
        e.type === 'roster' 
          ? e.assignedTo?.includes(filterStaff)
          : true
      );
    }
    
    return events;
  }, [jobs, treatments, animals, farmEvents, generateRosterEvents, showJobs, showRoster, showHealth, showFarmEvents, showBirthdays, filterStaff]);

  // Get events for a specific date
  const getEventsForDate = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return allEvents.filter(event => event.date === dateStr);
  };

  // Calendar navigation
  const goToPrevious = () => {
    if (viewMode === 'month') {
      setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
    } else {
      setCurrentDate(addDays(currentDate, -7));
    }
  };

  const goToNext = () => {
    if (viewMode === 'month') {
      setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
    } else {
      setCurrentDate(addDays(currentDate, 7));
    }
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  // Generate calendar days
  const calendarDays = useMemo(() => {
    if (viewMode === 'month') {
      const start = startOfMonth(currentDate);
      const end = endOfMonth(currentDate);
      const startPadding = start.getDay();
      const days: Date[] = [];
      
      // Previous month padding
      for (let i = startPadding - 1; i >= 0; i--) {
        days.push(addDays(start, -i - 1));
      }
      
      // Current month
      const monthDays = eachDayOfInterval({ start, end });
      days.push(...monthDays);
      
      // Next month padding
      const remaining = 42 - days.length;
      for (let i = 1; i <= remaining; i++) {
        days.push(addDays(end, i));
      }
      
      return days;
    } else {
      const start = startOfWeek(currentDate);
      return eachDayOfInterval({ start, end: addDays(start, 6) });
    }
  }, [currentDate, viewMode]);

  // Handle date click
  const handleDateClick = (date: Date) => {
    setSelectedDate(date);
    setNewEvent(prev => ({
      ...prev,
      date: format(date, 'yyyy-MM-dd'),
    }));
  };

  // Handle event click
  const handleEventClick = (event: CalendarEvent, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedEvent(event);
  };

  // Create farm event
  const createFarmEvent = () => {
    if (!newEvent.title || !newEvent.date) {
      toast.error('Please fill in required fields');
      return;
    }
    
    const event: CalendarEvent = {
      id: `event-${Date.now()}`,
      title: newEvent.title,
      description: newEvent.description,
      date: newEvent.date,
      time: newEvent.allDay ? undefined : newEvent.time,
      type: newEvent.type as CalendarEvent['type'],
      allDay: newEvent.allDay,
    };
    
    setFarmEvents(prev => [...prev, event]);
    setIsEventDialogOpen(false);
    setNewEvent({
      title: '',
      description: '',
      date: '',
      time: '09:00',
      type: 'farm',
      allDay: false,
    });
    toast.success('Event created');
  };

  // Delete farm event
  const deleteFarmEvent = (id: string) => {
    setFarmEvents(prev => prev.filter(e => e.id !== id));
    setSelectedEvent(null);
    toast.success('Event deleted');
  };

  // Update staff roster
  const updateStaffRoster = (staffId: string, pattern: string, startDate: string) => {
    setStaff(prev => prev.map(s => 
      s.id === staffId 
        ? { ...s, rosterPattern: pattern, rosterStartDate: startDate }
        : s
    ));
    toast.success('Roster updated');
  };

  // Add new staff
  const addStaff = () => {
    const newStaff: StaffMember = {
      id: `staff-${Date.now()}`,
      name: 'New Staff Member',
      email: '',
      role: 'Farm Hand',
      color: STAFF_COLORS[staff.length % STAFF_COLORS.length],
      rosterPattern: '6-2',
      rosterStartDate: format(new Date(), 'yyyy-MM-dd'),
    };
    setStaff(prev => [...prev, newStaff]);
    setEditingStaff(newStaff);
  };

  // Save staff
  const saveStaff = () => {
    if (editingStaff) {
      setStaff(prev => prev.map(s => s.id === editingStaff.id ? editingStaff : s));
      setEditingStaff(null);
      toast.success('Staff saved');
    }
  };

  // Delete staff
  const deleteStaff = (id: string) => {
    setStaff(prev => prev.filter(s => s.id !== id));
    toast.success('Staff removed');
  };

  // Get working staff for a date
  const getWorkingStaff = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    const rosterEvents = generateRosterEvents.filter(e => e.date === dateStr);
    return rosterEvents.map(e => ({
      name: e.title,
      color: e.color,
    }));
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <CalendarIcon className="h-8 w-8 text-primary" />
            Farm Calendar
          </h1>
          <p className="text-muted-foreground mt-1">
            Manage rosters, jobs, health events, and farm activities
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setIsRosterDialogOpen(true)}>
            <Users className="h-4 w-4 mr-2" />
            Manage Roster
          </Button>
          <Button onClick={() => {
            setSelectedDate(new Date());
            setNewEvent(prev => ({ ...prev, date: format(new Date(), 'yyyy-MM-dd') }));
            setIsEventDialogOpen(true);
          }}>
            <Plus className="h-4 w-4 mr-2" />
            Add Event
          </Button>
        </div>
      </div>

      {/* Controls */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            {/* Navigation */}
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={goToToday}>
                Today
              </Button>
              <Button variant="ghost" size="sm" onClick={goToPrevious}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="sm" onClick={goToNext}>
                <ChevronRight className="h-4 w-4" />
              </Button>
              <h2 className="text-lg font-semibold min-w-[200px]">
                {viewMode === 'month' 
                  ? `${MONTHS[currentDate.getMonth()]} ${currentDate.getFullYear()}`
                  : `Week of ${format(startOfWeek(currentDate), 'MMM d, yyyy')}`
                }
              </h2>
            </div>

            {/* View Toggle & Filters */}
            <div className="flex flex-wrap items-center gap-4">
              <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as 'month' | 'week')}>
                <TabsList>
                  <TabsTrigger value="month">
                    <LayoutGrid className="h-4 w-4 mr-1" />
                    Month
                  </TabsTrigger>
                  <TabsTrigger value="week">
                    <List className="h-4 w-4 mr-1" />
                    Week
                  </TabsTrigger>
                </TabsList>
              </Tabs>

              {/* Event Type Filters */}
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Filter className="h-4 w-4 mr-2" />
                    Filters
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-64">
                  <div className="space-y-3">
                    <h4 className="font-medium text-sm">Show Events</h4>
                    <div className="space-y-2">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <Checkbox checked={showJobs} onCheckedChange={(c) => setShowJobs(!!c)} />
                        <Briefcase className="h-4 w-4 text-blue-500" />
                        <span className="text-sm">Jobs</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <Checkbox checked={showRoster} onCheckedChange={(c) => setShowRoster(!!c)} />
                        <Users className="h-4 w-4 text-purple-500" />
                        <span className="text-sm">Staff Roster</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <Checkbox checked={showHealth} onCheckedChange={(c) => setShowHealth(!!c)} />
                        <Stethoscope className="h-4 w-4 text-red-500" />
                        <span className="text-sm">Health Events</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <Checkbox checked={showFarmEvents} onCheckedChange={(c) => setShowFarmEvents(!!c)} />
                        <Tractor className="h-4 w-4 text-green-500" />
                        <span className="text-sm">Farm Events</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <Checkbox checked={showBirthdays} onCheckedChange={(c) => setShowBirthdays(!!c)} />
                        <Cake className="h-4 w-4 text-pink-500" />
                        <span className="text-sm">Birthdays</span>
                      </label>
                    </div>
                    
                    <div className="pt-2 border-t">
                      <Label className="text-sm">Filter by Staff</Label>
                      <Select value={filterStaff} onValueChange={setFilterStaff}>
                        <SelectTrigger className="mt-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Staff</SelectItem>
                          {staff.map(s => (
                            <SelectItem key={s.id} value={s.id}>
                              <div className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: s.color }} />
                                {s.name}
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 text-sm">
        {Object.entries(EVENT_TYPES).map(([key, value]) => (
          <div key={key} className="flex items-center gap-1.5">
            <div className={cn("w-3 h-3 rounded", value.color)} />
            <span className="text-muted-foreground">{value.label}</span>
          </div>
        ))}
      </div>

      {/* Calendar Grid */}
      <Card>
        <CardContent className="p-4">
          {/* Day Headers */}
          <div className="grid grid-cols-7 gap-1 mb-2">
            {DAYS.map(day => (
              <div key={day} className="text-center text-sm font-medium text-muted-foreground py-2">
                {day}
              </div>
            ))}
          </div>

          {/* Calendar Days */}
          <div className={cn(
            "grid grid-cols-7 gap-1",
            viewMode === 'week' ? 'min-h-[400px]' : ''
          )}>
            {calendarDays.map((date, idx) => {
              const dayEvents = getEventsForDate(date);
              const workingStaff = getWorkingStaff(date);
              const isCurrentMonth = isSameMonth(date, currentDate);
              const isSelected = selectedDate && isSameDay(date, selectedDate);
              
              return (
                <div
                  key={idx}
                  onClick={() => handleDateClick(date)}
                  className={cn(
                    "min-h-[100px] p-1 border rounded-lg cursor-pointer transition-colors",
                    isCurrentMonth ? 'bg-background' : 'bg-muted/30',
                    isToday(date) && 'ring-2 ring-primary',
                    isSelected && 'ring-2 ring-primary bg-primary/5',
                    'hover:bg-accent/50'
                  )}
                >
                  {/* Date Header */}
                  <div className="flex items-center justify-between mb-1">
                    <span className={cn(
                      "text-sm font-medium",
                      !isCurrentMonth && 'text-muted-foreground',
                      isToday(date) && 'bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center'
                    )}>
                      {format(date, 'd')}
                    </span>
                    {workingStaff.length > 0 && showRoster && (
                      <div className="flex -space-x-1">
                        {workingStaff.slice(0, 3).map((s, i) => (
                          <div
                            key={i}
                            className="w-4 h-4 rounded-full border-2 border-background"
                            style={{ backgroundColor: s.color }}
                            title={s.name}
                          />
                        ))}
                        {workingStaff.length > 3 && (
                          <div className="w-4 h-4 rounded-full bg-muted text-[10px] flex items-center justify-center">
                            +{workingStaff.length - 3}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Events */}
                  <ScrollArea className="h-[70px]">
                    <div className="space-y-0.5">
                      {dayEvents.filter(e => e.type !== 'roster').slice(0, viewMode === 'week' ? 10 : 3).map(event => {
                        const eventType = EVENT_TYPES[event.type];
                        return (
                          <div
                            key={event.id}
                            onClick={(e) => handleEventClick(event, e)}
                            className={cn(
                              "text-xs px-1.5 py-0.5 rounded truncate cursor-pointer hover:opacity-80",
                              eventType?.color || 'bg-gray-500',
                              'text-white'
                            )}
                            title={event.title}
                          >
                            {event.time && <span className="opacity-75">{event.time} </span>}
                            {event.title}
                          </div>
                        );
                      })}
                      {dayEvents.filter(e => e.type !== 'roster').length > (viewMode === 'week' ? 10 : 3) && (
                        <div className="text-xs text-muted-foreground px-1">
                          +{dayEvents.filter(e => e.type !== 'roster').length - (viewMode === 'week' ? 10 : 3)} more
                        </div>
                      )}
                    </div>
                  </ScrollArea>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Selected Date Panel */}
      {selectedDate && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>{format(selectedDate, 'EEEE, MMMM d, yyyy')}</span>
              <Button size="sm" onClick={() => {
                setNewEvent(prev => ({ ...prev, date: format(selectedDate, 'yyyy-MM-dd') }));
                setIsEventDialogOpen(true);
              }}>
                <Plus className="h-4 w-4 mr-1" />
                Add Event
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {(() => {
              const events = getEventsForDate(selectedDate);
              const workingStaff = getWorkingStaff(selectedDate);
              
              if (events.length === 0 && workingStaff.length === 0) {
                return (
                  <p className="text-muted-foreground text-center py-8">
                    No events scheduled for this day
                  </p>
                );
              }
              
              return (
                <div className="space-y-4">
                  {/* Working Staff */}
                  {workingStaff.length > 0 && showRoster && (
                    <div>
                      <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                        <Users className="h-4 w-4" />
                        Staff On Duty
                      </h4>
                      <div className="flex flex-wrap gap-2">
                        {workingStaff.map((s, i) => (
                          <Badge key={i} variant="secondary" className="gap-1">
                            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: s.color }} />
                            {s.name}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {/* Events List */}
                  {events.filter(e => e.type !== 'roster').length > 0 && (
                    <div className="space-y-2">
                      {events.filter(e => e.type !== 'roster').map(event => {
                        const eventType = EVENT_TYPES[event.type];
                        const Icon = eventType?.icon || CalendarIcon;
                        
                        return (
                          <div
                            key={event.id}
                            className="flex items-start gap-3 p-3 rounded-lg border hover:bg-accent/50 cursor-pointer"
                            onClick={() => setSelectedEvent(event)}
                          >
                            <div className={cn("p-2 rounded", eventType?.color || 'bg-gray-500')}>
                              <Icon className="h-4 w-4 text-white" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium">{event.title}</p>
                              {event.description && (
                                <p className="text-sm text-muted-foreground truncate">{event.description}</p>
                              )}
                              <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                                {event.time && (
                                  <span className="flex items-center gap-1">
                                    <Clock className="h-3 w-3" />
                                    {event.time}
                                    {event.endTime && ` - ${event.endTime}`}
                                  </span>
                                )}
                                {event.assignedToNames && event.assignedToNames.length > 0 && (
                                  <span className="flex items-center gap-1">
                                    <Users className="h-3 w-3" />
                                    {event.assignedToNames.join(', ')}
                                  </span>
                                )}
                              </div>
                            </div>
                            {event.type === 'farm' && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  deleteFarmEvent(event.id);
                                }}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })()}
          </CardContent>
        </Card>
      )}

      {/* Create Event Dialog */}
      <Dialog open={isEventDialogOpen} onOpenChange={setIsEventDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Farm Event</DialogTitle>
            <DialogDescription>
              Create a new event on the calendar
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label>Event Title *</Label>
              <Input
                value={newEvent.title}
                onChange={(e) => setNewEvent(prev => ({ ...prev, title: e.target.value }))}
                placeholder="e.g., Vet Visit, Farm Meeting"
              />
            </div>
            
            <div>
              <Label>Description</Label>
              <Textarea
                value={newEvent.description}
                onChange={(e) => setNewEvent(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Event details..."
                rows={2}
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Date *</Label>
                <Input
                  type="date"
                  value={newEvent.date}
                  onChange={(e) => setNewEvent(prev => ({ ...prev, date: e.target.value }))}
                />
              </div>
              <div>
                <Label>Event Type</Label>
                <Select 
                  value={newEvent.type} 
                  onValueChange={(v) => setNewEvent(prev => ({ ...prev, type: v as CalendarEvent['type'] }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="farm">Farm Event</SelectItem>
                    <SelectItem value="health">Health Event</SelectItem>
                    <SelectItem value="birthday">Birthday</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <Checkbox
                checked={newEvent.allDay}
                onCheckedChange={(c) => setNewEvent(prev => ({ ...prev, allDay: !!c }))}
              />
              <Label>All day event</Label>
            </div>
            
            {!newEvent.allDay && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Start Time</Label>
                  <Input
                    type="time"
                    value={newEvent.time}
                    onChange={(e) => setNewEvent(prev => ({ ...prev, time: e.target.value }))}
                  />
                </div>
                <div>
                  <Label>End Time</Label>
                  <Input
                    type="time"
                    value={newEvent.endTime}
                    onChange={(e) => setNewEvent(prev => ({ ...prev, endTime: e.target.value }))}
                  />
                </div>
              </div>
            )}
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEventDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={createFarmEvent}>
              Create Event
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Roster Management Dialog */}
      <Dialog open={isRosterDialogOpen} onOpenChange={setIsRosterDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Manage Staff Roster</DialogTitle>
            <DialogDescription>
              Set up roster patterns for your team
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            {/* Roster Patterns Legend */}
            <div className="bg-muted/50 rounded-lg p-4">
              <h4 className="font-medium mb-2">Roster Patterns</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                {ROSTER_PATTERNS.filter(p => p.id !== 'custom').map(pattern => (
                  <div key={pattern.id} className="flex items-center gap-2">
                    <Badge variant="outline">{pattern.name}</Badge>
                    <span className="text-muted-foreground">{pattern.description}</span>
                  </div>
                ))}
              </div>
            </div>
            
            {/* Staff List */}
            <div className="space-y-3">
              {staff.map(member => (
                <div key={member.id} className="flex items-center gap-4 p-3 border rounded-lg">
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center text-white font-medium"
                    style={{ backgroundColor: member.color }}
                  >
                    {member.name.charAt(0)}
                  </div>
                  
                  {editingStaff?.id === member.id ? (
                    <div className="flex-1 grid grid-cols-4 gap-2">
                      <Input
                        value={editingStaff.name}
                        onChange={(e) => setEditingStaff({ ...editingStaff, name: e.target.value })}
                        placeholder="Name"
                      />
                      <Input
                        value={editingStaff.role}
                        onChange={(e) => setEditingStaff({ ...editingStaff, role: e.target.value })}
                        placeholder="Role"
                      />
                      <Select
                        value={editingStaff.rosterPattern}
                        onValueChange={(v) => setEditingStaff({ ...editingStaff, rosterPattern: v })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Pattern" />
                        </SelectTrigger>
                        <SelectContent>
                          {ROSTER_PATTERNS.map(p => (
                            <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Input
                        type="date"
                        value={editingStaff.rosterStartDate}
                        onChange={(e) => setEditingStaff({ ...editingStaff, rosterStartDate: e.target.value })}
                      />
                    </div>
                  ) : (
                    <div className="flex-1">
                      <p className="font-medium">{member.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {member.role} • Pattern: {ROSTER_PATTERNS.find(p => p.id === member.rosterPattern)?.name || 'None'}
                        {member.rosterStartDate && ` • Started: ${format(parseISO(member.rosterStartDate), 'MMM d, yyyy')}`}
                      </p>
                    </div>
                  )}
                  
                  <div className="flex items-center gap-1">
                    {editingStaff?.id === member.id ? (
                      <>
                        <Button size="sm" variant="ghost" onClick={saveStaff}>
                          <Save className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setEditingStaff(null)}>
                          <X className="h-4 w-4" />
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button size="sm" variant="ghost" onClick={() => setEditingStaff(member)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => deleteStaff(member.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
            
            <Button variant="outline" onClick={addStaff} className="w-full">
              <UserPlus className="h-4 w-4 mr-2" />
              Add Staff Member
            </Button>
          </div>
          
          <DialogFooter>
            <Button onClick={() => setIsRosterDialogOpen(false)}>
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Event Detail Dialog */}
      <Dialog open={!!selectedEvent} onOpenChange={() => setSelectedEvent(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedEvent && (() => {
                const eventType = EVENT_TYPES[selectedEvent.type];
                const Icon = eventType?.icon || CalendarIcon;
                return (
                  <>
                    <div className={cn("p-2 rounded", eventType?.color || 'bg-gray-500')}>
                      <Icon className="h-4 w-4 text-white" />
                    </div>
                    {selectedEvent.title}
                  </>
                );
              })()}
            </DialogTitle>
          </DialogHeader>
          
          {selectedEvent && (
            <div className="space-y-4">
              {selectedEvent.description && (
                <p className="text-muted-foreground">{selectedEvent.description}</p>
              )}
              
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                  <span>{format(parseISO(selectedEvent.date), 'EEEE, MMMM d, yyyy')}</span>
                </div>
                {selectedEvent.time && (
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span>{selectedEvent.time}{selectedEvent.endTime && ` - ${selectedEvent.endTime}`}</span>
                  </div>
                )}
                {selectedEvent.assignedToNames && selectedEvent.assignedToNames.length > 0 && (
                  <div className="flex items-center gap-2 col-span-2">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    <span>{selectedEvent.assignedToNames.join(', ')}</span>
                  </div>
                )}
              </div>
              
              {selectedEvent.status && (
                <Badge variant="secondary">{selectedEvent.status}</Badge>
              )}
            </div>
          )}
          
          <DialogFooter>
            {selectedEvent?.type === 'farm' && (
              <Button variant="destructive" onClick={() => deleteFarmEvent(selectedEvent.id)}>
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </Button>
            )}
            <Button variant="outline" onClick={() => setSelectedEvent(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
