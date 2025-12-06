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
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import { format, subDays, differenceInDays } from "date-fns";
import { 
  Scale, TrendingUp, TrendingDown, Plus, Target, 
  AlertTriangle, CheckCircle, Users, Calendar, BarChart3
} from "lucide-react";
import type { Animal, WeightRecord } from "@shared/schema";

type WeightTarget = {
  id: string;
  animalId: string | null;
  groupId: string | null;
  targetType: string;
  targetWeight: number;
  targetDate: string;
  notes: string | null;
};

type WeightStats = {
  totalRecords: number;
  averageWeight: number;
  averageBCS: number;
  animalsWeighed: number;
  underweightCount: number;
  overweightCount: number;
  avgDailyGain: number;
};

export default function WeightTrackingDashboard() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [showRecordDialog, setShowRecordDialog] = useState(false);
  const [showTargetDialog, setShowTargetDialog] = useState(false);
  const [selectedAnimalId, setSelectedAnimalId] = useState("");
  const [dateRange, setDateRange] = useState("30");

  // Form state for new weight record
  const [newRecord, setNewRecord] = useState({
    animalId: "",
    recordDate: format(new Date(), "yyyy-MM-dd"),
    weight: "",
    weightUnit: "kg",
    bodyConditionScore: "",
    measurementMethod: "scale",
    notes: "",
  });

  // Form state for weight target
  const [newTarget, setNewTarget] = useState({
    animalId: "",
    targetType: "weight",
    targetWeight: "",
    targetDate: format(new Date(), "yyyy-MM-dd"),
    notes: "",
  });

  // Fetch all animals
  const { data: animals = [] } = useQuery<Animal[]>({
    queryKey: ["/api/animals"],
    queryFn: async () => {
      const res = await fetch("/api/animals");
      if (!res.ok) throw new Error("Failed to fetch animals");
      return res.json();
    },
  });

  // Fetch weight records
  const { data: weightRecords = [], isLoading: loadingRecords } = useQuery<WeightRecord[]>({
    queryKey: ["/api/weight/records", dateRange],
    queryFn: async () => {
      const startDate = format(subDays(new Date(), parseInt(dateRange)), "yyyy-MM-dd");
      const res = await fetch(`/api/weight/records?startDate=${startDate}`);
      if (!res.ok) throw new Error("Failed to fetch weight records");
      return res.json();
    },
  });

  // Fetch weight targets
  const { data: weightTargets = [] } = useQuery<WeightTarget[]>({
    queryKey: ["/api/weight/targets"],
    queryFn: async () => {
      const res = await fetch("/api/weight/targets");
      if (!res.ok) throw new Error("Failed to fetch weight targets");
      return res.json();
    },
  });

  // Calculate statistics
  const stats: WeightStats = {
    totalRecords: weightRecords.length,
    averageWeight: weightRecords.length > 0 
      ? weightRecords.reduce((sum, r) => sum + (parseFloat(r.weight) || 0), 0) / weightRecords.length 
      : 0,
    averageBCS: weightRecords.filter(r => r.bodyConditionScore).length > 0
      ? weightRecords.filter(r => r.bodyConditionScore).reduce((sum, r) => sum + (r.bodyConditionScore || 0), 0) / weightRecords.filter(r => r.bodyConditionScore).length
      : 0,
    animalsWeighed: new Set(weightRecords.map(r => r.animalId)).size,
    underweightCount: weightRecords.filter(r => r.bodyConditionScore && r.bodyConditionScore < 3).length,
    overweightCount: weightRecords.filter(r => r.bodyConditionScore && r.bodyConditionScore > 4).length,
    avgDailyGain: 0, // Would need historical data to calculate
  };

  // Create weight record mutation
  const createRecordMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch("/api/weight/records", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to create weight record");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/weight/records"] });
      setShowRecordDialog(false);
      resetRecordForm();
      toast.success("Weight record added");
    },
    onError: () => toast.error("Failed to add weight record"),
  });

  // Create weight target mutation
  const createTargetMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch("/api/weight/targets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to create weight target");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/weight/targets"] });
      setShowTargetDialog(false);
      resetTargetForm();
      toast.success("Weight target set");
    },
    onError: () => toast.error("Failed to set weight target"),
  });

  const resetRecordForm = () => {
    setNewRecord({
      animalId: "", recordDate: format(new Date(), "yyyy-MM-dd"),
      weight: "", weightUnit: "kg", bodyConditionScore: "",
      measurementMethod: "scale", notes: "",
    });
  };

  const resetTargetForm = () => {
    setNewTarget({
      animalId: "", targetType: "weight", targetWeight: "",
      targetDate: format(new Date(), "yyyy-MM-dd"), notes: "",
    });
  };

  const handleCreateRecord = () => {
    if (!newRecord.animalId || !newRecord.weight) {
      toast.error("Please select an animal and enter weight");
      return;
    }
    createRecordMutation.mutate({
      ...newRecord,
      weight: parseFloat(newRecord.weight),
      bodyConditionScore: newRecord.bodyConditionScore ? parseInt(newRecord.bodyConditionScore) : null,
      recordedBy: user?.id,
    });
  };

  const handleCreateTarget = () => {
    if (!newTarget.targetWeight) {
      toast.error("Please enter target weight");
      return;
    }
    createTargetMutation.mutate({
      ...newTarget,
      targetWeight: parseFloat(newTarget.targetWeight),
      createdBy: user?.id,
    });
  };

  const getBCSColor = (bcs: number | null) => {
    if (!bcs) return "bg-gray-100 text-gray-800";
    if (bcs < 2.5) return "bg-red-100 text-red-800";
    if (bcs < 3) return "bg-orange-100 text-orange-800";
    if (bcs <= 3.5) return "bg-green-100 text-green-800";
    if (bcs <= 4) return "bg-yellow-100 text-yellow-800";
    return "bg-red-100 text-red-800";
  };

  const getBCSLabel = (bcs: number | null) => {
    if (!bcs) return "N/A";
    if (bcs < 2.5) return "Thin";
    if (bcs < 3) return "Moderate-";
    if (bcs <= 3.5) return "Optimal";
    if (bcs <= 4) return "Moderate+";
    return "Over";
  };

  // Group records by animal for history view
  const recordsByAnimal = weightRecords.reduce((acc, record) => {
    if (!acc[record.animalId]) acc[record.animalId] = [];
    acc[record.animalId].push(record);
    return acc;
  }, {} as Record<string, WeightRecord[]>);

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Scale className="h-8 w-8 text-blue-600" />
            Weight & BCS Tracking
          </h1>
          <p className="text-muted-foreground mt-1">
            Monitor animal weights and body condition scores for growth management
          </p>
        </div>
        <div className="flex gap-2">
          <Select value={dateRange} onValueChange={setDateRange}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">7 days</SelectItem>
              <SelectItem value="30">30 days</SelectItem>
              <SelectItem value="90">90 days</SelectItem>
              <SelectItem value="365">1 year</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={() => setShowTargetDialog(true)}>
            <Target className="h-4 w-4 mr-2" />
            Set Target
          </Button>
          <Button onClick={() => setShowRecordDialog(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Record Weight
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Records</CardTitle>
            <Scale className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalRecords}</div>
            <p className="text-xs text-muted-foreground">Last {dateRange} days</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Avg Weight</CardTitle>
            <BarChart3 className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.averageWeight.toFixed(0)} kg</div>
            <p className="text-xs text-muted-foreground">Across herd</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Avg BCS</CardTitle>
            <Target className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.averageBCS.toFixed(1)}</div>
            <p className="text-xs text-muted-foreground">Body condition</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Weighed</CardTitle>
            <Users className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.animalsWeighed}</div>
            <p className="text-xs text-muted-foreground">Animals</p>
          </CardContent>
        </Card>

        <Card className={stats.underweightCount > 0 ? "border-orange-300 bg-orange-50" : ""}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Underweight</CardTitle>
            <TrendingDown className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{stats.underweightCount}</div>
            <p className="text-xs text-muted-foreground">BCS &lt; 3</p>
          </CardContent>
        </Card>

        <Card className={stats.overweightCount > 0 ? "border-red-300 bg-red-50" : ""}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Overweight</CardTitle>
            <TrendingUp className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{stats.overweightCount}</div>
            <p className="text-xs text-muted-foreground">BCS &gt; 4</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Tabs defaultValue="records" className="space-y-4">
        <TabsList>
          <TabsTrigger value="records">Recent Records</TabsTrigger>
          <TabsTrigger value="animals">By Animal</TabsTrigger>
          <TabsTrigger value="targets">Weight Targets</TabsTrigger>
          <TabsTrigger value="bcs">BCS Distribution</TabsTrigger>
        </TabsList>

        {/* Recent Records Tab */}
        <TabsContent value="records" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Recent Weight Records</CardTitle>
              <CardDescription>Latest weight and BCS measurements</CardDescription>
            </CardHeader>
            <CardContent>
              {loadingRecords ? (
                <Skeleton className="h-64 w-full" />
              ) : weightRecords.length === 0 ? (
                <div className="text-center py-8">
                  <Scale className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">No weight records in this period</p>
                  <Button className="mt-4" onClick={() => setShowRecordDialog(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add First Record
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {weightRecords.slice(0, 20).map((record) => {
                    const animal = animals.find(a => a.id === record.animalId);
                    return (
                      <div key={record.id} className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex items-center gap-4">
                          <div className="p-2 bg-blue-100 rounded-full">
                            <Scale className="h-4 w-4 text-blue-600" />
                          </div>
                          <div>
                            <div className="font-medium">
                              {animal?.cowId || animal?.naitTag || 'Unknown Animal'}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {format(new Date(record.date), "MMM d, yyyy")}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <div className="font-bold text-lg">{record.weight} kg</div>
                            {record.bodyConditionScore && (
                              <Badge className={getBCSColor(record.bodyConditionScore)}>
                                BCS {record.bodyConditionScore} - {getBCSLabel(record.bodyConditionScore)}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* By Animal Tab */}
        <TabsContent value="animals" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Weight History by Animal</CardTitle>
              <CardDescription>Track individual animal weight trends</CardDescription>
            </CardHeader>
            <CardContent>
              {Object.keys(recordsByAnimal).length === 0 ? (
                <p className="text-muted-foreground text-center py-8">No records to display</p>
              ) : (
                <div className="space-y-4">
                  {Object.entries(recordsByAnimal).slice(0, 10).map(([animalId, records]) => {
                    const animal = animals.find(a => a.id === animalId);
                    const sortedRecords = records.sort((a, b) => 
                      new Date(b.date).getTime() - new Date(a.date).getTime()
                    );
                    const latestWeight = parseFloat(sortedRecords[0]?.weight || '0');
                    const previousWeight = parseFloat(sortedRecords[1]?.weight || '0');
                    const weightChange = previousWeight > 0 ? latestWeight - previousWeight : 0;

                    return (
                      <div key={animalId} className="p-4 border rounded-lg">
                        <div className="flex justify-between items-start mb-3">
                          <div>
                            <div className="font-medium">{animal?.cowId || animal?.naitTag || 'Unknown'}</div>
                            <div className="text-sm text-muted-foreground">{animal?.breed}</div>
                          </div>
                          <div className="text-right">
                            <div className="text-xl font-bold">{latestWeight} kg</div>
                            {weightChange !== 0 && (
                              <div className={`flex items-center gap-1 text-sm ${weightChange > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                {weightChange > 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                                {weightChange > 0 ? '+' : ''}{weightChange.toFixed(1)} kg
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex gap-2 flex-wrap">
                          {sortedRecords.slice(0, 5).map((record, idx) => (
                            <Badge key={record.id} variant={idx === 0 ? "default" : "outline"}>
                              {format(new Date(record.date), "MMM d")}: {record.weight}kg
                            </Badge>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Weight Targets Tab */}
        <TabsContent value="targets" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Weight Targets</CardTitle>
              <CardDescription>Set and track weight goals for animals</CardDescription>
            </CardHeader>
            <CardContent>
              {weightTargets.length === 0 ? (
                <div className="text-center py-8">
                  <Target className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">No weight targets set</p>
                  <Button className="mt-4" onClick={() => setShowTargetDialog(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Set First Target
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {weightTargets.map((target) => {
                    const animal = animals.find(a => a.id === target.animalId);
                    const daysUntil = differenceInDays(new Date(target.targetDate), new Date());
                    
                    return (
                      <div key={target.id} className="p-4 border rounded-lg">
                        <div className="flex justify-between items-center">
                          <div>
                            <div className="font-medium">
                              {animal ? (animal.cowId || animal.naitTag) : 'Herd Target'}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              Target: {target.targetWeight} kg by {format(new Date(target.targetDate), "MMM d, yyyy")}
                            </div>
                          </div>
                          <Badge variant={daysUntil < 0 ? "destructive" : daysUntil < 7 ? "secondary" : "outline"}>
                            {daysUntil < 0 ? 'Overdue' : `${daysUntil} days left`}
                          </Badge>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* BCS Distribution Tab */}
        <TabsContent value="bcs" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Body Condition Score Distribution</CardTitle>
              <CardDescription>Overview of herd body condition</CardDescription>
            </CardHeader>
            <CardContent>
              {(() => {
                const bcsDistribution = [1, 2, 3, 4, 5].map(score => ({
                  score,
                  count: weightRecords.filter(r => r.bodyConditionScore === score).length,
                }));
                const maxCount = Math.max(...bcsDistribution.map(d => d.count), 1);

                return (
                  <div className="space-y-4">
                    {bcsDistribution.map(({ score, count }) => (
                      <div key={score} className="flex items-center gap-4">
                        <div className="w-16 text-sm font-medium">BCS {score}</div>
                        <div className="flex-1">
                          <Progress 
                            value={(count / maxCount) * 100} 
                            className={`h-6 ${
                              score < 3 ? '[&>div]:bg-orange-500' :
                              score <= 3.5 ? '[&>div]:bg-green-500' :
                              '[&>div]:bg-yellow-500'
                            }`}
                          />
                        </div>
                        <div className="w-16 text-right">
                          <Badge variant="outline">{count}</Badge>
                        </div>
                      </div>
                    ))}
                    <div className="mt-6 p-4 bg-muted rounded-lg">
                      <h4 className="font-medium mb-2">BCS Guide</h4>
                      <div className="grid grid-cols-5 gap-2 text-xs">
                        <div className="text-center">
                          <Badge className="bg-red-100 text-red-800">1</Badge>
                          <div>Emaciated</div>
                        </div>
                        <div className="text-center">
                          <Badge className="bg-orange-100 text-orange-800">2</Badge>
                          <div>Thin</div>
                        </div>
                        <div className="text-center">
                          <Badge className="bg-green-100 text-green-800">3</Badge>
                          <div>Optimal</div>
                        </div>
                        <div className="text-center">
                          <Badge className="bg-yellow-100 text-yellow-800">4</Badge>
                          <div>Fat</div>
                        </div>
                        <div className="text-center">
                          <Badge className="bg-red-100 text-red-800">5</Badge>
                          <div>Obese</div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Record Weight Dialog */}
      <Dialog open={showRecordDialog} onOpenChange={setShowRecordDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record Weight & BCS</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div>
              <Label>Animal *</Label>
              <Select value={newRecord.animalId} onValueChange={(v) => setNewRecord({ ...newRecord, animalId: v })}>
                <SelectTrigger><SelectValue placeholder="Select animal" /></SelectTrigger>
                <SelectContent>
                  {animals.filter(a => a.status === 'active').map((animal) => (
                    <SelectItem key={animal.id} value={animal.id}>
                      {animal.cowId || animal.naitTag} - {animal.breed}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Date</Label>
                <Input 
                  type="date"
                  value={newRecord.recordDate} 
                  onChange={(e) => setNewRecord({ ...newRecord, recordDate: e.target.value })}
                />
              </div>
              <div>
                <Label>Method</Label>
                <Select value={newRecord.measurementMethod} onValueChange={(v) => setNewRecord({ ...newRecord, measurementMethod: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="scale">Scale</SelectItem>
                    <SelectItem value="tape">Weight Tape</SelectItem>
                    <SelectItem value="visual">Visual Estimate</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Weight (kg) *</Label>
                <Input 
                  type="number"
                  value={newRecord.weight} 
                  onChange={(e) => setNewRecord({ ...newRecord, weight: e.target.value })}
                  placeholder="e.g., 450"
                />
              </div>
              <div>
                <Label>Body Condition Score (1-5)</Label>
                <Select value={newRecord.bodyConditionScore} onValueChange={(v) => setNewRecord({ ...newRecord, bodyConditionScore: v })}>
                  <SelectTrigger><SelectValue placeholder="Select BCS" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1 - Emaciated</SelectItem>
                    <SelectItem value="2">2 - Thin</SelectItem>
                    <SelectItem value="3">3 - Optimal</SelectItem>
                    <SelectItem value="4">4 - Fat</SelectItem>
                    <SelectItem value="5">5 - Obese</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea 
                value={newRecord.notes} 
                onChange={(e) => setNewRecord({ ...newRecord, notes: e.target.value })}
                placeholder="Any observations..."
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowRecordDialog(false)}>Cancel</Button>
              <Button onClick={handleCreateRecord} disabled={createRecordMutation.isPending}>
                {createRecordMutation.isPending ? "Saving..." : "Save Record"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Set Target Dialog */}
      <Dialog open={showTargetDialog} onOpenChange={setShowTargetDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Set Weight Target</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div>
              <Label>Animal (optional - leave blank for herd target)</Label>
              <Select value={newTarget.animalId} onValueChange={(v) => setNewTarget({ ...newTarget, animalId: v })}>
                <SelectTrigger><SelectValue placeholder="Select animal or leave blank" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Herd Target</SelectItem>
                  {animals.filter(a => a.status === 'active').map((animal) => (
                    <SelectItem key={animal.id} value={animal.id}>
                      {animal.cowId || animal.naitTag}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Target Weight (kg) *</Label>
                <Input 
                  type="number"
                  value={newTarget.targetWeight} 
                  onChange={(e) => setNewTarget({ ...newTarget, targetWeight: e.target.value })}
                  placeholder="e.g., 500"
                />
              </div>
              <div>
                <Label>Target Date</Label>
                <Input 
                  type="date"
                  value={newTarget.targetDate} 
                  onChange={(e) => setNewTarget({ ...newTarget, targetDate: e.target.value })}
                />
              </div>
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea 
                value={newTarget.notes} 
                onChange={(e) => setNewTarget({ ...newTarget, notes: e.target.value })}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowTargetDialog(false)}>Cancel</Button>
              <Button onClick={handleCreateTarget} disabled={createTargetMutation.isPending}>
                {createTargetMutation.isPending ? "Saving..." : "Set Target"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
