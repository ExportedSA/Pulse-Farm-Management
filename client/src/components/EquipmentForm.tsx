import { useState } from 'react';
import { pulsePost, pulsePatch } from '@/lib/pulseApi';
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

interface EquipmentFormProps {
  existingEquipment?: Equipment | null;
  onSuccess: (equipment: Equipment) => void;
  onCancel: () => void;
}

// Equipment type options
const EQUIPMENT_TYPES = [
  'Tractor',
  'Harvester',
  'Irrigation System',
  'Milk Tank',
  'Milk Pump',
  'Cooling System',
  'Generator',
  'ATV/UTV',
  'Trailer',
  'Sprayer',
  'Mower',
  'Baler',
  'Feed Mixer',
  'Loader',
  'Drone',
  'Sensor',
  'Weather Station',
  'Fencing Equipment',
  'Water System',
  'Building',
  'Shed',
  'Other',
];

export default function EquipmentForm({ existingEquipment, onSuccess, onCancel }: EquipmentFormProps) {
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    name: existingEquipment?.name || '',
    type: existingEquipment?.type || '',
    model: existingEquipment?.model || '',
    serialNumber: existingEquipment?.serialNumber || '',
    manufacturer: existingEquipment?.manufacturer || '',
    yearManufactured: existingEquipment?.yearManufactured?.toString() || '',
    purchaseDate: existingEquipment?.purchaseDate || '',
    purchasePrice: existingEquipment?.purchasePrice || '',
    location: existingEquipment?.location || '',
    status: existingEquipment?.status || 'operational',
    serviceIntervalDays: existingEquipment?.serviceIntervalDays?.toString() || '',
    warrantyExpiry: existingEquipment?.warrantyExpiry || '',
    notes: existingEquipment?.notes || '',
  });

  const isEditing = !!existingEquipment;

  function handleChange(field: string, value: string) {
    setFormData(prev => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    // Validation
    if (!formData.name.trim()) {
      toast.error('Name is required');
      return;
    }
    if (!formData.type) {
      toast.error('Type is required');
      return;
    }

    setSaving(true);
    try {
      const payload: any = {
        name: formData.name.trim(),
        type: formData.type,
        status: formData.status,
      };

      // Add optional fields if provided
      if (formData.model) payload.model = formData.model;
      if (formData.serialNumber) payload.serialNumber = formData.serialNumber;
      if (formData.manufacturer) payload.manufacturer = formData.manufacturer;
      if (formData.yearManufactured) payload.yearManufactured = parseInt(formData.yearManufactured);
      if (formData.purchaseDate) payload.purchaseDate = formData.purchaseDate;
      if (formData.purchasePrice) payload.purchasePrice = formData.purchasePrice;
      if (formData.location) payload.location = formData.location;
      if (formData.serviceIntervalDays) payload.serviceIntervalDays = parseInt(formData.serviceIntervalDays);
      if (formData.warrantyExpiry) payload.warrantyExpiry = formData.warrantyExpiry;
      if (formData.notes) payload.notes = formData.notes;

      let result: Equipment;
      if (isEditing) {
        result = await pulsePatch<Equipment>(`/farm-equipment/${existingEquipment.id}`, payload);
        toast.success('Equipment updated successfully');
      } else {
        result = await pulsePost<Equipment>('/farm-equipment', payload);
        toast.success('Equipment created successfully');
      }

      onSuccess(result);
    } catch (err: any) {
      console.error('Failed to save equipment:', err);
      toast.error(err?.message || 'Failed to save equipment');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Basic Info */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="name">Name *</Label>
          <Input
            id="name"
            value={formData.name}
            onChange={(e) => handleChange('name', e.target.value)}
            placeholder="e.g., Tractor 1, Milk Tank A"
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="type">Type *</Label>
          <Select value={formData.type} onValueChange={(v) => handleChange('type', v)}>
            <SelectTrigger>
              <SelectValue placeholder="Select type" />
            </SelectTrigger>
            <SelectContent>
              {EQUIPMENT_TYPES.map(type => (
                <SelectItem key={type} value={type}>{type}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="manufacturer">Manufacturer</Label>
          <Input
            id="manufacturer"
            value={formData.manufacturer}
            onChange={(e) => handleChange('manufacturer', e.target.value)}
            placeholder="e.g., John Deere"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="model">Model</Label>
          <Input
            id="model"
            value={formData.model}
            onChange={(e) => handleChange('model', e.target.value)}
            placeholder="e.g., 6120M"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="serialNumber">Serial Number</Label>
          <Input
            id="serialNumber"
            value={formData.serialNumber}
            onChange={(e) => handleChange('serialNumber', e.target.value)}
            placeholder="Serial number"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="yearManufactured">Year Manufactured</Label>
          <Input
            id="yearManufactured"
            type="number"
            value={formData.yearManufactured}
            onChange={(e) => handleChange('yearManufactured', e.target.value)}
            placeholder="e.g., 2020"
            min="1900"
            max={new Date().getFullYear() + 1}
          />
        </div>
      </div>

      {/* Purchase Info */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="purchaseDate">Purchase Date</Label>
          <Input
            id="purchaseDate"
            type="date"
            value={formData.purchaseDate}
            onChange={(e) => handleChange('purchaseDate', e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="purchasePrice">Purchase Price ($)</Label>
          <Input
            id="purchasePrice"
            type="number"
            step="0.01"
            value={formData.purchasePrice}
            onChange={(e) => handleChange('purchasePrice', e.target.value)}
            placeholder="0.00"
          />
        </div>
      </div>

      {/* Location & Status */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="location">Location</Label>
          <Input
            id="location"
            value={formData.location}
            onChange={(e) => handleChange('location', e.target.value)}
            placeholder="e.g., Main Shed, Paddock 5"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="status">Status</Label>
          <Select value={formData.status} onValueChange={(v) => handleChange('status', v)}>
            <SelectTrigger>
              <SelectValue placeholder="Select status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="operational">Operational</SelectItem>
              <SelectItem value="maintenance_due">Maintenance Due</SelectItem>
              <SelectItem value="in_maintenance">In Maintenance</SelectItem>
              <SelectItem value="out_of_service">Out of Service</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Service Info */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="serviceIntervalDays">Service Interval (days)</Label>
          <Input
            id="serviceIntervalDays"
            type="number"
            value={formData.serviceIntervalDays}
            onChange={(e) => handleChange('serviceIntervalDays', e.target.value)}
            placeholder="e.g., 90"
            min="1"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="warrantyExpiry">Warranty Expiry</Label>
          <Input
            id="warrantyExpiry"
            type="date"
            value={formData.warrantyExpiry}
            onChange={(e) => handleChange('warrantyExpiry', e.target.value)}
          />
        </div>
      </div>

      {/* Notes */}
      <div className="space-y-2">
        <Label htmlFor="notes">Notes</Label>
        <Textarea
          id="notes"
          value={formData.notes}
          onChange={(e) => handleChange('notes', e.target.value)}
          placeholder="Additional notes about this equipment..."
          rows={3}
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
              {isEditing ? 'Updating...' : 'Creating...'}
            </>
          ) : (
            isEditing ? 'Update Equipment' : 'Create Equipment'
          )}
        </Button>
      </div>
    </form>
  );
}
