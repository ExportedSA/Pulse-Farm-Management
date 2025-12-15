import { useState, useEffect, useCallback } from 'react';
import { pulseGet } from '@/lib/pulseApi';
import { useAuth } from '@/lib/auth-context';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Clock,
  Loader2,
  AlertTriangle,
  Download,
  RefreshCw,
  Calendar,
  Users,
  TrendingUp,
} from 'lucide-react';
import { toast } from 'sonner';
import { format, subDays, startOfMonth, endOfMonth, subMonths } from 'date-fns';

// Types
interface TimesheetSummary {
  totalHours: number;
  totalEntries: number;
  dateRange: { from: string; to: string };
  byStaff: Array<{
    staffId: string;
    staffName: string;
    totalHours: number;
    entries: number;
  }>;
  generatedAt: string;
}

// Manager roles
const MANAGER_ROLES = ['owner', 'manager', 'admin'];

// Preset date ranges
const DATE_PRESETS = [
  { label: 'Last 7 Days', value: '7days' },
  { label: 'Last 30 Days', value: '30days' },
  { label: 'This Month', value: 'thisMonth' },
  { label: 'Last Month', value: 'lastMonth' },
  { label: 'Custom', value: 'custom' },
];

// Maximum hours threshold for highlighting
const MAX_WEEKLY_HOURS = 50;

export default function TimesheetReportPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [report, setReport] = useState<TimesheetSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [datePreset, setDatePreset] = useState('30days');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  const isManager = user?.role && MANAGER_ROLES.includes(user.role.toLowerCase());

  // Calculate date range based on preset
  function getDateRange(preset: string): { from: string; to: string } {
    const today = new Date();
    let from: Date;
    let to: Date = today;

    switch (preset) {
      case '7days':
        from = subDays(today, 7);
        break;
      case '30days':
        from = subDays(today, 30);
        break;
      case 'thisMonth':
        from = startOfMonth(today);
        to = endOfMonth(today);
        break;
      case 'lastMonth':
        const lastMonth = subMonths(today, 1);
        from = startOfMonth(lastMonth);
        to = endOfMonth(lastMonth);
        break;
      case 'custom':
        return { from: fromDate, to: toDate };
      default:
        from = subDays(today, 30);
    }

    return {
      from: format(from, 'yyyy-MM-dd'),
      to: format(to, 'yyyy-MM-dd'),
    };
  }

  // Load report data
  const loadReport = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const { from, to } = getDateRange(datePreset);
      if (!from || !to) {
        setError('Please select a valid date range');
        setLoading(false);
        return;
      }

      const data = await pulseGet<TimesheetSummary>(`/api/reports/timesheet-summary?from=${from}&to=${to}`);
      setReport(data);
    } catch (err: any) {
      console.error('Failed to load timesheet report:', err);
      setError('Failed to load timesheet report');
    } finally {
      setLoading(false);
    }
  }, [datePreset, fromDate, toDate]);

  useEffect(() => {
    if (datePreset !== 'custom' || (fromDate && toDate)) {
      loadReport();
    }
  }, [datePreset]);

  // Handle preset change
  function handlePresetChange(value: string) {
    setDatePreset(value);
    if (value !== 'custom') {
      const { from, to } = getDateRange(value);
      setFromDate(from);
      setToDate(to);
    }
  }

  // Export to CSV
  function exportToCSV() {
    if (!report) return;

    const headers = ['Staff Name', 'Total Hours', 'Number of Entries'];
    const rows = report.byStaff.map(staff => [
      staff.staffName,
      staff.totalHours.toString(),
      staff.entries.toString(),
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(',')),
      '',
      `Total Hours,${report.totalHours}`,
      `Total Entries,${report.totalEntries}`,
      `Date Range,${report.dateRange.from} to ${report.dateRange.to}`,
      `Generated,${report.generatedAt}`,
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `timesheet-report-${report.dateRange.from}-to-${report.dateRange.to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Report exported to CSV');
  }

  // Calculate average hours per staff
  function getAverageHours(): number {
    if (!report || report.byStaff.length === 0) return 0;
    return report.totalHours / report.byStaff.length;
  }

  // Check if hours exceed threshold (for the date range, scaled)
  function isHighHours(hours: number): boolean {
    if (!report) return false;
    const days = Math.ceil(
      (new Date(report.dateRange.to).getTime() - new Date(report.dateRange.from).getTime()) / (1000 * 60 * 60 * 24)
    );
    const weeks = days / 7;
    const threshold = MAX_WEEKLY_HOURS * weeks;
    return hours > threshold;
  }

  if (!isManager) {
    return (
      <div className="p-8 max-w-6xl mx-auto">
        <Card className="border-yellow-200 bg-yellow-50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3 text-yellow-800">
              <AlertTriangle className="h-5 w-5" />
              <p>You do not have permission to view timesheet reports.</p>
            </div>
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
          <h1 className="text-2xl font-bold text-pulse-green-800">Timesheet Report</h1>
          <p className="text-gray-500">Staff hours worked summary</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={loadReport} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button variant="outline" onClick={exportToCSV} disabled={!report}>
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Date Range Selector */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4 items-end">
            <div className="w-full md:w-48">
              <Label>Date Range</Label>
              <Select value={datePreset} onValueChange={handlePresetChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Select range" />
                </SelectTrigger>
                <SelectContent>
                  {DATE_PRESETS.map(preset => (
                    <SelectItem key={preset.value} value={preset.value}>
                      {preset.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {datePreset === 'custom' && (
              <>
                <div className="w-full md:w-40">
                  <Label>From</Label>
                  <Input
                    type="date"
                    value={fromDate}
                    onChange={(e) => setFromDate(e.target.value)}
                  />
                </div>
                <div className="w-full md:w-40">
                  <Label>To</Label>
                  <Input
                    type="date"
                    value={toDate}
                    onChange={(e) => setToDate(e.target.value)}
                  />
                </div>
                <Button onClick={loadReport} disabled={!fromDate || !toDate}>
                  Apply
                </Button>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-pulse-green-600" />
        </div>
      )}

      {/* Error State */}
      {error && !loading && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3 text-red-800">
              <AlertTriangle className="h-5 w-5" />
              <p>{error}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Report Content */}
      {report && !loading && (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-pulse-green-100 rounded-lg">
                    <Clock className="h-5 w-5 text-pulse-green-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Total Hours</p>
                    <p className="text-2xl font-bold">{report.totalHours.toFixed(1)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <Users className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Staff Members</p>
                    <p className="text-2xl font-bold">{report.byStaff.length}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-purple-100 rounded-lg">
                    <Calendar className="h-5 w-5 text-purple-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Total Entries</p>
                    <p className="text-2xl font-bold">{report.totalEntries}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-yellow-100 rounded-lg">
                    <TrendingUp className="h-5 w-5 text-yellow-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Avg Hours/Staff</p>
                    <p className="text-2xl font-bold">{getAverageHours().toFixed(1)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Staff Hours Table */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Hours by Staff Member
              </CardTitle>
              <CardDescription>
                {report.dateRange.from} to {report.dateRange.to}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {report.byStaff.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Clock className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                  <p>No timesheet entries found for this period</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Staff Member</TableHead>
                      <TableHead className="text-right">Hours Worked</TableHead>
                      <TableHead className="text-right">Entries</TableHead>
                      <TableHead className="text-right">Avg Hours/Entry</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {report.byStaff.map((staff) => (
                      <TableRow key={staff.staffId}>
                        <TableCell className="font-medium">{staff.staffName}</TableCell>
                        <TableCell className="text-right">
                          <span className={isHighHours(staff.totalHours) ? 'text-red-600 font-bold' : ''}>
                            {staff.totalHours.toFixed(1)}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">{staff.entries}</TableCell>
                        <TableCell className="text-right">
                          {staff.entries > 0 ? (staff.totalHours / staff.entries).toFixed(1) : '-'}
                        </TableCell>
                        <TableCell>
                          {isHighHours(staff.totalHours) ? (
                            <Badge variant="destructive">High Hours</Badge>
                          ) : (
                            <Badge variant="secondary">Normal</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}

              {/* Totals Row */}
              {report.byStaff.length > 0 && (
                <div className="mt-4 pt-4 border-t flex justify-between items-center">
                  <span className="font-medium">Total</span>
                  <div className="flex gap-8">
                    <span className="font-bold">{report.totalHours.toFixed(1)} hours</span>
                    <span className="text-gray-500">{report.totalEntries} entries</span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Report Footer */}
          <p className="text-xs text-gray-400 mt-4 text-right">
            Report generated: {new Date(report.generatedAt).toLocaleString()}
          </p>
        </>
      )}
    </div>
  );
}
