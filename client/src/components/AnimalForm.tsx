import { useState, useEffect } from 'react';
import { pulsePost, pulsePatch } from '@/lib/pulseApi';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Save, X } from 'lucide-react';
import { toast } from 'sonner';

// Types
interface Animal {
  id: string;
  farmId: string | null;
  visualId: string | null;
  lifetimeId: string | null;
  nationalId: string | null;
  naitTag: string | null;
  eid: string | null;
  name: string | null;
  breed: string | null;
  breedType: string | null;
  origin: string | null;
  dateOfBirth: string | null;
  yearBorn: number | null;
  sex: 'female' | 'male' | null;
  herd: string | null;
  status: 'active' | 'sold' | 'deceased';
  milkStatus: string | null;
  a2Status: string | null;
  notes: string | null;
  damId: string | null;
  sireId: string | null;
}

interface AnimalFormProps {
  existingAnimal?: Animal | null;
  onSuccess: (animal: Animal) => void;
  onCancel?: () => void;
}

interface FormData {
  visualId: string;
  lifetimeId: string;
  nationalId: string;
  naitTag: string;
  eid: string;
  name: string;
  breed: string;
  breedType: string;
  origin: string;
  dateOfBirth: string;
  yearBorn: string;
  sex: string;
  herd: string;
  status: string;
  milkStatus: string;
  a2Status: string;
  notes: string;
}

const BREED_OPTIONS = [
  'Holstein Friesian',
  'Jersey',
  'Ayrshire',
  'Crossbred',
  'Angus',
  'Hereford',
  'Shorthorn',
  'Charolais',
  'Simmental',
  'Other',
];

const BREED_TYPE_OPTIONS = [
  'Dairy',
  'Beef',
  'Dairy Cross',
  'Beef Cross',
  'Dual Purpose',
];

const HERD_OPTIONS = [
  'Main Herd',
  'Beef Herd',
  'Young Stock',
  'Dry Cows',
  'Milking Herd',
];

const MILK_STATUS_OPTIONS = [
  'In Milk',
  'Dry',
  'Not Applicable',
];

const A2_STATUS_OPTIONS = [
  'A2/A2',
  'A1/A2',
  'A1/A1',
  'Unknown',
];

export default function AnimalForm({ existingAnimal, onSuccess, onCancel }: AnimalFormProps) {
  const isEditing = !!existingAnimal;
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState<FormData>({
    visualId: '',
    lifetimeId: '',
    nationalId: '',
    naitTag: '',
    eid: '',
    name: '',
    breed: '',
    breedType: '',
    origin: '',
    dateOfBirth: '',
    yearBorn: '',
    sex: '',
    herd: '',
    status: 'active',
    milkStatus: '',
    a2Status: '',
    notes: '',
  });

  // Initialize form with existing animal data
  useEffect(() => {
    if (existingAnimal) {
      setFormData({
        visualId: existingAnimal.visualId || '',
        lifetimeId: existingAnimal.lifetimeId || '',
        nationalId: existingAnimal.nationalId || '',
        naitTag: existingAnimal.naitTag || '',
        eid: existingAnimal.eid || '',
        name: existingAnimal.name || '',
        breed: existingAnimal.breed || '',
        breedType: existingAnimal.breedType || '',
        origin: existingAnimal.origin || '',
        dateOfBirth: existingAnimal.dateOfBirth || '',
        yearBorn: existingAnimal.yearBorn?.toString() || '',
        sex: existingAnimal.sex || '',
        herd: existingAnimal.herd || '',
        status: existingAnimal.status || 'active',
        milkStatus: existingAnimal.milkStatus || '',
        a2Status: existingAnimal.a2Status || '',
        notes: existingAnimal.notes || '',
      });
    }
  }, [existingAnimal]);

  function handleChange(field: keyof FormData, value: string) {
    setFormData(prev => ({ ...prev, [field]: value }));
    setError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      // Build payload - only include non-empty values
      const payload: Record<string, any> = {};
      
      if (formData.visualId) payload.visualId = formData.visualId;
      if (formData.lifetimeId) payload.lifetimeId = formData.lifetimeId;
      if (formData.nationalId) payload.nationalId = formData.nationalId;
      if (formData.naitTag) payload.naitTag = formData.naitTag;
      if (formData.eid) payload.eid = formData.eid;
      if (formData.name) payload.name = formData.name;
      if (formData.breed) payload.breed = formData.breed;
      if (formData.breedType) payload.breedType = formData.breedType;
      if (formData.origin) payload.origin = formData.origin;
      if (formData.dateOfBirth) payload.dateOfBirth = formData.dateOfBirth;
      if (formData.yearBorn) payload.yearBorn = parseInt(formData.yearBorn);
      if (formData.sex) payload.sex = formData.sex;
      if (formData.herd) payload.herd = formData.herd;
      if (formData.status) payload.status = formData.status;
      if (formData.milkStatus) payload.milkStatus = formData.milkStatus;
      if (formData.a2Status) payload.a2Status = formData.a2Status;
      if (formData.notes) payload.notes = formData.notes;

      let result: Animal;

      if (isEditing && existingAnimal) {
        // Update existing animal
        result = await pulsePatch<Animal>(`/animals/${existingAnimal.id}`, payload);
        toast.success('Animal updated successfully');
      } else {
        // Create new animal
        result = await pulsePost<Animal>('/animals', payload);
        toast.success('Animal created successfully');
      }

      onSuccess(result);
    } catch (err: any) {
      console.error('Failed to save animal:', err);
      const errorMessage = err?.message || 'Failed to save animal. Please try again.';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{isEditing ? 'Edit Animal' : 'Add New Animal'}</CardTitle>
        <CardDescription>
          {isEditing
            ? 'Update the animal\'s information below.'
            : 'Enter the details for the new animal.'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm">
              {error}
            </div>
          )}

          {/* Basic Information */}
          <div className="space-y-4">
            <h3 className="font-medium text-gray-900">Basic Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => handleChange('name', e.target.value)}
                  placeholder="e.g., Daisy"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="visualId">Visual ID (Tag Number)</Label>
                <Input
                  id="visualId"
                  value={formData.visualId}
                  onChange={(e) => handleChange('visualId', e.target.value)}
                  placeholder="e.g., VID1001"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="breed">Breed</Label>
                <Select value={formData.breed} onValueChange={(v) => handleChange('breed', v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select breed" />
                  </SelectTrigger>
                  <SelectContent>
                    {BREED_OPTIONS.map((breed) => (
                      <SelectItem key={breed} value={breed}>
                        {breed}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="breedType">Breed Type</Label>
                <Select value={formData.breedType} onValueChange={(v) => handleChange('breedType', v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    {BREED_TYPE_OPTIONS.map((type) => (
                      <SelectItem key={type} value={type}>
                        {type}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="sex">Sex</Label>
                <Select value={formData.sex} onValueChange={(v) => handleChange('sex', v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select sex" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="female">Female</SelectItem>
                    <SelectItem value="male">Male</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Select value={formData.status} onValueChange={(v) => handleChange('status', v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="sold">Sold</SelectItem>
                    <SelectItem value="deceased">Deceased</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Birth & Origin */}
          <div className="space-y-4">
            <h3 className="font-medium text-gray-900">Birth & Origin</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="dateOfBirth">Date of Birth</Label>
                <Input
                  id="dateOfBirth"
                  type="date"
                  value={formData.dateOfBirth}
                  onChange={(e) => handleChange('dateOfBirth', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="yearBorn">Year Born</Label>
                <Input
                  id="yearBorn"
                  type="number"
                  value={formData.yearBorn}
                  onChange={(e) => handleChange('yearBorn', e.target.value)}
                  placeholder="e.g., 2020"
                  min="1990"
                  max={new Date().getFullYear()}
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="origin">Origin</Label>
                <Input
                  id="origin"
                  value={formData.origin}
                  onChange={(e) => handleChange('origin', e.target.value)}
                  placeholder="e.g., Home bred, Purchased - Smith Farm"
                />
              </div>
            </div>
          </div>

          {/* Identification */}
          <div className="space-y-4">
            <h3 className="font-medium text-gray-900">Identification Numbers</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="lifetimeId">Lifetime ID (LID)</Label>
                <Input
                  id="lifetimeId"
                  value={formData.lifetimeId}
                  onChange={(e) => handleChange('lifetimeId', e.target.value)}
                  placeholder="NAIT birth tag"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="nationalId">National ID</Label>
                <Input
                  id="nationalId"
                  value={formData.nationalId}
                  onChange={(e) => handleChange('nationalId', e.target.value)}
                  placeholder="National compliance ID"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="naitTag">NAIT Tag</Label>
                <Input
                  id="naitTag"
                  value={formData.naitTag}
                  onChange={(e) => handleChange('naitTag', e.target.value)}
                  placeholder="NAIT location number"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="eid">Electronic ID (EID)</Label>
                <Input
                  id="eid"
                  value={formData.eid}
                  onChange={(e) => handleChange('eid', e.target.value)}
                  placeholder="RFID tag number"
                />
              </div>
            </div>
          </div>

          {/* Herd & Production */}
          <div className="space-y-4">
            <h3 className="font-medium text-gray-900">Herd & Production</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="herd">Herd</Label>
                <Select value={formData.herd} onValueChange={(v) => handleChange('herd', v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select herd" />
                  </SelectTrigger>
                  <SelectContent>
                    {HERD_OPTIONS.map((herd) => (
                      <SelectItem key={herd} value={herd}>
                        {herd}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="milkStatus">Milk Status</Label>
                <Select value={formData.milkStatus} onValueChange={(v) => handleChange('milkStatus', v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    {MILK_STATUS_OPTIONS.map((status) => (
                      <SelectItem key={status} value={status}>
                        {status}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="a2Status">A2 Status</Label>
                <Select value={formData.a2Status} onValueChange={(v) => handleChange('a2Status', v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    {A2_STATUS_OPTIONS.map((status) => (
                      <SelectItem key={status} value={status}>
                        {status}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => handleChange('notes', e.target.value)}
              placeholder="Additional notes about this animal..."
              rows={3}
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t">
            {onCancel && (
              <Button type="button" variant="outline" onClick={onCancel} disabled={submitting}>
                <X className="h-4 w-4 mr-2" />
                Cancel
              </Button>
            )}
            <Button type="submit" disabled={submitting} className="bg-pulse-green-600 hover:bg-pulse-green-700">
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {isEditing ? 'Updating...' : 'Creating...'}
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  {isEditing ? 'Update Animal' : 'Create Animal'}
                </>
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
