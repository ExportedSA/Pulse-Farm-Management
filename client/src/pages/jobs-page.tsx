import { useState, useEffect } from 'react';
import { pulseGet, pulsePost, pulsePatch } from '@/lib/pulseApi';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { Checkbox } from '@/components/ui/checkbox';
import { JobPhotoUpload } from '@/components/JobPhotoUpload';
import { JobLocationPicker } from '@/components/JobLocationPicker';
import { ChecklistManager, CompactChecklist, type ChecklistItem } from '@/components/ChecklistManager';
import { toast } from 'sonner';
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
  Eye
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
  }, []);

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
      // Create FormData for file upload
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
      
      // Reset form
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
      setIsCreateJobOpen(false);
      toast.success('Job created successfully');
    } catch (error) {
      console.error('Failed to create job:', error);
      alert('Failed to create job. Please try again.');
    }
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
                      <Input
                        value={newJob.location}
                        onChange={(e) => setNewJob({ ...newJob, location: e.target.value })}
                        placeholder="e.g., Paddock A"
                      />
                    </div>

                    <div>
                      <label className="text-sm font-medium mb-2 block">Category</label>
                      <Select value={newJob.category} onValueChange={(value) => setNewJob({ ...newJob, category: value })}>
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

                  <div>
                    <label className="text-sm font-medium mb-2 block">Assign To *</label>
                    <div className="space-y-2 max-h-48 overflow-y-auto border rounded-lg p-3">
                      {availableUsers.map(user => (
                        <label key={user.id} className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded cursor-pointer">
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
                  <div>
                    <label className="text-sm font-medium mb-2 block">Pin Location on Map</label>
                    <p className="text-xs text-gray-500 mb-3">Click on the map to set the exact location for this job</p>
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
                      Create Job
                    </Button>
                    <Button
                      onClick={() => setIsCreateJobOpen(false)}
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
          </div>
        </div>
      </div>

      {/* Jobs List */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
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
