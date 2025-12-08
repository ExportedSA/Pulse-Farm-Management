import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Edit, Calendar, Tag, MapPin, Activity, TrendingUp, Plus, ChevronDown, ChevronUp, Syringe, Heart, Thermometer, AlertTriangle, Stethoscope, Pill, FlaskConical, Camera, Mic } from "lucide-react";
import { PhotoUpload } from "@/components/PhotoUpload";
import { VoiceRecorder } from "@/components/VoiceRecorder";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import type { Animal, Pasture, AnimalTreatment, ReproductionEvent, WeightRecord, HealthScore, HealthAlert, BreedingRecord, LactationRecord, HeatRecord, LabResult, Prescription } from "@shared/schema";
import { format } from "date-fns";

type AnimalGroup = {
  id: string;
  name: string;
  color: string | null;
};

type AnimalDetailDialogProps = {
  animal: Animal | null;
  onClose: () => void;
  onEdit: (animal: Animal) => void;
  groups: AnimalGroup[];
  pasture?: Pasture;
};

export default function AnimalDetailDialog({ 
  animal, 
  onClose, 
  onEdit,
  groups,
  pasture
}: AnimalDetailDialogProps) {
  const [showWeightHistory, setShowWeightHistory] = useState(false);
  const [newWeight, setNewWeight] = useState('');
  const [newBCS, setNewBCS] = useState('');
  const [weightDate, setWeightDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [weightNotes, setWeightNotes] = useState('');
  const [showVaccinationHistory, setShowVaccinationHistory] = useState(false);
  const [showHealthHistory, setShowHealthHistory] = useState(false);
  const [showBreedingHistory, setShowBreedingHistory] = useState(false);
  const [showVetHistory, setShowVetHistory] = useState(false);
  const queryClient = useQueryClient();
  const { user } = useAuth();

  // Handle weight record submission
  const handleWeightSubmit = () => {
    if (!animal || !newWeight) {
      toast.error('Please enter a weight');
      return;
    }

    if (!user?.id) {
      toast.error('Authentication error. Please sign in again.');
      return;
    }

    const weightData = {
      animalId: animal.id,
      weight: parseFloat(newWeight),
      date: weightDate,
      bodyConditionScore: newBCS ? parseInt(newBCS) : undefined,
      notes: weightNotes || undefined,
      recordedBy: user.id,
    };

    createWeightMutation.mutate(weightData);
  };

  // Fetch treatments for this animal
  const { data: treatments = [], isLoading: loadingTreatments } = useQuery<AnimalTreatment[]>({
    queryKey: ['/api/animals', animal?.id, 'treatments'],
    queryFn: async () => {
      if (!animal) return [];
      const res = await fetch(`/api/animals/${animal.id}/treatments`);
      if (!res.ok) throw new Error('Failed to fetch treatments');
      return res.json();
    },
    enabled: !!animal,
  });

  // Fetch weight records for this animal
  const { data: weightRecords = [], isLoading: loadingWeights } = useQuery<(WeightRecord & { adg?: number | null })[]>({
    queryKey: ['/api/weight/records', animal?.id],
    queryFn: async () => {
      if (!animal) return [];
      const res = await fetch(`/api/weight/records/${animal.id}`);
      if (!res.ok) throw new Error('Failed to fetch weight records');
      return res.json();
    },
    enabled: !!animal,
  });

  // Create weight record mutation
  const createWeightMutation = useMutation({
    mutationFn: async (weightData: {
      animalId: string;
      weight: number;
      date: string;
      bodyConditionScore?: number;
      notes?: string;
      recordedBy: string;
    }) => {
      const res = await fetch('/api/weight/records', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(weightData),
      });
      if (!res.ok) throw new Error('Failed to create weight record');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/weight/records', animal?.id] });
      setNewWeight('');
      setNewBCS('');
      setWeightNotes('');
      toast.success('Weight record added successfully');
    },
    onError: (error) => {
      toast.error('Failed to add weight record');
      console.error('Weight record error:', error);
    },
  });

  // Fetch vaccination records for this animal
  const { data: vaccinationRecords = [], isLoading: loadingVaccinations } = useQuery<AnimalTreatment[]>({
    queryKey: ['/api/vaccination/records/animal', animal?.id],
    queryFn: async () => {
      if (!animal) return [];
      const res = await fetch(`/api/vaccination/records/animal/${animal.id}`);
      if (!res.ok) throw new Error('Failed to fetch vaccination records');
      return res.json();
    },
    enabled: !!animal,
  });

  // Fetch health scores for this animal
  const { data: healthScores = [], isLoading: loadingHealthScores } = useQuery<HealthScore[]>({
    queryKey: ['/api/health/scores', animal?.id],
    queryFn: async () => {
      if (!animal) return [];
      const res = await fetch(`/api/health/scores/${animal.id}`);
      if (!res.ok) throw new Error('Failed to fetch health scores');
      return res.json();
    },
    enabled: !!animal,
  });

  // Fetch health alerts for this animal
  const { data: healthAlerts = [], isLoading: loadingHealthAlerts } = useQuery<HealthAlert[]>({
    queryKey: ['/api/health/alerts/animal', animal?.id],
    queryFn: async () => {
      if (!animal) return [];
      const res = await fetch(`/api/health/alerts/animal/${animal.id}`);
      if (!res.ok) throw new Error('Failed to fetch health alerts');
      return res.json();
    },
    enabled: !!animal,
  });

  // Fetch breeding records for this animal
  const { data: breedingRecords = [], isLoading: loadingBreeding } = useQuery<BreedingRecord[]>({
    queryKey: ['/api/reproduction/breeding/animal', animal?.id],
    queryFn: async () => {
      if (!animal) return [];
      const res = await fetch(`/api/reproduction/breeding/animal/${animal.id}`);
      if (!res.ok) throw new Error('Failed to fetch breeding records');
      return res.json();
    },
    enabled: !!animal,
  });

  // Fetch current lactation for this animal
  const { data: currentLactation, isLoading: loadingLactation } = useQuery<LactationRecord | null>({
    queryKey: ['/api/reproduction/lactation/animal', animal?.id, 'current'],
    queryFn: async () => {
      if (!animal) return null;
      const res = await fetch(`/api/reproduction/lactation/animal/${animal.id}/current`);
      if (!res.ok) throw new Error('Failed to fetch current lactation');
      return res.json();
    },
    enabled: !!animal,
  });

  // Fetch heat records for this animal
  const { data: heatRecords = [], isLoading: loadingHeats } = useQuery<HeatRecord[]>({
    queryKey: ['/api/reproduction/heat/animal', animal?.id],
    queryFn: async () => {
      if (!animal) return [];
      const res = await fetch(`/api/reproduction/heat/animal/${animal.id}`);
      if (!res.ok) throw new Error('Failed to fetch heat records');
      return res.json();
    },
    enabled: !!animal,
  });

  // Fetch lab results for this animal
  const { data: labResults = [], isLoading: loadingLabs } = useQuery<LabResult[]>({
    queryKey: ['/api/veterinary/lab-results/animal', animal?.id],
    queryFn: async () => {
      if (!animal) return [];
      const res = await fetch(`/api/veterinary/lab-results/animal/${animal.id}`);
      if (!res.ok) throw new Error('Failed to fetch lab results');
      return res.json();
    },
    enabled: !!animal,
  });

  // Fetch prescriptions for this animal
  const { data: prescriptions = [], isLoading: loadingPrescriptions } = useQuery<Prescription[]>({
    queryKey: ['/api/veterinary/prescriptions/animal', animal?.id],
    queryFn: async () => {
      if (!animal) return [];
      const res = await fetch(`/api/veterinary/prescriptions/animal/${animal.id}`);
      if (!res.ok) throw new Error('Failed to fetch prescriptions');
      return res.json();
    },
    enabled: !!animal,
  });

  // Fetch reproduction events for this animal
  const { data: reproEvents = [], isLoading: loadingRepro } = useQuery<ReproductionEvent[]>({
    queryKey: ['/api/reproduction-events', { animalId: animal?.id }],
    queryFn: async () => {
      if (!animal) return [];
      const res = await fetch(`/api/reproduction-events?animalId=${animal.id}`);
      if (!res.ok) throw new Error('Failed to fetch reproduction events');
      return res.json();
    },
    enabled: !!animal,
  });

  if (!animal) return null;

  const activeTreatments = treatments.filter(t => t.status === 'active');
  const completedTreatments = treatments.filter(t => t.status === 'completed');

  return (
    <Dialog open={!!animal} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto" data-testid="dialog-animal-detail">
        <DialogHeader>
          <div className="flex items-start justify-between">
            <div>
              <DialogTitle className="text-2xl font-mono mb-2">
                {animal.naitTag || animal.cowId || "No ID"}
              </DialogTitle>
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="secondary" data-testid="badge-status">
                  {animal.status}
                </Badge>
                {animal.sex && (
                  <Badge variant="outline">{animal.sex}</Badge>
                )}
                {animal.breed && (
                  <Badge variant="outline">{animal.breed}</Badge>
                )}
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onEdit(animal)}
              data-testid="button-edit-animal-detail"
            >
              <Edit className="h-4 w-4 mr-2" />
              Edit
            </Button>
          </div>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          {/* Basic Information */}
          {/* Tag Identification */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Tag className="h-5 w-5" />
                Tag Identification
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-3 border rounded-lg">
                  <div className="text-xs font-medium text-blue-600 mb-1">VID (Visual ID)</div>
                  <div className="text-sm font-mono font-semibold">
                    {(animal as any).visualId || animal.cowId || <span className="text-muted-foreground">Not set</span>}
                  </div>
                </div>
                <div className="p-3 border rounded-lg">
                  <div className="text-xs font-medium text-green-600 mb-1">LID (Lifetime ID)</div>
                  <div className="text-sm font-mono font-semibold">
                    {(animal as any).lifetimeId || <span className="text-muted-foreground">Not set</span>}
                  </div>
                </div>
                <div className="p-3 border rounded-lg">
                  <div className="text-xs font-medium text-purple-600 mb-1">NAIT Tag (EID)</div>
                  <div className="text-sm font-mono font-semibold">
                    {animal.naitTag || <span className="text-muted-foreground">Not set</span>}
                  </div>
                </div>
                <div className="p-3 border rounded-lg">
                  <div className="text-xs font-medium text-orange-600 mb-1">EID (Electronic)</div>
                  <div className="text-sm font-mono font-semibold">
                    {(animal as any).eid || <span className="text-muted-foreground">Not set</span>}
                  </div>
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-3">
                To change tags, use the Edit button above or go to Animals → Edit Animal → Tags
              </p>
            </CardContent>
          </Card>

          {/* Basic Information */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Activity className="h-5 w-5" />
                Basic Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-sm font-medium text-muted-foreground">Date of Birth</div>
                  <div className="text-sm">
                    {animal.dateOfBirth ? format(new Date(animal.dateOfBirth), 'MMM d, yyyy') : '—'}
                  </div>
                </div>
                <div>
                  <div className="text-sm font-medium text-muted-foreground">Herd</div>
                  <div className="text-sm">{animal.herd || '—'}</div>
                </div>
                <div>
                  <div className="text-sm font-medium text-muted-foreground">Breed</div>
                  <div className="text-sm">{animal.breed || '—'}</div>
                </div>
                <div>
                  <div className="text-sm font-medium text-muted-foreground">Sex</div>
                  <div className="text-sm">{animal.sex || '—'}</div>
                </div>
                {animal.birthId && (
                  <div>
                    <div className="text-sm font-medium text-muted-foreground">Birth ID</div>
                    <div className="text-sm font-mono">
                      {`${animal.birthId.participantCode}-${animal.birthId.year}-${animal.birthId.number}`}
                    </div>
                  </div>
                )}
              </div>
              {animal.notes && (
                <div>
                  <div className="text-sm font-medium text-muted-foreground mb-1">Notes</div>
                  <div className="text-sm p-3 bg-muted rounded-md">{animal.notes}</div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Location & Groups */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <MapPin className="h-5 w-5" />
                Location & Groups
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <div className="text-sm font-medium text-muted-foreground mb-2">Current Pasture</div>
                <div className="text-sm">
                  {pasture ? (
                    <Badge variant="secondary">{pasture.name}</Badge>
                  ) : (
                    <span className="text-muted-foreground">Not assigned</span>
                  )}
                </div>
              </div>
              {groups.length > 0 && (
                <div>
                  <div className="text-sm font-medium text-muted-foreground mb-2">Groups</div>
                  <div className="flex flex-wrap gap-2">
                    {groups.map(group => (
                      <Badge
                        key={group.id}
                        variant="secondary"
                        style={{
                          backgroundColor: group.color || undefined,
                          color: group.color ? '#ffffff' : undefined,
                        }}
                      >
                        {group.name}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Active Treatments */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Activity className="h-5 w-5" />
                Treatments
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loadingTreatments ? (
                <div className="space-y-2">
                  <Skeleton className="h-16 w-full" />
                  <Skeleton className="h-16 w-full" />
                </div>
              ) : activeTreatments.length === 0 && completedTreatments.length === 0 ? (
                <p className="text-sm text-muted-foreground">No treatments recorded</p>
              ) : (
                <div className="space-y-4">
                  {activeTreatments.length > 0 && (
                    <div>
                      <div className="text-sm font-medium mb-2">Active ({activeTreatments.length})</div>
                      <div className="space-y-2">
                        {activeTreatments.slice(0, 3).map(t => (
                          <div key={t.id} className="p-3 border rounded-md bg-muted/30">
                            <div className="flex items-start justify-between mb-1">
                              <div className="font-medium text-sm">{t.condition || 'Unknown condition'}</div>
                              <Badge variant="outline" className="text-xs">Active</Badge>
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {t.treatmentType || 'No treatment type'}
                              {t.bodyPart && ` • ${t.bodyPart}`}
                            </div>
                            <div className="text-xs text-muted-foreground mt-1">
                              Started: {format(new Date(t.dateTime), 'MMM d, yyyy')}
                            </div>
                            {t.dosesGiven !== undefined && t.totalDoses !== undefined && (
                              <div className="text-xs text-muted-foreground">
                                Doses: {t.dosesGiven} / {t.totalDoses}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {completedTreatments.length > 0 && (
                    <div>
                      <div className="text-sm font-medium mb-2">Recently Completed</div>
                      <div className="space-y-2">
                        {completedTreatments.slice(0, 2).map(t => (
                          <div key={t.id} className="p-3 border rounded-md">
                            <div className="flex items-start justify-between mb-1">
                              <div className="font-medium text-sm">{t.condition || 'Unknown condition'}</div>
                              <Badge variant="secondary" className="text-xs">Completed</Badge>
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {t.treatmentType || 'No treatment type'}
                              {t.bodyPart && ` • ${t.bodyPart}`}
                            </div>
                            <div className="text-xs text-muted-foreground mt-1">
                              Completed: {t.completedDate ? format(new Date(t.completedDate), 'MMM d, yyyy') : 'Date unknown'}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Reproduction Events */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Reproduction History
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loadingRepro ? (
                <div className="space-y-2">
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                </div>
              ) : reproEvents.length === 0 ? (
                <p className="text-sm text-muted-foreground">No reproduction events recorded</p>
              ) : (
                <div className="space-y-2">
                  {reproEvents.slice(0, 5).map(event => (
                    <div key={event.id} className="p-3 border rounded-md">
                      <div className="flex items-start justify-between mb-1">
                        <div className="font-medium text-sm capitalize">{event.eventType.replace('_', ' ')}</div>
                        <Badge variant="outline" className="text-xs">
                          {format(new Date(event.eventDate), 'MMM d, yyyy')}
                        </Badge>
                      </div>
                      {event.notes && (
                        <div className="text-xs text-muted-foreground mt-1">{event.notes}</div>
                      )}
                      {event.eventType === 'pregnancy_check' && event.pregnancyDetails && (
                        <div className="text-xs text-muted-foreground mt-1">
                          Result: {(event.pregnancyDetails as any).result || 'Unknown'}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Weight Tracking */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Weight Tracking
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {loadingWeights ? (
                <div className="space-y-2">
                  <Skeleton className="h-16 w-full" />
                  <Skeleton className="h-16 w-full" />
                </div>
              ) : (
                <>
                  {/* Current Weight Display */}
                  {weightRecords.length > 0 && (
                    <div className="p-4 bg-muted/30 rounded-md">
                      <div className="grid grid-cols-3 gap-4 text-center">
                        <div>
                          <div className="text-2xl font-bold text-green-600">
                            {weightRecords[0].weight} kg
                          </div>
                          <div className="text-xs text-muted-foreground">Current Weight</div>
                        </div>
                        <div>
                          <div className="text-2xl font-bold text-blue-600">
                            {format(new Date(weightRecords[0].date), 'MMM d')}
                          </div>
                          <div className="text-xs text-muted-foreground">Last Measured</div>
                        </div>
                        <div>
                          <div className="text-2xl font-bold text-purple-600">
                            {weightRecords[0].bodyConditionScore || '—'}
                          </div>
                          <div className="text-xs text-muted-foreground">BCS (1-5)</div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Quick Weight Entry Form */}
                  <div className="space-y-3">
                    <div className="text-sm font-medium">Add Weight Record</div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label htmlFor="weight" className="text-xs">Weight (kg)</Label>
                        <Input
                          id="weight"
                          type="number"
                          step="0.1"
                          placeholder="0.0"
                          value={newWeight}
                          onChange={(e) => setNewWeight(e.target.value)}
                          className="h-8"
                        />
                      </div>
                      <div>
                        <Label htmlFor="date" className="text-xs">Date</Label>
                        <Input
                          id="date"
                          type="date"
                          value={weightDate}
                          onChange={(e) => setWeightDate(e.target.value)}
                          className="h-8"
                        />
                      </div>
                      <div>
                        <Label htmlFor="bcs" className="text-xs">BCS (1-5)</Label>
                        <Input
                          id="bcs"
                          type="number"
                          min="1"
                          max="5"
                          placeholder="1-5"
                          value={newBCS}
                          onChange={(e) => setNewBCS(e.target.value)}
                          className="h-8"
                        />
                      </div>
                      <div>
                        <Label htmlFor="notes" className="text-xs">Notes (optional)</Label>
                        <Input
                          id="notes"
                          placeholder="Add notes..."
                          value={weightNotes}
                          onChange={(e) => setWeightNotes(e.target.value)}
                          className="h-8"
                        />
                      </div>
                    </div>
                    <Button
                      onClick={handleWeightSubmit}
                      disabled={!newWeight || createWeightMutation.isPending}
                      size="sm"
                      className="w-full"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      {createWeightMutation.isPending ? 'Adding...' : 'Add Weight Record'}
                    </Button>
                  </div>

                  {/* Weight History */}
                  {weightRecords.length > 0 && (
                    <div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowWeightHistory(!showWeightHistory)}
                        className="w-full justify-between"
                      >
                        <span className="text-sm font-medium">Weight History ({weightRecords.length} records)</span>
                        {showWeightHistory ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </Button>
                      
                      {showWeightHistory && (
                        <div className="mt-3 space-y-2 max-h-64 overflow-y-auto">
                          {weightRecords.map((record, index) => (
                            <div key={record.id} className="p-3 border rounded-md text-xs">
                              <div className="flex justify-between items-start">
                                <div className="space-y-1">
                                  <div className="font-medium">
                                    {record.weight} kg
                                    {record.bodyConditionScore && (
                                      <span className="ml-2 text-muted-foreground">
                                        BCS: {record.bodyConditionScore}
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-muted-foreground">
                                    {format(new Date(record.date), 'MMM d, yyyy')}
                                  </div>
                                  {record.notes && (
                                    <div className="text-muted-foreground italic">{record.notes}</div>
                                  )}
                                </div>
                                {record.adg !== null && record.adg !== undefined && (
                                  <div className="text-right">
                                    <div className={`font-medium ${record.adg > 0 ? 'text-green-600' : record.adg < 0 ? 'text-red-600' : 'text-gray-600'}`}>
                                      {record.adg > 0 ? '+' : ''}{record.adg} kg/day
                                    </div>
                                    <div className="text-muted-foreground">ADG</div>
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {weightRecords.length === 0 && (
                    <p className="text-sm text-muted-foreground">No weight records yet. Add the first weight record above.</p>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          {/* Vaccination Records */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Syringe className="h-5 w-5" />
                Vaccination & Preventive Health
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {loadingVaccinations ? (
                <div className="space-y-2">
                  <Skeleton className="h-16 w-full" />
                  <Skeleton className="h-16 w-full" />
                </div>
              ) : (
                <>
                  {/* Vaccination Summary */}
                  {vaccinationRecords.length > 0 && (
                    <div className="p-4 bg-muted/30 rounded-md">
                      <div className="grid grid-cols-3 gap-4 text-center">
                        <div>
                          <div className="text-2xl font-bold text-blue-600">
                            {vaccinationRecords.filter(r => r.category === 'vaccination').length}
                          </div>
                          <div className="text-xs text-muted-foreground">Vaccinations</div>
                        </div>
                        <div>
                          <div className="text-2xl font-bold text-green-600">
                            {vaccinationRecords.filter(r => r.category === 'drench').length}
                          </div>
                          <div className="text-xs text-muted-foreground">Drenches</div>
                        </div>
                        <div>
                          <div className="text-2xl font-bold text-purple-600">
                            {vaccinationRecords.length > 0 ? format(new Date(vaccinationRecords[0].dateTime), 'MMM d') : '—'}
                          </div>
                          <div className="text-xs text-muted-foreground">Last Treatment</div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Vaccination History */}
                  {vaccinationRecords.length > 0 && (
                    <div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowVaccinationHistory(!showVaccinationHistory)}
                        className="w-full justify-between"
                      >
                        <span className="text-sm font-medium">Vaccination History ({vaccinationRecords.length} records)</span>
                        {showVaccinationHistory ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </Button>
                      
                      {showVaccinationHistory && (
                        <div className="mt-3 space-y-2 max-h-64 overflow-y-auto">
                          {vaccinationRecords.map((record) => (
                            <div key={record.id} className="p-3 border rounded-md text-xs">
                              <div className="flex justify-between items-start">
                                <div className="space-y-1">
                                  <div className="font-medium">
                                    {record.treatmentType || 'Unknown Treatment'}
                                    <Badge variant={record.category === 'vaccination' ? 'default' : 'secondary'} className="ml-2 text-xs">
                                      {record.category === 'vaccination' ? 'Vaccination' : 'Drench'}
                                    </Badge>
                                  </div>
                                  <div className="text-muted-foreground">
                                    {format(new Date(record.dateTime), 'MMM d, yyyy')}
                                  </div>
                                  {record.productId && (
                                    <div className="text-muted-foreground">
                                      Product ID: {record.productId.slice(0, 8)}...
                                    </div>
                                  )}
                                  {record.doseAmount && (
                                    <div className="text-muted-foreground">
                                      Dose: {record.doseAmount} {record.doseUnit || ''}
                                    </div>
                                  )}
                                  {record.clinicalNotes && (
                                    <div className="text-muted-foreground italic">{record.clinicalNotes}</div>
                                  )}
                                </div>
                                <div className="text-right">
                                  <Badge 
                                    variant={record.status === 'completed' ? 'secondary' : 'outline'}
                                    className="text-xs"
                                  >
                                    {record.status === 'completed' ? 'Completed' : 'Active'}
                                  </Badge>
                                  {record.staffMember && (
                                    <div className="text-muted-foreground mt-1">
                                      {record.staffMember}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {vaccinationRecords.length === 0 && (
                    <p className="text-sm text-muted-foreground">No vaccination or drench records yet. Use the Treatment form to add preventive health records.</p>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          {/* Health Monitoring */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Heart className="h-5 w-5" />
                Health Monitoring
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {loadingHealthScores || loadingHealthAlerts ? (
                <div className="space-y-2">
                  <Skeleton className="h-16 w-full" />
                  <Skeleton className="h-16 w-full" />
                </div>
              ) : (
                <>
                  {/* Active Health Alerts */}
                  {healthAlerts.filter(a => a.isActive).length > 0 && (
                    <div className="p-3 bg-red-50 border border-red-200 rounded-md">
                      <div className="flex items-center gap-2 mb-2">
                        <AlertTriangle className="h-4 w-4 text-red-600" />
                        <span className="font-medium text-red-800">Active Health Alerts</span>
                      </div>
                      <div className="space-y-2">
                        {healthAlerts.filter(a => a.isActive).slice(0, 3).map((alert) => (
                          <div key={alert.id} className="text-sm">
                            <Badge variant={
                              alert.severity === 'critical' ? 'destructive' :
                              alert.severity === 'high' ? 'destructive' :
                              'secondary'
                            } className="mr-2 text-xs">
                              {alert.severity}
                            </Badge>
                            <span className="text-red-700">{alert.title}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Latest Health Score Summary */}
                  {healthScores.length > 0 && (
                    <div className="p-4 bg-muted/30 rounded-md">
                      <div className="text-sm font-medium mb-3">Latest Health Check ({format(new Date(healthScores[0].recordDate), 'MMM d, yyyy')})</div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-center">
                        {healthScores[0].lamenessScore && (
                          <div className="p-2 bg-background rounded">
                            <div className={`text-xl font-bold ${
                              parseInt(healthScores[0].lamenessScore) >= 3 ? 'text-red-600' : 'text-green-600'
                            }`}>
                              {healthScores[0].lamenessScore}/5
                            </div>
                            <div className="text-xs text-muted-foreground">Lameness</div>
                          </div>
                        )}
                        {healthScores[0].temperature && (
                          <div className="p-2 bg-background rounded">
                            <div className={`text-xl font-bold ${
                              parseFloat(healthScores[0].temperature) >= 39.5 ? 'text-red-600' : 'text-green-600'
                            }`}>
                              {healthScores[0].temperature}°{healthScores[0].temperatureUnit || 'C'}
                            </div>
                            <div className="text-xs text-muted-foreground">Temperature</div>
                          </div>
                        )}
                        {healthScores[0].somaticCellCount && (
                          <div className="p-2 bg-background rounded">
                            <div className={`text-xl font-bold ${
                              healthScores[0].somaticCellCount >= 200 ? 'text-red-600' : 'text-green-600'
                            }`}>
                              {healthScores[0].somaticCellCount}k
                            </div>
                            <div className="text-xs text-muted-foreground">SCC</div>
                          </div>
                        )}
                        {healthScores[0].bodyConditionScore && (
                          <div className="p-2 bg-background rounded">
                            <div className="text-xl font-bold text-blue-600">
                              {healthScores[0].bodyConditionScore}/5
                            </div>
                            <div className="text-xs text-muted-foreground">BCS</div>
                          </div>
                        )}
                        {healthScores[0].ruminationMinutes && (
                          <div className="p-2 bg-background rounded">
                            <div className={`text-xl font-bold ${
                              healthScores[0].ruminationMinutes < 400 ? 'text-yellow-600' : 'text-green-600'
                            }`}>
                              {healthScores[0].ruminationMinutes}
                            </div>
                            <div className="text-xs text-muted-foreground">Rumination (min)</div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Health History */}
                  {healthScores.length > 0 && (
                    <div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowHealthHistory(!showHealthHistory)}
                        className="w-full justify-between"
                      >
                        <span className="text-sm font-medium">Health History ({healthScores.length} records)</span>
                        {showHealthHistory ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </Button>
                      
                      {showHealthHistory && (
                        <div className="mt-3 space-y-2 max-h-64 overflow-y-auto">
                          {healthScores.map((score) => (
                            <div key={score.id} className="p-3 border rounded-md text-xs">
                              <div className="flex justify-between items-start mb-2">
                                <span className="font-medium">
                                  {format(new Date(score.recordDate), 'MMM d, yyyy')}
                                </span>
                                <Badge variant="outline" className="text-xs">
                                  {score.source || 'manual'}
                                </Badge>
                              </div>
                              <div className="grid grid-cols-3 gap-2 text-muted-foreground">
                                {score.lamenessScore && (
                                  <div>Lameness: {score.lamenessScore}/5</div>
                                )}
                                {score.temperature && (
                                  <div>Temp: {score.temperature}°{score.temperatureUnit || 'C'}</div>
                                )}
                                {score.somaticCellCount && (
                                  <div>SCC: {score.somaticCellCount}k</div>
                                )}
                                {score.bodyConditionScore && (
                                  <div>BCS: {score.bodyConditionScore}/5</div>
                                )}
                                {score.ruminationMinutes && (
                                  <div>Rumination: {score.ruminationMinutes}min</div>
                                )}
                              </div>
                              {score.notes && (
                                <div className="mt-1 text-muted-foreground italic">{score.notes}</div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {healthScores.length === 0 && healthAlerts.filter(a => a.isActive).length === 0 && (
                    <p className="text-sm text-muted-foreground">No health scores recorded yet. Use the Health Monitoring dashboard to add health assessments.</p>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          {/* Enhanced Reproduction Management */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Heart className="h-5 w-5 text-pink-600" />
                Reproduction & Lactation
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {loadingBreeding || loadingLactation || loadingHeats ? (
                <div className="space-y-2">
                  <Skeleton className="h-16 w-full" />
                  <Skeleton className="h-16 w-full" />
                </div>
              ) : (
                <>
                  {/* Current Lactation Status */}
                  {currentLactation && (
                    <div className="p-4 bg-blue-50 border border-blue-200 rounded-md">
                      <div className="flex items-center gap-2 mb-2">
                        <Activity className="h-4 w-4 text-blue-600" />
                        <span className="font-medium text-blue-800">Current Lactation</span>
                        <Badge variant="outline" className="ml-auto">
                          Lactation #{currentLactation.lactationNumber}
                        </Badge>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-center mt-3">
                        <div className="p-2 bg-white rounded">
                          <div className="text-xl font-bold text-blue-600">
                            {currentLactation.daysInMilk || 0}
                          </div>
                          <div className="text-xs text-muted-foreground">Days in Milk</div>
                        </div>
                        <div className="p-2 bg-white rounded">
                          <div className="text-xl font-bold text-green-600 capitalize">
                            {currentLactation.status}
                          </div>
                          <div className="text-xs text-muted-foreground">Status</div>
                        </div>
                        {currentLactation.peakMilkYield && (
                          <div className="p-2 bg-white rounded">
                            <div className="text-xl font-bold text-purple-600">
                              {currentLactation.peakMilkYield}kg
                            </div>
                            <div className="text-xs text-muted-foreground">Peak Yield</div>
                          </div>
                        )}
                        {currentLactation.averageDailyYield && (
                          <div className="p-2 bg-white rounded">
                            <div className="text-xl font-bold text-orange-600">
                              {currentLactation.averageDailyYield}kg
                            </div>
                            <div className="text-xs text-muted-foreground">Avg Daily</div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Predicted Heat Alert */}
                  {heatRecords.filter(h => h.isPredicted && new Date(h.detectionDate) >= new Date()).length > 0 && (
                    <div className="p-3 bg-pink-50 border border-pink-200 rounded-md">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-pink-600" />
                        <span className="font-medium text-pink-800">Predicted Heat</span>
                      </div>
                      <div className="mt-2 text-sm">
                        {heatRecords
                          .filter(h => h.isPredicted && new Date(h.detectionDate) >= new Date())
                          .slice(0, 1)
                          .map(heat => (
                            <div key={heat.id} className="text-pink-700">
                              Expected: {format(new Date(heat.detectionDate), 'MMM d, yyyy')}
                              {heat.cycleLength && <span className="text-muted-foreground ml-2">({heat.cycleLength} day cycle)</span>}
                            </div>
                          ))}
                      </div>
                    </div>
                  )}

                  {/* Latest Breeding Record */}
                  {breedingRecords.length > 0 && (
                    <div className="p-4 bg-muted/30 rounded-md">
                      <div className="text-sm font-medium mb-2">Latest Breeding</div>
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Date:</span>
                          <span>{format(new Date(breedingRecords[0].breedingDate), 'MMM d, yyyy')}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Method:</span>
                          <Badge variant="outline" className="capitalize">{breedingRecords[0].breedingMethod}</Badge>
                        </div>
                        {breedingRecords[0].pregnancyResult && (
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Result:</span>
                            <Badge variant={breedingRecords[0].pregnancyResult === 'pregnant' ? 'default' : 'secondary'} className="capitalize">
                              {breedingRecords[0].pregnancyResult.replace('_', ' ')}
                            </Badge>
                          </div>
                        )}
                        {breedingRecords[0].expectedCalvingDate && (
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Expected Calving:</span>
                            <span className="font-medium text-green-600">
                              {format(new Date(breedingRecords[0].expectedCalvingDate), 'MMM d, yyyy')}
                            </span>
                          </div>
                        )}
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Service #:</span>
                          <span>{breedingRecords[0].serviceNumber || 1}</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Breeding History */}
                  {breedingRecords.length > 0 && (
                    <div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowBreedingHistory(!showBreedingHistory)}
                        className="w-full justify-between"
                      >
                        <span className="text-sm font-medium">Breeding History ({breedingRecords.length} records)</span>
                        {showBreedingHistory ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </Button>
                      
                      {showBreedingHistory && (
                        <div className="mt-3 space-y-2 max-h-64 overflow-y-auto">
                          {breedingRecords.map((record) => (
                            <div key={record.id} className="p-3 border rounded-md text-xs">
                              <div className="flex justify-between items-start mb-2">
                                <span className="font-medium">
                                  {format(new Date(record.breedingDate), 'MMM d, yyyy')}
                                </span>
                                <Badge variant="outline" className="text-xs capitalize">
                                  {record.breedingMethod}
                                </Badge>
                              </div>
                              <div className="grid grid-cols-2 gap-2 text-muted-foreground">
                                <div>Service #{record.serviceNumber || 1}</div>
                                {record.pregnancyResult && (
                                  <div className="capitalize">{record.pregnancyResult.replace('_', ' ')}</div>
                                )}
                                {record.conceptionConfirmed && (
                                  <div className="text-green-600">✓ Confirmed</div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {breedingRecords.length === 0 && !currentLactation && (
                    <p className="text-sm text-muted-foreground">No breeding or lactation records yet. Use the Reproduction dashboard to add records.</p>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          {/* Photos */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Camera className="h-5 w-5" />
                Photos
              </CardTitle>
            </CardHeader>
            <CardContent>
              <PhotoUpload animalId={animal.id} showExisting={true} />
            </CardContent>
          </Card>

          {/* Voice Notes */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Mic className="h-5 w-5" />
                Voice Notes
              </CardTitle>
            </CardHeader>
            <CardContent>
              <VoiceRecorder animalId={animal.id} showExisting={true} />
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
}
