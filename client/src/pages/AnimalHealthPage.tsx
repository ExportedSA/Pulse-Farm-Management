import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'wouter';
import { pulseGet, pulsePost } from '@/lib/pulseApi';
import { useChatWebSocket } from '@/hooks/useChatWebSocket';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Heart, 
  Plus, 
  ArrowLeft, 
  Calendar, 
  Stethoscope, 
  Syringe, 
  AlertTriangle,
  Eye,
  ClipboardCheck,
  MoreHorizontal,
  Loader2
} from 'lucide-react';
import { toast } from 'sonner';

// Types
interface HealthRecord {
  id: string;
  animalId: string;
  recordedById: string;
  date: string;
  type: 'illness' | 'treatment' | 'vaccination' | 'injury' | 'observation' | 'checkup' | 'other';
  description: string;
  notes: string | null;
  severity: 'low' | 'medium' | 'high' | 'critical' | null;
  treatmentId: string | null;
  vetVisitId: string | null;
  requiresFollowUp: boolean | null;
  followUpDate: string | null;
  followUpCompleted: boolean | null;
  createdAt: string;
  updatedAt: string;
}

interface Animal {
  id: string;
  visualId: string | null;
  name: string | null;
  breed: string | null;
  status: string;
}

const HEALTH_RECORD_TYPES = [
  { value: 'illness', label: 'Illness', icon: AlertTriangle },
  { value: 'treatment', label: 'Treatment', icon: Stethoscope },
  { value: 'vaccination', label: 'Vaccination', icon: Syringe },
  { value: 'injury', label: 'Injury', icon: AlertTriangle },
  { value: 'observation', label: 'Observation', icon: Eye },
  { value: 'checkup', label: 'Checkup', icon: ClipboardCheck },
  { value: 'other', label: 'Other', icon: MoreHorizontal },
];

const SEVERITY_LEVELS = [
  { value: 'low', label: 'Low', color: 'bg-green-100 text-green-800' },
  { value: 'medium', label: 'Medium', color: 'bg-yellow-100 text-yellow-800' },
  { value: 'high', label: 'High', color: 'bg-orange-100 text-orange-800' },
  { value: 'critical', label: 'Critical', color: 'bg-red-100 text-red-800' },
];

export default function AnimalHealthPage() {
  const params = useParams<{ animalId: string }>();
  const animalId = params.animalId;

  // State
  const [animal, setAnimal] = useState<Animal | null>(null);
  const [records, setRecords] = useState<HealthRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    type: 'observation' as HealthRecord['type'],
    description: '',
    notes: '',
    severity: 'low' as 'low' | 'medium' | 'high' | 'critical',
    requiresFollowUp: false,
    followUpDate: '',
  });

  // Handle real-time health record updates via WebSocket
  const handleNewHealthRecord = useCallback((recordAnimalId: string, record: HealthRecord) => {
    // Only update if the record is for the currently viewed animal
    if (recordAnimalId === animalId) {
      setRecords(prev => {
        // Check if record already exists (avoid duplicates)
        if (prev.some(r => r.id === record.id)) {
          return prev;
        }
        // Add new record at the beginning (newest first)
        return [record, ...prev];
      });
      toast.success('New health record added');
    }
  }, [animalId]);

  // Handle real-time notifications
  const handleNewNotification = useCallback((notification: any) => {
    // Show toast for animal health notifications
    if (notification.type === 'animal_health') {
      toast.info(notification.title, {
        description: notification.message,
      });
    }
  }, []);

  // WebSocket connection for real-time updates
  const { subscribeToChannel, unsubscribeFromChannel } = useChatWebSocket({
    onNewHealthRecord: handleNewHealthRecord,
    onNewNotification: handleNewNotification,
  });

  // Subscribe to animal channel for real-time updates
  useEffect(() => {
    if (animalId) {
      const channelId = `animal-${animalId}`;
      subscribeToChannel(channelId);
      
      return () => {
        unsubscribeFromChannel(channelId);
      };
    }
  }, [animalId, subscribeToChannel, unsubscribeFromChannel]);

  // Load animal and health records
  useEffect(() => {
    if (animalId) {
      loadData();
    }
  }, [animalId]);

  async function loadData() {
    setLoading(true);
    setError(null);
    try {
      const [animalData, recordsData] = await Promise.all([
        pulseGet<Animal>(`/animals/${animalId}`),
        pulseGet<HealthRecord[]>(`/animals/${animalId}/health`),
      ]);
      setAnimal(animalData);
      setRecords(recordsData);
    } catch (err) {
      console.error('Failed to load health data:', err);
      setError('Failed to load health records. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!animalId) return;

    setSubmitting(true);
    try {
      const payload = {
        date: formData.date,
        type: formData.type,
        description: formData.description,
        notes: formData.notes || undefined,
        severity: formData.severity,
        requiresFollowUp: formData.requiresFollowUp,
        followUpDate: formData.requiresFollowUp && formData.followUpDate ? formData.followUpDate : undefined,
      };

      const newRecord = await pulsePost<HealthRecord>(`/animals/${animalId}/health`, payload);
      setRecords(prev => [newRecord, ...prev]);
      
      // Reset form
      setFormData({
        date: new Date().toISOString().split('T')[0],
        type: 'observation',
        description: '',
        notes: '',
        severity: 'low',
        requiresFollowUp: false,
        followUpDate: '',
      });
      setShowForm(false);
      toast.success('Health record added successfully');
    } catch (err) {
      console.error('Failed to create health record:', err);
      toast.error('Failed to add health record. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  function getTypeIcon(type: string) {
    const typeConfig = HEALTH_RECORD_TYPES.find(t => t.value === type);
    return typeConfig?.icon || MoreHorizontal;
  }

  function getTypeLabel(type: string) {
    const typeConfig = HEALTH_RECORD_TYPES.find(t => t.value === type);
    return typeConfig?.label || type;
  }

  function getSeverityBadge(severity: string | null) {
    const config = SEVERITY_LEVELS.find(s => s.value === severity);
    if (!config) return null;
    return (
      <Badge variant="outline" className={config.color}>
        {config.label}
      </Badge>
    );
  }

  function formatDate(dateString: string) {
    return new Date(dateString).toLocaleDateString('en-NZ', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  }

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-pulse-forest" />
        <span className="ml-2">Loading health records...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8">
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <p className="text-red-800">{error}</p>
            <Button onClick={loadData} className="mt-4">
              Try Again
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <Link href="/app/animals">
          <Button variant="ghost" className="mb-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Animals
          </Button>
        </Link>
        
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <Heart className="h-8 w-8 text-pulse-forest" />
              Health Records
            </h1>
            {animal && (
              <p className="text-muted-foreground mt-2">
                {animal.name || animal.visualId || 'Unknown Animal'} 
                {animal.breed && ` • ${animal.breed}`}
              </p>
            )}
          </div>
          
          <Button 
            onClick={() => setShowForm(!showForm)}
            className="bg-pulse-forest hover:bg-pulse-forest-dark"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Record
          </Button>
        </div>
      </div>

      {/* New Record Form */}
      {showForm && (
        <Card className="mb-8 border-pulse-forest/20">
          <CardHeader>
            <CardTitle className="text-lg">New Health Record</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Date */}
                <div>
                  <label className="block text-sm font-medium mb-1">Date *</label>
                  <Input
                    type="date"
                    value={formData.date}
                    onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))}
                    required
                  />
                </div>

                {/* Type */}
                <div>
                  <label className="block text-sm font-medium mb-1">Type *</label>
                  <Select
                    value={formData.type}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, type: value as HealthRecord['type'] }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      {HEALTH_RECORD_TYPES.map(type => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Severity */}
                <div>
                  <label className="block text-sm font-medium mb-1">Severity</label>
                  <Select
                    value={formData.severity}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, severity: value as any }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select severity" />
                    </SelectTrigger>
                    <SelectContent>
                      {SEVERITY_LEVELS.map(level => (
                        <SelectItem key={level.value} value={level.value}>
                          {level.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium mb-1">Description *</label>
                <Textarea
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Describe the health event..."
                  required
                  rows={3}
                />
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium mb-1">Additional Notes</label>
                <Textarea
                  value={formData.notes}
                  onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder="Any additional notes..."
                  rows={2}
                />
              </div>

              {/* Follow-up */}
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.requiresFollowUp}
                    onChange={(e) => setFormData(prev => ({ ...prev, requiresFollowUp: e.target.checked }))}
                    className="rounded border-gray-300"
                  />
                  <span className="text-sm">Requires follow-up</span>
                </label>

                {formData.requiresFollowUp && (
                  <div className="flex items-center gap-2">
                    <label className="text-sm">Follow-up date:</label>
                    <Input
                      type="date"
                      value={formData.followUpDate}
                      onChange={(e) => setFormData(prev => ({ ...prev, followUpDate: e.target.value }))}
                      className="w-auto"
                    />
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-2 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowForm(false)}
                  disabled={submitting}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={submitting || !formData.description}
                  className="bg-pulse-forest hover:bg-pulse-forest-dark"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    'Save Record'
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Records List */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold">
          Health History ({records.length} records)
        </h2>

        {records.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Heart className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No health records yet</p>
              <Button 
                onClick={() => setShowForm(true)} 
                className="mt-4 bg-pulse-forest hover:bg-pulse-forest-dark"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add First Record
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {records.map(record => {
              const TypeIcon = getTypeIcon(record.type);
              return (
                <Card key={record.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="py-4">
                    <div className="flex items-start gap-4">
                      {/* Icon */}
                      <div className="p-2 rounded-full bg-pulse-forest/10">
                        <TypeIcon className="h-5 w-5 text-pulse-forest" />
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium">{getTypeLabel(record.type)}</span>
                          {getSeverityBadge(record.severity)}
                          {record.requiresFollowUp && !record.followUpCompleted && (
                            <Badge variant="outline" className="bg-blue-100 text-blue-800">
                              Follow-up needed
                            </Badge>
                          )}
                        </div>
                        
                        <p className="text-sm text-muted-foreground mb-2">
                          {record.description}
                        </p>

                        {record.notes && (
                          <p className="text-sm text-muted-foreground italic">
                            Notes: {record.notes}
                          </p>
                        )}

                        <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {formatDate(record.date)}
                          </span>
                          {record.followUpDate && (
                            <span>
                              Follow-up: {formatDate(record.followUpDate)}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
