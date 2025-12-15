import { useState, useEffect, useCallback } from 'react';
import { pulseGet, pulsePost } from '@/lib/pulseApi';
import { useAuth } from '@/lib/auth-context';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import {
  Clock,
  Play,
  Square,
  Calendar,
  Timer,
  CheckCircle,
  XCircle,
  Loader2,
  AlertTriangle,
  Coffee,
} from 'lucide-react';
import { toast } from 'sonner';
import { format, formatDistanceToNow, parseISO } from 'date-fns';

// Types
interface TimesheetEntry {
  id: string;
  farmId: string;
  staffProfileId: string;
  date: string;
  startTime: string;
  endTime: string | null;
  breakMinutes: number | null;
  totalHours: string | null;
  jobId: string | null;
  taskDescription: string | null;
  location: string | null;
  status: 'draft' | 'pending' | 'approved' | 'rejected';
  approvedBy: string | null;
  approvedAt: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

interface TimesheetSummary {
  totalHours: number;
  approvedHours: number;
  pendingHours: number;
  entryCount: number;
}

export default function MyTimePage() {
  const { user } = useAuth();
  const [activeShift, setActiveShift] = useState<TimesheetEntry | null>(null);
  const [recentEntries, setRecentEntries] = useState<TimesheetEntry[]>([]);
  const [weeklySummary, setWeeklySummary] = useState<TimesheetSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [clockingIn, setClockingIn] = useState(false);
  const [clockingOut, setClockingOut] = useState(false);
  const [breakMinutes, setBreakMinutes] = useState('0');
  const [error, setError] = useState<string | null>(null);

  // Load timesheet data
  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [active, entries, summary] = await Promise.all([
        pulseGet<TimesheetEntry | null>('/timesheets/active').catch(() => null),
        pulseGet<TimesheetEntry[]>('/timesheets/weekly').catch(() => []),
        pulseGet<TimesheetSummary>('/timesheets/summary?' + new URLSearchParams({
          startDate: getWeekStart(),
          endDate: getWeekEnd(),
        })).catch(() => null),
      ]);

      setActiveShift(active);
      setRecentEntries(entries);
      setWeeklySummary(summary);
    } catch (err) {
      console.error('Failed to load timesheet data:', err);
      setError('Failed to load timesheet data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Get week boundaries
  function getWeekStart(): string {
    const now = new Date();
    const dayOfWeek = now.getDay();
    const monday = new Date(now);
    monday.setDate(now.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
    return monday.toISOString().split('T')[0];
  }

  function getWeekEnd(): string {
    const now = new Date();
    const dayOfWeek = now.getDay();
    const sunday = new Date(now);
    sunday.setDate(now.getDate() + (dayOfWeek === 0 ? 0 : 7 - dayOfWeek));
    return sunday.toISOString().split('T')[0];
  }

  // Clock in
  async function handleClockIn() {
    setClockingIn(true);
    try {
      const entry = await pulsePost<TimesheetEntry>('/timesheets/clock-in', {});
      setActiveShift(entry);
      toast.success('Clocked in successfully!');
      loadData();
    } catch (err: any) {
      console.error('Failed to clock in:', err);
      toast.error(err?.message || 'Failed to clock in');
    } finally {
      setClockingIn(false);
    }
  }

  // Clock out
  async function handleClockOut() {
    setClockingOut(true);
    try {
      const entry = await pulsePost<TimesheetEntry>('/timesheets/clock-out', {
        breakMinutes: parseInt(breakMinutes) || 0,
      });
      setActiveShift(null);
      toast.success(`Clocked out! Total: ${entry.totalHours} hours`);
      loadData();
    } catch (err: any) {
      console.error('Failed to clock out:', err);
      toast.error(err?.message || 'Failed to clock out');
    } finally {
      setClockingOut(false);
    }
  }

  // Format time
  function formatTime(timeStr: string): string {
    return timeStr; // Already in HH:MM format
  }

  // Format date
  function formatDate(dateStr: string): string {
    try {
      return format(parseISO(dateStr), 'EEE, MMM d');
    } catch {
      return dateStr;
    }
  }

  // Get status badge
  function getStatusBadge(status: string) {
    switch (status) {
      case 'draft':
        return <Badge variant="outline">Draft</Badge>;
      case 'pending':
        return <Badge className="bg-yellow-100 text-yellow-800">Pending</Badge>;
      case 'approved':
        return <Badge className="bg-green-100 text-green-800">Approved</Badge>;
      case 'rejected':
        return <Badge className="bg-red-100 text-red-800">Rejected</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  }

  // Calculate elapsed time for active shift
  function getElapsedTime(): string {
    if (!activeShift) return '';
    
    const [hours, minutes] = activeShift.startTime.split(':').map(Number);
    const startDate = new Date();
    startDate.setHours(hours, minutes, 0, 0);
    
    // If start time is after current time, it was yesterday
    if (startDate > new Date()) {
      startDate.setDate(startDate.getDate() - 1);
    }
    
    return formatDistanceToNow(startDate, { addSuffix: false });
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
            <Button variant="outline" className="mt-4" onClick={loadData}>
              Try Again
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-pulse-green-800">My Time</h1>
        <p className="text-gray-500">Track your work hours</p>
      </div>

      {/* Clock In/Out Card */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Time Clock
          </CardTitle>
        </CardHeader>
        <CardContent>
          {activeShift ? (
            // Currently clocked in
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-green-50 rounded-lg border border-green-200">
                <div>
                  <p className="text-sm text-green-600 font-medium">Currently Working</p>
                  <p className="text-2xl font-bold text-green-800">
                    Clocked in at {formatTime(activeShift.startTime)}
                  </p>
                  <p className="text-sm text-green-600 mt-1">
                    Working for {getElapsedTime()}
                  </p>
                </div>
                <div className="h-4 w-4 bg-green-500 rounded-full animate-pulse" />
              </div>

              {/* Break input */}
              <div className="flex items-end gap-4">
                <div className="flex-1">
                  <Label htmlFor="breakMinutes" className="flex items-center gap-2">
                    <Coffee className="h-4 w-4" />
                    Break Time (minutes)
                  </Label>
                  <Input
                    id="breakMinutes"
                    type="number"
                    value={breakMinutes}
                    onChange={(e) => setBreakMinutes(e.target.value)}
                    min="0"
                    className="mt-1"
                  />
                </div>
                <Button
                  onClick={handleClockOut}
                  disabled={clockingOut}
                  variant="destructive"
                  size="lg"
                  className="min-w-[140px]"
                >
                  {clockingOut ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Clocking Out...
                    </>
                  ) : (
                    <>
                      <Square className="h-4 w-4 mr-2" />
                      Clock Out
                    </>
                  )}
                </Button>
              </div>
            </div>
          ) : (
            // Not clocked in
            <div className="text-center py-6">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-100 rounded-full mb-4">
                <Clock className="h-8 w-8 text-gray-400" />
              </div>
              <p className="text-gray-500 mb-4">You're not currently clocked in</p>
              <Button
                onClick={handleClockIn}
                disabled={clockingIn}
                size="lg"
                className="bg-pulse-green-600 hover:bg-pulse-green-700 min-w-[140px]"
              >
                {clockingIn ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Clocking In...
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4 mr-2" />
                    Clock In
                  </>
                )}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Weekly Summary */}
      {weeklySummary && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Timer className="h-5 w-5" />
              This Week
            </CardTitle>
            <CardDescription>
              {getWeekStart()} to {getWeekEnd()}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <p className="text-2xl font-bold text-pulse-green-800">
                  {weeklySummary.totalHours.toFixed(1)}
                </p>
                <p className="text-sm text-gray-500">Total Hours</p>
              </div>
              <div className="text-center p-4 bg-green-50 rounded-lg">
                <p className="text-2xl font-bold text-green-700">
                  {weeklySummary.approvedHours.toFixed(1)}
                </p>
                <p className="text-sm text-gray-500">Approved</p>
              </div>
              <div className="text-center p-4 bg-yellow-50 rounded-lg">
                <p className="text-2xl font-bold text-yellow-700">
                  {weeklySummary.pendingHours.toFixed(1)}
                </p>
                <p className="text-sm text-gray-500">Pending</p>
              </div>
              <div className="text-center p-4 bg-blue-50 rounded-lg">
                <p className="text-2xl font-bold text-blue-700">
                  {weeklySummary.entryCount}
                </p>
                <p className="text-sm text-gray-500">Entries</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent Entries */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Recent Entries
          </CardTitle>
        </CardHeader>
        <CardContent>
          {recentEntries.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Clock className="h-12 w-12 mx-auto mb-4 text-gray-300" />
              <p>No timesheet entries this week</p>
            </div>
          ) : (
            <div className="space-y-3">
              {recentEntries.map(entry => (
                <div
                  key={entry.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50"
                >
                  <div className="flex items-center gap-4">
                    <div className="text-center min-w-[60px]">
                      <p className="text-sm font-medium">{formatDate(entry.date)}</p>
                    </div>
                    <Separator orientation="vertical" className="h-10" />
                    <div>
                      <p className="font-medium">
                        {formatTime(entry.startTime)} - {entry.endTime ? formatTime(entry.endTime) : 'In Progress'}
                      </p>
                      {entry.location && (
                        <p className="text-sm text-gray-500">{entry.location}</p>
                      )}
                      {entry.taskDescription && (
                        <p className="text-sm text-gray-500">{entry.taskDescription}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    {entry.totalHours && (
                      <span className="font-medium text-pulse-green-700">
                        {parseFloat(entry.totalHours).toFixed(1)} hrs
                      </span>
                    )}
                    {getStatusBadge(entry.status)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
