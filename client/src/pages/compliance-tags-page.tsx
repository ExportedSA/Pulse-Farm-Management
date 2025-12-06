import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
  Shield,
  Plus,
  Search,
  Filter,
  CheckCircle2,
  Circle,
  AlertTriangle,
  Clock,
  FileText,
  Tag,
  Link2,
  Unlink,
  Calendar,
  Upload,
  Download,
  History,
  BarChart3,
  Eye,
  Trash2,
  Edit,
  ChevronRight,
} from 'lucide-react';

interface ComplianceTag {
  id: string;
  framework: string;
  name: string;
  code: string;
  description: string;
  color: string;
  icon: string;
  requiresEvidence: boolean;
  evidenceTypes?: string[];
  frequency?: string;
  isActive: boolean;
  frameworkInfo?: { name: string; icon: string; color: string; description: string };
}

interface TaskComplianceLink {
  id: string;
  taskId: string;
  taskTitle: string;
  complianceTagId: string;
  complianceTagName: string;
  framework: string;
  status: string;
  evidenceProvided: boolean;
  evidenceUrls?: string[];
  notes?: string;
  completedAt?: string;
  completedBy?: string;
  dueDate?: string;
  frameworkInfo?: { name: string; icon: string; color: string };
  isOverdue?: boolean;
}

interface Framework {
  id: string;
  name: string;
  icon: string;
  color: string;
  description: string;
}

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-gray-100 text-gray-800',
  in_progress: 'bg-blue-100 text-blue-800',
  completed: 'bg-green-100 text-green-800',
  overdue: 'bg-red-100 text-red-800',
  not_applicable: 'bg-gray-100 text-gray-500',
};

const STATUS_ICONS: Record<string, React.ReactNode> = {
  pending: <Circle className="h-4 w-4 text-gray-500" />,
  in_progress: <Clock className="h-4 w-4 text-blue-500" />,
  completed: <CheckCircle2 className="h-4 w-4 text-green-500" />,
  overdue: <AlertTriangle className="h-4 w-4 text-red-500" />,
};

// Mock tasks for linking
const MOCK_TASKS = [
  { id: '1', title: 'Morning Feed - Paddock A' },
  { id: '2', title: 'Fence Repair - North Boundary' },
  { id: '3', title: 'Health Check - Dairy Herd' },
  { id: '4', title: 'Water Trough Inspection' },
  { id: '5', title: 'Afternoon Milking' },
  { id: '6', title: 'Move Herd to Paddock B' },
  { id: '7', title: 'Check Calving Paddock' },
  { id: '8', title: 'Evening Feed' },
];

export default function ComplianceTagsPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterFramework, setFilterFramework] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [isCreateTagDialogOpen, setIsCreateTagDialogOpen] = useState(false);
  const [isLinkDialogOpen, setIsLinkDialogOpen] = useState(false);
  const [selectedTag, setSelectedTag] = useState<ComplianceTag | null>(null);
  const [selectedLink, setSelectedLink] = useState<TaskComplianceLink | null>(null);

  // Form states
  const [newTag, setNewTag] = useState({
    framework: 'nzfap',
    name: '',
    code: '',
    description: '',
    requiresEvidence: true,
    frequency: 'monthly',
  });

  const [linkForm, setLinkForm] = useState({
    taskId: '',
    complianceTagId: '',
    dueDate: '',
    notes: '',
  });

  // Fetch dashboard
  const { data: dashboard } = useQuery({
    queryKey: ['complianceDashboard'],
    queryFn: async () => {
      const res = await fetch('/api/compliance-tags/dashboard');
      if (!res.ok) throw new Error('Failed to fetch dashboard');
      return res.json();
    },
  });

  // Fetch frameworks
  const { data: frameworks = [] } = useQuery<Framework[]>({
    queryKey: ['complianceFrameworks'],
    queryFn: async () => {
      const res = await fetch('/api/compliance-tags/frameworks');
      if (!res.ok) throw new Error('Failed to fetch frameworks');
      return res.json();
    },
  });

  // Fetch tags
  const { data: tags = [] } = useQuery<ComplianceTag[]>({
    queryKey: ['complianceTags', filterFramework],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filterFramework !== 'all') params.append('framework', filterFramework);
      params.append('active', 'true');
      const res = await fetch(`/api/compliance-tags/tags?${params}`);
      if (!res.ok) throw new Error('Failed to fetch tags');
      return res.json();
    },
  });

  // Fetch links
  const { data: links = [] } = useQuery<TaskComplianceLink[]>({
    queryKey: ['complianceLinks', filterFramework, filterStatus],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filterFramework !== 'all') params.append('framework', filterFramework);
      if (filterStatus !== 'all') params.append('status', filterStatus);
      const res = await fetch(`/api/compliance-tags/links?${params}`);
      if (!res.ok) throw new Error('Failed to fetch links');
      return res.json();
    },
  });

  // Fetch audit log
  const { data: auditLog = [] } = useQuery({
    queryKey: ['complianceAuditLog'],
    queryFn: async () => {
      const res = await fetch('/api/compliance-tags/audit-log?limit=20');
      if (!res.ok) throw new Error('Failed to fetch audit log');
      return res.json();
    },
  });

  // Create tag mutation
  const createTagMutation = useMutation({
    mutationFn: async (data: typeof newTag) => {
      const res = await fetch('/api/compliance-tags/tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Failed to create tag');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['complianceTags'] });
      queryClient.invalidateQueries({ queryKey: ['complianceDashboard'] });
      setIsCreateTagDialogOpen(false);
      setNewTag({ framework: 'nzfap', name: '', code: '', description: '', requiresEvidence: true, frequency: 'monthly' });
      toast.success('Compliance tag created');
    },
    onError: () => {
      toast.error('Failed to create tag');
    },
  });

  // Link tag to task mutation
  const linkMutation = useMutation({
    mutationFn: async (data: typeof linkForm) => {
      const task = MOCK_TASKS.find(t => t.id === data.taskId);
      const res = await fetch('/api/compliance-tags/links', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...data,
          taskTitle: task?.title,
        }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to link tag');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['complianceLinks'] });
      queryClient.invalidateQueries({ queryKey: ['complianceDashboard'] });
      setIsLinkDialogOpen(false);
      setLinkForm({ taskId: '', complianceTagId: '', dueDate: '', notes: '' });
      toast.success('Compliance tag linked to task');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  // Update link status mutation
  const updateLinkMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const res = await fetch(`/api/compliance-tags/links/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error('Failed to update status');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['complianceLinks'] });
      queryClient.invalidateQueries({ queryKey: ['complianceDashboard'] });
      toast.success('Status updated');
    },
  });

  // Delete link mutation
  const deleteLinkMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/compliance-tags/links/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to remove tag');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['complianceLinks'] });
      queryClient.invalidateQueries({ queryKey: ['complianceDashboard'] });
      toast.success('Compliance tag removed from task');
    },
  });

  // Filter tags by search
  const filteredTags = tags.filter(tag =>
    tag.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    tag.code.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('en-NZ', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const formatTimeAgo = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Shield className="h-8 w-8 text-pulse-forest" />
            Compliance Tagging
          </h1>
          <p className="text-muted-foreground mt-1">
            Track compliance requirements across tasks and generate reports
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setIsLinkDialogOpen(true)}>
            <Link2 className="h-4 w-4 mr-2" />
            Link Tag to Task
          </Button>
          <Button onClick={() => setIsCreateTagDialogOpen(true)} className="bg-pulse-forest hover:bg-pulse-forest-dark">
            <Plus className="h-4 w-4 mr-2" />
            Create Tag
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="tags">Compliance Tags</TabsTrigger>
          <TabsTrigger value="tasks">Tagged Tasks</TabsTrigger>
          <TabsTrigger value="audit">Audit Log</TabsTrigger>
        </TabsList>

        {/* Dashboard */}
        <TabsContent value="dashboard" className="space-y-6">
          {dashboard && (
            <>
              {/* Stats */}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <Card>
                  <CardContent className="p-4 text-center">
                    <p className="text-2xl font-bold">{dashboard.stats.totalLinks}</p>
                    <p className="text-sm text-muted-foreground">Total Items</p>
                  </CardContent>
                </Card>
                <Card className="border-green-200 bg-green-50">
                  <CardContent className="p-4 text-center">
                    <p className="text-2xl font-bold text-green-700">{dashboard.stats.completed}</p>
                    <p className="text-sm text-green-600">Completed</p>
                  </CardContent>
                </Card>
                <Card className="border-blue-200 bg-blue-50">
                  <CardContent className="p-4 text-center">
                    <p className="text-2xl font-bold text-blue-700">{dashboard.stats.inProgress}</p>
                    <p className="text-sm text-blue-600">In Progress</p>
                  </CardContent>
                </Card>
                <Card className="border-yellow-200 bg-yellow-50">
                  <CardContent className="p-4 text-center">
                    <p className="text-2xl font-bold text-yellow-700">{dashboard.stats.pending}</p>
                    <p className="text-sm text-yellow-600">Pending</p>
                  </CardContent>
                </Card>
                <Card className={dashboard.stats.overdue > 0 ? "border-red-200 bg-red-50" : ""}>
                  <CardContent className="p-4 text-center">
                    <p className={cn("text-2xl font-bold", dashboard.stats.overdue > 0 && "text-red-700")}>
                      {dashboard.stats.overdue}
                    </p>
                    <p className="text-sm text-muted-foreground">Overdue</p>
                  </CardContent>
                </Card>
              </div>

              {/* Completion Rate */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg">Overall Compliance Rate</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-4">
                    <Progress value={dashboard.stats.completionRate} className="flex-1 h-4" />
                    <span className="text-2xl font-bold text-pulse-forest">
                      {dashboard.stats.completionRate}%
                    </span>
                  </div>
                </CardContent>
              </Card>

              {/* By Framework */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Compliance by Framework</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {dashboard.byFramework.map((fw: any) => (
                      <div
                        key={fw.framework}
                        className="p-4 border rounded-lg"
                        style={{ borderLeftColor: fw.color, borderLeftWidth: 4 }}
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-xl">{fw.icon}</span>
                          <span className="font-medium">{fw.name}</span>
                        </div>
                        <div className="grid grid-cols-3 gap-2 text-sm">
                          <div className="text-center">
                            <p className="font-bold text-green-600">{fw.completed}</p>
                            <p className="text-xs text-muted-foreground">Done</p>
                          </div>
                          <div className="text-center">
                            <p className="font-bold text-blue-600">{fw.pending}</p>
                            <p className="text-xs text-muted-foreground">Pending</p>
                          </div>
                          <div className="text-center">
                            <p className={cn("font-bold", fw.overdue > 0 && "text-red-600")}>
                              {fw.overdue}
                            </p>
                            <p className="text-xs text-muted-foreground">Overdue</p>
                          </div>
                        </div>
                        <Progress 
                          value={fw.total > 0 ? (fw.completed / fw.total) * 100 : 0} 
                          className="mt-2 h-2"
                        />
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Upcoming Due */}
              {dashboard.upcomingDue.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Calendar className="h-5 w-5" />
                      Upcoming Due
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {dashboard.upcomingDue.map((item: any) => (
                        <div
                          key={item.id}
                          className={cn(
                            "flex items-center justify-between p-3 border rounded-lg",
                            item.isOverdue && "border-red-200 bg-red-50"
                          )}
                        >
                          <div className="flex items-center gap-3">
                            <span className="text-lg">{item.frameworkInfo?.icon}</span>
                            <div>
                              <p className="font-medium">{item.taskTitle}</p>
                              <p className="text-sm text-muted-foreground">{item.complianceTagName}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge className={item.isOverdue ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'}>
                              {item.isOverdue ? 'Overdue' : `Due ${formatDate(item.dueDate)}`}
                            </Badge>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => updateLinkMutation.mutate({ id: item.id, status: 'completed' })}
                            >
                              <CheckCircle2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </TabsContent>

        {/* Tags */}
        <TabsContent value="tags" className="space-y-4">
          {/* Filters */}
          <Card>
            <CardContent className="p-4">
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex-1 min-w-[200px] max-w-sm">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search tags..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                </div>
                <Select value={filterFramework} onValueChange={setFilterFramework}>
                  <SelectTrigger className="w-[180px]">
                    <Filter className="h-4 w-4 mr-1" />
                    <SelectValue placeholder="Framework" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Frameworks</SelectItem>
                    {frameworks.map(fw => (
                      <SelectItem key={fw.id} value={fw.id}>
                        {fw.icon} {fw.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Tags Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredTags.map(tag => (
              <Card key={tag.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div
                      className="w-10 h-10 rounded-lg flex items-center justify-center text-white text-lg"
                      style={{ backgroundColor: tag.color }}
                    >
                      {tag.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="font-semibold">{tag.name}</h3>
                          <p className="text-xs text-muted-foreground">{tag.code}</p>
                        </div>
                        <Badge variant="outline" style={{ borderColor: tag.color, color: tag.color }}>
                          {tag.frameworkInfo?.name}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                        {tag.description}
                      </p>
                      <div className="flex items-center gap-2 mt-2">
                        {tag.requiresEvidence && (
                          <Badge variant="secondary" className="text-xs">
                            <FileText className="h-3 w-3 mr-1" />
                            Evidence Required
                          </Badge>
                        )}
                        {tag.frequency && (
                          <Badge variant="outline" className="text-xs capitalize">
                            {tag.frequency}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2 mt-3 pt-3 border-t">
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1"
                      onClick={() => {
                        setLinkForm({ ...linkForm, complianceTagId: tag.id });
                        setIsLinkDialogOpen(true);
                      }}
                    >
                      <Link2 className="h-4 w-4 mr-1" />
                      Link to Task
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Tagged Tasks */}
        <TabsContent value="tasks" className="space-y-4">
          {/* Filters */}
          <Card>
            <CardContent className="p-4">
              <div className="flex flex-wrap items-center gap-4">
                <Select value={filterFramework} onValueChange={setFilterFramework}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Framework" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Frameworks</SelectItem>
                    {frameworks.map(fw => (
                      <SelectItem key={fw.id} value={fw.id}>
                        {fw.icon} {fw.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger className="w-[150px]">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="in_progress">In Progress</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="overdue">Overdue</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Links List */}
          <div className="space-y-2">
            {links.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  <Tag className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>No tagged tasks found</p>
                </CardContent>
              </Card>
            ) : (
              links.map(link => (
                <Card key={link.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-4">
                      <div
                        className="w-10 h-10 rounded-lg flex items-center justify-center text-white text-lg"
                        style={{ backgroundColor: link.frameworkInfo?.color }}
                      >
                        {link.frameworkInfo?.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between">
                          <div>
                            <h3 className="font-semibold">{link.taskTitle}</h3>
                            <p className="text-sm text-muted-foreground">
                              {link.complianceTagName} • {link.frameworkInfo?.name}
                            </p>
                          </div>
                          <Badge className={STATUS_COLORS[link.status]}>
                            {STATUS_ICONS[link.status]}
                            <span className="ml-1 capitalize">{link.status.replace('_', ' ')}</span>
                          </Badge>
                        </div>
                        <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                          {link.dueDate && (
                            <span className={link.isOverdue ? 'text-red-600' : ''}>
                              <Calendar className="h-3 w-3 inline mr-1" />
                              Due: {formatDate(link.dueDate)}
                            </span>
                          )}
                          {link.evidenceProvided && (
                            <span className="text-green-600">
                              <FileText className="h-3 w-3 inline mr-1" />
                              Evidence provided
                            </span>
                          )}
                          {link.completedBy && (
                            <span>
                              Completed by {link.completedBy}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        {link.status !== 'completed' && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => updateLinkMutation.mutate({ id: link.id, status: 'completed' })}
                          >
                            <CheckCircle2 className="h-4 w-4 mr-1" />
                            Complete
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => deleteLinkMutation.mutate(link.id)}
                        >
                          <Unlink className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </TabsContent>

        {/* Audit Log */}
        <TabsContent value="audit" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <History className="h-5 w-5" />
                Compliance Audit Log
              </CardTitle>
              <CardDescription>Track all compliance-related actions</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[500px]">
                <div className="space-y-3">
                  {auditLog.map((log: any) => (
                    <div key={log.id} className="flex items-start gap-3 p-3 border rounded-lg">
                      <div className={cn(
                        "w-8 h-8 rounded-full flex items-center justify-center",
                        log.action === 'status_changed' && log.newStatus === 'completed' ? "bg-green-100" :
                        log.action === 'tag_added' ? "bg-blue-100" :
                        log.action === 'tag_removed' ? "bg-red-100" :
                        "bg-gray-100"
                      )}>
                        {log.action === 'status_changed' ? (
                          <CheckCircle2 className="h-4 w-4 text-green-600" />
                        ) : log.action === 'tag_added' ? (
                          <Link2 className="h-4 w-4 text-blue-600" />
                        ) : log.action === 'tag_removed' ? (
                          <Unlink className="h-4 w-4 text-red-600" />
                        ) : log.action === 'evidence_uploaded' ? (
                          <Upload className="h-4 w-4 text-purple-600" />
                        ) : (
                          <History className="h-4 w-4 text-gray-600" />
                        )}
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-sm">
                          {log.action === 'status_changed' && `Status changed to "${log.newStatus}"`}
                          {log.action === 'tag_added' && `Tag "${log.complianceTagName}" added`}
                          {log.action === 'tag_removed' && `Tag "${log.complianceTagName}" removed`}
                          {log.action === 'evidence_uploaded' && 'Evidence uploaded'}
                          {log.action === 'verified' && 'Compliance verified'}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {log.taskTitle}
                        </p>
                        {log.notes && (
                          <p className="text-xs text-muted-foreground mt-1">{log.notes}</p>
                        )}
                        <p className="text-xs text-muted-foreground mt-1">
                          {log.performedBy} • {formatTimeAgo(log.performedAt)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Create Tag Dialog */}
      <Dialog open={isCreateTagDialogOpen} onOpenChange={setIsCreateTagDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Compliance Tag</DialogTitle>
            <DialogDescription>Define a new compliance requirement</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid gap-2">
              <Label>Framework *</Label>
              <Select
                value={newTag.framework}
                onValueChange={(v) => setNewTag({ ...newTag, framework: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {frameworks.map(fw => (
                    <SelectItem key={fw.id} value={fw.id}>
                      {fw.icon} {fw.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Name *</Label>
                <Input
                  value={newTag.name}
                  onChange={(e) => setNewTag({ ...newTag, name: e.target.value })}
                  placeholder="e.g., Chemical Storage Audit"
                />
              </div>
              <div className="grid gap-2">
                <Label>Code *</Label>
                <Input
                  value={newTag.code}
                  onChange={(e) => setNewTag({ ...newTag, code: e.target.value })}
                  placeholder="e.g., NZFAP-101"
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Description</Label>
              <Textarea
                value={newTag.description}
                onChange={(e) => setNewTag({ ...newTag, description: e.target.value })}
                placeholder="Describe the compliance requirement..."
                rows={2}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Frequency</Label>
                <Select
                  value={newTag.frequency}
                  onValueChange={(v) => setNewTag({ ...newTag, frequency: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="once">Once</SelectItem>
                    <SelectItem value="daily">Daily</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="quarterly">Quarterly</SelectItem>
                    <SelectItem value="annually">Annually</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2 pt-6">
                <Checkbox
                  id="requiresEvidence"
                  checked={newTag.requiresEvidence}
                  onCheckedChange={(c) => setNewTag({ ...newTag, requiresEvidence: !!c })}
                />
                <Label htmlFor="requiresEvidence">Requires Evidence</Label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateTagDialogOpen(false)}>Cancel</Button>
            <Button
              onClick={() => createTagMutation.mutate(newTag)}
              disabled={!newTag.name || !newTag.code || createTagMutation.isPending}
            >
              Create Tag
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Link Tag Dialog */}
      <Dialog open={isLinkDialogOpen} onOpenChange={setIsLinkDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Link Compliance Tag to Task</DialogTitle>
            <DialogDescription>Associate a compliance requirement with a task</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid gap-2">
              <Label>Task *</Label>
              <Select
                value={linkForm.taskId}
                onValueChange={(v) => setLinkForm({ ...linkForm, taskId: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a task..." />
                </SelectTrigger>
                <SelectContent>
                  {MOCK_TASKS.map(task => (
                    <SelectItem key={task.id} value={task.id}>
                      {task.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Compliance Tag *</Label>
              <Select
                value={linkForm.complianceTagId}
                onValueChange={(v) => setLinkForm({ ...linkForm, complianceTagId: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a tag..." />
                </SelectTrigger>
                <SelectContent>
                  {tags.map(tag => (
                    <SelectItem key={tag.id} value={tag.id}>
                      {tag.icon} {tag.name} ({tag.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Due Date</Label>
              <Input
                type="date"
                value={linkForm.dueDate}
                onChange={(e) => setLinkForm({ ...linkForm, dueDate: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label>Notes</Label>
              <Textarea
                value={linkForm.notes}
                onChange={(e) => setLinkForm({ ...linkForm, notes: e.target.value })}
                placeholder="Additional notes..."
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsLinkDialogOpen(false)}>Cancel</Button>
            <Button
              onClick={() => linkMutation.mutate(linkForm)}
              disabled={!linkForm.taskId || !linkForm.complianceTagId || linkMutation.isPending}
            >
              <Link2 className="h-4 w-4 mr-1" />
              Link Tag
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
