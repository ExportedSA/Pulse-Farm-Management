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
import { format, differenceInDays, addDays } from "date-fns";
import { 
  Heart, Calendar, Plus, Baby, Activity, TrendingUp, 
  AlertTriangle, Users, Droplets, Clock
} from "lucide-react";
import type { Bull, BreedingRecord, CalvingRecord, LactationRecord, HeatRecord, Animal, User } from "@shared/schema";

export default function ReproductionDashboard() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [showBreedingDialog, setShowBreedingDialog] = useState(false);
  const [showHeatDialog, setShowHeatDialog] = useState(false);
  const [showBullDialog, setShowBullDialog] = useState(false);

  // Form states
  const [newBreeding, setNewBreeding] = useState({
    animalId: "",
    bullId: "",
    breedingDate: format(new Date(), "yyyy-MM-dd"),
    breedingMethod: "ai" as "natural" | "ai" | "et",
    heatDetectedDate: "",
    heatIntensity: "" as "" | "weak" | "moderate" | "strong",
    serviceNumber: "1",
    notes: "",
  });

  const [newHeat, setNewHeat] = useState({
    animalId: "",
    detectionDate: format(new Date(), "yyyy-MM-dd"),
    detectionTime: "",
    intensity: "" as "" | "weak" | "moderate" | "strong",
    detectionMethod: "visual",
    breedingPlanned: false,
    notes: "",
  });

  const [newBull, setNewBull] = useState({
    name: "",
    code: "",
    breed: "",
    isOwned: false,
    strawsAvailable: "",
    supplier: "",
    notes: "",
  });

  // Fetch data
  const { data: animals = [] } = useQuery<Animal[]>({
    queryKey: ["/api/animals"],
    queryFn: async () => {
      const res = await fetch("/api/animals");
      if (!res.ok) throw new Error("Failed to fetch animals");
      return res.json();
    },
  });

  const { data: bulls = [], isLoading: loadingBulls } = useQuery<Bull[]>({
    queryKey: ["/api/reproduction/bulls"],
    queryFn: async () => {
      const res = await fetch("/api/reproduction/bulls");
      if (!res.ok) throw new Error("Failed to fetch bulls");
      return res.json();
    },
  });

  const { data: breedingRecords = [], isLoading: loadingBreeding } = useQuery<BreedingRecord[]>({
    queryKey: ["/api/reproduction/breeding"],
    queryFn: async () => {
      const res = await fetch("/api/reproduction/breeding");
      if (!res.ok) throw new Error("Failed to fetch breeding records");
      return res.json();
    },
  });

  const { data: expectedCalvings = [] } = useQuery<BreedingRecord[]>({
    queryKey: ["/api/reproduction/breeding/expected-calvings"],
    queryFn: async () => {
      const res = await fetch("/api/reproduction/breeding/expected-calvings?days=60");
      if (!res.ok) throw new Error("Failed to fetch expected calvings");
      return res.json();
    },
  });

  const { data: calvingRecords = [], isLoading: loadingCalving } = useQuery<CalvingRecord[]>({
    queryKey: ["/api/reproduction/calving"],
    queryFn: async () => {
      const res = await fetch("/api/reproduction/calving");
      if (!res.ok) throw new Error("Failed to fetch calving records");
      return res.json();
    },
  });

  const { data: calvingStats = [] } = useQuery<{ difficulty: string; count: number }[]>({
    queryKey: ["/api/reproduction/calving/difficulty-stats"],
    queryFn: async () => {
      const res = await fetch("/api/reproduction/calving/difficulty-stats");
      if (!res.ok) throw new Error("Failed to fetch calving stats");
      return res.json();
    },
  });

  const { data: dryCows = [] } = useQuery<LactationRecord[]>({
    queryKey: ["/api/reproduction/lactation/dry-cows"],
    queryFn: async () => {
      const res = await fetch("/api/reproduction/lactation/dry-cows");
      if (!res.ok) throw new Error("Failed to fetch dry cows");
      return res.json();
    },
  });

  const { data: predictedHeats = [] } = useQuery<HeatRecord[]>({
    queryKey: ["/api/reproduction/heat/predicted"],
    queryFn: async () => {
      const res = await fetch("/api/reproduction/heat/predicted?days=7");
      if (!res.ok) throw new Error("Failed to fetch predicted heats");
      return res.json();
    },
  });

  const { data: users = [] } = useQuery<User[]>({
    queryKey: ["/api/users"],
    queryFn: async () => {
      const res = await fetch("/api/users");
      if (!res.ok) throw new Error("Failed to fetch users");
      return res.json();
    },
  });

  // Mutations
  const createBreedingMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch("/api/reproduction/breeding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to create breeding record");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/reproduction"] });
      setShowBreedingDialog(false);
      resetBreedingForm();
      toast.success("Breeding record created");
    },
    onError: () => toast.error("Failed to create breeding record"),
  });

  const createHeatMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch("/api/reproduction/heat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to create heat record");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/reproduction"] });
      setShowHeatDialog(false);
      resetHeatForm();
      toast.success("Heat record created - next heat predicted");
    },
    onError: () => toast.error("Failed to create heat record"),
  });

  const createBullMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch("/api/reproduction/bulls", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to create bull");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/reproduction/bulls"] });
      setShowBullDialog(false);
      resetBullForm();
      toast.success("Bull/sire added");
    },
    onError: () => toast.error("Failed to add bull"),
  });

  const resetBreedingForm = () => {
    setNewBreeding({
      animalId: "",
      bullId: "",
      breedingDate: format(new Date(), "yyyy-MM-dd"),
      breedingMethod: "ai",
      heatDetectedDate: "",
      heatIntensity: "",
      serviceNumber: "1",
      notes: "",
    });
  };

  const resetHeatForm = () => {
    setNewHeat({
      animalId: "",
      detectionDate: format(new Date(), "yyyy-MM-dd"),
      detectionTime: "",
      intensity: "",
      detectionMethod: "visual",
      breedingPlanned: false,
      notes: "",
    });
  };

  const resetBullForm = () => {
    setNewBull({
      name: "",
      code: "",
      breed: "",
      isOwned: false,
      strawsAvailable: "",
      supplier: "",
      notes: "",
    });
  };

  const handleCreateBreeding = () => {
    if (!newBreeding.animalId) {
      toast.error("Please select an animal");
      return;
    }
    createBreedingMutation.mutate({
      ...newBreeding,
      serviceNumber: parseInt(newBreeding.serviceNumber) || 1,
      heatIntensity: newBreeding.heatIntensity || null,
      recordedBy: user?.id,
    });
  };

  const handleCreateHeat = () => {
    if (!newHeat.animalId) {
      toast.error("Please select an animal");
      return;
    }
    createHeatMutation.mutate({
      ...newHeat,
      intensity: newHeat.intensity || null,
      detectedBy: user?.id,
    });
  };

  const handleCreateBull = () => {
    if (!newBull.name) {
      toast.error("Please enter a bull name");
      return;
    }
    createBullMutation.mutate({
      ...newBull,
      strawsAvailable: newBull.strawsAvailable ? parseInt(newBull.strawsAvailable) : 0,
    });
  };

  const getAnimalName = (animalId: string) => {
    const animal = animals.find(a => a.id === animalId);
    return animal?.cowId || animal?.naitTag || animalId.slice(0, 8);
  };

  const getBullName = (bullId: string | null) => {
    if (!bullId) return "Unknown";
    const bull = bulls.find(b => b.id === bullId);
    return bull?.name || bull?.code || bullId.slice(0, 8);
  };

  // Calculate stats
  const femaleAnimals = animals.filter(a => a.sex === 'female' && a.status === 'active');
  const confirmedPregnancies = breedingRecords.filter(r => r.conceptionConfirmed).length;
  const totalBreedings = breedingRecords.length;
  const conceptionRate = totalBreedings > 0 ? ((confirmedPregnancies / totalBreedings) * 100).toFixed(1) : "0";

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Heart className="h-8 w-8 text-pink-600" />
            Reproduction Management
          </h1>
          <p className="text-muted-foreground mt-1">
            Breeding calendar, heat detection, calving management, and lactation tracking
          </p>
        </div>
        <div className="flex gap-2">
          <Dialog open={showHeatDialog} onOpenChange={setShowHeatDialog}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Activity className="h-4 w-4 mr-2" />
                Record Heat
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Record Heat Detection</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 mt-4">
                <div>
                  <Label>Animal *</Label>
                  <Select value={newHeat.animalId} onValueChange={(v) => setNewHeat({ ...newHeat, animalId: v })}>
                    <SelectTrigger><SelectValue placeholder="Select animal" /></SelectTrigger>
                    <SelectContent>
                      {femaleAnimals.map((animal) => (
                        <SelectItem key={animal.id} value={animal.id}>
                          {animal.cowId || animal.naitTag || animal.id.slice(0, 8)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Detection Date</Label>
                    <Input type="date" value={newHeat.detectionDate} onChange={(e) => setNewHeat({ ...newHeat, detectionDate: e.target.value })} />
                  </div>
                  <div>
                    <Label>Time</Label>
                    <Input type="time" value={newHeat.detectionTime} onChange={(e) => setNewHeat({ ...newHeat, detectionTime: e.target.value })} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Intensity</Label>
                    <Select value={newHeat.intensity} onValueChange={(v) => setNewHeat({ ...newHeat, intensity: v as any })}>
                      <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="weak">Weak</SelectItem>
                        <SelectItem value="moderate">Moderate</SelectItem>
                        <SelectItem value="strong">Strong</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Detection Method</Label>
                    <Select value={newHeat.detectionMethod} onValueChange={(v) => setNewHeat({ ...newHeat, detectionMethod: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="visual">Visual</SelectItem>
                        <SelectItem value="sensor">Sensor</SelectItem>
                        <SelectItem value="tail_paint">Tail Paint</SelectItem>
                        <SelectItem value="mount_detector">Mount Detector</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <Label>Notes</Label>
                  <Textarea value={newHeat.notes} onChange={(e) => setNewHeat({ ...newHeat, notes: e.target.value })} />
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setShowHeatDialog(false)}>Cancel</Button>
                  <Button onClick={handleCreateHeat} disabled={createHeatMutation.isPending}>
                    {createHeatMutation.isPending ? "Recording..." : "Record Heat"}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={showBreedingDialog} onOpenChange={setShowBreedingDialog}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Record Breeding
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Record Breeding Event</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 mt-4">
                <div>
                  <Label>Animal *</Label>
                  <Select value={newBreeding.animalId} onValueChange={(v) => setNewBreeding({ ...newBreeding, animalId: v })}>
                    <SelectTrigger><SelectValue placeholder="Select animal" /></SelectTrigger>
                    <SelectContent>
                      {femaleAnimals.map((animal) => (
                        <SelectItem key={animal.id} value={animal.id}>
                          {animal.cowId || animal.naitTag || animal.id.slice(0, 8)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Breeding Date</Label>
                    <Input type="date" value={newBreeding.breedingDate} onChange={(e) => setNewBreeding({ ...newBreeding, breedingDate: e.target.value })} />
                  </div>
                  <div>
                    <Label>Method</Label>
                    <Select value={newBreeding.breedingMethod} onValueChange={(v) => setNewBreeding({ ...newBreeding, breedingMethod: v as any })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ai">AI (Artificial Insemination)</SelectItem>
                        <SelectItem value="natural">Natural Mating</SelectItem>
                        <SelectItem value="et">Embryo Transfer</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <Label>Bull/Sire</Label>
                  <Select value={newBreeding.bullId} onValueChange={(v) => setNewBreeding({ ...newBreeding, bullId: v })}>
                    <SelectTrigger><SelectValue placeholder="Select bull" /></SelectTrigger>
                    <SelectContent>
                      {bulls.map((bull) => (
                        <SelectItem key={bull.id} value={bull.id}>
                          {bull.name} {bull.code && `(${bull.code})`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Service Number</Label>
                  <Input type="number" min="1" value={newBreeding.serviceNumber} onChange={(e) => setNewBreeding({ ...newBreeding, serviceNumber: e.target.value })} />
                </div>
                <div>
                  <Label>Notes</Label>
                  <Textarea value={newBreeding.notes} onChange={(e) => setNewBreeding({ ...newBreeding, notes: e.target.value })} />
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setShowBreedingDialog(false)}>Cancel</Button>
                  <Button onClick={handleCreateBreeding} disabled={createBreedingMutation.isPending}>
                    {createBreedingMutation.isPending ? "Recording..." : "Record Breeding"}
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
            <CardTitle className="text-sm font-medium">Predicted Heats</CardTitle>
            <Activity className="h-4 w-4 text-pink-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-pink-600">{predictedHeats.length}</div>
            <p className="text-xs text-muted-foreground">Next 7 days</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Expected Calvings</CardTitle>
            <Baby className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{expectedCalvings.length}</div>
            <p className="text-xs text-muted-foreground">Next 60 days</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Conception Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{conceptionRate}%</div>
            <p className="text-xs text-muted-foreground">{confirmedPregnancies}/{totalBreedings} confirmed</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Dry Cows</CardTitle>
            <Droplets className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{dryCows.length}</div>
            <p className="text-xs text-muted-foreground">In dry period</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Bulls/Sires</CardTitle>
            <Users className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">{bulls.length}</div>
            <p className="text-xs text-muted-foreground">Active sires</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Tabs */}
      <Tabs defaultValue="calendar" className="space-y-4">
        <TabsList>
          <TabsTrigger value="calendar">
            <Calendar className="h-4 w-4 mr-2" />
            Breeding Calendar
          </TabsTrigger>
          <TabsTrigger value="heats">
            <Activity className="h-4 w-4 mr-2" />
            Heat Detection
          </TabsTrigger>
          <TabsTrigger value="calving">
            <Baby className="h-4 w-4 mr-2" />
            Calving
          </TabsTrigger>
          <TabsTrigger value="bulls">
            <Users className="h-4 w-4 mr-2" />
            Bull Management
          </TabsTrigger>
        </TabsList>

        {/* Breeding Calendar Tab */}
        <TabsContent value="calendar" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Recent Breedings</CardTitle>
                <CardDescription>Latest breeding events</CardDescription>
              </CardHeader>
              <CardContent>
                {loadingBreeding ? (
                  <Skeleton className="h-32 w-full" />
                ) : breedingRecords.length === 0 ? (
                  <p className="text-muted-foreground text-center py-4">No breeding records yet</p>
                ) : (
                  <div className="space-y-3 max-h-80 overflow-y-auto">
                    {breedingRecords.slice(0, 10).map((record) => (
                      <div key={record.id} className="p-3 border rounded-lg">
                        <div className="flex justify-between items-start">
                          <div>
                            <div className="font-medium">{getAnimalName(record.animalId)}</div>
                            <div className="text-sm text-muted-foreground">
                              {format(new Date(record.breedingDate), 'MMM d, yyyy')} • {getBullName(record.bullId)}
                            </div>
                          </div>
                          <div className="text-right">
                            <Badge variant="outline" className="capitalize">{record.breedingMethod}</Badge>
                            {record.conceptionConfirmed && (
                              <Badge variant="default" className="ml-2">Confirmed</Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Expected Calvings</CardTitle>
                <CardDescription>Upcoming calving dates</CardDescription>
              </CardHeader>
              <CardContent>
                {expectedCalvings.length === 0 ? (
                  <p className="text-muted-foreground text-center py-4">No expected calvings</p>
                ) : (
                  <div className="space-y-3 max-h-80 overflow-y-auto">
                    {expectedCalvings.map((record) => {
                      const daysUntil = record.expectedCalvingDate 
                        ? differenceInDays(new Date(record.expectedCalvingDate), new Date())
                        : null;
                      return (
                        <div key={record.id} className="p-3 border rounded-lg">
                          <div className="flex justify-between items-start">
                            <div>
                              <div className="font-medium">{getAnimalName(record.animalId)}</div>
                              <div className="text-sm text-muted-foreground">
                                Sire: {getBullName(record.bullId)}
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="font-medium text-green-600">
                                {record.expectedCalvingDate && format(new Date(record.expectedCalvingDate), 'MMM d')}
                              </div>
                              {daysUntil !== null && (
                                <div className="text-xs text-muted-foreground">
                                  {daysUntil <= 0 ? 'Due now' : `${daysUntil} days`}
                                </div>
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
          </div>
        </TabsContent>

        {/* Heat Detection Tab */}
        <TabsContent value="heats" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Predicted Heats (Next 7 Days)</CardTitle>
              <CardDescription>Animals expected to come into heat</CardDescription>
            </CardHeader>
            <CardContent>
              {predictedHeats.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">No predicted heats. Record observed heats to generate predictions.</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {predictedHeats.map((heat) => {
                    const daysUntil = differenceInDays(new Date(heat.detectionDate), new Date());
                    return (
                      <div key={heat.id} className={`p-4 border rounded-lg ${daysUntil <= 1 ? 'border-pink-300 bg-pink-50' : ''}`}>
                        <div className="flex justify-between items-start">
                          <div className="font-medium">{getAnimalName(heat.animalId)}</div>
                          {daysUntil <= 1 && <Badge variant="destructive">Imminent</Badge>}
                        </div>
                        <div className="text-sm text-muted-foreground mt-1">
                          Expected: {format(new Date(heat.detectionDate), 'MMM d, yyyy')}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {heat.cycleLength} day cycle
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Calving Tab */}
        <TabsContent value="calving" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Calving Difficulty Analysis</CardTitle>
                <CardDescription>Distribution of calving difficulties</CardDescription>
              </CardHeader>
              <CardContent>
                {calvingStats.length === 0 ? (
                  <p className="text-muted-foreground text-center py-4">No calving data yet</p>
                ) : (
                  <div className="space-y-3">
                    {calvingStats.map((stat) => (
                      <div key={stat.difficulty} className="flex justify-between items-center">
                        <div className="flex items-center gap-2">
                          <Badge variant={
                            stat.difficulty === 'easy' ? 'default' :
                            stat.difficulty === 'assisted' ? 'secondary' :
                            'destructive'
                          } className="capitalize">
                            {stat.difficulty}
                          </Badge>
                        </div>
                        <div className="font-medium">{stat.count} calvings</div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Recent Calvings</CardTitle>
                <CardDescription>Latest calving events</CardDescription>
              </CardHeader>
              <CardContent>
                {loadingCalving ? (
                  <Skeleton className="h-32 w-full" />
                ) : calvingRecords.length === 0 ? (
                  <p className="text-muted-foreground text-center py-4">No calving records yet</p>
                ) : (
                  <div className="space-y-3 max-h-64 overflow-y-auto">
                    {calvingRecords.slice(0, 8).map((record) => (
                      <div key={record.id} className="p-3 border rounded-lg">
                        <div className="flex justify-between items-start">
                          <div>
                            <div className="font-medium">{getAnimalName(record.damId)}</div>
                            <div className="text-sm text-muted-foreground">
                              {format(new Date(record.calvingDate), 'MMM d, yyyy')}
                            </div>
                          </div>
                          <div className="text-right">
                            {record.calfSex && (
                              <Badge variant="outline" className="capitalize">{record.calfSex}</Badge>
                            )}
                            {record.calvingDifficulty && (
                              <Badge variant={record.calvingDifficulty === 'easy' ? 'default' : 'secondary'} className="ml-1 capitalize">
                                {record.calvingDifficulty}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Bull Management Tab */}
        <TabsContent value="bulls" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Bull/Sire Registry</CardTitle>
                <CardDescription>Manage bulls and AI sires</CardDescription>
              </div>
              <Dialog open={showBullDialog} onOpenChange={setShowBullDialog}>
                <DialogTrigger asChild>
                  <Button size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Bull
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add Bull/Sire</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 mt-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Name *</Label>
                        <Input value={newBull.name} onChange={(e) => setNewBull({ ...newBull, name: e.target.value })} />
                      </div>
                      <div>
                        <Label>Code</Label>
                        <Input placeholder="e.g., ABC123" value={newBull.code} onChange={(e) => setNewBull({ ...newBull, code: e.target.value })} />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Breed</Label>
                        <Input value={newBull.breed} onChange={(e) => setNewBull({ ...newBull, breed: e.target.value })} />
                      </div>
                      <div>
                        <Label>Straws Available</Label>
                        <Input type="number" value={newBull.strawsAvailable} onChange={(e) => setNewBull({ ...newBull, strawsAvailable: e.target.value })} />
                      </div>
                    </div>
                    <div>
                      <Label>Supplier</Label>
                      <Input value={newBull.supplier} onChange={(e) => setNewBull({ ...newBull, supplier: e.target.value })} />
                    </div>
                    <div>
                      <Label>Notes</Label>
                      <Textarea value={newBull.notes} onChange={(e) => setNewBull({ ...newBull, notes: e.target.value })} />
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" onClick={() => setShowBullDialog(false)}>Cancel</Button>
                      <Button onClick={handleCreateBull} disabled={createBullMutation.isPending}>
                        {createBullMutation.isPending ? "Adding..." : "Add Bull"}
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              {loadingBulls ? (
                <Skeleton className="h-32 w-full" />
              ) : bulls.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">No bulls registered yet</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {bulls.map((bull) => (
                    <div key={bull.id} className="p-4 border rounded-lg">
                      <div className="flex justify-between items-start mb-2">
                        <div className="font-medium">{bull.name}</div>
                        {bull.code && <Badge variant="outline">{bull.code}</Badge>}
                      </div>
                      <div className="text-sm text-muted-foreground space-y-1">
                        {bull.breed && <div>Breed: {bull.breed}</div>}
                        {bull.strawsAvailable !== null && bull.strawsAvailable > 0 && (
                          <div>Straws: {bull.strawsAvailable}</div>
                        )}
                        {bull.supplier && <div>Supplier: {bull.supplier}</div>}
                        {bull.fertilityRating && (
                          <div>Fertility: {bull.fertilityRating}%</div>
                        )}
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
