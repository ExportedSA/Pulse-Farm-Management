import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import { format, subDays, differenceInDays } from "date-fns";
import { 
  Scale, TrendingUp, TrendingDown, Plus, Target, Search,
  AlertTriangle, CheckCircle2, Users, Calendar, BarChart3,
  Loader2, LineChart, ArrowUp, ArrowDown, Minus, Eye,
  ClipboardList, Trash2
} from "lucide-react";
import type { Animal, WeightRecord, AnimalGroup } from "@shared/schema";

interface WeightStats {
  totalRecords: number;
  uniqueAnimals: number;
  totalAnimals: number;
  averageWeight: number;
  averageADG: number;
  weightRanges: {
    under200: number;
    range200to400: number;
    range400to600: number;
    over600: number;
  };
  coveragePercent: number;
}

interface GrowthData {
  animal: Animal;
  records: (WeightRecord & { adg: number | null; periodDays: number | null })[];
  growth: {
    firstWeight: number;
    lastWeight: number;
    totalGain: number;
    totalDays: number;
    overallADG: number;
    recordCount: number;
    currentAge: number | null;
  } | null;
}

export default function WeightGrowthTrackingPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  // State
  const [activeTab, setActiveTab] = useState("overview");
  const [dateRange, setDateRange] = useState("90");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedAnimalId, setSelectedAnimalId] = useState<string | null>(null);
  
  // Dialog states
  const [showRecordDialog, setShowRecordDialog] = useState(false);
  const [showBatchDialog, setShowBatchDialog] = useState(false);
  const [showGrowthDialog, setShowGrowthDialog] = useState(false);
  
  // Form states
  const [recordForm, setRecordForm] = useState({
    animalId: "",
    weight: "",
    date: format(new Date(), "yyyy-MM-dd"),
    bodyConditionScore: "",
    notes: "",
  });
  
  const [batchForm, setBatchForm] = useState({
    sessionName: "",
    sessionDate: format(new Date(), "yyyy-MM-dd"),
    records: [] as { animalId: string; weight: string; bcs: string }[],
  });

  // Fetch animals
  const { data: animals = [] } = useQuery<Animal[]>({
    queryKey: ["/api/animals"],
    queryFn: async () => {
      const res = await fetch("/api/animals");
      if (!res.ok) throw new Error("Failed to fetch animals");
      return res.json();
    },
  });

  // Fetch weight stats
  const { data: stats, isLoading: loadingStats } = useQuery<WeightStats>({
    queryKey: ["/api/weight/stats", dateRange],
    queryFn: async () => {
      const startDate = format(subDays(new Date(), parseInt(dateRange)), "yyyy-MM-dd");
      const res = await fetch(`/api/weight/stats?startDate=${startDate}`);
      if (!res.ok) throw new Error("Failed to fetch stats");
      return res.json();
    },
  });

  // Fetch weight records
  const { data: weightRecords = [], isLoading: loadingRecords } = useQuery<WeightRecord[]>({
    queryKey: ["/api/weight/records", dateRange],
    queryFn: async () => {
      const startDate = format(subDays(new Date(), parseInt(dateRange)), "yyyy-MM-dd");
      const res = await fetch(`/api/weight/records?startDate=${startDate}`);
      if (!res.ok) throw new Error("Failed to fetch records");
      return res.json();
    },
  });

  // Fetch growth data for selected animal
  const { data: growthData, isLoading: loadingGrowth } = useQuery<GrowthData>({
    queryKey: ["/api/weight/growth", selectedAnimalId],
    queryFn: async () => {
      const res = await fetch(`/api/weight/growth/${selectedAnimalId}`);
      if (!res.ok) throw new Error("Failed to fetch growth data");
      return res.json();
    },
    enabled: !!selectedAnimalId,
  });

  // Fetch groups
  const { data: groups = [] } = useQuery<AnimalGroup[]>({
    queryKey: ["/api/groups"],
    queryFn: async () => {
      const res = await fetch("/api/groups");
      if (!res.ok) throw new Error("Failed to fetch groups");
      return res.json();
    },
  });

  // Create weight record mutation
  const createRecordMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch("/api/weight/records", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to create record");
      return res.json();
    },
    onSuccess: () => {
      toast.success("Weight recorded");
      queryClient.invalidateQueries({ queryKey: ["/api/weight"] });
      setShowRecordDialog(false);
      resetRecordForm();
    },
    onError: () => toast.error("Failed to record weight"),
  });

  // Batch record mutation
  const batchRecordMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch("/api/weight/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to batch record");
      return res.json();
    },
    onSuccess: (data) => {
      toast.success(`Recorded ${data.success} weights`);
      if (data.failed > 0) {
        toast.warning(`${data.failed} records failed`);
      }
      queryClient.invalidateQueries({ queryKey: ["/api/weight"] });
      setShowBatchDialog(false);
      resetBatchForm();
    },
    onError: () => toast.error("Failed to batch record"),
  });

  // Delete record mutation
  const deleteRecordMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/weight/records/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
    },
    onSuccess: () => {
      toast.success("Record deleted");
      queryClient.invalidateQueries({ queryKey: ["/api/weight"] });
    },
    onError: () => toast.error("Failed to delete record"),
  });

  // Reset forms
  const resetRecordForm = () => {
    setRecordForm({
      animalId: "",
      weight: "",
      date: format(new Date(), "yyyy-MM-dd"),
      bodyConditionScore: "",
      notes: "",
    });
  };

  const resetBatchForm = () => {
    setBatchForm({
      sessionName: "",
      sessionDate: format(new Date(), "yyyy-MM-dd"),
      records: [],
    });
  };

  // Handle record submit
  const handleRecordSubmit = () => {
    if (!recordForm.animalId || !recordForm.weight) {
      toast.error("Please select animal and enter weight");
      return;
    }
    createRecordMutation.mutate({
      animalId: recordForm.animalId,
      weight: parseFloat(recordForm.weight),
      date: recordForm.date,
      bodyConditionScore: recordForm.bodyConditionScore ? parseInt(recordForm.bodyConditionScore) : null,
      notes: recordForm.notes || null,
      recordedBy: user?.id,
    });
  };

  // Handle batch submit
  const handleBatchSubmit = () => {
    const validRecords = batchForm.records.filter(r => r.animalId && r.weight);
    if (validRecords.length === 0) {
      toast.error("No valid records to submit");
      return;
    }
    batchRecordMutation.mutate({
      sessionName: batchForm.sessionName || undefined,
      sessionDate: batchForm.sessionDate,
      records: validRecords.map(r => ({
        animalId: r.animalId,
        weight: parseFloat(r.weight),
        bodyConditionScore: r.bcs ? parseInt(r.bcs) : undefined,
      })),
      recordedBy: user?.id,
    });
  };

  // Add animal to batch
  const addToBatch = (animalId: string) => {
    if (batchForm.records.some(r => r.animalId === animalId)) return;
    setBatchForm({
      ...batchForm,
      records: [...batchForm.records, { animalId, weight: "", bcs: "" }],
    });
  };

  // Update batch record
  const updateBatchRecord = (index: number, field: string, value: string) => {
    const newRecords = [...batchForm.records];
    (newRecords[index] as any)[field] = value;
    setBatchForm({ ...batchForm, records: newRecords });
  };

  // Remove from batch
  const removeFromBatch = (index: number) => {
    setBatchForm({
      ...batchForm,
      records: batchForm.records.filter((_, i) => i !== index),
    });
  };

  // Filter animals
  const filteredAnimals = useMemo(() => {
    const active = animals.filter(a => a.status === "active");
    if (!searchQuery) return active;
    const query = searchQuery.toLowerCase();
    return active.filter(a => 
      a.cowId?.toLowerCase().includes(query) ||
      a.naitTag?.toLowerCase().includes(query) ||
      a.eid?.toLowerCase().includes(query)
    );
  }, [animals, searchQuery]);

  // Get animal name
  const getAnimalName = (animalId: string) => {
    const animal = animals.find(a => a.id === animalId);
    return animal?.cowId || animal?.naitTag || animalId.slice(0, 8);
  };

  // Group records by animal
  const recordsByAnimal = useMemo(() => {
    const grouped: Record<string, WeightRecord[]> = {};
    weightRecords.forEach(r => {
      if (!grouped[r.animalId]) grouped[r.animalId] = [];
      grouped[r.animalId].push(r);
    });
    return grouped;
  }, [weightRecords]);

  // Calculate ADG for display
  const getADG = (animalId: string) => {
    const records = recordsByAnimal[animalId];
    if (!records || records.length < 2) return null;
    const sorted = [...records].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    const first = sorted[0];
    const last = sorted[sorted.length - 1];
    const days = differenceInDays(new Date(last.date), new Date(first.date));
    if (days <= 0) return null;
    return (parseFloat(last.weight) - parseFloat(first.weight)) / days;
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Scale className="h-8 w-8 text-blue-600" />
            Weight & Growth Tracking
          </h1>
          <p className="text-muted-foreground mt-1">
            Monitor weights, calculate ADG, and track growth performance
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={dateRange} onValueChange={setDateRange}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="30">30 days</SelectItem>
              <SelectItem value="90">90 days</SelectItem>
              <SelectItem value="180">6 months</SelectItem>
              <SelectItem value="365">1 year</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={() => setShowBatchDialog(true)}>
            <ClipboardList className="h-4 w-4 mr-2" />
            Batch Weigh
          </Button>
          <Button onClick={() => setShowRecordDialog(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Record Weight
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Records</p>
                <p className="text-2xl font-bold">{stats?.totalRecords || 0}</p>
              </div>
              <Scale className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Avg Weight</p>
                <p className="text-2xl font-bold">{stats?.averageWeight || 0} kg</p>
              </div>
              <BarChart3 className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Avg ADG</p>
                <p className="text-2xl font-bold">
                  {stats?.averageADG ? `${stats.averageADG.toFixed(2)} kg` : "—"}
                </p>
              </div>
              <TrendingUp className="h-8 w-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Weighed</p>
                <p className="text-2xl font-bold">{stats?.uniqueAnimals || 0}</p>
              </div>
              <Users className="h-8 w-8 text-orange-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Coverage</p>
                <p className="text-2xl font-bold">{stats?.coveragePercent || 0}%</p>
              </div>
              <Target className="h-8 w-8 text-indigo-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Herd</p>
                <p className="text-2xl font-bold">{stats?.totalAnimals || 0}</p>
              </div>
              <CheckCircle2 className="h-8 w-8 text-teal-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="records">Weight Records</TabsTrigger>
          <TabsTrigger value="animals">By Animal</TabsTrigger>
          <TabsTrigger value="growth">Growth Analysis</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Weight Distribution */}
            <Card>
              <CardHeader>
                <CardTitle>Weight Distribution</CardTitle>
                <CardDescription>Animals by weight range</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span>&lt; 200 kg</span>
                    <span>{stats?.weightRanges?.under200 || 0}</span>
                  </div>
                  <Progress value={(stats?.weightRanges?.under200 || 0) / (stats?.totalRecords || 1) * 100} className="h-2" />
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span>200-400 kg</span>
                    <span>{stats?.weightRanges?.range200to400 || 0}</span>
                  </div>
                  <Progress value={(stats?.weightRanges?.range200to400 || 0) / (stats?.totalRecords || 1) * 100} className="h-2" />
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span>400-600 kg</span>
                    <span>{stats?.weightRanges?.range400to600 || 0}</span>
                  </div>
                  <Progress value={(stats?.weightRanges?.range400to600 || 0) / (stats?.totalRecords || 1) * 100} className="h-2" />
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span>&gt; 600 kg</span>
                    <span>{stats?.weightRanges?.over600 || 0}</span>
                  </div>
                  <Progress value={(stats?.weightRanges?.over600 || 0) / (stats?.totalRecords || 1) * 100} className="h-2" />
                </div>
              </CardContent>
            </Card>

            {/* Recent Records */}
            <Card>
              <CardHeader>
                <CardTitle>Recent Weights</CardTitle>
                <CardDescription>Latest weight recordings</CardDescription>
              </CardHeader>
              <CardContent>
                {weightRecords.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">No records yet</p>
                ) : (
                  <div className="space-y-2">
                    {weightRecords.slice(0, 8).map((record) => (
                      <div key={record.id} className="flex items-center justify-between p-2 bg-muted rounded">
                        <div>
                          <span className="font-medium">{getAnimalName(record.animalId)}</span>
                          <span className="text-xs text-muted-foreground ml-2">
                            {format(new Date(record.date), "MMM d")}
                          </span>
                        </div>
                        <Badge variant="outline">{parseFloat(record.weight).toFixed(0)} kg</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Coverage Alert */}
          {stats && stats.coveragePercent < 80 && (
            <Card className="border-orange-500 bg-orange-50">
              <CardContent className="pt-6">
                <div className="flex items-start gap-4">
                  <AlertTriangle className="h-6 w-6 text-orange-600" />
                  <div>
                    <p className="font-medium text-orange-800">
                      Low weighing coverage ({stats.coveragePercent}%)
                    </p>
                    <p className="text-sm text-orange-700 mt-1">
                      {stats.totalAnimals - stats.uniqueAnimals} animals haven't been weighed in the selected period.
                      Consider scheduling a weigh session.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Records Tab */}
        <TabsContent value="records" className="space-y-4">
          <Card>
            <CardContent className="p-0">
              {loadingRecords ? (
                <div className="p-8 text-center">Loading...</div>
              ) : weightRecords.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">
                  <Scale className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No weight records found</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Animal</TableHead>
                      <TableHead>Weight</TableHead>
                      <TableHead>BCS</TableHead>
                      <TableHead>Notes</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {weightRecords.slice(0, 50).map((record) => (
                      <TableRow key={record.id}>
                        <TableCell>{format(new Date(record.date), "MMM d, yyyy")}</TableCell>
                        <TableCell className="font-medium">{getAnimalName(record.animalId)}</TableCell>
                        <TableCell>{parseFloat(record.weight).toFixed(1)} kg</TableCell>
                        <TableCell>
                          {record.bodyConditionScore ? (
                            <Badge variant="outline">{record.bodyConditionScore}</Badge>
                          ) : "—"}
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate">
                          {record.notes || "—"}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => deleteRecordMutation.mutate(record.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* By Animal Tab */}
        <TabsContent value="animals" className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search animals..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Animal</TableHead>
                    <TableHead>Latest Weight</TableHead>
                    <TableHead>Last Weighed</TableHead>
                    <TableHead>Records</TableHead>
                    <TableHead>ADG</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAnimals.slice(0, 50).map((animal) => {
                    const records = recordsByAnimal[animal.id] || [];
                    const latest = records[0];
                    const adg = getADG(animal.id);
                    
                    return (
                      <TableRow key={animal.id}>
                        <TableCell className="font-medium">
                          {animal.cowId || animal.naitTag || animal.id.slice(0, 8)}
                        </TableCell>
                        <TableCell>
                          {latest ? `${parseFloat(latest.weight).toFixed(0)} kg` : "—"}
                        </TableCell>
                        <TableCell>
                          {latest ? format(new Date(latest.date), "MMM d") : "Never"}
                        </TableCell>
                        <TableCell>{records.length}</TableCell>
                        <TableCell>
                          {adg !== null ? (
                            <div className="flex items-center gap-1">
                              {adg > 0 ? (
                                <ArrowUp className="h-3 w-3 text-green-500" />
                              ) : adg < 0 ? (
                                <ArrowDown className="h-3 w-3 text-red-500" />
                              ) : (
                                <Minus className="h-3 w-3 text-gray-500" />
                              )}
                              <span className={adg > 0 ? "text-green-600" : adg < 0 ? "text-red-600" : ""}>
                                {adg.toFixed(2)} kg/day
                              </span>
                            </div>
                          ) : "—"}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setSelectedAnimalId(animal.id);
                              setShowGrowthDialog(true);
                            }}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Growth Analysis Tab */}
        <TabsContent value="growth" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Growth Performance</CardTitle>
              <CardDescription>
                Select an animal to view detailed growth analysis
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {Object.entries(recordsByAnimal)
                  .filter(([_, records]) => records.length >= 2)
                  .slice(0, 12)
                  .map(([animalId, records]) => {
                    const adg = getADG(animalId);
                    const latest = records[0];
                    return (
                      <Card 
                        key={animalId} 
                        className="cursor-pointer hover:shadow-md transition-shadow"
                        onClick={() => {
                          setSelectedAnimalId(animalId);
                          setShowGrowthDialog(true);
                        }}
                      >
                        <CardContent className="pt-4">
                          <div className="font-medium">{getAnimalName(animalId)}</div>
                          <div className="text-2xl font-bold mt-1">
                            {parseFloat(latest.weight).toFixed(0)} kg
                          </div>
                          {adg !== null && (
                            <div className={`text-sm flex items-center gap-1 ${
                              adg > 0 ? "text-green-600" : adg < 0 ? "text-red-600" : "text-gray-500"
                            }`}>
                              {adg > 0 ? <ArrowUp className="h-3 w-3" /> : 
                               adg < 0 ? <ArrowDown className="h-3 w-3" /> : 
                               <Minus className="h-3 w-3" />}
                              {adg.toFixed(2)} kg/day
                            </div>
                          )}
                          <div className="text-xs text-muted-foreground mt-1">
                            {records.length} records
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
              </div>
              {Object.keys(recordsByAnimal).filter(id => (recordsByAnimal[id]?.length || 0) >= 2).length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <LineChart className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Need at least 2 weight records per animal for growth analysis</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Record Weight Dialog */}
      <Dialog open={showRecordDialog} onOpenChange={setShowRecordDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record Weight</DialogTitle>
            <DialogDescription>Add a new weight measurement</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Animal *</Label>
              <Select
                value={recordForm.animalId}
                onValueChange={(v) => setRecordForm({ ...recordForm, animalId: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select animal" />
                </SelectTrigger>
                <SelectContent>
                  {filteredAnimals.map((animal) => (
                    <SelectItem key={animal.id} value={animal.id}>
                      {animal.cowId || animal.naitTag || animal.id.slice(0, 8)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Weight (kg) *</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={recordForm.weight}
                  onChange={(e) => setRecordForm({ ...recordForm, weight: e.target.value })}
                  placeholder="e.g., 450"
                />
              </div>
              <div>
                <Label>Date</Label>
                <Input
                  type="date"
                  value={recordForm.date}
                  onChange={(e) => setRecordForm({ ...recordForm, date: e.target.value })}
                />
              </div>
            </div>
            <div>
              <Label>Body Condition Score (1-5)</Label>
              <Select
                value={recordForm.bodyConditionScore}
                onValueChange={(v) => setRecordForm({ ...recordForm, bodyConditionScore: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Optional" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 - Very Thin</SelectItem>
                  <SelectItem value="2">2 - Thin</SelectItem>
                  <SelectItem value="3">3 - Good</SelectItem>
                  <SelectItem value="4">4 - Fat</SelectItem>
                  <SelectItem value="5">5 - Very Fat</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea
                value={recordForm.notes}
                onChange={(e) => setRecordForm({ ...recordForm, notes: e.target.value })}
                placeholder="Optional notes..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRecordDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleRecordSubmit} disabled={createRecordMutation.isPending}>
              {createRecordMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Batch Weigh Dialog */}
      <Dialog open={showBatchDialog} onOpenChange={setShowBatchDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>Batch Weigh Session</DialogTitle>
            <DialogDescription>Record weights for multiple animals at once</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Session Name</Label>
                <Input
                  value={batchForm.sessionName}
                  onChange={(e) => setBatchForm({ ...batchForm, sessionName: e.target.value })}
                  placeholder="e.g., Weekly Weigh"
                />
              </div>
              <div>
                <Label>Date</Label>
                <Input
                  type="date"
                  value={batchForm.sessionDate}
                  onChange={(e) => setBatchForm({ ...batchForm, sessionDate: e.target.value })}
                />
              </div>
            </div>

            <div>
              <Label>Add Animals</Label>
              <Select onValueChange={addToBatch}>
                <SelectTrigger>
                  <SelectValue placeholder="Select animal to add" />
                </SelectTrigger>
                <SelectContent>
                  {filteredAnimals
                    .filter(a => !batchForm.records.some(r => r.animalId === a.id))
                    .map((animal) => (
                      <SelectItem key={animal.id} value={animal.id}>
                        {animal.cowId || animal.naitTag || animal.id.slice(0, 8)}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            {batchForm.records.length > 0 && (
              <ScrollArea className="h-[300px] border rounded-md p-2">
                <div className="space-y-2">
                  {batchForm.records.map((record, index) => (
                    <div key={record.animalId} className="flex items-center gap-2 p-2 bg-muted rounded">
                      <span className="font-medium w-24">{getAnimalName(record.animalId)}</span>
                      <Input
                        type="number"
                        placeholder="Weight (kg)"
                        value={record.weight}
                        onChange={(e) => updateBatchRecord(index, "weight", e.target.value)}
                        className="w-28"
                      />
                      <Select
                        value={record.bcs}
                        onValueChange={(v) => updateBatchRecord(index, "bcs", v)}
                      >
                        <SelectTrigger className="w-20">
                          <SelectValue placeholder="BCS" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="1">1</SelectItem>
                          <SelectItem value="2">2</SelectItem>
                          <SelectItem value="3">3</SelectItem>
                          <SelectItem value="4">4</SelectItem>
                          <SelectItem value="5">5</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button variant="ghost" size="sm" onClick={() => removeFromBatch(index)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}

            {batchForm.records.length === 0 && (
              <div className="text-center py-8 text-muted-foreground border rounded-md">
                <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>Add animals to start batch weighing</p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBatchDialog(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleBatchSubmit} 
              disabled={batchRecordMutation.isPending || batchForm.records.length === 0}
            >
              {batchRecordMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Save {batchForm.records.filter(r => r.weight).length} Records
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Growth Detail Dialog */}
      <Dialog open={showGrowthDialog} onOpenChange={setShowGrowthDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Growth Analysis</DialogTitle>
          </DialogHeader>
          {loadingGrowth ? (
            <div className="py-8 text-center">
              <Loader2 className="h-8 w-8 animate-spin mx-auto" />
            </div>
          ) : growthData ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                <div>
                  <p className="font-medium text-lg">
                    {growthData.animal.cowId || growthData.animal.naitTag}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {growthData.animal.breed} • {growthData.animal.sex}
                  </p>
                </div>
                {growthData.growth && (
                  <div className="text-right">
                    <p className="text-2xl font-bold">{growthData.growth.lastWeight} kg</p>
                    <p className="text-sm text-muted-foreground">Current weight</p>
                  </div>
                )}
              </div>

              {growthData.growth && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 border rounded-lg">
                    <p className="text-sm text-muted-foreground">Total Gain</p>
                    <p className="text-xl font-bold text-green-600">
                      +{growthData.growth.totalGain} kg
                    </p>
                  </div>
                  <div className="p-3 border rounded-lg">
                    <p className="text-sm text-muted-foreground">Overall ADG</p>
                    <p className="text-xl font-bold text-purple-600">
                      {growthData.growth.overallADG} kg/day
                    </p>
                  </div>
                  <div className="p-3 border rounded-lg">
                    <p className="text-sm text-muted-foreground">Period</p>
                    <p className="text-xl font-bold">{growthData.growth.totalDays} days</p>
                  </div>
                  <div className="p-3 border rounded-lg">
                    <p className="text-sm text-muted-foreground">Records</p>
                    <p className="text-xl font-bold">{growthData.growth.recordCount}</p>
                  </div>
                </div>
              )}

              {growthData.records.length > 0 && (
                <div>
                  <Label className="text-muted-foreground">Weight History</Label>
                  <ScrollArea className="h-[200px] mt-2">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date</TableHead>
                          <TableHead>Weight</TableHead>
                          <TableHead>ADG</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {growthData.records.map((record) => (
                          <TableRow key={record.id}>
                            <TableCell>{format(new Date(record.date), "MMM d, yyyy")}</TableCell>
                            <TableCell>{parseFloat(record.weight).toFixed(1)} kg</TableCell>
                            <TableCell>
                              {record.adg !== null ? (
                                <span className={record.adg > 0 ? "text-green-600" : record.adg < 0 ? "text-red-600" : ""}>
                                  {record.adg > 0 ? "+" : ""}{record.adg.toFixed(2)} kg/day
                                </span>
                              ) : "—"}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                </div>
              )}
            </div>
          ) : (
            <div className="py-8 text-center text-muted-foreground">
              No growth data available
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
