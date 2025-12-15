import { useState, useEffect, useCallback } from 'react';
import { Link } from 'wouter';
import { pulseGet } from '@/lib/pulseApi';
import { useAuth } from '@/lib/auth-context';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  AlertTriangle,
  CheckCircle,
  Clock,
  Users,
  Wrench,
  Heart,
  Shield,
  FileText,
  Loader2,
  RefreshCw,
  ChevronRight,
  AlertCircle,
  Activity,
  Calendar,
  TrendingUp,
} from 'lucide-react';
import { toast } from 'sonner';

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
}

interface ComplianceStatus {
  summary: {
    animalsNeedingHealthCheck: number;
    equipmentNeedingService: number;
    unresolvedHazards: number;
    staffNeedingTraining: number;
  };
  schedulerRunning: boolean;
}

interface AnimalInventory {
  total: number;
  byBreed: Record<string, number>;
  byStatus: Record<string, number>;
}

// Manager roles
const MANAGER_ROLES = ['owner', 'manager', 'admin'];

export default function ComplianceDashboard() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [safetyReport, setSafetyReport] = useState<SafetyReport | null>(null);
  const [complianceStatus, setComplianceStatus] = useState<ComplianceStatus | null>(null);
  const [animalInventory, setAnimalInventory] = useState<AnimalInventory | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isManager = user?.role && MANAGER_ROLES.includes(user.role.toLowerCase());

  // Load all dashboard data
  const loadDashboardData = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      const [safety, compliance, animals] = await Promise.all([
        pulseGet<SafetyReport>('/api/reports/safety').catch(() => null),
        pulseGet<ComplianceStatus>('/api/compliance/status').catch(() => null),
        pulseGet<AnimalInventory>('/api/reports/animal-inventory').catch(() => null),
      ]);

      setSafetyReport(safety);
      setComplianceStatus(compliance);
      setAnimalInventory(animals);

      if (isRefresh) {
        toast.success('Dashboard refreshed');
      }
    } catch (err: any) {
      console.error('Failed to load dashboard data:', err);
      setError('Failed to load compliance data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  // Calculate overall compliance score
  function getComplianceScore(): number {
    if (!complianceStatus?.summary) return 100;
    const { animalsNeedingHealthCheck, equipmentNeedingService, unresolvedHazards, staffNeedingTraining } = complianceStatus.summary;
    const totalIssues = animalsNeedingHealthCheck + equipmentNeedingService + unresolvedHazards + staffNeedingTraining;
    if (totalIssues === 0) return 100;
    // Simple scoring: deduct points for each issue, min 0
    return Math.max(0, 100 - (totalIssues * 5));
  }

  // Get status color
  function getStatusColor(count: number, threshold: number = 0): string {
    if (count === 0) return 'text-green-600';
    if (count <= threshold) return 'text-yellow-600';
    return 'text-red-600';
  }

  // Get badge variant
  function getBadgeVariant(count: number): 'default' | 'secondary' | 'destructive' | 'outline' {
    if (count === 0) return 'secondary';
    if (count <= 2) return 'default';
    return 'destructive';
  }

  if (!isManager) {
    return (
      <div className="p-8 max-w-6xl mx-auto">
        <Card className="border-yellow-200 bg-yellow-50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3 text-yellow-800">
              <AlertTriangle className="h-5 w-5" />
              <p>You do not have permission to view the compliance dashboard.</p>
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
            <Button variant="outline" className="mt-4" onClick={() => loadDashboardData()}>
              Try Again
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const complianceScore = getComplianceScore();
  const summary = complianceStatus?.summary;

  return (
    <div className="p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-pulse-green-800">Compliance Dashboard</h1>
          <p className="text-gray-500">Monitor farm compliance and safety status</p>
        </div>
        <Button
          variant="outline"
          onClick={() => loadDashboardData(true)}
          disabled={refreshing}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Overall Compliance Score */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Overall Compliance Score
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-6">
            <div className="flex-1">
              <Progress 
                value={complianceScore} 
                className={`h-4 ${complianceScore >= 80 ? '[&>div]:bg-green-500' : complianceScore >= 50 ? '[&>div]:bg-yellow-500' : '[&>div]:bg-red-500'}`}
              />
            </div>
            <div className={`text-3xl font-bold ${complianceScore >= 80 ? 'text-green-600' : complianceScore >= 50 ? 'text-yellow-600' : 'text-red-600'}`}>
              {complianceScore}%
            </div>
          </div>
          <p className="text-sm text-gray-500 mt-2">
            {complianceScore >= 80 
              ? 'Good standing - keep up the great work!' 
              : complianceScore >= 50 
                ? 'Some items need attention' 
                : 'Critical items require immediate action'}
          </p>
        </CardContent>
      </Card>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {/* Animal Health */}
        <Card className={summary?.animalsNeedingHealthCheck ? 'border-yellow-200' : 'border-green-200'}>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${summary?.animalsNeedingHealthCheck ? 'bg-yellow-100' : 'bg-green-100'}`}>
                  <Heart className={`h-5 w-5 ${summary?.animalsNeedingHealthCheck ? 'text-yellow-600' : 'text-green-600'}`} />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Animal Health</p>
                  <p className={`text-2xl font-bold ${getStatusColor(summary?.animalsNeedingHealthCheck || 0)}`}>
                    {summary?.animalsNeedingHealthCheck || 0}
                  </p>
                </div>
              </div>
              <Badge variant={getBadgeVariant(summary?.animalsNeedingHealthCheck || 0)}>
                {summary?.animalsNeedingHealthCheck === 0 ? 'OK' : 'Due'}
              </Badge>
            </div>
            <p className="text-xs text-gray-500 mt-2">Animals needing health check</p>
          </CardContent>
        </Card>

        {/* Equipment Maintenance */}
        <Card className={summary?.equipmentNeedingService ? 'border-yellow-200' : 'border-green-200'}>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${summary?.equipmentNeedingService ? 'bg-yellow-100' : 'bg-green-100'}`}>
                  <Wrench className={`h-5 w-5 ${summary?.equipmentNeedingService ? 'text-yellow-600' : 'text-green-600'}`} />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Equipment</p>
                  <p className={`text-2xl font-bold ${getStatusColor(summary?.equipmentNeedingService || 0)}`}>
                    {summary?.equipmentNeedingService || 0}
                  </p>
                </div>
              </div>
              <Badge variant={getBadgeVariant(summary?.equipmentNeedingService || 0)}>
                {summary?.equipmentNeedingService === 0 ? 'OK' : 'Service'}
              </Badge>
            </div>
            <p className="text-xs text-gray-500 mt-2">Equipment needing service</p>
          </CardContent>
        </Card>

        {/* Safety Hazards */}
        <Card className={summary?.unresolvedHazards ? 'border-red-200' : 'border-green-200'}>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${summary?.unresolvedHazards ? 'bg-red-100' : 'bg-green-100'}`}>
                  <Shield className={`h-5 w-5 ${summary?.unresolvedHazards ? 'text-red-600' : 'text-green-600'}`} />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Safety</p>
                  <p className={`text-2xl font-bold ${getStatusColor(summary?.unresolvedHazards || 0)}`}>
                    {summary?.unresolvedHazards || 0}
                  </p>
                </div>
              </div>
              <Badge variant={getBadgeVariant(summary?.unresolvedHazards || 0)}>
                {summary?.unresolvedHazards === 0 ? 'OK' : 'Open'}
              </Badge>
            </div>
            <p className="text-xs text-gray-500 mt-2">Unresolved hazards</p>
          </CardContent>
        </Card>

        {/* Staff Training */}
        <Card className={summary?.staffNeedingTraining ? 'border-yellow-200' : 'border-green-200'}>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${summary?.staffNeedingTraining ? 'bg-yellow-100' : 'bg-green-100'}`}>
                  <Users className={`h-5 w-5 ${summary?.staffNeedingTraining ? 'text-yellow-600' : 'text-green-600'}`} />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Training</p>
                  <p className={`text-2xl font-bold ${getStatusColor(summary?.staffNeedingTraining || 0)}`}>
                    {summary?.staffNeedingTraining || 0}
                  </p>
                </div>
              </div>
              <Badge variant={getBadgeVariant(summary?.staffNeedingTraining || 0)}>
                {summary?.staffNeedingTraining === 0 ? 'OK' : 'Pending'}
              </Badge>
            </div>
            <p className="text-xs text-gray-500 mt-2">Staff needing induction</p>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Sections */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Safety & Hazards */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Safety Overview
              </CardTitle>
              <Link href="/app/reports/safety">
                <Button variant="ghost" size="sm">
                  View Report <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {safetyReport ? (
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <p className="text-2xl font-bold text-red-600">{safetyReport.hazards.open}</p>
                    <p className="text-xs text-gray-500">Open Hazards</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-yellow-600">{safetyReport.tasks.overdue}</p>
                    <p className="text-xs text-gray-500">Overdue Tasks</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-green-600">{safetyReport.hazards.resolved}</p>
                    <p className="text-xs text-gray-500">Resolved</p>
                  </div>
                </div>

                {safetyReport.recentHazards.length > 0 && (
                  <div className="mt-4">
                    <p className="text-sm font-medium mb-2">Recent Hazards</p>
                    <div className="space-y-2">
                      {safetyReport.recentHazards.slice(0, 3).map(hazard => (
                        <div key={hazard.id} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                          <div className="flex items-center gap-2">
                            <AlertCircle className={`h-4 w-4 ${
                              hazard.riskLevel === 'critical' || hazard.riskLevel === 'high' 
                                ? 'text-red-500' 
                                : 'text-yellow-500'
                            }`} />
                            <span className="text-sm truncate max-w-[200px]">{hazard.title}</span>
                          </div>
                          <Badge variant="outline" className="text-xs">
                            {hazard.status}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-gray-500 text-center py-4">No safety data available</p>
            )}
          </CardContent>
        </Card>

        {/* Equipment Status */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Wrench className="h-5 w-5" />
                Equipment Status
              </CardTitle>
              <Link href="/app/equipment">
                <Button variant="ghost" size="sm">
                  View All <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {safetyReport?.equipment ? (
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <p className="text-2xl font-bold text-green-600">{safetyReport.equipment.operational}</p>
                    <p className="text-xs text-gray-500">Operational</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-yellow-600">{safetyReport.equipment.needingService}</p>
                    <p className="text-xs text-gray-500">Need Service</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-red-600">{safetyReport.equipment.outOfService}</p>
                    <p className="text-xs text-gray-500">Out of Service</p>
                  </div>
                </div>

                <div className="mt-4">
                  <div className="flex items-center justify-between text-sm">
                    <span>Equipment Health</span>
                    <span className="font-medium">
                      {safetyReport.equipment.total > 0 
                        ? Math.round((safetyReport.equipment.operational / safetyReport.equipment.total) * 100)
                        : 100}%
                    </span>
                  </div>
                  <Progress 
                    value={safetyReport.equipment.total > 0 
                      ? (safetyReport.equipment.operational / safetyReport.equipment.total) * 100
                      : 100} 
                    className="h-2 mt-2"
                  />
                </div>
              </div>
            ) : (
              <p className="text-gray-500 text-center py-4">No equipment data available</p>
            )}
          </CardContent>
        </Card>

        {/* Animal Inventory Summary */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Heart className="h-5 w-5" />
                Herd Overview
              </CardTitle>
              <Link href="/app/reports/animals">
                <Button variant="ghost" size="sm">
                  View Report <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {animalInventory ? (
              <div className="space-y-4">
                <div className="text-center">
                  <p className="text-4xl font-bold text-pulse-green-600">{animalInventory.total}</p>
                  <p className="text-sm text-gray-500">Total Animals</p>
                </div>

                {Object.keys(animalInventory.byStatus).length > 0 && (
                  <div className="grid grid-cols-2 gap-2 mt-4">
                    {Object.entries(animalInventory.byStatus).slice(0, 4).map(([status, count]) => (
                      <div key={status} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                        <span className="text-sm capitalize">{status}</span>
                        <Badge variant="outline">{count}</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <p className="text-gray-500 text-center py-4">No animal data available</p>
            )}
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Quick Actions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3">
              <Link href="/app/reports/animals">
                <Button variant="outline" className="w-full justify-start">
                  <FileText className="h-4 w-4 mr-2" />
                  Animal Report
                </Button>
              </Link>
              <Link href="/app/reports/timesheets">
                <Button variant="outline" className="w-full justify-start">
                  <Clock className="h-4 w-4 mr-2" />
                  Timesheet Report
                </Button>
              </Link>
              <Link href="/app/reports/safety">
                <Button variant="outline" className="w-full justify-start">
                  <Shield className="h-4 w-4 mr-2" />
                  Safety Report
                </Button>
              </Link>
              <Link href="/app/reports/equipment">
                <Button variant="outline" className="w-full justify-start">
                  <Wrench className="h-4 w-4 mr-2" />
                  Equipment Report
                </Button>
              </Link>
            </div>

            <div className="mt-4 pt-4 border-t">
              <Link href="/app/tasks">
                <Button className="w-full bg-pulse-green-600 hover:bg-pulse-green-700">
                  <CheckCircle className="h-4 w-4 mr-2" />
                  View All Tasks
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
