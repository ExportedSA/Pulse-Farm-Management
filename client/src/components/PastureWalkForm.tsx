import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Ruler, Calendar, User, Save, Plus } from 'lucide-react';

interface Pasture {
  id: string;
  name: string;
  area: number;
}

interface PastureWalkFormProps {
  pastures: Pasture[];
  onSubmit: (data: PastureMeasurementData) => void;
  loading?: boolean;
}

interface PastureMeasurementData {
  pasture_id: string;
  cover_kg_dm_ha: number;
  measurement_method: 'plate_meter' | 'visual' | 'satellite';
  pre_or_post: 'pre' | 'post';
  notes?: string;
  plate_reading?: number;
}

const PastureWalkForm: React.FC<PastureWalkFormProps> = ({ 
  pastures, 
  onSubmit, 
  loading = false 
}) => {
  const [formData, setFormData] = useState<PastureMeasurementData>({
    pasture_id: '',
    cover_kg_dm_ha: 0,
    measurement_method: 'plate_meter',
    pre_or_post: 'pre',
    notes: '',
    plate_reading: 0,
  });

  const [quickEntries, setQuickEntries] = useState<Record<string, { cover: number; plate?: number }>>({});

  // Convert plate meter reading to kg DM/ha (simplified formula)
  const plateToCover = (plateReading: number): number => {
    return Math.round(plateReading * 140 + 500); // Simplified conversion
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.pasture_id || formData.cover_kg_dm_ha <= 0) {
      return;
    }
    onSubmit(formData);
  };

  const handleQuickEntry = (pastureId: string, cover: number, plate?: number) => {
    const entry: PastureMeasurementData = {
      pasture_id: pastureId,
      cover_kg_dm_ha: cover,
      measurement_method: plate ? 'plate_meter' : 'visual',
      pre_or_post: 'pre',
      plate_reading: plate,
    };
    onSubmit(entry);
  };

  const handlePlateChange = (plateReading: number) => {
    const cover = plateToCover(plateReading);
    setFormData({
      ...formData,
      plate_reading: plateReading,
      cover_kg_dm_ha: cover,
    });
  };

  const handleCoverChange = (cover: number) => {
    setFormData({
      ...formData,
      cover_kg_dm_ha: cover,
      plate_reading: undefined,
    });
  };

  return (
    <div className="space-y-6">
      {/* Quick Entry Cards */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5" />
            Quick Cover Entry
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {pastures.slice(0, 6).map((pasture) => (
              <div key={pasture.id} className="p-4 border rounded-lg">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h4 className="font-medium">{pasture.name}</h4>
                    <p className="text-sm text-muted-foreground">{pasture.area} ha</p>
                  </div>
                  <Badge variant="outline">{pasture.area} ha</Badge>
                </div>
                
                <div className="space-y-3">
                  <div>
                    <Label className="text-sm">Cover (kg DM/ha)</Label>
                    <Input
                      type="number"
                      placeholder="2500"
                      value={quickEntries[pasture.id]?.cover || ''}
                      onChange={(e) => {
                        const cover = parseInt(e.target.value) || 0;
                        setQuickEntries(prev => ({
                          ...prev,
                          [pasture.id]: { cover }
                        }));
                      }}
                    />
                  </div>
                  
                  <Button
                    size="sm"
                    className="w-full"
                    onClick={() => {
                      const entry = quickEntries[pasture.id];
                      if (entry && entry.cover > 0) {
                        handleQuickEntry(pasture.id, entry.cover);
                        setQuickEntries(prev => {
                          const newEntries = { ...prev };
                          delete newEntries[pasture.id];
                          return newEntries;
                        });
                      }
                    }}
                    disabled={!quickEntries[pasture.id]?.cover || quickEntries[pasture.id]?.cover <= 0}
                  >
                    <Save className="h-3 w-3 mr-1" />
                    Save
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Detailed Measurement Form */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Ruler className="h-5 w-5" />
            Detailed Measurement Entry
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Pasture Selection */}
              <div className="space-y-2">
                <Label htmlFor="pasture">Paddock</Label>
                <Select
                  value={formData.pasture_id}
                  onValueChange={(value) => setFormData({ ...formData, pasture_id: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a paddock" />
                  </SelectTrigger>
                  <SelectContent>
                    {pastures.map((pasture) => (
                      <SelectItem key={pasture.id} value={pasture.id}>
                        {pasture.name} ({pasture.area} ha)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Measurement Method */}
              <div className="space-y-2">
                <Label htmlFor="method">Measurement Method</Label>
                <Select
                  value={formData.measurement_method}
                  onValueChange={(value: any) => setFormData({ ...formData, measurement_method: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="plate_meter">Plate Meter</SelectItem>
                    <SelectItem value="visual">Visual Estimation</SelectItem>
                    <SelectItem value="satellite">Satellite Data</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Plate Meter Reading */}
              {formData.measurement_method === 'plate_meter' && (
                <div className="space-y-2">
                  <Label htmlFor="plate">Plate Reading (cm)</Label>
                  <Input
                    id="plate"
                    type="number"
                    step="0.1"
                    placeholder="4.5"
                    value={formData.plate_reading || ''}
                    onChange={(e) => handlePlateChange(parseFloat(e.target.value) || 0)}
                  />
                  <p className="text-sm text-muted-foreground">
                    Converted: {formData.cover_kg_dm_ha} kg DM/ha
                  </p>
                </div>
              )}

              {/* Direct Cover Entry */}
              {formData.measurement_method !== 'plate_meter' && (
                <div className="space-y-2">
                  <Label htmlFor="cover">Cover (kg DM/ha)</Label>
                  <Input
                    id="cover"
                    type="number"
                    placeholder="2500"
                    value={formData.cover_kg_dm_ha || ''}
                    onChange={(e) => handleCoverChange(parseInt(e.target.value) || 0)}
                  />
                </div>
              )}

              {/* Pre/Post Grazing */}
              <div className="space-y-2">
                <Label htmlFor="timing">Measurement Timing</Label>
                <Select
                  value={formData.pre_or_post}
                  onValueChange={(value: any) => setFormData({ ...formData, pre_or_post: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pre">Pre-Grazing</SelectItem>
                    <SelectItem value="post">Post-Grazing</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label htmlFor="notes">Notes (Optional)</Label>
              <Textarea
                id="notes"
                placeholder="Add any observations about pasture condition, weather, etc."
                value={formData.notes || ''}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={3}
              />
            </div>

            {/* Submit Button */}
            <div className="flex justify-end">
              <Button
                type="submit"
                disabled={!formData.pasture_id || formData.cover_kg_dm_ha <= 0 || loading}
                className="min-w-32"
              >
                {loading ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                Save Measurement
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default PastureWalkForm;
