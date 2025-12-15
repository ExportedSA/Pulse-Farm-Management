import { useState, useEffect, useCallback } from 'react';
import { pulseGet } from '@/lib/pulseApi';
import { useAuth } from '@/lib/auth-context';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
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
  Shield,
  Loader2,
  AlertTriangle,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  Clock,
  Wrench,
  MapPin,
} from 'lucide-react';
import { format, parseISO } from 'date-fns';

// Types
interface SafetyReport {
  hazards: {
    total: number;
    open: number;
    resolved: number;
    byRiskLevel: Record<string, number>;
  };
  tasks: {
    total: number;
    pending: number;
    completed: number;
    overdue: number;
  };
  equipment: {
    total: number;
    needingService: number;
    operational: number;
    outOfService: number;
  };
  recentHazards: Array<{
    id: string;
    title: string;
    status: string;
    riskLevel: string;
    identifiedAt: string;
    location: string;
  }>;
  generatedAt: string;
}

// Manager roles
const MANAGER_ROLES = ['owner', 'manager', 'admin'];

export default function SafetyReportPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [report, setReport] = useState<SafetyReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isManager = user?.role && MANAGER_ROLES.includes(user.role.toLowerCase());

  // Load report data
  const loadReport = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await pulseGet<SafetyReport>('/api/reports/safety');
      setReport(data);
    } catch (err: any) {
      console.error('Failed to load safety report:', err);
      setError('Failed to load safety report');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadReport();
  }, [loadReport]);

  // Get risk level badge
  function getRiskBadge(level: string) {
    switch (level?.toLowerCase()) {
      case 'critical':
        return <Badge className="bg-red-600">Critical</Badge>;
      case 'high':
        return <Badge className="bg-orange-500">High</Badge>;
      case 'medium':
        return <Badge className="bg-yellow-500">Medium</Badge>;
      case 'low':
        return <Badge className="bg-green-500">Low</Badge>;
      default:
        return <Badge variant="outline">{level}</Badge>;
    }
  }

  // Get status badge
  function getStatusBadge(status: string) {
    switch (status?.toLowerCase()) {
      case 'identified':
        return <Badge variant="destructive">Identified</Badge>;
      case 'under_review':
        return <Badge className="bg-yellow-500">Under Review</Badge>;
      case 'mitigated':
        return <Badge className="bg-blue-500">Mitigated</Badge>;
      case 'resolved':
        return <Badge className="bg-green-500">Resolved</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  }

  // Format date
  function formatDate(dateStr: string): string {
    try {
      return format(parseISO(dateStr), 'MMM d, yyyy');
    } catch {
      return dateStr;
    }
  }

  if (!isManager) {
    return (
      <div className="p-8 max-w-6xl mx-auto">
        <Card className="border-yellow-200 bg-yellow-50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3 text-yellow-800">
              <AlertTriangle className="h-5 w-5" />
              <p>You do not have permission to view safety reports.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
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
      <div className="p-8 max-w-6xl mx-auto">
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3 text-red-800">
              <AlertTriangle className="h-5 w-5" />
              <p>{error}</p>
            </div>
            <Button variant="outline" className="mt-4" onClick={loadReport}>
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
          <h1 className="text-2xl font-bold text-pulse-green-800">Safety Report</h1>
          <p className="text-gray-500">Hazards, incidents, and safety compliance overview</p>
        </div>
        <Button variant="outline" onClick={loadReport} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {report && (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            {/* Open Hazards */}
            <Card className={report.hazards.open > 0 ? 'border-red-200' : 'border-green-200'}>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${report.hazards.open > 0 ? 'bg-red-100' : 'bg-green-100'}`}>
                    <AlertCircle className={`h-5 w-5 ${report.hazards.open > 0 ? 'text-red-600' : 'text-green-600'}`} />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Open Hazards</p>
                    <p className={`text-2xl font-bold ${report.hazards.open > 0 ? 'text-red-600' : 'text-green-600'}`}>
                      {report.hazards.open}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Resolved Hazards */}
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-green-100 rounded-lg">
                    <CheckCircle className="h-5 w-5 text-green-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Resolved</p>
                    <p className="text-2xl font-bold text-green-600">{report.hazards.resolved}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Overdue Tasks */}
            <Card className={report.tasks.overdue > 0 ? 'border-yellow-200' : ''}>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${report.tasks.overdue > 0 ? 'bg-yellow-100' : 'bg-gray-100'}`}>
                    <Clock className={`h-5 w-5 ${report.tasks.overdue > 0 ? 'text-yellow-600' : 'text-gray-600'}`} />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Overdue Tasks</p>
                    <p className={`text-2xl font-bold ${report.tasks.overdue > 0 ? 'text-yellow-600' : 'text-gray-600'}`}>
                      {report.tasks.overdue}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Equipment Issues */}
            <Card className={report.equipment.outOfService > 0 ? 'border-red-200' : ''}>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${report.equipment.outOfService > 0 ? 'bg-red-100' : 'bg-gray-100'}`}>
                    <Wrench className={`h-5 w-5 ${report.equipment.outOfService > 0 ? 'text-red-600' : 'text-gray-600'}`} />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Out of Service</p>
                    <p className={`text-2xl font-bold ${report.equipment.outOfService > 0 ? 'text-red-600' : 'text-gray-600'}`}>
                      {report.equipment.outOfService}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Hazards by Risk Level */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  Hazards by Risk Level
                </CardTitle>
                <CardDescription>Open hazards categorized by severity</CardDescription>
              </CardHeader>
              <CardContent>
                {Object.keys(report.hazards.byRiskLevel).length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <CheckCircle className="h-12 w-12 mx-auto mb-4 text-green-300" />
                    <p>No open hazards - great job!</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {Object.entries(report.hazards.byRiskLevel).map(([level, count]) => (
                      <div key={level} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center gap-3">
                          {getRiskBadge(level)}
                          <span className="capitalize">{level} Risk</span>
                        </div>
                        <span className="text-xl font-bold">{count}</span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Task Summary */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  Safety Task Summary
                </CardTitle>
                <CardDescription>Safety and maintenance task status</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <span>Pending Tasks</span>
                    <Badge variant="outline">{report.tasks.pending}</Badge>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <span>Completed Tasks</span>
                    <Badge className="bg-green-500">{report.tasks.completed}</Badge>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <span>Overdue Tasks</span>
                    <Badge variant={report.tasks.overdue > 0 ? 'destructive' : 'outline'}>
                      {report.tasks.overdue}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-pulse-green-50 rounded-lg">
                    <span className="font-medium">Total Tasks</span>
                    <span className="font-bold">{report.tasks.total}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Equipment Status */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Wrench className="h-5 w-5" />
                Equipment Status
              </CardTitle>
              <CardDescription>Current status of farm equipment</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center p-4 bg-green-50 rounded-lg">
                  <p className="text-3xl font-bold text-green-600">{report.equipment.operational}</p>
                  <p className="text-sm text-gray-500">Operational</p>
                </div>
                <div className="text-center p-4 bg-yellow-50 rounded-lg">
                  <p className="text-3xl font-bold text-yellow-600">{report.equipment.needingService}</p>
                  <p className="text-sm text-gray-500">Needs Service</p>
                </div>
                <div className="text-center p-4 bg-red-50 rounded-lg">
                  <p className="text-3xl font-bold text-red-600">{report.equipment.outOfService}</p>
                  <p className="text-sm text-gray-500">Out of Service</p>
                </div>
                <div className="text-center p-4 bg-gray-50 rounded-lg">
                  <p className="text-3xl font-bold text-gray-600">{report.equipment.total}</p>
                  <p className="text-sm text-gray-500">Total Equipment</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Recent Hazards Table */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5" />
                Recent Hazards
              </CardTitle>
              <CardDescription>Most recently identified hazards</CardDescription>
            </CardHeader>
            <CardContent>
              {report.recentHazards.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Shield className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                  <p>No hazards recorded</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Hazard</TableHead>
                      <TableHead>Location</TableHead>
                      <TableHead>Risk Level</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Identified</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {report.recentHazards.map((hazard) => (
                      <TableRow key={hazard.id}>
                        <TableCell className="font-medium">{hazard.title}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1 text-gray-500">
                            <MapPin className="h-3 w-3" />
                            {hazard.location || '-'}
                          </div>
                        </TableCell>
                        <TableCell>{getRiskBadge(hazard.riskLevel)}</TableCell>
                        <TableCell>{getStatusBadge(hazard.status)}</TableCell>
                        <TableCell className="text-gray-500">
                          {formatDate(hazard.identifiedAt)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
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
