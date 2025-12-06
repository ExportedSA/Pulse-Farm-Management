import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import {
  Search,
  Clock,
  CheckCircle2,
  Star,
  Plus,
  Play,
  Repeat,
  Calendar,
  Users,
  MapPin,
  ChevronRight,
  ListChecks,
  Sparkles,
  Filter,
  BookTemplate,
  Zap,
  ArrowRight,
} from 'lucide-react';

interface ChecklistItem {
  text: string;
  required: boolean;
}

interface CategoryInfo {
  id: string;
  name: string;
  icon: string;
  color: string;
}

interface TaskTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  categoryInfo?: CategoryInfo;
  priority: string;
  estimatedDuration: number;
  defaultTime: string;
  checklistItems: ChecklistItem[];
  tags: string[];
  suggestedRecurrence: string | null;
  isPopular?: boolean;
  isCustom?: boolean;
}

interface User {
  id: string;
  name: string;
}

const PRIORITY_COLORS: Record<string, string> = {
  urgent: 'bg-red-500 text-white',
  high: 'bg-orange-500 text-white',
  medium: 'bg-yellow-500 text-black',
  low: 'bg-green-500 text-white',
};

const PRIORITY_LABELS: Record<string, string> = {
  urgent: '🔴 Urgent',
  high: '🟠 High',
  medium: '🟡 Medium',
  low: '🟢 Low',
};

// Mock users
const USERS: User[] = [
  { id: 'user-1', name: 'John Smith' },
  { id: 'user-2', name: 'Sarah Johnson' },
  { id: 'user-3', name: 'Mike Wilson' },
  { id: 'user-4', name: 'Emily Brown' },
];

export default function TaskTemplatesPage() {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedTemplate, setSelectedTemplate] = useState<TaskTemplate | null>(null);
  const [isUseDialogOpen, setIsUseDialogOpen] = useState(false);
  const [useMode, setUseMode] = useState<'job' | 'recurring'>('job');
  
  // Form state for creating from template
  const [createForm, setCreateForm] = useState({
    date: new Date().toISOString().split('T')[0],
    time: '',
    assignedTo: [] as string[],
    location: '',
    notes: '',
    recurrenceType: 'daily',
    recurrenceInterval: 1,
    recurrenceDays: [] as number[],
  });

  // Fetch categories
  const { data: categories = [] } = useQuery<CategoryInfo[]>({
    queryKey: ['templateCategories'],
    queryFn: async () => {
      const res = await fetch('/api/task-templates/categories');
      if (!res.ok) throw new Error('Failed to fetch categories');
      return res.json();
    },
  });

  // Fetch templates
  const { data: templates = [], isLoading } = useQuery<TaskTemplate[]>({
    queryKey: ['taskTemplates', selectedCategory, searchQuery],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedCategory !== 'all') params.append('category', selectedCategory);
      if (searchQuery) params.append('search', searchQuery);
      
      const res = await fetch(`/api/task-templates?${params}`);
      if (!res.ok) throw new Error('Failed to fetch templates');
      return res.json();
    },
  });

  // Fetch popular templates
  const { data: popularTemplates = [] } = useQuery<TaskTemplate[]>({
    queryKey: ['popularTemplates'],
    queryFn: async () => {
      const res = await fetch('/api/task-templates/popular');
      if (!res.ok) throw new Error('Failed to fetch popular templates');
      return res.json();
    },
  });

  // Create job from template
  const createJobMutation = useMutation({
    mutationFn: async (data: { templateId: string; formData: typeof createForm }) => {
      const res = await fetch(`/api/task-templates/${data.templateId}/create-job`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data.formData),
      });
      if (!res.ok) throw new Error('Failed to create job');
      return res.json();
    },
    onSuccess: () => {
      toast.success('Job created successfully!');
      setIsUseDialogOpen(false);
      setSelectedTemplate(null);
      resetForm();
    },
    onError: () => {
      toast.error('Failed to create job');
    },
  });

  // Create recurring task from template
  const createRecurringMutation = useMutation({
    mutationFn: async (data: { templateId: string; formData: typeof createForm }) => {
      const res = await fetch(`/api/task-templates/${data.templateId}/create-recurring`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data.formData),
      });
      if (!res.ok) throw new Error('Failed to create recurring task');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recurringTaskTemplates'] });
      toast.success('Recurring task created successfully!');
      setIsUseDialogOpen(false);
      setSelectedTemplate(null);
      resetForm();
    },
    onError: () => {
      toast.error('Failed to create recurring task');
    },
  });

  const resetForm = () => {
    setCreateForm({
      date: new Date().toISOString().split('T')[0],
      time: '',
      assignedTo: [],
      location: '',
      notes: '',
      recurrenceType: 'daily',
      recurrenceInterval: 1,
      recurrenceDays: [],
    });
  };

  const openUseDialog = (template: TaskTemplate, mode: 'job' | 'recurring') => {
    setSelectedTemplate(template);
    setUseMode(mode);
    setCreateForm(prev => ({
      ...prev,
      time: template.defaultTime,
      recurrenceType: template.suggestedRecurrence || 'daily',
    }));
    setIsUseDialogOpen(true);
  };

  const handleCreate = () => {
    if (!selectedTemplate) return;
    
    if (useMode === 'job') {
      createJobMutation.mutate({
        templateId: selectedTemplate.id,
        formData: createForm,
      });
    } else {
      createRecurringMutation.mutate({
        templateId: selectedTemplate.id,
        formData: createForm,
      });
    }
  };

  const formatDuration = (minutes: number) => {
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  };

  const groupedTemplates = templates.reduce((acc, template) => {
    const cat = template.category;
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(template);
    return acc;
  }, {} as Record<string, TaskTemplate[]>);

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <BookTemplate className="h-8 w-8 text-pulse-forest" />
            Task Templates
          </h1>
          <p className="text-muted-foreground mt-1">
            Pre-built templates for common farm tasks. Save time by starting from a template.
          </p>
        </div>
        <Button variant="outline">
          <Plus className="h-4 w-4 mr-2" />
          Create Custom Template
        </Button>
      </div>

      {/* Quick Start - Popular Templates */}
      <Card className="bg-gradient-to-r from-pulse-forest/10 to-pulse-forest/5 border-pulse-forest/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-yellow-500" />
            Quick Start - Popular Templates
          </CardTitle>
          <CardDescription>Most commonly used templates by farmers</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {popularTemplates.slice(0, 4).map((template) => (
              <Card 
                key={template.id} 
                className="cursor-pointer hover:shadow-md transition-shadow border-2 hover:border-pulse-forest/50"
                onClick={() => openUseDialog(template, 'job')}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="text-2xl">{template.categoryInfo?.icon}</div>
                    <Badge className={PRIORITY_COLORS[template.priority]} variant="secondary">
                      {template.priority}
                    </Badge>
                  </div>
                  <h4 className="font-semibold mt-2">{template.name}</h4>
                  <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                    {template.description}
                  </p>
                  <div className="flex items-center gap-2 mt-3 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    {formatDuration(template.estimatedDuration)}
                    <span className="mx-1">•</span>
                    <ListChecks className="h-3 w-3" />
                    {template.checklistItems?.length || 0} steps
                  </div>
                  <Button size="sm" className="w-full mt-3" variant="outline">
                    <Zap className="h-3 w-3 mr-1" />
                    Use Template
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Search and Filter */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search templates..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={selectedCategory} onValueChange={setSelectedCategory}>
          <SelectTrigger className="w-full sm:w-[200px]">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue placeholder="All Categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {categories.map((cat) => (
              <SelectItem key={cat.id} value={cat.id}>
                {cat.icon} {cat.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Template Browser */}
      {isLoading ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Loading templates...
          </CardContent>
        </Card>
      ) : templates.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <BookTemplate className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No templates found</p>
            <p className="text-sm">Try adjusting your search or filters</p>
          </CardContent>
        </Card>
      ) : selectedCategory === 'all' ? (
        // Grouped by category
        <div className="space-y-6">
          {Object.entries(groupedTemplates).map(([categoryId, categoryTemplates]) => {
            const categoryInfo = categories.find(c => c.id === categoryId);
            return (
              <div key={categoryId}>
                <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                  <span>{categoryInfo?.icon}</span>
                  {categoryInfo?.name || categoryId}
                  <Badge variant="secondary">{categoryTemplates.length}</Badge>
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {categoryTemplates.map((template) => (
                    <TemplateCard
                      key={template.id}
                      template={template}
                      onUseAsJob={() => openUseDialog(template, 'job')}
                      onUseAsRecurring={() => openUseDialog(template, 'recurring')}
                      formatDuration={formatDuration}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        // Flat list for single category
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {templates.map((template) => (
            <TemplateCard
              key={template.id}
              template={template}
              onUseAsJob={() => openUseDialog(template, 'job')}
              onUseAsRecurring={() => openUseDialog(template, 'recurring')}
              formatDuration={formatDuration}
            />
          ))}
        </div>
      )}

      {/* Use Template Dialog */}
      <Dialog open={isUseDialogOpen} onOpenChange={setIsUseDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {useMode === 'job' ? (
                <>
                  <Play className="h-5 w-5 text-green-500" />
                  Create Job from Template
                </>
              ) : (
                <>
                  <Repeat className="h-5 w-5 text-blue-500" />
                  Create Recurring Task
                </>
              )}
            </DialogTitle>
            <DialogDescription>
              {selectedTemplate?.name}
            </DialogDescription>
          </DialogHeader>

          {selectedTemplate && (
            <div className="space-y-4 py-4">
              {/* Template Preview */}
              <div className="bg-muted/50 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xl">{selectedTemplate.categoryInfo?.icon}</span>
                  <span className="font-medium">{selectedTemplate.name}</span>
                  <Badge className={PRIORITY_COLORS[selectedTemplate.priority]} variant="secondary">
                    {selectedTemplate.priority}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">{selectedTemplate.description}</p>
                <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {formatDuration(selectedTemplate.estimatedDuration)}
                  </span>
                  <span className="flex items-center gap-1">
                    <ListChecks className="h-3 w-3" />
                    {selectedTemplate.checklistItems?.length || 0} checklist items
                  </span>
                </div>
              </div>

              {/* Mode Toggle */}
              <div className="flex gap-2">
                <Button
                  variant={useMode === 'job' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setUseMode('job')}
                  className="flex-1"
                >
                  <Calendar className="h-4 w-4 mr-1" />
                  One-time Job
                </Button>
                <Button
                  variant={useMode === 'recurring' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setUseMode('recurring')}
                  className="flex-1"
                >
                  <Repeat className="h-4 w-4 mr-1" />
                  Recurring Task
                </Button>
              </div>

              {/* Job-specific fields */}
              {useMode === 'job' && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label>Date</Label>
                    <Input
                      type="date"
                      value={createForm.date}
                      onChange={(e) => setCreateForm({ ...createForm, date: e.target.value })}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label>Time</Label>
                    <Input
                      type="time"
                      value={createForm.time}
                      onChange={(e) => setCreateForm({ ...createForm, time: e.target.value })}
                    />
                  </div>
                </div>
              )}

              {/* Recurring-specific fields */}
              {useMode === 'recurring' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label>Repeat</Label>
                      <Select
                        value={createForm.recurrenceType}
                        onValueChange={(v) => setCreateForm({ ...createForm, recurrenceType: v })}
                      >
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
                    <div className="grid gap-2">
                      <Label>Start Date</Label>
                      <Input
                        type="date"
                        value={createForm.date}
                        onChange={(e) => setCreateForm({ ...createForm, date: e.target.value })}
                      />
                    </div>
                  </div>
                  {selectedTemplate.suggestedRecurrence && (
                    <p className="text-xs text-muted-foreground">
                      💡 Suggested: {selectedTemplate.suggestedRecurrence}
                    </p>
                  )}
                </div>
              )}

              {/* Common fields */}
              <div className="grid gap-2">
                <Label>Assign To</Label>
                <div className="flex flex-wrap gap-2">
                  {USERS.map((user) => (
                    <Button
                      key={user.id}
                      type="button"
                      variant={createForm.assignedTo.includes(user.id) ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => {
                        const assigned = createForm.assignedTo.includes(user.id)
                          ? createForm.assignedTo.filter(id => id !== user.id)
                          : [...createForm.assignedTo, user.id];
                        setCreateForm({ ...createForm, assignedTo: assigned });
                      }}
                    >
                      {user.name}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="grid gap-2">
                <Label>Location (Optional)</Label>
                <Input
                  placeholder="e.g., Paddock A, Dairy Shed"
                  value={createForm.location}
                  onChange={(e) => setCreateForm({ ...createForm, location: e.target.value })}
                />
              </div>

              {/* Checklist Preview */}
              {selectedTemplate.checklistItems && selectedTemplate.checklistItems.length > 0 && (
                <div className="border rounded-lg p-3">
                  <h4 className="font-medium text-sm mb-2 flex items-center gap-2">
                    <ListChecks className="h-4 w-4" />
                    Checklist Items ({selectedTemplate.checklistItems.length})
                  </h4>
                  <ScrollArea className="h-32">
                    <div className="space-y-1">
                      {selectedTemplate.checklistItems.map((item, index) => (
                        <div key={index} className="flex items-center gap-2 text-sm">
                          <CheckCircle2 className="h-3 w-3 text-muted-foreground" />
                          <span>{item.text}</span>
                          {item.required && (
                            <Badge variant="outline" className="text-xs">Required</Badge>
                          )}
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsUseDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              disabled={createJobMutation.isPending || createRecurringMutation.isPending}
              className="bg-pulse-forest hover:bg-pulse-forest-dark"
            >
              {createJobMutation.isPending || createRecurringMutation.isPending ? (
                'Creating...'
              ) : useMode === 'job' ? (
                <>
                  <Play className="h-4 w-4 mr-1" />
                  Create Job
                </>
              ) : (
                <>
                  <Repeat className="h-4 w-4 mr-1" />
                  Create Recurring Task
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Template Card Component
function TemplateCard({
  template,
  onUseAsJob,
  onUseAsRecurring,
  formatDuration,
}: {
  template: TaskTemplate;
  onUseAsJob: () => void;
  onUseAsRecurring: () => void;
  formatDuration: (minutes: number) => string;
}) {
  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="text-xl">{template.categoryInfo?.icon}</span>
            {template.isPopular && (
              <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
            )}
          </div>
          <Badge className={PRIORITY_COLORS[template.priority]} variant="secondary">
            {template.priority}
          </Badge>
        </div>
        
        <h4 className="font-semibold">{template.name}</h4>
        <p className="text-sm text-muted-foreground line-clamp-2 mt-1 min-h-[40px]">
          {template.description}
        </p>
        
        <div className="flex items-center gap-3 mt-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {formatDuration(template.estimatedDuration)}
          </span>
          <span className="flex items-center gap-1">
            <ListChecks className="h-3 w-3" />
            {template.checklistItems?.length || 0} steps
          </span>
          {template.suggestedRecurrence && (
            <span className="flex items-center gap-1">
              <Repeat className="h-3 w-3" />
              {template.suggestedRecurrence}
            </span>
          )}
        </div>

        {template.tags && template.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {template.tags.slice(0, 3).map((tag) => (
              <Badge key={tag} variant="outline" className="text-xs">
                {tag}
              </Badge>
            ))}
          </div>
        )}

        <div className="flex gap-2 mt-4">
          <Button size="sm" variant="outline" className="flex-1" onClick={onUseAsJob}>
            <Play className="h-3 w-3 mr-1" />
            Job
          </Button>
          <Button size="sm" variant="outline" className="flex-1" onClick={onUseAsRecurring}>
            <Repeat className="h-3 w-3 mr-1" />
            Recurring
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
