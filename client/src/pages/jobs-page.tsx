import { useState, useEffect, lazy, Suspense } from 'react';
import { pulseGet, pulsePost, pulsePatch } from '@/lib/pulseApi';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { Checkbox } from '@/components/ui/checkbox';
import { JobPhotoUpload } from '@/components/JobPhotoUpload';
import { JobLocationPicker } from '@/components/JobLocationPicker';
import { ChecklistManager, CompactChecklist, type ChecklistItem } from '@/components/ChecklistManager';
import { toast } from 'sonner';

// Lazy load map components to avoid SSR issues
const FarmMap = lazy(() => import('@/components/FarmMap'));
import { 
  Calendar, 
  Clock, 
  MapPin, 
  Users, 
  Plus, 
  CheckCircle2,
  AlertCircle,
  Circle,
  MoreVertical,
  Briefcase,
  ClipboardList,
  ListChecks,
  Star,
  Trash2,
  Eye,
  Map,
  Layers,
  Filter,
  Navigation,
  Target,
  AlertTriangle,
  Repeat,
  BookTemplate,
  Zap,
  ChevronRight
} from 'lucide-react';

interface Job {
  id: string;
  title: string;
  description: string;
  location: string;
  latitude?: number;
  longitude?: number;
  photoUrls?: string[];
  assignedTo: string[];
  assignedToNames?: string[];
  status: 'pending' | 'in-progress' | 'completed' | 'cancelled';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  startDate: string;
  endDate?: string;
  startTime: string;
  endTime?: string;
  category: string;
  createdBy: string;
  createdAt: string;
  notes?: string;
  checklistItems?: ChecklistItem[];
  estimatedDuration?: number;
}

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
}

interface Paddock {
  id: string;
  name: string;
  boundaries: [number, number][]; // [[lat, lng], [lat, lng], ...]
  area: number; // in hectares
  pastureType: string;
  status: string;
  lastGrazed?: string;
  nextInspection?: string;
}

interface TaskTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  priority: string;
  estimatedDuration: number;
  defaultTime: string;
  checklistItems: { text: string; required: boolean }[];
  suggestedRecurrence: string | null;
}

interface AutoAssignRule {
  id: string;
  name: string;
  category: string;
  assignToRole?: string;
  assignToUsers: string[];
  isActive: boolean;
}

export default function JobsPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('all');
  const [isCreateJobOpen, setIsCreateJobOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterPriority, setFilterPriority] = useState<string>('all');
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);

  // Map view state
  const [mapView, setMapView] = useState<'list' | 'map'>('list');
  const [showPaddocks, setShowPaddocks] = useState(true);
  const [selectedMapJob, setSelectedMapJob] = useState<Job | null>(null);
  const [mapFilterStatus, setMapFilterStatus] = useState<string>('all');
  const [mapFilterPriority, setMapFilterPriority] = useState<string>('all');
  const [paddocks, setPaddocks] = useState<Paddock[]>([]);

  // Template and recurring state
  const [templates, setTemplates] = useState<TaskTemplate[]>([]);
  const [showTemplates, setShowTemplates] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<TaskTemplate | null>(null);
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurrenceType, setRecurrenceType] = useState<'daily' | 'weekly' | 'monthly'>('weekly');
  const [recurrenceInterval, setRecurrenceInterval] = useState(1);
  const [recurrenceDays, setRecurrenceDays] = useState<number[]>([1]); // Monday by default
  const [autoAssignRules, setAutoAssignRules] = useState<AutoAssignRule[]>([]);

  // Form states
  const [newJob, setNewJob] = useState({
    title: '',
    description: '',
    location: '',
    latitude: -40.9006 as number | undefined,
    longitude: 175.6466 as number | undefined,
    photos: [] as File[],
    assignedTo: [] as string[],
    priority: 'medium' as const,
    status: 'pending' as const,
    startDate: new Date().toISOString().split('T')[0],
    startTime: '09:00',
    endDate: '',
    endTime: '',
    category: 'general',
    notes: '',
    checklistItems: [] as ChecklistItem[],
    estimatedDuration: 60
  });

  const [newChecklistItem, setNewChecklistItem] = useState('');
  const [newChecklistRequired, setNewChecklistRequired] = useState(false);

  const [availableUsers, setAvailableUsers] = useState<User[]>([]);

  useEffect(() => {
    loadJobs();
    loadUsers();
    loadMapData();
    loadTemplates();
    loadAutoAssignRules();
  }, []);

  // Load task templates
  async function loadTemplates() {
    try {
      // Mock templates - would come from API in production
      const mockTemplates: TaskTemplate[] = [
        {
          id: 'tpl-1', name: 'Weekly Vehicle Inspection', description: 'Complete safety inspection of all farm vehicles',
          category: 'maintenance', priority: 'medium', estimatedDuration: 60, defaultTime: '08:00',
          checklistItems: [
            { text: 'Check tire pressure and condition', required: true },
            { text: 'Check oil and fluid levels', required: true },
            { text: 'Test lights and indicators', required: true },
            { text: 'Inspect brakes', required: true },
            { text: 'Check safety equipment', required: false },
          ],
          suggestedRecurrence: 'weekly',
        },
        {
          id: 'tpl-2', name: 'Morning Feed - All Paddocks', description: 'Distribute hay and supplements to all cattle',
          category: 'feeding', priority: 'high', estimatedDuration: 90, defaultTime: '06:00',
          checklistItems: [
            { text: 'Check feed stock levels', required: true },
            { text: 'Fill water troughs', required: true },
            { text: 'Distribute supplements', required: false },
            { text: 'Check for sick animals', required: true },
          ],
          suggestedRecurrence: 'daily',
        },
        {
          id: 'tpl-3', name: 'Fence Line Inspection', description: 'Walk and inspect all fence lines for damage',
          category: 'maintenance', priority: 'medium', estimatedDuration: 120, defaultTime: '09:00',
          checklistItems: [
            { text: 'Check for broken wires', required: true },
            { text: 'Check post stability', required: true },
            { text: 'Test electric fence voltage', required: true },
            { text: 'Clear vegetation from fence line', required: false },
          ],
          suggestedRecurrence: 'weekly',
        },
        {
          id: 'tpl-4', name: 'Water System Check', description: 'Inspect all water troughs and pipes',
          category: 'maintenance', priority: 'high', estimatedDuration: 45, defaultTime: '07:00',
          checklistItems: [
            { text: 'Check trough water levels', required: true },
            { text: 'Clean troughs if needed', required: false },
            { text: 'Check for leaks', required: true },
            { text: 'Test pump operation', required: true },
          ],
          suggestedRecurrence: 'daily',
        },
        {
          id: 'tpl-5', name: 'Monthly Equipment Service', description: 'Scheduled maintenance for farm equipment',
          category: 'maintenance', priority: 'medium', estimatedDuration: 180, defaultTime: '08:00',
          checklistItems: [
            { text: 'Change oil and filters', required: true },
            { text: 'Grease all fittings', required: true },
            { text: 'Check belts and hoses', required: true },
            { text: 'Test all functions', required: true },
            { text: 'Update service log', required: true },
          ],
          suggestedRecurrence: 'monthly',
        },
      ];
      setTemplates(mockTemplates);
    } catch (err) {
      console.error('Failed to load templates:', err);
    }
  }

  // Load auto-assignment rules
  async function loadAutoAssignRules() {
    try {
      // Mock rules - would come from API in production
      const mockRules: AutoAssignRule[] = [
        { id: 'rule-1', name: 'Feeding Tasks', category: 'feeding', assignToRole: 'Stock Handler', assignToUsers: ['user-2', 'user-3'], isActive: true },
        { id: 'rule-2', name: 'Maintenance Tasks', category: 'maintenance', assignToRole: 'Farm Manager', assignToUsers: ['user-1'], isActive: true },
        { id: 'rule-3', name: 'Health Checks', category: 'health', assignToRole: 'Veterinarian', assignToUsers: ['user-4'], isActive: true },
      ];
      setAutoAssignRules(mockRules);
    } catch (err) {
      console.error('Failed to load auto-assign rules:', err);
    }
  }

  // Apply template to new job form
  const applyTemplate = (template: TaskTemplate) => {
    setNewJob({
      ...newJob,
      title: template.name,
      description: template.description,
      category: template.category,
      priority: template.priority as any,
      startTime: template.defaultTime,
      estimatedDuration: template.estimatedDuration,
      checklistItems: template.checklistItems.map((item, idx) => ({
        id: `item-${Date.now()}-${idx}`,
        text: item.text,
        required: item.required,
        completed: false,
        order: idx,
      })),
    });
    setSelectedTemplate(template);
    if (template.suggestedRecurrence) {
      setIsRecurring(true);
      setRecurrenceType(template.suggestedRecurrence as any);
    }
    setShowTemplates(false);
    toast.success(`Template "${template.name}" applied`);
  };

  // Apply auto-assignment based on category
  const applyAutoAssignment = (category: string) => {
    const rule = autoAssignRules.find(r => r.category === category && r.isActive);
    if (rule) {
      setNewJob(prev => ({ ...prev, assignedTo: rule.assignToUsers }));
      toast.info(`Auto-assigned to ${rule.name}`);
    }
  };

  // Load map data (paddocks)
  async function loadMapData() {
    try {
      // Mock paddocks data - would come from API in production
      const mockPaddocks: Paddock[] = [
        {
          id: 'paddock-1',
          name: 'Front Paddock',
          boundaries: [
            [-40.8995, 175.6455],
            [-40.8995, 175.6475],
            [-40.9015, 175.6475],
            [-40.9015, 175.6455],
          ],
          area: 25,
          pastureType: 'Ryegrass',
          status: 'active',
          lastGrazed: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
        },
        {
          id: 'paddock-2',
          name: 'Back Paddock',
          boundaries: [
            [-40.9015, 175.6455],
            [-40.9015, 175.6475],
            [-40.9035, 175.6475],
            [-40.9035, 175.6455],
          ],
          area: 30,
          pastureType: 'Clover Mix',
          status: 'resting',
          lastGrazed: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
        },
        {
          id: 'paddock-3',
          name: 'Side Paddock',
          boundaries: [
            [-40.9015, 175.6475],
            [-40.9015, 175.6495],
            [-40.9035, 175.6495],
            [-40.9035, 175.6475],
          ],
          area: 20,
          pastureType: 'Mixed Pasture',
          status: 'active',
          lastGrazed: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
        },
      ];

      setPaddocks(mockPaddocks);
    } catch (err) {
      console.error('Failed to load map data:', err);
    }
  }

  async function loadJobs() {
    try {
      const data = await pulseGet<Job[]>('/jobs');
      setJobs(data);
    } catch (err) {
      console.error('Failed to load jobs:', err);
    } finally {
      setLoading(false);
    }
  }

  async function loadUsers() {
    try {
      const data = await pulseGet<User[]>('/jobs/users');
      setAvailableUsers(data);
    } catch (err) {
      console.error('Failed to load users:', err);
    }
  }

  const handleCreateJob = async () => {
    if (!newJob.title || !newJob.description || !newJob.location || newJob.assignedTo.length === 0) {
      alert('Please fill in all required fields and assign at least one person');
      return;
    }

    try {
      // If recurring, create a recurring task template instead
      if (isRecurring) {
        const recurringData = {
          title: newJob.title,
          description: newJob.description,
          location: newJob.location,
          latitude: newJob.latitude,
          longitude: newJob.longitude,
          assignedTo: newJob.assignedTo,
          priority: newJob.priority,
          category: newJob.category,
          recurrenceType: recurrenceType,
          recurrenceInterval: recurrenceInterval,
          recurrenceDays: recurrenceType === 'weekly' ? recurrenceDays : null,
          recurrenceTime: newJob.startTime,
          recurrenceEndTime: newJob.endTime || null,
          startDate: newJob.startDate,
          checklistItems: newJob.checklistItems,
          estimatedDuration: newJob.estimatedDuration,
        };

        const response = await fetch('/api/recurring-tasks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(recurringData),
          credentials: 'include'
        });

        if (!response.ok) {
          throw new Error('Failed to create recurring task');
        }

        toast.success('Recurring task created successfully! View it in Recurring Tasks.');
        // Reset and close
        resetForm();
        return;
      }

      // Create FormData for file upload (one-off job)
      const formData = new FormData();
      formData.append('title', newJob.title);
      formData.append('description', newJob.description);
      formData.append('location', newJob.location);
      if (newJob.latitude !== undefined) formData.append('latitude', newJob.latitude.toString());
      if (newJob.longitude !== undefined) formData.append('longitude', newJob.longitude.toString());
      
      // Add actual photo files to FormData
      newJob.photos.forEach((photo, index) => {
        formData.append(`photos`, photo);
      });
      
      formData.append('assignedTo', JSON.stringify(newJob.assignedTo));
      formData.append('priority', newJob.priority);
      formData.append('startDate', newJob.startDate);
      formData.append('startTime', newJob.startTime);
      if (newJob.endDate) formData.append('endDate', newJob.endDate);
      if (newJob.endTime) formData.append('endTime', newJob.endTime);
      formData.append('category', newJob.category);
      if (newJob.notes) formData.append('notes', newJob.notes);

      const response = await fetch('/api/jobs', {
        method: 'POST',
        body: formData,
        credentials: 'include'
      });
      
      if (!response.ok) {
        throw new Error('Failed to create job');
      }
      
      const job = await response.json();
      setJobs([job, ...jobs]);
      
      resetForm();
      toast.success('Job created successfully');
    } catch (error) {
      console.error('Failed to create job:', error);
      alert('Failed to create job. Please try again.');
    }
  };

  const resetForm = () => {
    setNewJob({
      title: '',
      description: '',
      location: '',
      latitude: -40.9006,
      longitude: 175.6466,
      photos: [],
      assignedTo: [],
      priority: 'medium',
      status: 'pending',
      startDate: new Date().toISOString().split('T')[0],
      startTime: '09:00',
      endDate: '',
      endTime: '',
      category: 'general',
      notes: '',
      checklistItems: [],
      estimatedDuration: 60
    });
    setIsRecurring(false);
    setRecurrenceType('weekly');
    setRecurrenceInterval(1);
    setRecurrenceDays([1]);
    setSelectedTemplate(null);
    setShowTemplates(false);
    setIsCreateJobOpen(false);
  };

  async function updateJobStatus(jobId: string, status: Job['status']) {
    try {
      await pulsePatch(`/jobs/${jobId}`, { status });
      await loadJobs();
      toast.success(`Job ${status === 'completed' ? 'completed' : 'updated'}`);
    } catch (err) {
      console.error('Failed to update job status:', err);
      toast.error('Failed to update job status');
    }
  }

  // Update job checklist
  async function updateJobChecklist(jobId: string, checklistItems: ChecklistItem[]) {
    try {
      await pulsePatch(`/jobs/${jobId}`, { checklistItems });
      setJobs(jobs.map(j => j.id === jobId ? { ...j, checklistItems } : j));
      if (selectedJob?.id === jobId) {
        setSelectedJob({ ...selectedJob, checklistItems });
      }
    } catch (err) {
      console.error('Failed to update checklist:', err);
    }
  }

  // Add checklist item to new job
  const addChecklistItem = () => {
    if (!newChecklistItem.trim()) return;
    const item: ChecklistItem = {
      id: `item-${Date.now()}`,
      text: newChecklistItem.trim(),
      required: newChecklistRequired,
      completed: false,
      order: newJob.checklistItems.length,
    };
    setNewJob({ ...newJob, checklistItems: [...newJob.checklistItems, item] });
    setNewChecklistItem('');
    setNewChecklistRequired(false);
  };

  // Remove checklist item from new job
  const removeChecklistItem = (id: string) => {
    setNewJob({
      ...newJob,
      checklistItems: newJob.checklistItems.filter(i => i.id !== id),
    });
  };

  // Open job detail dialog
  const openJobDetail = (job: Job) => {
    setSelectedJob(job);
    setIsDetailDialogOpen(true);
  };

  // Get checklist progress
  const getChecklistProgress = (items?: ChecklistItem[]) => {
    if (!items || items.length === 0) return null;
    const completed = items.filter(i => i.completed).length;
    return { completed, total: items.length, percent: Math.round((completed / items.length) * 100) };
  };

  const filteredJobs = jobs.filter(job => {
    const matchesSearch = job.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         job.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         job.location.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = filterStatus === 'all' || job.status === filterStatus;
    const matchesPriority = filterPriority === 'all' || job.priority === filterPriority;
    const matchesTab = activeTab === 'all' || 
                       (activeTab === 'my-jobs' && job.assignedTo.includes('demo-user')) ||
                       (activeTab === 'today' && job.startDate === new Date().toISOString().split('T')[0]);
    
    return matchesSearch && matchesStatus && matchesPriority && matchesTab;
  });

  // Filter jobs for map view
  const filteredMapJobs = jobs.filter(job => {
    const hasLocation = job.latitude !== undefined && job.longitude !== undefined;
    const matchesStatus = mapFilterStatus === 'all' || job.status === mapFilterStatus;
    const matchesPriority = mapFilterPriority === 'all' || job.priority === mapFilterPriority;
    const matchesTab = activeTab === 'all' || 
                       (activeTab === 'my-jobs' && job.assignedTo.includes('demo-user')) ||
                       (activeTab === 'today' && job.startDate === new Date().toISOString().split('T')[0]);
    
    return hasLocation && matchesStatus && matchesPriority && matchesTab;
  });

  // Get job marker color based on status and priority
  const getJobMarkerColor = (job: Job) => {
    if (job.status === 'completed') return '#10b981'; // green
    if (job.status === 'in-progress') return '#3b82f6'; // blue
    if (job.status === 'cancelled') return '#ef4444'; // red
    
    // For pending jobs, use priority color
    switch (job.priority) {
      case 'urgent': return '#dc2626'; // red
      case 'high': return '#ea580c'; // orange
      case 'medium': return '#ca8a04'; // yellow
      case 'low': return '#16a34a'; // green
      default: return '#6b7280'; // gray
    }
  };

  // Handle job click on map
  const handleMapJobClick = (job: Job) => {
    setSelectedMapJob(job);
    setIsDetailDialogOpen(true);
  };

  // Handle paddock click on map
  const handlePaddockClick = (paddock: Paddock) => {
    toast.info(`Paddock: ${paddock.name} - ${paddock.pastureType} (${paddock.area}ha)`);
  };

  const getStatusIcon = (status: Job['status']) => {
    switch (status) {
      case 'completed': return <CheckCircle2 className="h-4 w-4 text-green-600" />;
      case 'in-progress': return <Clock className="h-4 w-4 text-blue-600" />;
      case 'pending': return <Circle className="h-4 w-4 text-gray-400" />;
      case 'cancelled': return <AlertCircle className="h-4 w-4 text-red-600" />;
    }
  };

  const getPriorityColor = (priority: Job['priority']) => {
    switch (priority) {
      case 'urgent': return 'bg-red-100 text-red-800 border-red-200';
      case 'high': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'low': return 'bg-green-100 text-green-800 border-green-200';
    }
  };

  const getStatusColor = (status: Job['status']) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800';
      case 'in-progress': return 'bg-blue-100 text-blue-800';
      case 'pending': return 'bg-gray-100 text-gray-800';
      case 'cancelled': return 'bg-red-100 text-red-800';
    }
  };

  if (loading) {
    return <div className="p-8">Loading jobs...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                <Briefcase className="h-6 w-6 text-pulse-forest" />
                Job Scheduler
              </h1>
              <p className="text-sm text-gray-500 mt-1">Manage and assign tasks to your team</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" asChild>
                <a href="/app/task-templates">
                  <BookTemplate className="h-4 w-4 mr-2" />
                  Templates
                </a>
              </Button>
              <Button variant="outline" size="sm" asChild>
                <a href="/app/recurring-tasks">
                  <Repeat className="h-4 w-4 mr-2" />
                  Recurring
                </a>
              </Button>
              <Dialog open={isCreateJobOpen} onOpenChange={setIsCreateJobOpen}>
                <DialogTrigger asChild>
                  <Button className="bg-pulse-forest hover:bg-pulse-forest-dark text-white">
                    <Plus className="h-4 w-4 mr-2" />
                    Create Job
                  </Button>
                </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Create New Job</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  {/* Quick Template Selection */}
                  <div className="border rounded-lg p-4 bg-gradient-to-r from-blue-50 to-indigo-50">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <BookTemplate className="h-5 w-5 text-blue-600" />
                        <span className="font-medium text-sm">Quick Start from Template</span>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowTemplates(!showTemplates)}
                      >
                        {showTemplates ? 'Hide' : 'Browse All'}
                        <ChevronRight className={`h-4 w-4 ml-1 transition-transform ${showTemplates ? 'rotate-90' : ''}`} />
                      </Button>
                    </div>
                    {!showTemplates ? (
                      <div className="flex flex-wrap gap-2">
                        {templates.slice(0, 3).map(tpl => (
                          <Button
                            key={tpl.id}
                            variant="outline"
                            size="sm"
                            onClick={() => applyTemplate(tpl)}
                            className="text-xs"
                          >
                            <Zap className="h-3 w-3 mr-1 text-yellow-500" />
                            {tpl.name}
                          </Button>
                        ))}
                      </div>
                    ) : (
                      <div className="space-y-2 max-h-48 overflow-y-auto">
                        {templates.map(tpl => (
                          <div
                            key={tpl.id}
                            onClick={() => applyTemplate(tpl)}
                            className="flex items-center justify-between p-2 bg-white rounded border cursor-pointer hover:border-blue-300 hover:bg-blue-50 transition-colors"
                          >
                            <div>
                              <p className="font-medium text-sm">{tpl.name}</p>
                              <p className="text-xs text-gray-500">{tpl.description}</p>
                            </div>
                            <div className="flex items-center gap-2">
                              {tpl.suggestedRecurrence && (
                                <Badge variant="secondary" className="text-xs">
                                  <Repeat className="h-3 w-3 mr-1" />
                                  {tpl.suggestedRecurrence}
                                </Badge>
                              )}
                              <Badge variant="outline" className="text-xs">{tpl.category}</Badge>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    {selectedTemplate && (
                      <div className="mt-2 flex items-center gap-2 text-xs text-green-600">
                        <CheckCircle2 className="h-3 w-3" />
                        Using template: {selectedTemplate.name}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-5 px-1 text-xs"
                          onClick={() => {
                            setSelectedTemplate(null);
                            setNewJob({ ...newJob, title: '', description: '', checklistItems: [] });
                          }}
                        >
                          Clear
                        </Button>
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="text-sm font-medium mb-2 block">Job Title *</label>
                    <Input
                      value={newJob.title}
                      onChange={(e) => setNewJob({ ...newJob, title: e.target.value })}
                      placeholder="e.g., Morning Feed - Paddock A"
                    />
                  </div>

                  <div>
                    <label className="text-sm font-medium mb-2 block">Description *</label>
                    <Textarea
                      value={newJob.description}
                      onChange={(e) => setNewJob({ ...newJob, description: e.target.value })}
                      placeholder="Describe the job details..."
                      rows={3}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium mb-2 block">Location *</label>
                      <div className="flex gap-2">
                        <Input
                          value={newJob.location}
                          onChange={(e) => setNewJob({ ...newJob, location: e.target.value })}
                          placeholder="e.g., Paddock A"
                          className="flex-1"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          onClick={() => {
                            const mapSection = document.getElementById('job-map-picker');
                            mapSection?.scrollIntoView({ behavior: 'smooth' });
                          }}
                          title="Pin location on map"
                        >
                          <MapPin className="h-4 w-4" />
                        </Button>
                      </div>
                      {newJob.latitude && newJob.longitude && (
                        <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          GPS: {newJob.latitude.toFixed(5)}, {newJob.longitude.toFixed(5)}
                        </p>
                      )}
                    </div>

                    <div>
                      <label className="text-sm font-medium mb-2 block">Category</label>
                      <Select value={newJob.category} onValueChange={(value) => {
                        setNewJob({ ...newJob, category: value });
                        applyAutoAssignment(value);
                      }}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="general">General</SelectItem>
                          <SelectItem value="feeding">Feeding</SelectItem>
                          <SelectItem value="health">Health Check</SelectItem>
                          <SelectItem value="maintenance">Maintenance</SelectItem>
                          <SelectItem value="breeding">Breeding</SelectItem>
                          <SelectItem value="milking">Milking</SelectItem>
                        </SelectContent>
                      </Select>
                      {autoAssignRules.find(r => r.category === newJob.category && r.isActive) && (
                        <p className="text-xs text-blue-600 mt-1 flex items-center gap-1">
                          <Zap className="h-3 w-3" />
                          Auto-assignment rule active for this category
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium mb-2 block">Priority</label>
                      <Select value={newJob.priority} onValueChange={(value: any) => setNewJob({ ...newJob, priority: value })}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="low">Low</SelectItem>
                          <SelectItem value="medium">Medium</SelectItem>
                          <SelectItem value="high">High</SelectItem>
                          <SelectItem value="urgent">Urgent</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <label className="text-sm font-medium mb-2 block">Status</label>
                      <Select value={newJob.status} onValueChange={(value: any) => setNewJob({ ...newJob, status: value })}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pending">Pending</SelectItem>
                          <SelectItem value="in-progress">In Progress</SelectItem>
                          <SelectItem value="completed">Completed</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium mb-2 block">Start Date *</label>
                      <Input
                        type="date"
                        value={newJob.startDate}
                        onChange={(e) => setNewJob({ ...newJob, startDate: e.target.value })}
                      />
                    </div>

                    <div>
                      <label className="text-sm font-medium mb-2 block">End Date</label>
                      <Input
                        type="date"
                        value={newJob.endDate}
                        onChange={(e) => setNewJob({ ...newJob, endDate: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium mb-2 block">Start Time *</label>
                      <Input
                        type="time"
                        value={newJob.startTime}
                        onChange={(e) => setNewJob({ ...newJob, startTime: e.target.value })}
                      />
                    </div>

                    <div>
                      <label className="text-sm font-medium mb-2 block">End Time</label>
                      <Input
                        type="time"
                        value={newJob.endTime}
                        onChange={(e) => setNewJob({ ...newJob, endTime: e.target.value })}
                      />
                    </div>
                  </div>

                  {/* Recurring Schedule Section */}
                  <div className="border rounded-lg p-4 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Repeat className="h-5 w-5 text-purple-600" />
                        <span className="font-medium text-sm">Make this a Recurring Task</span>
                      </div>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={isRecurring}
                          onChange={(e) => setIsRecurring(e.target.checked)}
                          className="rounded"
                        />
                        <span className="text-sm text-gray-600">Enable</span>
                      </label>
                    </div>
                    
                    {isRecurring && (
                      <div className="space-y-4 pt-2 border-t">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="text-sm font-medium mb-2 block">Repeat</label>
                            <Select value={recurrenceType} onValueChange={(v: any) => setRecurrenceType(v)}>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="daily">Daily</SelectItem>
                                <SelectItem value="weekly">Weekly</SelectItem>
                                <SelectItem value="monthly">Monthly</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <label className="text-sm font-medium mb-2 block">Every</label>
                            <div className="flex items-center gap-2">
                              <Input
                                type="number"
                                min={1}
                                max={30}
                                value={recurrenceInterval}
                                onChange={(e) => setRecurrenceInterval(parseInt(e.target.value) || 1)}
                                className="w-20"
                              />
                              <span className="text-sm text-gray-600">
                                {recurrenceType === 'daily' ? 'day(s)' : recurrenceType === 'weekly' ? 'week(s)' : 'month(s)'}
                              </span>
                            </div>
                          </div>
                        </div>
                        
                        {recurrenceType === 'weekly' && (
                          <div>
                            <label className="text-sm font-medium mb-2 block">On these days</label>
                            <div className="flex gap-2">
                              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, idx) => (
                                <button
                                  key={day}
                                  type="button"
                                  onClick={() => {
                                    if (recurrenceDays.includes(idx)) {
                                      setRecurrenceDays(recurrenceDays.filter(d => d !== idx));
                                    } else {
                                      setRecurrenceDays([...recurrenceDays, idx].sort());
                                    }
                                  }}
                                  className={`w-10 h-10 rounded-full text-xs font-medium transition-colors ${
                                    recurrenceDays.includes(idx)
                                      ? 'bg-purple-600 text-white'
                                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                  }`}
                                >
                                  {day}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                        
                        <div className="bg-purple-50 rounded p-3 text-sm text-purple-800">
                          <p className="font-medium">Schedule Summary:</p>
                          <p>
                            This task will repeat every {recurrenceInterval > 1 ? `${recurrenceInterval} ` : ''}
                            {recurrenceType === 'daily' ? (recurrenceInterval > 1 ? 'days' : 'day') : 
                             recurrenceType === 'weekly' ? (recurrenceInterval > 1 ? 'weeks' : 'week') : 
                             (recurrenceInterval > 1 ? 'months' : 'month')}
                            {recurrenceType === 'weekly' && recurrenceDays.length > 0 && (
                              <> on {recurrenceDays.map(d => ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d]).join(', ')}</>
                            )}
                            {' '}at {newJob.startTime || '(set time above)'}.
                          </p>
                        </div>
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="text-sm font-medium mb-2 block">Assign To *</label>
                    <div className="space-y-2 max-h-48 overflow-y-auto border rounded-lg p-3">
                      {availableUsers.map(user => (
                        <label key={user.id} className="flex items-center gap-3 p-2 hover:bg-accent rounded cursor-pointer">
                          <input
                            type="checkbox"
                            checked={newJob.assignedTo.includes(user.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setNewJob({ ...newJob, assignedTo: [...newJob.assignedTo, user.id] });
                              } else {
                                setNewJob({ ...newJob, assignedTo: newJob.assignedTo.filter(id => id !== user.id) });
                              }
                            }}
                            className="rounded"
                          />
                          <Avatar className="h-8 w-8">
                            <AvatarFallback className="bg-gray-200 text-xs">
                              {user.name.charAt(0)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1">
                            <p className="text-sm font-medium">{user.name}</p>
                            <p className="text-xs text-gray-500">{user.role}</p>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="text-sm font-medium mb-2 block">Additional Notes</label>
                    <Textarea
                      value={newJob.notes}
                      onChange={(e) => setNewJob({ ...newJob, notes: e.target.value })}
                      placeholder="Any additional information..."
                      rows={2}
                    />
                  </div>

                  {/* Checklist Builder Section */}
                  <div className="border rounded-lg p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-medium flex items-center gap-2">
                        <ListChecks className="h-4 w-4" />
                        Checklist Items
                      </label>
                      <Badge variant="secondary" className="text-xs">
                        {newJob.checklistItems.length} items
                      </Badge>
                    </div>
                    
                    <div className="flex gap-2">
                      <Input
                        placeholder="Add a checklist item..."
                        value={newChecklistItem}
                        onChange={(e) => setNewChecklistItem(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addChecklistItem())}
                        className="flex-1"
                      />
                      <Button
                        type="button"
                        variant={newChecklistRequired ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setNewChecklistRequired(!newChecklistRequired)}
                        className="px-2"
                        title={newChecklistRequired ? 'Required item' : 'Optional item'}
                      >
                        <Star className={`h-4 w-4 ${newChecklistRequired ? 'fill-current' : ''}`} />
                      </Button>
                      <Button type="button" onClick={addChecklistItem} size="sm" disabled={!newChecklistItem.trim()}>
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                    
                    {newJob.checklistItems.length > 0 && (
                      <div className="space-y-2 max-h-48 overflow-y-auto">
                        {newJob.checklistItems.map((item, index) => (
                          <div key={item.id} className="flex items-center gap-2 p-2 bg-gray-50 rounded">
                            <span className="text-xs text-gray-400 w-5">{index + 1}.</span>
                            <span className="flex-1 text-sm">{item.text}</span>
                            {item.required && (
                              <Badge variant="outline" className="text-xs text-red-600 border-red-200">
                                Required
                              </Badge>
                            )}
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => removeChecklistItem(item.id)}
                              className="h-6 w-6 p-0 text-gray-400 hover:text-red-500"
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                    
                    {newJob.checklistItems.length === 0 && (
                      <p className="text-xs text-gray-500 text-center py-2">
                        Add checklist items to track task completion steps
                      </p>
                    )}
                  </div>

                  {/* Photo Upload Section */}
                  <JobPhotoUpload
                    photos={newJob.photos}
                    onPhotosChange={(photos) => setNewJob({ ...newJob, photos })}
                    maxPhotos={5}
                  />

                  {/* Location Picker Section */}
                  <div id="job-map-picker">
                    <label className="text-sm font-medium mb-2 block flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-primary" />
                      Pin Location on Map
                    </label>
                    <p className="text-xs text-muted-foreground mb-3">Click on the map to set the exact GPS location. The assigned person can view this on their device.</p>
                    <JobLocationPicker
                      latitude={newJob.latitude}
                      longitude={newJob.longitude}
                      onLocationChange={(lat, lng) => setNewJob({ ...newJob, latitude: lat, longitude: lng })}
                    />
                  </div>

                  <div className="flex gap-2 pt-4">
                    <Button
                      onClick={handleCreateJob}
                      disabled={!newJob.title || !newJob.description || !newJob.location || !newJob.startDate || !newJob.startTime || newJob.assignedTo.length === 0}
                      className="flex-1 bg-pulse-forest hover:bg-pulse-forest-dark text-white"
                    >
                      {isRecurring ? (
                        <>
                          <Repeat className="h-4 w-4 mr-2" />
                          Create Recurring Task
                        </>
                      ) : (
                        'Create Job'
                      )}
                    </Button>
                    <Button
                      onClick={resetForm}
                      variant="outline"
                      className="flex-1"
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
            </div>
          </div>
        </div>
      </div>

      {/* Filters and Tabs */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="mb-4">
              <TabsTrigger value="all">All Jobs</TabsTrigger>
              <TabsTrigger value="today">Today</TabsTrigger>
              <TabsTrigger value="my-jobs">My Jobs</TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="flex flex-wrap gap-3">
            <div className="flex-1 min-w-[200px]">
              <Input
                placeholder="Search jobs..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full"
              />
            </div>
            
            {/* View Toggle */}
            <div className="flex bg-gray-100 rounded-lg p-1">
              <Button
                variant={mapView === 'list' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setMapView('list')}
                className="flex items-center gap-2"
              >
                <ListChecks className="h-4 w-4" />
                List
              </Button>
              <Button
                variant={mapView === 'map' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setMapView('map')}
                className="flex items-center gap-2"
              >
                <Map className="h-4 w-4" />
                Map
              </Button>
            </div>
            
            {mapView === 'list' ? (
              <>
                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger className="w-[150px]">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="in-progress">In Progress</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={filterPriority} onValueChange={setFilterPriority}>
                  <SelectTrigger className="w-[150px]">
                    <SelectValue placeholder="Priority" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Priority</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="low">Low</SelectItem>
                  </SelectContent>
                </Select>
              </>
            ) : (
              <>
                {/* Map Filters */}
                <Select value={mapFilterStatus} onValueChange={setMapFilterStatus}>
                  <SelectTrigger className="w-[150px]">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="in-progress">In Progress</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={mapFilterPriority} onValueChange={setMapFilterPriority}>
                  <SelectTrigger className="w-[150px]">
                    <SelectValue placeholder="Priority" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Priority</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="low">Low</SelectItem>
                  </SelectContent>
                </Select>

                {/* Map Layer Controls */}
                <div className="flex items-center gap-2 border rounded-lg px-3 py-2">
                  <Layers className="h-4 w-4 text-gray-500" />
                  <div className="flex items-center gap-2">
                    <label className="flex items-center gap-1 text-sm">
                      <Checkbox
                        checked={showPaddocks}
                        onCheckedChange={(checked) => setShowPaddocks(checked as boolean)}
                      />
                      Show Paddocks
                    </label>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Jobs Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {mapView === 'list' ? (
          /* Jobs List */
          <div className="grid gap-4">
            {filteredJobs.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <ClipboardList className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-500">No jobs found</p>
                  <p className="text-sm text-gray-400 mt-2">Create your first job to get started</p>
                </CardContent>
              </Card>
            ) : (
              filteredJobs.map(job => (
                <Card key={job.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-start gap-3 mb-3">
                          {getStatusIcon(job.status)}
                          <div className="flex-1">
                            <h3 className="text-lg font-semibold text-gray-900 mb-1">{job.title}</h3>
                            <p className="text-sm text-gray-600 mb-3">{job.description}</p>
                            
                            <div className="flex flex-wrap gap-4 text-sm text-gray-500 mb-3">
                              <div className="flex items-center gap-1">
                                <MapPin className="h-4 w-4" />
                                {job.location}
                              </div>
                              <div className="flex items-center gap-1">
                                <Calendar className="h-4 w-4" />
                                {new Date(job.startDate).toLocaleDateString()}
                              </div>
                              <div className="flex items-center gap-1">
                                <Clock className="h-4 w-4" />
                                {job.startTime} {job.endTime && `- ${job.endTime}`}
                              </div>
                            </div>

                            <div className="flex flex-wrap gap-2 items-center">
                              <Badge className={getPriorityColor(job.priority)}>
                                {job.priority.toUpperCase()}
                              </Badge>
                              <Badge className={getStatusColor(job.status)} variant="secondary">
                                {job.status.replace('-', ' ').toUpperCase()}
                              </Badge>
                              <Badge variant="outline" className="text-xs">
                                {job.category}
                              </Badge>
                            </div>
                          </div>
                        </div>

                        {/* Checklist Progress */}
                        {job.checklistItems && job.checklistItems.length > 0 && (
                          <div className="mt-3 pt-3 border-t">
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2 text-sm text-gray-600">
                                <ListChecks className="h-4 w-4" />
                                <span>Checklist</span>
                                <Badge variant="secondary" className="text-xs">
                                  {getChecklistProgress(job.checklistItems)?.completed}/{getChecklistProgress(job.checklistItems)?.total}
                                </Badge>
                              </div>
                              {getChecklistProgress(job.checklistItems)?.percent === 100 && (
                                <Badge className="bg-green-100 text-green-800 text-xs">
                                  <CheckCircle2 className="h-3 w-3 mr-1" />
                                  Complete
                                </Badge>
                              )}
                            </div>
                            <Progress 
                              value={getChecklistProgress(job.checklistItems)?.percent || 0} 
                              className="h-2"
                            />
                          </div>
                        )}

                        <div className="flex items-center gap-2 mt-4 pt-4 border-t">
                          <Users className="h-4 w-4 text-gray-400" />
                          <div className="flex -space-x-2">
                            {job.assignedToNames?.slice(0, 3).map((name, idx) => (
                              <Avatar key={idx} className="h-8 w-8 border-2 border-white">
                                <AvatarFallback className="bg-pulse-forest text-white text-xs">
                                  {name.charAt(0)}
                                </AvatarFallback>
                              </Avatar>
                            ))}
                            {job.assignedToNames && job.assignedToNames.length > 3 && (
                              <div className="h-8 w-8 rounded-full bg-gray-200 border-2 border-white flex items-center justify-center text-xs font-medium">
                                +{job.assignedToNames.length - 3}
                              </div>
                            )}
                          </div>
                          <span className="text-sm text-gray-600 ml-2">
                            {job.assignedToNames?.join(', ')}
                          </span>
                        </div>
                      </div>

                      <div className="flex flex-col gap-2 ml-4">
                        {job.status === 'pending' && (
                          <Button
                            size="sm"
                            onClick={() => updateJobStatus(job.id, 'in-progress')}
                            className="bg-blue-600 hover:bg-blue-700 text-white"
                          >
                            Start
                          </Button>
                        )}
                        {job.status === 'in-progress' && (
                          <Button
                            size="sm"
                            onClick={() => updateJobStatus(job.id, 'completed')}
                            className="bg-green-600 hover:bg-green-700 text-white"
                          >
                            Complete
                          </Button>
                        )}
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => openJobDetail(job)}
                        >
                          <Eye className="h-4 w-4 mr-1" />
                          View
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        ) : (
          /* Map View */
          <Suspense fallback={
            <Card>
              <CardContent className="py-12 text-center">
                <Map className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500">Loading map...</p>
              </CardContent>
            </Card>
          }>
            <div className="space-y-4">
              {/* Map Statistics */}
              <div className="grid grid-cols-4 gap-4 mb-4">
                <Card>
                  <CardContent className="p-4 text-center">
                    <div className="text-2xl font-bold text-blue-600">{filteredMapJobs.length}</div>
                    <div className="text-sm text-gray-600">Jobs on Map</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 text-center">
                    <div className="text-2xl font-bold text-orange-600">{filteredMapJobs.filter(j => j.priority === 'urgent' || j.priority === 'high').length}</div>
                    <div className="text-sm text-gray-600">High Priority</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 text-center">
                    <div className="text-2xl font-bold text-green-600">{filteredMapJobs.filter(j => j.status === 'completed').length}</div>
                    <div className="text-sm text-gray-600">Completed</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 text-center">
                    <div className="text-2xl font-bold text-purple-600">{filteredMapJobs.filter(j => j.status === 'in-progress').length}</div>
                    <div className="text-sm text-gray-600">In Progress</div>
                  </CardContent>
                </Card>
              </div>

              {/* Farm Map */}
              <Card className="h-[600px]">
                <CardContent className="p-0 h-full">
                  <FarmMap
                    taskPins={filteredMapJobs.map(job => ({
                      id: job.id,
                      title: job.title,
                      description: job.description,
                      latitude: job.latitude?.toString() || '0',
                      longitude: job.longitude?.toString() || '0',
                      status: job.status === 'in-progress' ? 'in_progress' : job.status as 'pending' | 'completed' | 'cancelled',
                      priority: job.priority,
                      category: job.category,
                      dueDate: job.startDate,
                      assignedTo: job.assignedTo.join(','),
                      pastureId: null,
                      notes: job.notes || null,
                      completedAt: job.status === 'completed' ? new Date().toISOString() : null,
                      createdAt: job.createdAt,
                    }))}
                    paddocks={showPaddocks ? paddocks.map(p => ({
                      id: p.id,
                      name: p.name,
                      coordinates: p.boundaries,
                      color: p.status === 'active' ? '#22c55e' : '#eab308',
                      status: p.status,
                    })) : []}
                    center={[-40.9006, 175.6466]}
                    zoom={14}
                    onPinClick={(pin) => {
                      const job = filteredMapJobs.find(j => j.id === pin.id);
                      if (job) handleMapJobClick(job);
                    }}
                    showPaddocks={showPaddocks}
                    selectedPinId={selectedMapJob?.id}
                  />
                </CardContent>
              </Card>

              {/* Map Legend */}
              <Card>
                <CardContent className="p-4">
                  <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
                    <Layers className="h-4 w-4" />
                    Map Legend
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-xs">
                    <div className="space-y-2">
                      <div className="font-medium text-gray-700">Job Status</div>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full bg-green-500"></div>
                          <span>Completed</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                          <span>In Progress</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                          <span>Pending</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full bg-red-500"></div>
                          <span>Cancelled</span>
                        </div>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="font-medium text-gray-700">Priority</div>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full bg-red-600"></div>
                          <span>Urgent</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full bg-orange-600"></div>
                          <span>High</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full bg-yellow-600"></div>
                          <span>Medium</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full bg-green-600"></div>
                          <span>Low</span>
                        </div>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="font-medium text-gray-700">Map Features</div>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded bg-green-200 border border-green-400"></div>
                          <span>Active Paddocks</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded bg-yellow-200 border border-yellow-400"></div>
                          <span>Resting Paddocks</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 transform rotate-45 bg-purple-500 border-2 border-white"></div>
                          <span>Task Pins</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full bg-gray-400"></div>
                          <span>Completed Tasks</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="mt-4 pt-4 border-t">
                    <p className="text-xs text-gray-500">
                      <strong>Tip:</strong> Click on any task pin to view job details and update status. 
                      Toggle paddocks on/off using the layer controls above.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </Suspense>
        )}
      </div>

      {/* Job Detail Dialog with Full Checklist */}
      <Dialog open={isDetailDialogOpen} onOpenChange={setIsDetailDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          {selectedJob && (
            <>
              <DialogHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <DialogTitle className="text-xl">{selectedJob.title}</DialogTitle>
                    <p className="text-sm text-gray-500 mt-1">{selectedJob.description}</p>
                  </div>
                  <div className="flex gap-2">
                    <Badge className={getPriorityColor(selectedJob.priority)}>
                      {selectedJob.priority}
                    </Badge>
                    <Badge className={getStatusColor(selectedJob.status)} variant="secondary">
                      {selectedJob.status.replace('-', ' ')}
                    </Badge>
                  </div>
                </div>
              </DialogHeader>

              <div className="space-y-6 py-4">
                {/* Job Details */}
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-gray-400" />
                    <span>{selectedJob.location}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-gray-400" />
                    <span>{new Date(selectedJob.startDate).toLocaleDateString()}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-gray-400" />
                    <span>{selectedJob.startTime} {selectedJob.endTime && `- ${selectedJob.endTime}`}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-gray-400" />
                    <span>{selectedJob.assignedToNames?.join(', ')}</span>
                  </div>
                </div>

                {/* Location Map - Show if GPS coordinates exist */}
                {selectedJob.latitude && selectedJob.longitude && (
                  <div className="border rounded-lg overflow-hidden">
                    <div className="bg-muted/50 px-4 py-2 border-b flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-primary" />
                        <span className="text-sm font-medium">Pinned Location</span>
                      </div>
                      <a
                        href={`https://www.google.com/maps?q=${selectedJob.latitude},${selectedJob.longitude}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-primary hover:underline flex items-center gap-1"
                      >
                        <Navigation className="h-3 w-3" />
                        Open in Google Maps
                      </a>
                    </div>
                    <div className="h-48">
                      <Suspense fallback={<div className="h-full flex items-center justify-center bg-muted"><MapPin className="h-8 w-8 text-muted-foreground animate-pulse" /></div>}>
                        <JobLocationPicker
                          latitude={selectedJob.latitude}
                          longitude={selectedJob.longitude}
                          onLocationChange={() => {}}
                          className="pointer-events-none"
                        />
                      </Suspense>
                    </div>
                    <div className="bg-muted/30 px-4 py-2 text-xs text-muted-foreground">
                      GPS: {selectedJob.latitude.toFixed(6)}, {selectedJob.longitude.toFixed(6)}
                    </div>
                  </div>
                )}

                {/* Checklist Section */}
                {selectedJob.checklistItems && selectedJob.checklistItems.length > 0 ? (
                  <div className="border rounded-lg p-4">
                    <ChecklistManager
                      items={selectedJob.checklistItems}
                      onChange={(items) => updateJobChecklist(selectedJob.id, items)}
                      showProgress={true}
                      showCompletionDetails={true}
                      allowReorder={false}
                      allowAddItems={selectedJob.status !== 'completed'}
                      readOnly={selectedJob.status === 'completed'}
                      currentUserId="demo-user"
                      currentUserName="Current User"
                      title="Task Checklist"
                    />
                  </div>
                ) : (
                  <div className="border rounded-lg p-6 text-center text-gray-500">
                    <ListChecks className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No checklist items for this job</p>
                  </div>
                )}

                {/* Notes */}
                {selectedJob.notes && (
                  <div className="border rounded-lg p-4">
                    <h4 className="font-medium text-sm mb-2">Notes</h4>
                    <p className="text-sm text-gray-600">{selectedJob.notes}</p>
                  </div>
                )}
              </div>

              <DialogFooter>
                <div className="flex gap-2 w-full">
                  {selectedJob.status === 'pending' && (
                    <Button
                      onClick={() => {
                        updateJobStatus(selectedJob.id, 'in-progress');
                        setIsDetailDialogOpen(false);
                      }}
                      className="flex-1 bg-blue-600 hover:bg-blue-700"
                    >
                      Start Job
                    </Button>
                  )}
                  {selectedJob.status === 'in-progress' && (
                    <Button
                      onClick={() => {
                        // Check if all required items are complete
                        const requiredItems = selectedJob.checklistItems?.filter(i => i.required) || [];
                        const allRequiredComplete = requiredItems.every(i => i.completed);
                        
                        if (requiredItems.length > 0 && !allRequiredComplete) {
                          toast.error('Please complete all required checklist items before completing the job');
                          return;
                        }
                        
                        updateJobStatus(selectedJob.id, 'completed');
                        setIsDetailDialogOpen(false);
                      }}
                      className="flex-1 bg-green-600 hover:bg-green-700"
                    >
                      <CheckCircle2 className="h-4 w-4 mr-1" />
                      Complete Job
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    onClick={() => setIsDetailDialogOpen(false)}
                  >
                    Close
                  </Button>
                </div>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
