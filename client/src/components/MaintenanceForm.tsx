import { useState } from 'react';
import { pulsePost } from '@/lib/pulseApi';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

// Types
interface Equipment {
  id: string;
  farmId: string;
  name: string;
  type: string;
  model: string | null;
  serialNumber: string | null;
  manufacturer: string | null;
  yearManufactured: number | null;
  purchaseDate: string | null;
  purchasePrice: string | null;
  location: string | null;
  status: 'operational' | 'maintenance_due' | 'in_maintenance' | 'out_of_service';
  lastServiceDate: string | null;
  nextServiceDue: string | null;
  serviceIntervalDays: number | null;
  warrantyExpiry: string | null;
  notes: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface MaintenanceRecord {
  id: string;
  equipmentId: string;
  serviceDate: string;
  serviceType: string;
  description: string | null;
  cost: string | null;
  performedBy: string | null;
  nextServiceDue: string | null;
  notes: string | null;
  createdAt: string;
}

interface MaintenanceFormProps {
  equipmentId: string;
  onSuccess: (record: MaintenanceRecord, equipment: Equipment) => void;
  onCancel: () => void;
}

// Service type options
const SERVICE_TYPES = [
  'Routine Maintenance',
  'Repair',
  'Inspection',
  'Oil Change',
  'Filter Replacement',
  'Calibration',
  'Cleaning',
  'Part Replacement',
  'Safety Check',
  'Warranty Service',
  'Emergency Repair',
  'Other',
];

export default function MaintenanceForm({ equipmentId, onSuccess, onCancel }: MaintenanceFormProps) {
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    serviceDate: new Date().toISOString().split('T')[0],
    serviceType: '',
    description: '',
    cost: '',
    performedBy: '',
    nextServiceDue: '',
    notes: '',
  });

  function handleChange(field: string, value: string) {
    setFormData(prev => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    // Validation
    if (!formData.serviceDate) {
      toast.error('Service date is required');
      return;
    }
    if (!formData.serviceType) {
      toast.error('Service type is required');
      return;
    }

    setSaving(true);
    try {
      const payload: any = {
        serviceDate: formData.serviceDate,
        serviceType: formData.serviceType,
      };

      // Add optional fields if provided
      if (formData.description) payload.description = formData.description;
      if (formData.cost) payload.cost = formData.cost;
      if (formData.performedBy) payload.performedBy = formData.performedBy;
      if (formData.nextServiceDue) payload.nextServiceDue = formData.nextServiceDue;
      if (formData.notes) payload.notes = formData.notes;

      const result = await pulsePost<{ record: MaintenanceRecord; equipment: Equipment }>(
        `/farm-equipment/${equipmentId}/log-service`,
        payload
      );

      onSuccess(result.record, result.equipment);
    } catch (err: any) {
      console.error('Failed to log maintenance:', err);
      toast.error(err?.message || 'Failed to log maintenance');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Date and Type */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="serviceDate">Service Date *</Label>
          <Input
            id="serviceDate"
            type="date"
            value={formData.serviceDate}
            onChange={(e) => handleChange('serviceDate', e.target.value)}
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="serviceType">Service Type *</Label>
          <Select value={formData.serviceType} onValueChange={(v) => handleChange('serviceType', v)}>
            <SelectTrigger>
              <SelectValue placeholder="Select type" />
            </SelectTrigger>
            <SelectContent>
              {SERVICE_TYPES.map(type => (
                <SelectItem key={type} value={type}>{type}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Description */}
      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          value={formData.description}
          onChange={(e) => handleChange('description', e.target.value)}
          placeholder="Describe the maintenance work performed..."
          rows={3}
        />
      </div>

      {/* Cost and Performed By */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="cost">Cost ($)</Label>
          <Input
            id="cost"
            type="number"
            step="0.01"
            value={formData.cost}
            onChange={(e) => handleChange('cost', e.target.value)}
            placeholder="0.00"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="performedBy">Performed By</Label>
          <Input
            id="performedBy"
            value={formData.performedBy}
            onChange={(e) => handleChange('performedBy', e.target.value)}
            placeholder="Name of person or company"
          />
        </div>
      </div>

      {/* Next Service Due */}
      <div className="space-y-2">
        <Label htmlFor="nextServiceDue">Next Service Due</Label>
        <Input
          id="nextServiceDue"
          type="date"
          value={formData.nextServiceDue}
          onChange={(e) => handleChange('nextServiceDue', e.target.value)}
        />
        <p className="text-sm text-gray-500">
          Setting this will update the equipment's next service due date
        </p>
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
      <div className="flex justify-end gap-3 pt-4">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button 
          type="submit" 
          disabled={saving}
          className="bg-pulse-green-600 hover:bg-pulse-green-700"
        >
          {saving ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : (
            'Log Maintenance'
          )}
        </Button>
      </div>
    </form>
  );
}
