import { useState, useEffect } from 'react';
import { pulsePost, pulsePatch } from '@/lib/pulseApi';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Save, X } from 'lucide-react';
import { toast } from 'sonner';

// Types
interface Task {
  id: string;
  farmId: string;
  jobId: string | null;
  title: string;
  description: string | null;
  status: 'pending' | 'in_progress' | 'done' | 'cancelled';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  assignedToId: string | null;
  createdById: string;
  dueDate: string | null;
  startDate: string | null;
  completedAt: string | null;
  completedById: string | null;
  estimatedMinutes: number | null;
  actualMinutes: number | null;
  location: string | null;
  checklistItems: { id: string; text: string; completed: boolean }[] | null;
  tags: string[] | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
}

interface TaskFormProps {
  existingTask?: Task | null;
  users: User[];
  onSuccess: (task: Task) => void;
  onCancel: () => void;
}

interface FormData {
  title: string;
  description: string;
  assignedToId: string;
  dueDate: string;
  startDate: string;
  priority: string;
  status: string;
  estimatedMinutes: string;
  location: string;
  notes: string;
}

export default function TaskForm({ existingTask, users, onSuccess, onCancel }: TaskFormProps) {
  const isEditing = !!existingTask;
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState<FormData>({
    title: '',
    description: '',
    assignedToId: '',
    dueDate: '',
    startDate: '',
    priority: 'medium',
    status: 'pending',
    estimatedMinutes: '',
    location: '',
    notes: '',
  });

  // Initialize form with existing task data
  useEffect(() => {
    if (existingTask) {
      setFormData({
        title: existingTask.title || '',
        description: existingTask.description || '',
        assignedToId: existingTask.assignedToId || '',
        dueDate: existingTask.dueDate ? existingTask.dueDate.split('T')[0] : '',
        startDate: existingTask.startDate ? existingTask.startDate.split('T')[0] : '',
        priority: existingTask.priority || 'medium',
        status: existingTask.status || 'pending',
        estimatedMinutes: existingTask.estimatedMinutes?.toString() || '',
        location: existingTask.location || '',
        notes: existingTask.notes || '',
      });
    }
  }, [existingTask]);

  function handleChange(field: keyof FormData, value: string) {
    setFormData(prev => ({ ...prev, [field]: value }));
    setError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    
    if (!formData.title.trim()) {
      setError('Title is required');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      // Build payload
      const payload: Record<string, any> = {
        title: formData.title.trim(),
      };

      if (formData.description) payload.description = formData.description;
      if (formData.assignedToId) payload.assignedToId = formData.assignedToId;
      if (formData.dueDate) payload.dueDate = new Date(formData.dueDate).toISOString();
      if (formData.startDate) payload.startDate = new Date(formData.startDate).toISOString();
      if (formData.priority) payload.priority = formData.priority;
      if (formData.estimatedMinutes) payload.estimatedMinutes = parseInt(formData.estimatedMinutes);
      if (formData.location) payload.location = formData.location;
      if (formData.notes) payload.notes = formData.notes;

      // Include status only when editing
      if (isEditing && formData.status) {
        payload.status = formData.status;
      }

      let result: Task;

      if (isEditing && existingTask) {
        result = await pulsePatch<Task>(`/tasks/${existingTask.id}`, payload);
        toast.success('Task updated successfully');
      } else {
        result = await pulsePost<Task>('/tasks', payload);
        toast.success('Task created successfully');
      }

      onSuccess(result);
    } catch (err: any) {
      console.error('Failed to save task:', err);
      const errorMessage = err?.message || 'Failed to save task';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm">
          {error}
        </div>
      )}

      {/* Title */}
      <div className="space-y-2">
        <Label htmlFor="title">Title *</Label>
        <Input
          id="title"
          value={formData.title}
          onChange={(e) => handleChange('title', e.target.value)}
          placeholder="Enter task title"
          required
        />
      </div>

      {/* Description */}
      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          value={formData.description}
          onChange={(e) => handleChange('description', e.target.value)}
          placeholder="Describe the task..."
          rows={3}
        />
      </div>

      {/* Two column layout */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Assignee */}
        <div className="space-y-2">
          <Label htmlFor="assignedToId">Assign To</Label>
          <Select value={formData.assignedToId} onValueChange={(v) => handleChange('assignedToId', v)}>
            <SelectTrigger>
              <SelectValue placeholder="Select assignee" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">Unassigned</SelectItem>
              {users.map(user => (
                <SelectItem key={user.id} value={user.id}>
                  {user.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Priority */}
        <div className="space-y-2">
          <Label htmlFor="priority">Priority</Label>
          <Select value={formData.priority} onValueChange={(v) => handleChange('priority', v)}>
            <SelectTrigger>
              <SelectValue placeholder="Select priority" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="low">Low</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="urgent">Urgent</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Due Date */}
        <div className="space-y-2">
          <Label htmlFor="dueDate">Due Date</Label>
          <Input
            id="dueDate"
            type="date"
            value={formData.dueDate}
            onChange={(e) => handleChange('dueDate', e.target.value)}
          />
        </div>

        {/* Start Date */}
        <div className="space-y-2">
          <Label htmlFor="startDate">Start Date</Label>
          <Input
            id="startDate"
            type="date"
            value={formData.startDate}
            onChange={(e) => handleChange('startDate', e.target.value)}
          />
        </div>

        {/* Estimated Time */}
        <div className="space-y-2">
          <Label htmlFor="estimatedMinutes">Estimated Time (minutes)</Label>
          <Input
            id="estimatedMinutes"
            type="number"
            value={formData.estimatedMinutes}
            onChange={(e) => handleChange('estimatedMinutes', e.target.value)}
            placeholder="e.g., 60"
            min="1"
          />
        </div>

        {/* Status (only for editing) */}
        {isEditing && (
          <div className="space-y-2">
            <Label htmlFor="status">Status</Label>
            <Select value={formData.status} onValueChange={(v) => handleChange('status', v)}>
              <SelectTrigger>
                <SelectValue placeholder="Select status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="done">Done</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {/* Location */}
      <div className="space-y-2">
        <Label htmlFor="location">Location</Label>
        <Input
          id="location"
          value={formData.location}
          onChange={(e) => handleChange('location', e.target.value)}
          placeholder="e.g., North Paddock"
        />
      </div>

      {/* Notes */}
      <div className="space-y-2">
        <Label htmlFor="notes">Notes</Label>
        <Textarea
          id="notes"
          value={formData.notes}
          onChange={(e) => handleChange('notes', e.target.value)}
          placeholder="Additional notes..."
          rows={2}
        />
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-3 pt-4 border-t">
        <Button type="button" variant="outline" onClick={onCancel} disabled={submitting}>
          <X className="h-4 w-4 mr-2" />
          Cancel
        </Button>
        <Button type="submit" disabled={submitting} className="bg-pulse-green-600 hover:bg-pulse-green-700">
          {submitting ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              {isEditing ? 'Updating...' : 'Creating...'}
            </>
          ) : (
            <>
              <Save className="h-4 w-4 mr-2" />
              {isEditing ? 'Update Task' : 'Create Task'}
            </>
          )}
        </Button>
      </div>
    </form>
  );
}
