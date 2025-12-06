import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { 
  Shield, 
  CheckCircle, 
  AlertTriangle, 
  Clock, 
  FileText,
  TrendingUp,
  Calendar,
  Award,
  AlertCircle,
  CheckSquare,
  XCircle,
  BarChart3,
  Download,
  RefreshCw
} from 'lucide-react';

interface ComplianceStandard {
  id: string;
  code: string;
  title: string;
  description: string;
  category: string;
  requirementLevel: string;
  checkFrequency: string;
  documentationRequired: boolean;
  isActive: boolean;
  lastUpdated: string;
}

interface ComplianceCheck {
  id: string;
  standardId: string;
  checkDate: string;
  status: string;
  score: string | null;
  findings: string | null;
  correctiveActions: string | null;
  dueDate: string | null;
  completedDate: string | null;
  checkedBy: string | null;
  evidence: string | null;
  createdAt: string;
  updatedAt: string;
}

interface ComplianceAudit {
  id: string;
  auditType: string;
  auditDate: string;
  auditor: string | null;
  overallScore: string | null;
  status: string;
  findings: string | null;
  recommendations: string | null;
  nextAuditDate: string | null;
  certificateIssued: boolean;
  certificateExpiry: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

const STATUS_COLORS = {
  compliant: 'bg-green-100 text-green-800',
  non_compliant: 'bg-red-100 text-red-800',
  pending_review: 'bg-yellow-100 text-yellow-800',
  not_applicable: 'bg-gray-100 text-gray-800',
  scheduled: 'bg-blue-100 text-blue-800',
  in_progress: 'bg-orange-100 text-orange-800',
  completed: 'bg-green-100 text-green-800',
  failed: 'bg-red-100 text-red-800',
};

const REQUIREMENT_COLORS = {
  mandatory: 'bg-red-100 text-red-800',
  recommended: 'bg-blue-100 text-blue-800',
  best_practice: 'bg-green-100 text-green-800',
};

export default function NZFAPCompliancePage() {
  const queryClient = useQueryClient();
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  // Fetch compliance dashboard
  const { data: dashboard } = useQuery({
    queryKey: ['complianceDashboard'],
    queryFn: async () => {
      const response = await fetch('/api/nzfap/dashboard');
      if (!response.ok) throw new Error('Failed to fetch compliance dashboard');
      return response.json();
    },
  });

  // Fetch compliance standards
  const { data: standards = [] } = useQuery<ComplianceStandard[]>({
    queryKey: ['complianceStandards'],
    queryFn: async () => {
      const response = await fetch('/api/nzfap/standards?isActive=true');
      if (!response.ok) throw new Error('Failed to fetch compliance standards');
      return response.json();
    },
  });

  // Fetch compliance scores
  const { data: scores = [] } = useQuery({
    queryKey: ['complianceScores'],
    queryFn: async () => {
      const response = await fetch('/api/nzfap/scores');
      if (!response.ok) throw new Error('Failed to fetch compliance scores');
      return response.json();
    },
  });

  // Fetch upcoming tasks
  const { data: upcomingTasks = [] } = useQuery({
    queryKey: ['upcomingComplianceTasks'],
    queryFn: async () => {
      const response = await fetch('/api/nzfap/tasks/upcoming?days=30');
      if (!response.ok) throw new Error('Failed to fetch upcoming tasks');
      return response.json();
    },
  });

  // Fetch overdue items
  const { data: overdueItems = [] } = useQuery({
    queryKey: ['overdueComplianceItems'],
    queryFn: async () => {
      const response = await fetch('/api/nzfap/tasks/overdue');
      if (!response.ok) throw new Error('Failed to fetch overdue items');
      return response.json();
    },
  });

  // Initialize NZFAP standards mutation
  const initializeMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/nzfap/initialize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!response.ok) throw new Error('Failed to initialize NZFAP standards');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['complianceStandards'] });
      queryClient.invalidateQueries({ queryKey: ['complianceDashboard'] });
    },
  });

  const formatScore = (score: number) => {
    return Math.round(score);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'compliant':
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'non_compliant':
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-600" />;
      case 'pending_review':
      case 'in_progress':
        return <Clock className="h-4 w-4 text-yellow-600" />;
      default:
        return <AlertCircle className="h-4 w-4 text-gray-600" />;
    }
  };

  const getOverallScoreColor = (score: number) => {
    if (score >= 90) return 'text-green-600';
    if (score >= 75) return 'text-yellow-600';
    if (score >= 60) return 'text-orange-600';
    return 'text-red-600';
  };

  const filteredScores = selectedCategory === 'all' 
    ? scores 
    : scores.filter((s: any) => s.category === selectedCategory);

  const categories = ['all', ...Array.from(new Set(standards.map((s: ComplianceStandard) => s.category)))];

  if (!dashboard && standards.length === 0) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">NZFAP Compliance</h1>
            <p className="text-muted-foreground">Manage farm assurance program compliance</p>
          </div>
        </div>
        
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-8">
              <Shield className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-semibold mb-2">NZFAP Standards Not Initialized</h3>
              <p className="text-muted-foreground mb-4">
                Initialize the NZFAP compliance standards to get started
              </p>
              <Button 
                onClick={() => initializeMutation.mutate()}
                disabled={initializeMutation.isPending}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${initializeMutation.isPending ? 'animate-spin' : ''}`} />
                {initializeMutation.isPending ? 'Initializing...' : 'Initialize NZFAP Standards'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">NZFAP Compliance</h1>
          <p className="text-muted-foreground">Farm assurance program compliance management</p>
        </div>
        <Button 
          variant="outline" 
          onClick={() => initializeMutation.mutate()}
          disabled={initializeMutation.isPending}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${initializeMutation.isPending ? 'animate-spin' : ''}`} />
          Reset Standards
        </Button>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Overall Score</p>
                <p className={`text-2xl font-bold ${getOverallScoreColor(dashboard?.overview?.overallScore || 0)}`}>
                  {formatScore(dashboard?.overview?.overallScore || 0)}%
                </p>
              </div>
              <Award className="h-8 w-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Compliant Items</p>
                <p className="text-2xl font-bold text-green-600">
                  {dashboard?.overview?.compliantChecks || 0}
                </p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Non-Compliant</p>
                <p className="text-2xl font-bold text-red-600">
                  {dashboard?.overview?.nonCompliantChecks || 0}
                </p>
              </div>
              <XCircle className="h-8 w-8 text-red-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Pending Review</p>
                <p className="text-2xl font-bold text-yellow-600">
                  {dashboard?.overview?.pendingChecks || 0}
                </p>
              </div>
              <Clock className="h-8 w-8 text-yellow-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Alerts Section */}
      {(overdueItems.length > 0 || upcomingTasks.length > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {overdueItems.length > 0 && (
            <Card className="border-red-200">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-red-600">
                  <AlertTriangle className="h-5 w-5" />
                  Overdue Items ({overdueItems.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {overdueItems.slice(0, 3).map((item: any, index: number) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-red-50 rounded-lg">
                      <div className="flex items-center gap-3">
                        {getStatusIcon(item.status)}
                        <div>
                          <p className="font-medium text-sm">{item.title}</p>
                          <p className="text-xs text-muted-foreground">
                            {item.daysOverdue} days overdue
                          </p>
                        </div>
                      </div>
                      <Badge variant="destructive">Overdue</Badge>
                    </div>
                  ))}
                  {overdueItems.length > 3 && (
                    <p className="text-sm text-muted-foreground text-center">
                      +{overdueItems.length - 3} more overdue items
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {upcomingTasks.length > 0 && (
            <Card className="border-blue-200">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-blue-600">
                  <Calendar className="h-5 w-5" />
                  Upcoming Tasks ({upcomingTasks.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {upcomingTasks.slice(0, 3).map((task: any, index: number) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                      <div className="flex items-center gap-3">
                        {getStatusIcon(task.status)}
                        <div>
                          <p className="font-medium text-sm">{task.title}</p>
                          <p className="text-xs text-muted-foreground">
                            Due: {new Date(task.dueDate).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <Badge className={task.priority === 'high' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'}>
                        {task.priority}
                      </Badge>
                    </div>
                  ))}
                  {upcomingTasks.length > 3 && (
                    <p className="text-sm text-muted-foreground text-center">
                      +{upcomingTasks.length - 3} more upcoming tasks
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="standards">Standards</TabsTrigger>
          <TabsTrigger value="scores">Scores by Category</TabsTrigger>
          <TabsTrigger value="audits">Audits</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Compliance Status Breakdown</CardTitle>
                <CardDescription>Current status of all compliance items</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {Object.entries(dashboard?.statusBreakdown || {}).map(([status, count]) => (
                    <div key={status} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {getStatusIcon(status)}
                        <span className="capitalize">{status.replace('_', ' ')}</span>
                      </div>
                      <Badge className={STATUS_COLORS[status as keyof typeof STATUS_COLORS]}>
                        {count as number}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Overall Compliance Progress</CardTitle>
                <CardDescription>Farm-wide compliance score</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="text-center">
                    <div className="text-4xl font-bold mb-2">
                      <span className={getOverallScoreColor(dashboard?.overview?.overallScore || 0)}>
                        {formatScore(dashboard?.overview?.overallScore || 0)}%
                      </span>
                    </div>
                    <Progress 
                      value={dashboard?.overview?.overallScore || 0} 
                      className="h-3 mb-4"
                    />
                    <p className="text-sm text-muted-foreground">
                      {dashboard?.overview?.overallScore >= 90 
                        ? 'Excellent - Exceeding standards'
                        : dashboard?.overview?.overallScore >= 75
                        ? 'Good - Meeting most standards'
                        : dashboard?.overview?.overallScore >= 60
                        ? 'Fair - Some improvements needed'
                        : 'Poor - Immediate attention required'
                      }
                    </p>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                    <div className="text-center">
                      <p className="text-2xl font-bold text-blue-600">
                        {dashboard?.overview?.totalStandards || 0}
                      </p>
                      <p className="text-sm text-muted-foreground">Total Standards</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold text-purple-600">
                        {dashboard?.upcomingAudits || 0}
                      </p>
                      <p className="text-sm text-muted-foreground">Upcoming Audits</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="standards" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Compliance Standards</CardTitle>
              <CardDescription>NZFAP farm assurance program standards</CardDescription>
            </CardHeader>
            <CardContent>
              {standards.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No compliance standards found</p>
                  <p className="text-sm">Initialize NZFAP standards to get started</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {standards.map((standard) => (
                    <div
                      key={standard.id}
                      className="flex items-center justify-between p-4 border rounded-lg"
                    >
                      <div className="flex items-center gap-4">
                        <Shield className="h-8 w-8 text-blue-500" />
                        <div>
                          <p className="font-medium">{standard.title}</p>
                          <p className="text-sm text-muted-foreground">{standard.code}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge className={REQUIREMENT_COLORS[standard.requirementLevel as keyof typeof REQUIREMENT_COLORS]}>
                              {standard.requirementLevel}
                            </Badge>
                            <Badge variant="outline">{standard.checkFrequency}</Badge>
                            {standard.documentationRequired && (
                              <Badge variant="secondary">Documentation Required</Badge>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium capitalize">{standard.category.replace('_', ' ')}</p>
                        <p className="text-xs text-muted-foreground">
                          Updated: {new Date(standard.lastUpdated).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="scores" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Compliance Scores by Category</span>
                <div className="flex gap-2">
                  {categories.map((category) => (
                    <Button
                      key={category}
                      variant={selectedCategory === category ? "default" : "outline"}
                      size="sm"
                      onClick={() => setSelectedCategory(category)}
                    >
                      {category === 'all' ? 'All' : category.replace('_', ' ')}
                    </Button>
                  ))}
                </div>
              </CardTitle>
              <CardDescription>
                Compliance performance across different categories
              </CardDescription>
            </CardHeader>
            <CardContent>
              {filteredScores.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <BarChart3 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No score data available</p>
                  <p className="text-sm">Complete compliance checks to see scores</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredScores.map((score: any) => (
                    <div key={score.category} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-medium capitalize">
                          {score.category.replace('_', ' ')}
                        </span>
                        <span className={`font-bold ${getOverallScoreColor(score.score)}`}>
                          {formatScore(score.score)}%
                        </span>
                      </div>
                      <Progress value={score.score} className="h-2" />
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>{score.totalChecks} checks completed</span>
                        <span>{score.compliantChecks} compliant</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="audits" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Compliance Audits</CardTitle>
              <CardDescription>Internal and external audit records</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-muted-foreground">
                <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No audit records found</p>
                <p className="text-sm">Audit history will appear here</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
