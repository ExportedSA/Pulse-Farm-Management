import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import { format } from "date-fns";
import { 
  Heart, AlertTriangle, Thermometer, Activity, Plus, 
  CheckCircle2, XCircle, Skull, TrendingDown, Droplets
} from "lucide-react";
import type { HealthScore, HealthAlert, MortalityRecord, Animal } from "@shared/schema";

export default function HealthMonitoringDashboard() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [showScoreDialog, setShowScoreDialog] = useState(false);
  const [showMortalityDialog, setShowMortalityDialog] = useState(false);
  const [selectedAnimalId, setSelectedAnimalId] = useState("");

  // Form state for new health score
  const [newScore, setNewScore] = useState({
    animalId: "",
    recordDate: format(new Date(), "yyyy-MM-dd"),
    lamenessScore: "",
    affectedLimb: "",
    temperature: "",
    temperatureUnit: "C",
    somaticCellCount: "",
    sccQuarter: "",
    ruminationMinutes: "",
    activityLevel: "",
    bodyConditionScore: "",
    respiratoryRate: "",
    heartRate: "",
    notes: "",
  });

  // Form state for mortality record
  const [newMortality, setNewMortality] = useState({
    animalId: "",
    deathDate: format(new Date(), "yyyy-MM-dd"),
    cause: "unknown",
    causeDetails: "",
    ageAtDeath: "",
    wasUnderTreatment: false,
    estimatedValue: "",
    postMortemPerformed: false,
    postMortemFindings: "",
    notes: "",
  });

  // Fetch all animals for selection
  const { data: animals = [] } = useQuery<Animal[]>({
    queryKey: ["/api/animals"],
    queryFn: async () => {
      const res = await fetch("/api/animals");
      if (!res.ok) throw new Error("Failed to fetch animals");
      return res.json();
    },
  });

  // Fetch active health alerts
  const { data: healthAlerts = [], isLoading: loadingAlerts } = useQuery<HealthAlert[]>({
    queryKey: ["/api/health/alerts", { active: true }],
    queryFn: async () => {
      const res = await fetch("/api/health/alerts?active=true");
      if (!res.ok) throw new Error("Failed to fetch health alerts");
      return res.json();
    },
  });

  // Fetch high SCC animals
  const { data: highSCCScores = [] } = useQuery<HealthScore[]>({
    queryKey: ["/api/health/high-scc"],
    queryFn: async () => {
      const res = await fetch("/api/health/high-scc?threshold=200");
      if (!res.ok) throw new Error("Failed to fetch high SCC scores");
      return res.json();
    },
  });

  // Fetch lameness issues
  const { data: lamenessScores = [] } = useQuery<HealthScore[]>({
    queryKey: ["/api/health/lameness"],
    queryFn: async () => {
      const res = await fetch("/api/health/lameness?minScore=3");
      if (!res.ok) throw new Error("Failed to fetch lameness scores");
      return res.json();
    },
  });

  // Fetch fever cases
  const { data: feverScores = [] } = useQuery<HealthScore[]>({
    queryKey: ["/api/health/fever"],
    queryFn: async () => {
      const res = await fetch("/api/health/fever?threshold=39.5");
      if (!res.ok) throw new Error("Failed to fetch fever scores");
      return res.json();
    },
  });

  // Fetch mortality records
  const { data: mortalityRecords = [], isLoading: loadingMortality } = useQuery<MortalityRecord[]>({
    queryKey: ["/api/health/mortality"],
    queryFn: async () => {
      const res = await fetch("/api/health/mortality");
      if (!res.ok) throw new Error("Failed to fetch mortality records");
      return res.json();
    },
  });

  // Create health score mutation
  const createScoreMutation = useMutation({
    mutationFn: async (scoreData: any) => {
      const res = await fetch("/api/health/scores", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(scoreData),
      });
      if (!res.ok) throw new Error("Failed to create health score");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/health"] });
      setShowScoreDialog(false);
      resetScoreForm();
      toast.success("Health score recorded successfully");
    },
    onError: () => {
      toast.error("Failed to record health score");
    },
  });

  // Create mortality record mutation
  const createMortalityMutation = useMutation({
    mutationFn: async (mortalityData: any) => {
      const res = await fetch("/api/health/mortality", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(mortalityData),
      });
      if (!res.ok) throw new Error("Failed to create mortality record");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/health/mortality"] });
      queryClient.invalidateQueries({ queryKey: ["/api/animals"] });
      setShowMortalityDialog(false);
      resetMortalityForm();
      toast.success("Mortality record created successfully");
    },
    onError: () => {
      toast.error("Failed to create mortality record");
    },
  });

  // Acknowledge alert mutation
  const acknowledgeAlertMutation = useMutation({
    mutationFn: async (alertId: string) => {
      const res = await fetch(`/api/health/alerts/${alertId}/acknowledge`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user?.id }),
      });
      if (!res.ok) throw new Error("Failed to acknowledge alert");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/health/alerts"] });
      toast.success("Alert acknowledged");
    },
  });

  // Resolve alert mutation
  const resolveAlertMutation = useMutation({
    mutationFn: async ({ alertId, notes }: { alertId: string; notes?: string }) => {
      const res = await fetch(`/api/health/alerts/${alertId}/resolve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user?.id, notes }),
      });
      if (!res.ok) throw new Error("Failed to resolve alert");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/health/alerts"] });
      toast.success("Alert resolved");
    },
  });

  const resetScoreForm = () => {
    setNewScore({
      animalId: "",
      recordDate: format(new Date(), "yyyy-MM-dd"),
      lamenessScore: "",
      affectedLimb: "",
      temperature: "",
      temperatureUnit: "C",
      somaticCellCount: "",
      sccQuarter: "",
      ruminationMinutes: "",
      activityLevel: "",
      bodyConditionScore: "",
      respiratoryRate: "",
      heartRate: "",
      notes: "",
    });
  };

  const resetMortalityForm = () => {
    setNewMortality({
      animalId: "",
      deathDate: format(new Date(), "yyyy-MM-dd"),
      cause: "unknown",
      causeDetails: "",
      ageAtDeath: "",
      wasUnderTreatment: false,
      estimatedValue: "",
      postMortemPerformed: false,
      postMortemFindings: "",
      notes: "",
    });
  };

  const handleCreateScore = () => {
    if (!newScore.animalId) {
      toast.error("Please select an animal");
      return;
    }

    createScoreMutation.mutate({
      ...newScore,
      lamenessScore: newScore.lamenessScore || null,
      temperature: newScore.temperature || null,
      somaticCellCount: newScore.somaticCellCount ? parseInt(newScore.somaticCellCount) : null,
      ruminationMinutes: newScore.ruminationMinutes ? parseInt(newScore.ruminationMinutes) : null,
      activityLevel: newScore.activityLevel ? parseInt(newScore.activityLevel) : null,
      bodyConditionScore: newScore.bodyConditionScore ? parseInt(newScore.bodyConditionScore) : null,
      respiratoryRate: newScore.respiratoryRate ? parseInt(newScore.respiratoryRate) : null,
      heartRate: newScore.heartRate ? parseInt(newScore.heartRate) : null,
      recordedBy: user?.id,
    });
  };

  const handleCreateMortality = () => {
    if (!newMortality.animalId) {
      toast.error("Please select an animal");
      return;
    }

    createMortalityMutation.mutate({
      ...newMortality,
      ageAtDeath: newMortality.ageAtDeath ? parseInt(newMortality.ageAtDeath) : null,
      estimatedValue: newMortality.estimatedValue || null,
      recordedBy: user?.id,
    });
  };

  const getAnimalName = (animalId: string) => {
    const animal = animals.find(a => a.id === animalId);
    return animal?.cowId || animal?.naitTag || animalId.slice(0, 8);
  };

  const criticalAlerts = healthAlerts.filter(a => a.severity === 'critical');
  const highAlerts = healthAlerts.filter(a => a.severity === 'high');
  const activeAnimals = animals.filter(a => a.status === 'active');

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Heart className="h-8 w-8 text-red-600" />
            Health Monitoring
          </h1>
          <p className="text-muted-foreground mt-1">
            Track health scores, manage alerts, and analyze mortality
          </p>
        </div>
        <div className="flex gap-2">
          <Dialog open={showScoreDialog} onOpenChange={setShowScoreDialog}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Record Health Score
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Record Health Score</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 mt-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <Label>Animal *</Label>
                    <Select
                      value={newScore.animalId}
                      onValueChange={(v) => setNewScore({ ...newScore, animalId: v })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select animal" />
                      </SelectTrigger>
                      <SelectContent>
                        {activeAnimals.map((animal) => (
                          <SelectItem key={animal.id} value={animal.id}>
                            {animal.cowId || animal.naitTag || animal.id.slice(0, 8)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Record Date</Label>
                    <Input
                      type="date"
                      value={newScore.recordDate}
                      onChange={(e) => setNewScore({ ...newScore, recordDate: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Lameness Score (1-5)</Label>
                    <Select
                      value={newScore.lamenessScore}
                      onValueChange={(v) => setNewScore({ ...newScore, lamenessScore: v })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select score" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">1 - Normal</SelectItem>
                        <SelectItem value="2">2 - Slightly Lame</SelectItem>
                        <SelectItem value="3">3 - Moderately Lame</SelectItem>
                        <SelectItem value="4">4 - Severely Lame</SelectItem>
                        <SelectItem value="5">5 - Non-weight Bearing</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Affected Limb</Label>
                    <Select
                      value={newScore.affectedLimb}
                      onValueChange={(v) => setNewScore({ ...newScore, affectedLimb: v })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select limb" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="front_left">Front Left</SelectItem>
                        <SelectItem value="front_right">Front Right</SelectItem>
                        <SelectItem value="rear_left">Rear Left</SelectItem>
                        <SelectItem value="rear_right">Rear Right</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Temperature (°C)</Label>
                    <Input
                      type="number"
                      step="0.1"
                      placeholder="e.g., 38.5"
                      value={newScore.temperature}
                      onChange={(e) => setNewScore({ ...newScore, temperature: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>SCC (thousands/ml)</Label>
                    <Input
                      type="number"
                      placeholder="e.g., 150"
                      value={newScore.somaticCellCount}
                      onChange={(e) => setNewScore({ ...newScore, somaticCellCount: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>SCC Quarter</Label>
                    <Select
                      value={newScore.sccQuarter}
                      onValueChange={(v) => setNewScore({ ...newScore, sccQuarter: v })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select quarter" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="front_left">Front Left</SelectItem>
                        <SelectItem value="front_right">Front Right</SelectItem>
                        <SelectItem value="rear_left">Rear Left</SelectItem>
                        <SelectItem value="rear_right">Rear Right</SelectItem>
                        <SelectItem value="bulk">Bulk Tank</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Rumination (min/day)</Label>
                    <Input
                      type="number"
                      placeholder="e.g., 450"
                      value={newScore.ruminationMinutes}
                      onChange={(e) => setNewScore({ ...newScore, ruminationMinutes: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Body Condition Score (1-5)</Label>
                    <Select
                      value={newScore.bodyConditionScore}
                      onValueChange={(v) => setNewScore({ ...newScore, bodyConditionScore: v })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select BCS" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">1 - Emaciated</SelectItem>
                        <SelectItem value="2">2 - Thin</SelectItem>
                        <SelectItem value="3">3 - Average</SelectItem>
                        <SelectItem value="4">4 - Fat</SelectItem>
                        <SelectItem value="5">5 - Obese</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-2">
                    <Label>Notes</Label>
                    <Textarea
                      placeholder="Additional observations..."
                      value={newScore.notes}
                      onChange={(e) => setNewScore({ ...newScore, notes: e.target.value })}
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setShowScoreDialog(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleCreateScore} disabled={createScoreMutation.isPending}>
                    {createScoreMutation.isPending ? "Recording..." : "Record Score"}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={showMortalityDialog} onOpenChange={setShowMortalityDialog}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Skull className="h-4 w-4 mr-2" />
                Record Mortality
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Record Mortality</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 mt-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <Label>Animal *</Label>
                    <Select
                      value={newMortality.animalId}
                      onValueChange={(v) => setNewMortality({ ...newMortality, animalId: v })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select animal" />
                      </SelectTrigger>
                      <SelectContent>
                        {activeAnimals.map((animal) => (
                          <SelectItem key={animal.id} value={animal.id}>
                            {animal.cowId || animal.naitTag || animal.id.slice(0, 8)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Death Date</Label>
                    <Input
                      type="date"
                      value={newMortality.deathDate}
                      onChange={(e) => setNewMortality({ ...newMortality, deathDate: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Cause of Death *</Label>
                    <Select
                      value={newMortality.cause}
                      onValueChange={(v) => setNewMortality({ ...newMortality, cause: v })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="disease">Disease</SelectItem>
                        <SelectItem value="injury">Injury</SelectItem>
                        <SelectItem value="calving">Calving Complications</SelectItem>
                        <SelectItem value="metabolic">Metabolic Disorder</SelectItem>
                        <SelectItem value="culled">Culled</SelectItem>
                        <SelectItem value="unknown">Unknown</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-2">
                    <Label>Cause Details</Label>
                    <Textarea
                      placeholder="Describe the circumstances..."
                      value={newMortality.causeDetails}
                      onChange={(e) => setNewMortality({ ...newMortality, causeDetails: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Estimated Value ($)</Label>
                    <Input
                      type="number"
                      placeholder="e.g., 1500"
                      value={newMortality.estimatedValue}
                      onChange={(e) => setNewMortality({ ...newMortality, estimatedValue: e.target.value })}
                    />
                  </div>
                  <div className="col-span-2">
                    <Label>Notes</Label>
                    <Textarea
                      placeholder="Additional notes..."
                      value={newMortality.notes}
                      onChange={(e) => setNewMortality({ ...newMortality, notes: e.target.value })}
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setShowMortalityDialog(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleCreateMortality} disabled={createMortalityMutation.isPending}>
                    {createMortalityMutation.isPending ? "Recording..." : "Record Mortality"}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Critical Alerts</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{criticalAlerts.length}</div>
            <p className="text-xs text-muted-foreground">Require immediate attention</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">High SCC</CardTitle>
            <Droplets className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{highSCCScores.length}</div>
            <p className="text-xs text-muted-foreground">Animals with SCC ≥200k</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Lameness</CardTitle>
            <Activity className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{lamenessScores.length}</div>
            <p className="text-xs text-muted-foreground">Score ≥3 detected</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Fever Cases</CardTitle>
            <Thermometer className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-500">{feverScores.length}</div>
            <p className="text-xs text-muted-foreground">Temp ≥39.5°C</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Mortality (YTD)</CardTitle>
            <Skull className="h-4 w-4 text-gray-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-600">{mortalityRecords.length}</div>
            <p className="text-xs text-muted-foreground">Deaths recorded</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs defaultValue="alerts" className="space-y-4">
        <TabsList>
          <TabsTrigger value="alerts">
            <AlertTriangle className="h-4 w-4 mr-2" />
            Health Alerts ({healthAlerts.length})
          </TabsTrigger>
          <TabsTrigger value="issues">
            <TrendingDown className="h-4 w-4 mr-2" />
            Health Issues
          </TabsTrigger>
          <TabsTrigger value="mortality">
            <Skull className="h-4 w-4 mr-2" />
            Mortality Analysis
          </TabsTrigger>
        </TabsList>

        {/* Alerts Tab */}
        <TabsContent value="alerts" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Active Health Alerts</CardTitle>
              <CardDescription>
                Auto-generated alerts based on health score thresholds
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loadingAlerts ? (
                <div className="space-y-3">
                  <Skeleton className="h-16 w-full" />
                  <Skeleton className="h-16 w-full" />
                </div>
              ) : healthAlerts.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <CheckCircle2 className="h-12 w-12 mx-auto mb-4 text-green-500" />
                  <p>No active health alerts. All animals are healthy!</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {healthAlerts.map((alert) => (
                    <div
                      key={alert.id}
                      className={`p-4 border rounded-lg ${
                        alert.severity === 'critical' ? 'border-red-300 bg-red-50' :
                        alert.severity === 'high' ? 'border-orange-300 bg-orange-50' :
                        'border-yellow-300 bg-yellow-50'
                      }`}
                    >
                      <div className="flex justify-between items-start">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <Badge variant={
                              alert.severity === 'critical' ? 'destructive' :
                              alert.severity === 'high' ? 'destructive' :
                              'secondary'
                            }>
                              {alert.severity}
                            </Badge>
                            <span className="font-medium">{alert.title}</span>
                          </div>
                          <div className="text-sm text-muted-foreground">
                            Animal: {getAnimalName(alert.animalId)}
                          </div>
                          {alert.description && (
                            <div className="text-sm">{alert.description}</div>
                          )}
                          <div className="text-xs text-muted-foreground">
                            Created: {format(new Date(alert.createdAt), 'MMM d, yyyy h:mm a')}
                          </div>
                        </div>
                        <div className="flex gap-2">
                          {!alert.acknowledgedAt && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => acknowledgeAlertMutation.mutate(alert.id)}
                            >
                              Acknowledge
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="default"
                            onClick={() => resolveAlertMutation.mutate({ alertId: alert.id })}
                          >
                            Resolve
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Health Issues Tab */}
        <TabsContent value="issues" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Droplets className="h-5 w-5 text-yellow-600" />
                  High SCC Animals
                </CardTitle>
              </CardHeader>
              <CardContent>
                {highSCCScores.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No high SCC cases</p>
                ) : (
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {highSCCScores.slice(0, 10).map((score) => (
                      <div key={score.id} className="p-2 border rounded text-sm">
                        <div className="font-medium">{getAnimalName(score.animalId)}</div>
                        <div className="text-muted-foreground">
                          SCC: {score.somaticCellCount}k • {format(new Date(score.recordDate), 'MMM d')}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Activity className="h-5 w-5 text-orange-600" />
                  Lameness Cases
                </CardTitle>
              </CardHeader>
              <CardContent>
                {lamenessScores.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No lameness cases</p>
                ) : (
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {lamenessScores.slice(0, 10).map((score) => (
                      <div key={score.id} className="p-2 border rounded text-sm">
                        <div className="font-medium">{getAnimalName(score.animalId)}</div>
                        <div className="text-muted-foreground">
                          Score: {score.lamenessScore}/5 • {score.affectedLimb || 'Unknown limb'}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Thermometer className="h-5 w-5 text-red-500" />
                  Fever Cases
                </CardTitle>
              </CardHeader>
              <CardContent>
                {feverScores.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No fever cases</p>
                ) : (
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {feverScores.slice(0, 10).map((score) => (
                      <div key={score.id} className="p-2 border rounded text-sm">
                        <div className="font-medium">{getAnimalName(score.animalId)}</div>
                        <div className="text-muted-foreground">
                          Temp: {score.temperature}°{score.temperatureUnit || 'C'} • {format(new Date(score.recordDate), 'MMM d')}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Mortality Tab */}
        <TabsContent value="mortality" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Mortality Records</CardTitle>
              <CardDescription>
                Track and analyze animal deaths for loss prevention
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loadingMortality ? (
                <div className="space-y-3">
                  <Skeleton className="h-16 w-full" />
                  <Skeleton className="h-16 w-full" />
                </div>
              ) : mortalityRecords.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <CheckCircle2 className="h-12 w-12 mx-auto mb-4 text-green-500" />
                  <p>No mortality records. Great herd health!</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {mortalityRecords.map((record) => (
                    <div key={record.id} className="p-4 border rounded-lg">
                      <div className="flex justify-between items-start">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{getAnimalName(record.animalId)}</span>
                            <Badge variant="secondary" className="capitalize">
                              {record.cause}
                            </Badge>
                          </div>
                          <div className="text-sm text-muted-foreground">
                            Death Date: {format(new Date(record.deathDate), 'MMM d, yyyy')}
                          </div>
                          {record.causeDetails && (
                            <div className="text-sm">{record.causeDetails}</div>
                          )}
                          {record.estimatedValue && (
                            <div className="text-sm text-muted-foreground">
                              Estimated Value: ${record.estimatedValue}
                            </div>
                          )}
                        </div>
                        <div className="text-right text-sm text-muted-foreground">
                          {record.postMortemPerformed && (
                            <Badge variant="outline">Post-mortem done</Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
